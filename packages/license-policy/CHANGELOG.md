# @galaxy-foundry/license-policy

## 0.1.1

### Patch Changes

- [#5](https://github.com/jmchilton/foundry-lib/pull/5) [`f36be24`](https://github.com/jmchilton/foundry-lib/commit/f36be24e0a935f41372ba206e10b2ae0d7a6cc3f) Thanks [@jmchilton](https://github.com/jmchilton)! - Assert three more invariants on the shipped table: an own-words-only row may not permit
  `sidecar` either, a verbatim-ok row must require its `license_file`, and no row may permit
  nothing at all.

  Tests only — the table and the loader are unchanged. These were being asserted in an
  instance's own suite against its hand-mirrored copy; they are properties of the shipped
  table, so they move here rather than being deleted along with that copy.

## 0.1.0

### Minor Changes

- [`febdb87`](https://github.com/jmchilton/foundry-lib/commit/febdb874cec407f86ce5d7b97092da4ca7c51569) Thanks [@jmchilton](https://github.com/jmchilton)! - Initial release: the shared license → redistribution-policy table plus its loader.

  Ships the 268-line table (23 curated SPDX rows, a deny-by-default `default` row, five
  `global_rules`) that two Foundry instances previously kept as hand-mirrored copies, together
  with `bundledPolicy()`, strict parsing/validation, id resolution, and `bundledPolicyText()`
  for conformance-testing a local copy.

  Deliberately excludes license _coherence_ rules — the two instances enforce genuinely
  different ones today, so those stay instance-local until they converge.
