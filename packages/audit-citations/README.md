# @galaxy-foundry/audit-citations

Extract scholarly citations from text artifacts, resolve them against public metadata providers,
and produce reproducible citation-integrity findings with exact source spans.

```sh
npm install @galaxy-foundry/audit-citations zod@^4
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
- provider interfaces plus Crossref, DOI content negotiation, OpenAlex/arXiv, Europe PMC, Semantic
  Scholar, DBLP, and allowlisted citation-page resolvers;
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

- DOI strings beginning with `10.` and DOI URLs, percent-decoded, because a DOI containing
  parentheses has to be encoded to survive a Markdown link;
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

### Typed note frontmatter

A source note records the work it summarizes in _fields_, not sentences: one prose field carries
the bibliographic record while separate typed fields carry the identifiers. Read line by line the
two halves never meet. The identifier lines describe nothing, so they can report only that the
identifier exists; the description line names no identifier in a form the prose grammar finds. A
wrong DOI four lines below the title that would expose it comes back `resolved`.

Declaring the fields makes one frontmatter block one citation:

```json
{
  "noteFrontmatter": {
    "descriptionField": "citation",
    "identifierFields": ["doi", "arxiv", "pmid", "pmcid"]
  }
}
```

A field's **name is the identifier's kind**. That is not a shortcut — a bare `1912.04135` has no
prefix for a grammar to recognize, and an arXiv id and a PMID are both just digits, so a kind
inferred from shape is a kind guessed wrong eventually. `identifierFields` is a closed set for the
same reason: an unrecognized name would be read as ordinary text and its identifier silently never
seen.

Names are matched as leaf keys at any depth, so a nested `source_ids: { doi: ... }` needs no path
and no YAML parser. Values are read as plain scalars, quoted or not. Identifiers written as prose
or as URLs elsewhere in the block are collected too, and every identifier in the block is
attributed to the one work the block describes — which is what lets the cross-evidence comparison
check that a note's DOI and its arXiv id name the same paper.

A block carrying no identifier at all produces no candidate, even when it describes a work. A note
whose typed frontmatter says the source has no identifier — a web chapter, a package reference
manual, an unpublished draft — has made an assertion, and resolving its description by title would
ask a provider to guess at a record the note already said does not exist. The guess arrives as an
unresolved or mismatched citation in a note that is correct, which is the expensive direction. A
numbered bibliography entry keeps the title fallback: there a missing DOI is an absence, not a
declaration.

The option is opt-in. Without it, frontmatter is ordinary text and is extracted exactly as before.

### Resolved is not verified

Identity comparison runs against a described title, so a candidate that names an identifier but
describes no work resolves and can produce no mismatch. It is unfalsifiable, not correct. Those
findings carry `verifiable: false`, the run summary counts them as `resolvedUnverified`, and the
report states the split rather than folding them into one headline that reads as a fully verified
corpus.

## Data flow

![Citation audit pipeline from repository configuration through extraction, normalized evidence, evaluation, and JSON and Markdown reports.](https://raw.githubusercontent.com/jmchilton/foundry-lib/main/docs/assets/diagrams/audit-citations-flow.svg)

Evidence acquisition and evaluation remain separate. A timeout is `unavailable`; a completed
lookup with no record is `unresolved`; a resolved record describing another work is
`resolved-mismatched`.

Every request carries its own deadline, covering the response body as well as the connection, so a
provider that answers and then stalls mid-stream cannot hang a run. It defaults to 15 seconds and is
set with `requestTimeoutMs`. The deadline is enforced by the resolver rather than delegated to the
transport, because a caller-supplied `fetch` may ignore the abort signal it is given.

A DOI Crossref does not register — a deposited dataset or software release, for instance — is
retried through DOI content negotiation, which resolves it through whichever agency registered it.
Only a DOI no agency recognizes becomes `unresolved`.

A title without an identifier is searched across Crossref, OpenAlex, Semantic Scholar, and DBLP in
turn, because search coverage varies by venue, year, and publication type. If any of those indexes
could not be reached and none resolved the title, the result is `unavailable` rather than
`unresolved`: the index that would have recognized it may be the one that failed.

Comparison results are typed mismatches carrying a severity. An `error` disputes the identity of
the cited work; a `warning` records ordinary publication drift, such as a preprint that later
acquired a journal year. Only errors make a citation a finding, so drift stays visible without
demanding review beside a wrong author.

The report states extraction coverage — how many reference-section lines produced a candidate —
next to the verdict counts, because a resolution rate describes only the citations the extractor
could read. It also rolls findings up per artifact, since several flagged citations in one document
is a stronger signal than the same number spread across a corpus.

## Library usage

A caller with no configuration file supplies documents and options directly:

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

### From a configuration file

The main entry point never touches the filesystem. The glob and `git` adapter that turns a config
file into `SourceDocument[]` lives behind a subpath, so importing the library does not pull in
`fast-glob` or `node:child_process`:

```ts
import {
  citationExtractionOptions,
  loadCitationAuditConfig,
  loadConfiguredDocuments,
  scholarlyResolverOptions,
} from '@galaxy-foundry/audit-citations/config';

