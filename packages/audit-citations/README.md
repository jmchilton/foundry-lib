# @galaxy-foundry/audit-citations

Extract scholarly citations from text artifacts, resolve them against public metadata providers,
and produce reproducible citation-integrity findings with exact source spans.

```sh
npm install @galaxy-foundry/audit-citations
```

> **Experimental contract:** this package is an intentional N=1 design extraction from the Bio
> Topology Foundry reference-audit spike. Its `0.x` schemas may change when a structurally different
> Foundry or skill repository becomes the second adopter. It does not establish a generic audit
> substrate, and S2/S3 checkers must not depend on citation-shaped types.

## The boundary

The library owns citation mechanics:

- strict schemas for scans, normalized evidence snapshots, adjudications, and audit runs;
- DOI, arXiv, PMID, and PMCID extraction and normalization;
- explicit Markdown bibliography extraction;
- provider interfaces plus Crossref, OpenAlex/arXiv, Europe PMC, and allowlisted citation-page
  resolvers;
- title, year, author-list, first-author, and cross-identifier comparison, separated into identity
  errors and publication-drift warnings;
- deterministic offline replay from normalized evidence;
- stale-safe manual adjudication; and
- machine-readable findings and a Markdown report.

The consuming repository owns its source paths, artifact kinds, enabled citation-page hosts,
reference-heading vocabulary, user-agent identity, output locations, and release policy.

The core accepts explicit `SourceDocument` values. Only the CLI discovers files, so a caller can
use the library without Git or a particular directory layout.

### Supported extraction forms

The experimental extractor intentionally recognizes a narrow, documented grammar:

- DOI strings beginning with `10.` and DOI URLs;
- modern arXiv identifiers such as `2401.00001`, optionally versioned, when introduced by
  `arXiv:` or an `arxiv.org/abs|pdf/` URL;
- five-to-nine digit PMID values introduced by `PMID:` or a PubMed URL;
- `PMC` followed by five-to-nine digits;
- allowlisted scholarly-page URLs whose paths end in `.html`; and
- single-line, numbered Markdown bibliography entries under a configured reference heading, with
  either a quoted title or the supported `authors. title. ... year` shape; the author blob is split
  on `,`, `;`, `&`, and `and`, rejoining an initials-only fragment with the name before it.

Any other non-blank line under a reference heading is counted as unextracted and reported as
missing coverage rather than passed over silently.

Old-style arXiv identifiers, shorter historical PMIDs, bullet-list or wrapped bibliography
entries, and arbitrary scholarly URLs are not currently extracted. Author–year prose such as
`Smith et al. (2024)` is counted as a diagnostic only; it never becomes a citation candidate.

## Data flow

```text
instance config ──> CLI filesystem adapter ──> SourceDocument[]
                                                   │
                                                   ▼
                                            extractCitations
                                                   │
                                            CitationScan
                                                   │
                    normalized cache ─────> collectEvidence <──── provider resolver
                                                   │
                                      CitationEvidenceSnapshot
                                                   │
                          adjudications ──> buildCitationAuditRun
                                                   │
                                             CitationAuditRun
                                                   │
                                      JSON output + Markdown report
```

Evidence acquisition and evaluation remain separate. A timeout is `unavailable`; a completed
lookup with no record is `unresolved`; a resolved record describing another work is
`resolved-mismatched`.

Comparison results are typed mismatches carrying a severity. An `error` disputes the identity of
the cited work; a `warning` records ordinary publication drift, such as a preprint that later
acquired a journal year. Only errors make a citation a finding, so drift stays visible without
demanding review beside a wrong author.

The report states extraction coverage — how many reference-section lines produced a candidate —
next to the verdict counts, because a resolution rate describes only the citations the extractor
could read. It also rolls findings up per artifact, since several flagged citations in one document
is a stronger signal than the same number spread across a corpus.

## Library usage

