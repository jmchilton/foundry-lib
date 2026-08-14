# @galaxy-foundry/audit-citations

## 0.2.1

### Patch Changes

- [#123](https://github.com/jmchilton/foundry-lib/pull/123) [`b305cfb`](https://github.com/jmchilton/foundry-lib/commit/b305cfb2fbc2e2d73b94fde939326a2590184195) Thanks [@jmchilton](https://github.com/jmchilton)! - Stop turning a declared absence of identifiers into a citation to resolve.

  A source note may describe a source that has no identifier at all — a chapter of a web textbook, a
  package reference manual, an unpublished working paper — and say so in its typed frontmatter.
  `noteFrontmatter` read the description anyway and emitted a candidate with no identifiers, which
  falls back to a title query. That asks a provider to guess at a record the note has already stated
  does not exist, and the guess comes back as an unresolved or mismatched citation against a note that
  is correct.

  A frontmatter block now produces a candidate only when it names at least one identifier. A numbered
  bibliography entry is unchanged: there a missing DOI is an absence rather than a declaration, and
  the title fallback is the only way to check it at all.

  Adopting corpora will see those candidates leave the run. Regenerate the committed report; no
  evidence is invalidated.

## 0.2.0

### Minor Changes

- [#115](https://github.com/jmchilton/foundry-lib/pull/115) [`5844c00`](https://github.com/jmchilton/foundry-lib/commit/5844c009915e781a3246381f36d79e64935c00fd) Thanks [@jmchilton](https://github.com/jmchilton)! - Read a note's typed frontmatter as one citation, and stop counting resolution as verification.

  A source note keeps the two halves of a citation in adjacent fields: `citation` describes the work,
  typed fields name it. Line-oriented extraction never joined them, so the description resolved
  nothing and the identifiers described nothing — and a candidate that describes nothing cannot
  mismatch, so a wrong DOI four lines below its own title came back `resolved`.

  `noteFrontmatter` declares where those fields are, turning one frontmatter block into one
  checkable citation and reaching bare `arxiv`/`pmid`/`pmcid` values that no prose grammar can see.
  It is opt-in; unset, frontmatter is extracted exactly as before.

  Findings now carry `verifiable`, the summary counts `resolvedUnverified`, and the report separates
  citations verified against a described work from identifiers that merely resolved. Both are
  additive schema fields: a committed run regenerates rather than migrates.

## 0.1.2

### Patch Changes

- [#100](https://github.com/jmchilton/foundry-lib/pull/100) [`95f99db`](https://github.com/jmchilton/foundry-lib/commit/95f99db8c3b7b3f1befad4e382257b571f62cbdf) Thanks [@jmchilton](https://github.com/jmchilton)! - Read two citation forms that were previously reported as defects in correct notes.

  A DOI containing parentheses must be percent-encoded to survive a Markdown link, since an unescaped
  closing parenthesis would end it. Extraction stopped at the first escape and queried a truncated
  DOI that no agency registers, reporting a correctly cited work as unresolved. DOI matching now
  accepts `%` and decodes the identifier, keeping it as written when it holds a literal `%` that
  `decodeURIComponent` rejects.

  Vancouver style writes given names as an unpunctuated run after the family name — `Domingos AI`
  against a provider's `Ana I Domingos`. The run normalized to a single token that matched nothing,
  so three correctly cited authors read as a fabricated list. A name is now compared with such a run
  expanded into one token per letter, refused for a leading token and for a name with no lowercase
  letter anywhere, so that a short family name in capitals is not mistaken for initials.

## 0.1.1

### Patch Changes

- [#52](https://github.com/jmchilton/foundry-lib/pull/52) [`26d830d`](https://github.com/jmchilton/foundry-lib/commit/26d830d852c2ba0148f61bfb89ef04eee08d973d) Thanks [@jmchilton](https://github.com/jmchilton)! - Point reference-contract term documentation at the rendered Foundry Pattern page, and correct
  site-kit's peer metadata to the Pagefind 2 component contract its shipped Astro source uses.
  Replace audit-citations' text pipeline with the accessible SVG used by the architecture guide.

  The Pagefind range correction excludes no published compatible version: `astro-pagefind` moved from
  1.8.6 directly to 2.0.0, so the former `>=1.9` range already resolved only to 2.x releases.

- [#50](https://github.com/jmchilton/foundry-lib/pull/50) [`df6b089`](https://github.com/jmchilton/foundry-lib/commit/df6b089d81d3d13561e85cbd2c7abe29de2273ac) Thanks [@jmchilton](https://github.com/jmchilton)! - Run the packaged `foundry-audit-citations` command when a package manager invokes it through its
  `.bin` symlink. The direct-execution guard now compares real paths instead of mistaking the symlink
  for an import and exiting successfully without producing output.

## 0.1.0

### Minor Changes

- [#36](https://github.com/jmchilton/foundry-lib/pull/36) [`4dd2763`](https://github.com/jmchilton/foundry-lib/commit/4dd27630f1fea43b11062d7533cead0c321212f4) Thanks [@jmchilton](https://github.com/jmchilton)! - Add the experimental citation-integrity audit package: strict normalized schemas, configurable
  Markdown extraction, scholarly provider resolution, offline evidence replay, stale-safe manual
  adjudication, partitioned reporting, and the `foundry-audit-citations` CLI. The glob and `git`
  filesystem adapter is exported separately as `@galaxy-foundry/audit-citations/config`, so the main
  entry point stays a pure function of the documents the caller supplies.

  Comparison results are typed mismatches carrying an `error` or `warning` severity, so publication
  drift no longer enters the manual-review queue beside a disputed identity. Author lists are split
  and compared with an overlap check that abstains rather than guessing on short or truncated lists.
  Reference-section lines the extractor could not read are recorded, and the report states extraction
  coverage and per-artifact findings alongside the verdict counts. A DOI Crossref does not register
  is retried through DOI content negotiation, so a deposited dataset no longer shares the unresolved
  verdict with a fabricated identifier. Bibliographic lookup searches Crossref, OpenAlex, Semantic
  Scholar, and DBLP in turn, and reports a citation as unavailable rather than unresolved when an
  index could not be reached. Every provider request runs under a configurable deadline that covers
  the response body as well as the connection, so a provider that stalls mid-stream becomes an
  unavailable citation instead of a hung run.

## 0.0.0

Experimental package; no published release yet.
