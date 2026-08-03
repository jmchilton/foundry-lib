# Citation audit architecture and schemas

`@galaxy-foundry/audit-citations` is the first deliberately experimental package in
`foundry-lib`. It exists to make the citation-audit boundary inspectable before a second adopter
has stabilized it. Experimental status permits revision; it does not permit hidden instance
policy.

## Ownership boundary

| Concern                             | Package                   | Consuming repository       |
| ----------------------------------- | ------------------------- | -------------------------- |
| Citation wire schemas and parsers   | owns                      | consumes                   |
| Source files and directory layout   | does not own              | declares                   |
| Artifact-kind vocabulary            | carries as opaque strings | declares                   |
| DOI/arXiv/PMID/PMCID grammar        | owns                      | enables through extraction |
| Bibliography heading vocabulary     | supplies a default        | may override               |
| Provider response normalization     | owns                      | selects refresh timing     |
| Citation-page host trust            | enforces allowlist        | declares hosts             |
| Adjudication format and stale check | owns                      | performs review            |
| Release or acceptance policy        | does not own              | declares                   |

The library entry point receives `SourceDocument[]`. It never searches a repository, and it does not
pull the glob or `git` machinery into consumers: the filesystem adapter lives behind the
`@galaxy-foundry/audit-citations/config` subpath. That adapter turns configured glob rules into
explicit documents, and `trackedOnly` intersects the result with `git ls-files` rather than matching
through git. Git pathspecs and globs disagree—a pathspec `*` crosses directory separators—so one
matcher decides membership and `trackedOnly` only ever narrows the corpus.

## Component flow

```text
┌───────────────────── consuming repository ─────────────────────┐
│ source rules · artifact kinds · heading terms · trusted hosts  │
└────────────────────────────┬────────────────────────────────────┘
                             │ CitationAuditConfig
                             ▼
┌──────────────┐       ┌───────────────┐       ┌────────────────┐
│ CLI adapter  │──────>│   extractor   │──────>│ CitationScan   │
│ files + Git  │ docs  │ identifiers + │       │ candidates +   │
└──────────────┘       │ bibliography  │       │ diagnostics    │
                       └───────────────┘       └───────┬────────┘
                                                      │ queries
                         ┌────────────────────────────┼───────────────┐
                         ▼                            ▼               ▼
                  ┌────────────┐              ┌────────────┐  ┌────────────┐
                  │ normalized │<────────────>│ resolver   │  │ offline    │
                  │ evidence   │              │ providers  │  │ replay     │
                  └──────┬─────┘              └────────────┘  └────────────┘
                         │ evidence IDs
                         ▼
                  ┌────────────┐     ┌────────────────┐
                  │ evaluator  │<────│ adjudications  │
                  └──────┬─────┘     └────────────────┘
                         ▼
                  ┌──────────────────┐
                  │ CitationAuditRun │───> JSON + Markdown
                  └──────────────────┘
```

Extraction, evidence acquisition, evaluation, and review are separate phases. This prevents a
provider outage from becoming an `unresolved` citation and prevents manual review from rewriting
the evidence that prompted it.

The extractor currently accepts modern arXiv IDs, five-to-nine digit PMID/PMCID forms, DOI strings,
allowlisted `.html` scholarly pages, and single-line numbered bibliography entries. Old-style
arXiv IDs, shorter historical PMIDs, bullet or wrapped bibliographies, and general scholarly URLs
remain outside the experimental grammar. Free-form author–year prose is measured only as an
extractor diagnostic and is never promoted to a candidate.

## Entity relationships

```text
CitationScan
  └─ candidates[]: CitationCandidate
       ├─ id
       ├─ span: ArtifactSpan
       ├─ identifiers[]: CitationIdentifier
       └─ described?: DescribedCitation

CitationEvidenceSnapshot
  └─ evidence[]: CitationEvidence
       ├─ id
       ├─ query: identifier | bibliographic
       ├─ provider + state + observedAt
       ├─ metadata?: ScholarlyMetadata
       └─ locator/error

CitationAuditRun
  ├─ candidates[]
  ├─ findings[]: candidateId + evidenceIds[] + verdict
  ├─ adjudications[]: candidateId + sourceDigest + decision
  ├─ corpus/evidence digests
  └─ partitions and extractor diagnostics
```

`collectEvidence` returns two snapshots. `cache` is everything known, including evidence no current
candidate references, and is what belongs on disk. `snapshot` is exactly the evidence the supplied
candidates reference, so `evidenceSnapshotDigest` identifies the run rather than the cache's
history: the same corpus digests identically whether or not the cache has accumulated evidence for
citations that have since been deleted.