```ts
import {
  ScholarlyResolver,
  buildCitationAuditRun,
  collectEvidence,
  extractCitations,
  renderCitationAuditMarkdown,
} from '@galaxy-foundry/audit-citations';

const scan = extractCitations(
  [
    {
      path: 'research/paper.md',
      artifactKind: 'research-note',
      text: markdown,
    },
  ],
  { scholarlyPageHosts: ['proceedings.mlr.press'] },
);

const collected = await collectEvidence(scan.candidates, cachedEvidence, {
  refresh: true,
  resolver: new ScholarlyResolver({
    userAgent: 'example-audit/1.0 (https://example.org/contact)',
    scholarlyPageHosts: ['proceedings.mlr.press'],
  }),
});

const run = buildCitationAuditRun(scan, collected.snapshot, { adjudications });
const markdownReport = renderCitationAuditMarkdown(run, collected.snapshot);
```

Omit `refresh` and the resolver to replay from the evidence snapshot. A missing cached query becomes
`unavailable`; it is never silently interpreted as a nonexistent citation.

`collectEvidence` returns both `snapshot` and `cache`. Persist `cache`, which retains evidence for
queries no current candidate references; pass `snapshot`, which holds exactly the evidence the
candidates reference, to `buildCitationAuditRun` and `renderCitationAuditMarkdown` so a run's
identity does not depend on the cache's history.

The main entry point never touches the filesystem. The glob and `git` adapter that turns a config
file into `SourceDocument[]` lives behind a subpath, so importing the library does not pull in
`fast-glob` or `node:child_process`:

```ts
import {
  loadCitationAuditConfig,
  loadConfiguredDocuments,
} from '@galaxy-foundry/audit-citations/config';
```

## CLI

Create `audit-citations.config.json` in the consuming repository:

```json
{
  "schemaVersion": 1,
  "trackedOnly": true,
  "sources": [
    {
      "include": ["content/papers/*.md"],
      "artifactKind": "paper-note"
    },
    {
      "include": ["content/packages/*.md"],
      "artifactKind": "package-note"
    }
  ],
  "referenceHeadingTerms": ["references", "source note"],
  "scholarlyPageHosts": ["proceedings.mlr.press", "proceedings.neurips.cc"],
  "userAgent": "my-foundry-citation-audit/1.0 (https://example.org/contact)"
}
```

`include` and `exclude` are always matched as globs. `trackedOnly` intersects that match with
`git ls-files`, so it only ever narrows the corpus — it never reinterprets the patterns as git
pathspecs, which would widen them (a pathspec `*` crosses directory separators; a glob `*` does
not).

Extract without network access:

```sh
foundry-audit-citations scan \
  --config audit-citations.config.json \
  --output build/citation-scan.json
```

Refresh evidence and audit:

```sh
foundry-audit-citations audit \
  --config audit-citations.config.json \
  --refresh \
  --evidence audit/provider-evidence.json \
  --output build/citation-audit.json \
  --markdown build/citation-audit.md
```

Omit `--refresh` for offline replay. Use `--candidate-source` for a historical scan and
`--adjudications` for a separately persisted manual-review document. CLI outputs, including each
incremental evidence-cache checkpoint during refresh, are written through a same-directory
temporary file and atomic rename so interruption cannot expose truncated JSON.

## Wire documents

All persisted documents are strict, versioned JSON contracts. Unknown fields are rejected.

- `CitationScan` contains normalized candidates and extractor diagnostics.
- `CitationEvidenceSnapshot` contains each normalized provider query once.
- `CitationAdjudications` binds review decisions to both candidate ID and exact source digest.
- `CitationAuditRun` contains candidates and lightweight findings that reference evidence IDs; it
  does not duplicate provider metadata inside every finding.

A candidate ID is stable across unrelated line movement because it derives from artifact path,
source text, and same-text occurrence ordinal. `sourceDigest` detects a changed citation before an
old adjudication can be reused. Corpus provenance records the candidate digest separately from Git
`headRevision` and `workingTreeDirty`.

See the rendered [architecture and schema notes](https://jmchilton.github.io/foundry-lib/#/architecture/audit-citations)
for entity relationships, ownership, and compatibility rules.

## What this package does not do

- It does not decide whether the cited source supports the surrounding claim.
- It does not validate tools, APIs, command flags, or numeric thresholds.
- It does not define a repository-wide release gate or composite score.
- It does not contain Foundry-specific source paths or artifact kinds.
- It does not escalate an unresolved citation to a language model or a web search. That tier cannot
  be replayed, so it belongs to a consuming repository rather than to this package.
- It does not create `audit-base` or `audit-schemas`; those boundaries must be earned by another
  checker rather than inferred from citation terminology.

## License

MIT
