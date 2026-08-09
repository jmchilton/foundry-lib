---
'@galaxy-foundry/source-note': minor
'@galaxy-foundry/license-policy': minor
---

Add `@galaxy-foundry/source-note`, the frontmatter contract for a note that summarizes an external
work, and give `license-policy` the closed posture vocabulary it was matching by pattern.

Two instances had written this field set independently, with four copies of the licence-coherence
rule between them. They had also fused four questions into one `attribution` string — which work
this is, what notice its licence obliges, how much of it was read, and what it is addressable by —
so the halves a resolver can check could only be reached by parsing them back out of the half it
cannot. Each is now its own field, and `source_ids` and `source_license` are discriminated unions,
because "nobody looked" and "we looked and there is none" are different claims.

`SUMMARY_POSTURES` names the two postures a source note may declare. `license-aware-summary`,
`license-aware-with-quotes`, and `faithful-summary-with-quotes` were three spellings of one of
them, which is why `declaresVerbatimCarry` was a regular expression over free text; it now reads
the canonical postures exactly and keeps the pattern only for a Cast ref, whose `derived` may be
absent or free prose. Neither canonical name says "license-aware": every posture is, and labelling
one of them so is what let the vocabulary sprawl.