The normalized shape is intentional. Evidence appears once in the snapshot and findings reference
it by ID. A run retains its candidate snapshot so a repaired source tree can still replay a
historical baseline without copying provider metadata into every row.

## Identity and staleness

Three identities answer different questions:

- `CitationCandidate.id` identifies an occurrence across unrelated line movement. It hashes the
  artifact path, exact source text, and ordinal among identical lines in that artifact.
- `ArtifactSpan.sourceDigest` proves the reviewed text has not changed. An adjudication with a
  different digest is rejected.
- `CitationAuditRun.corpus.digest` identifies the complete ordered candidate set. Git provenance is
  recorded separately because a worktree can be dirty when an audit runs.

This avoids both failure modes of a line-number ID: harmless insertions do not invalidate review,
and substantive citation edits cannot silently inherit an old decision.

## State and verdict are not the same field

Provider evidence has three states:

- `resolved`: normalized metadata was observed;
- `unresolved`: the provider completed the query and found no record; and
- `unavailable`: the query could not be evaluated because evidence or infrastructure was absent.

A successful HTTP status is not sufficient for `resolved`: normalized metadata must contain a
nonblank title, and identifier lookups must return the requested DOI, arXiv-derived DOI, PMID, or
PMCID. Malformed or identity-inconsistent provider payloads are `unavailable`, while the arXiv
resolver may continue to its Atom-feed fallback.

Bibliographic lookup is a search, not a registry read, and search coverage varies by venue, year,
and publication type — DBLP indexes computer-science conference proceedings that Crossref covers
unevenly, for instance. A title is therefore searched across Crossref, OpenAlex, Semantic Scholar,
and DBLP in turn until one resolves it, and absence from a single index is not treated as evidence
that the work does not exist. Identifier lookups do not fan out this way: they read a registry that
is authoritative for the identifier.

A single provider missing a record is not the same as no record existing. Crossref registers most
scholarly DOIs but not all of them — DataCite covers deposited datasets and software, and further
agencies cover their own regions and disciplines — so a DOI Crossref does not know is retried
through content negotiation, which resolves it through whichever agency registered it. Only a DOI
no agency recognizes is `unresolved`, and a second check that could not run leaves the citation
`unavailable` rather than borrowing the first provider's miss. Incremental evidence checkpoints use atomic file
replacement so an interrupted refresh leaves either the prior valid snapshot or the next one.

The citation evaluator produces four verdicts:

- `resolved`;
- `resolved-mismatched`;
- `unresolved`; and
- `unavailable`.

Every resolved identifier is compared. One good DOI cannot hide a second identifier resolving to a
different work.

Comparison produces mismatches, not free text, and each carries a severity. An `error` disputes the
identity of the cited work: a title that describes something else, a first author who does not
appear, an author list mostly absent from the record, or two identifiers resolving to different
works. A `warning` records ordinary publication drift, currently a differing year. Only errors make
a citation `resolved-mismatched`, so a preprint that later acquired a journal year — and an arXiv
deposit year read as a publication year — stay visible without entering the manual-review queue
beside a fabricated author.

Author comparison abstains rather than guessing. Two author lists are compared only as deep as the
shorter one reaches, because a provider that stores three of thirty authors is not evidence of a
fabricated list, and below three compared names the check abstains unless every name matches, since
one wrong name out of two is a transcription slip. The leading name is still compared separately in
that case.

## Coverage is part of the result

A resolution rate describes only the citations the extractor could read. The scan therefore records
every non-blank line inside a reference section that produced no candidate, and the report states
extraction coverage beside the verdict counts. A wrapped entry contributes one line per physical
line, so the figure is a lower bound.

Escalating an unresolved citation to a web search would need a language model, which would make a
run irreproducible. That tier belongs to a consuming repository, above this package's boundary.

Manual classification remains orthogonal. `extractor-false-positive` removes an occurrence from
the citation denominator; `resolver-false-positive` supplies an explicit effective verdict; and
`confirmed-finding` preserves the machine result with a review note.

## Compatibility

Every wire document carries `schemaVersion: 1`; readers reject unknown fields and unsupported
versions. During the experimental `0.x` phase, a breaking schema correction is permitted only with:

1. a migration note;
2. updated synthetic fixtures and parsers;
3. a Bio Topology Foundry migration; and
4. an explanation of what the exercised corpus disproved about the previous shape.

The package must not turn citation-specific fields into generic audit vocabulary merely to prepare
for S2 or S3. A later `audit-base` or `audit-schemas` package should be extracted only after an
independent tool or threshold checker produces an identical lifecycle contract.