// The directory the configured globs are relative to.
const root = '.';

const config = await loadCitationAuditConfig('audit-citations.config.json');
const scan = extractCitations(
  await loadConfiguredDocuments(root, config),
  citationExtractionOptions(config),
);
const resolver = new ScholarlyResolver(scholarlyResolverOptions(config));
```

Translate a config into options with those two functions rather than by hand. The mapping has more
than one caller — the CLI is one, and any consumer that replays its own audit is another — and a
field one caller forgets is not a missing feature but a report written by reading the corpus one way
and checked by reading it another, with both runs green. Every configuration field either selects
the corpus, through `loadConfiguredDocuments`, or governs how a document is read, through these
two; a test in the package holds that partition, so a new field cannot arrive without reaching the
callers it belongs to.

### Replaying a committed report

The audit's outputs are meant to be committed, and a committed report is only worth as much as the
check that it still follows from its evidence. Because evaluation is separate from acquisition, a
consumer can rebuild the whole run offline — same config, same corpus, same evidence snapshot, no
network — and assert the result equals what is checked in. That turns the report into a tested
artifact: an edited citation, a changed heading, a hand-touched JSON file, or a stale evidence
entry fails the consumer's ordinary test run rather than waiting for the next refresh.

Replay by omitting `refresh` and the resolver, and replay `generatedAt` and Git provenance from the
committed run rather than restamping them — they record when a run happened, and comparing them as
content fails on every unrelated commit while hiding nothing.

## CLI

The npm package publishes `foundry-audit-citations` as a standalone Node.js CLI. It does not require
Astro, a Foundry repository, or any other `@galaxy-foundry` package. Git is optional and is consulted
only when the configuration enables `trackedOnly`.

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
  "userAgent": "my-foundry-citation-audit/1.0 (https://example.org/contact)",
  "requestTimeoutMs": 15000
}
```

Install the package in the repository as shown above, or run the scan once without adding a
dependency:

```sh
npx --yes \
  --package=@galaxy-foundry/audit-citations \
  --package=zod@^4 \
  foundry-audit-citations scan \
  --config audit-citations.config.json \
  --output build/citation-scan.json
```

`include` and `exclude` are always matched as globs. `trackedOnly` intersects that match with
`git ls-files`, so it only ever narrows the corpus — it never reinterprets the patterns as git
pathspecs, which would widen them (a pathspec `*` crosses directory separators; a glob `*` does
not).

Extract without network access:

```sh
npx foundry-audit-citations scan \
  --config audit-citations.config.json \
  --output build/citation-scan.json
```

Refresh evidence and audit:

```sh
npx foundry-audit-citations audit \
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
