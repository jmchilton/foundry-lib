# @galaxy-foundry/license-policy

## 0.1.0

### Minor Changes

- [`febdb87`](https://github.com/jmchilton/foundry-lib/commit/febdb874cec407f86ce5d7b97092da4ca7c51569) Thanks [@jmchilton](https://github.com/jmchilton)! - Initial release: the shared license → redistribution-policy table plus its loader.

  Ships the 268-line table (23 curated SPDX rows, a deny-by-default `default` row, five
  `global_rules`) that two Foundry instances previously kept as hand-mirrored copies, together
  with `bundledPolicy()`, strict parsing/validation, id resolution, and `bundledPolicyText()`
  for conformance-testing a local copy.

  Deliberately excludes license _coherence_ rules — the two instances enforce genuinely
  different ones today, so those stay instance-local until they converge.
