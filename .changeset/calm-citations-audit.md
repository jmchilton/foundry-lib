---
'@galaxy-foundry/audit-citations': minor
---

Add the experimental citation-integrity audit package: strict normalized schemas, configurable
Markdown extraction, scholarly provider resolution, offline evidence replay, stale-safe manual
adjudication, partitioned reporting, and the `foundry-audit-citations` CLI. The glob and `git`
filesystem adapter is exported separately as `@galaxy-foundry/audit-citations/config`, so the main
entry point stays a pure function of the documents the caller supplies.
