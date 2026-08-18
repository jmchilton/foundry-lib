# @galaxy-foundry/audit-base

## 0.1.0

### Minor Changes

- [#129](https://github.com/jmchilton/foundry-lib/pull/129) [`024e6e3`](https://github.com/jmchilton/foundry-lib/commit/024e6e395ba3023ebec2b16977218895ee5b4c3f) Thanks [@jmchilton](https://github.com/jmchilton)! - Extract the audit lifecycle two independent checkers arrived at separately.

  `audit-citations` entered as an experimental N=1 design extraction whose own admission note said its
  citation types were not evidence that a tool or threshold check shared a base schema, and that any
  `audit-base` had to pass the normal admission test after a second checker existed. That checker now
  exists — the Bio Topology Foundry's environment runtime-claim audit — and this package is the
  result.

  It ships the lifecycle and none of the vocabulary: a digest-bound `artifactSpanSchema`, corpus
  identity, the severity pair, the three adjudication classifications, an `adjudicationSchema` built
  against the consumer's own verdicts, and `adjudicationProblems`. Two of its files were byte-identical
  in both implementations before extraction.

  Verdict and evidence-state vocabularies, extraction, reporting, evidence acquisition, and claim-id
  minting stay with the checker. Where the two implementations disagree — whether a retired decision
  stops a run — the package detects and the consumer decides.
