---
'@galaxy-foundry/audit-citations': minor
---

Read a note's typed frontmatter as one citation, and stop counting resolution as verification.

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
