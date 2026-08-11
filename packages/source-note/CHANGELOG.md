# @galaxy-foundry/source-note

## 0.2.1

### Patch Changes

- Updated dependencies [[`c80ef27`](https://github.com/jmchilton/foundry-lib/commit/c80ef2725d03d300eb4d3b18398f06442f2f617d)]:
  - @galaxy-foundry/license-policy@0.7.0

## 0.2.0

### Minor Changes

- [#110](https://github.com/jmchilton/foundry-lib/pull/110) [`eaa40e0`](https://github.com/jmchilton/foundry-lib/commit/eaa40e04b9d2a74086635f1fb32384c9893b1772) Thanks [@jmchilton](https://github.com/jmchilton)! - Add `not-read` to `SOURCE_READ_LEVELS`.

  The first corpus migrated onto the contract has two notes whose source was never read: a
  citation-accuracy note built from CrossRef and PubMed metadata, and a note assembled from open
  surrogates because the primary is paywalled. Both are source notes; neither read the source, and
  the nearest existing level, `abstract-only`, would assert a read that never happened.

## 0.1.0

### Minor Changes

- [#106](https://github.com/jmchilton/foundry-lib/pull/106) [`8abd703`](https://github.com/jmchilton/foundry-lib/commit/8abd703a03af0909fa62984e3db347dba6238cfc) Thanks [@jmchilton](https://github.com/jmchilton)! - Add `@galaxy-foundry/source-note`, the frontmatter contract for a note that summarizes an external
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

### Patch Changes

- Updated dependencies [[`8abd703`](https://github.com/jmchilton/foundry-lib/commit/8abd703a03af0909fa62984e3db347dba6238cfc)]:
  - @galaxy-foundry/license-policy@0.6.0
