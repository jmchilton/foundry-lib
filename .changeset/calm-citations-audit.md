---
'@galaxy-foundry/audit-citations': minor
---

Add the experimental citation-integrity audit package: strict normalized schemas, configurable
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
verdict with a fabricated identifier.
