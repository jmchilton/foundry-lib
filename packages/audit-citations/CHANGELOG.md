# @galaxy-foundry/audit-citations

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
