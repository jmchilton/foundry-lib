# @galaxy-foundry/license-policy

## 0.2.0

### Minor Changes

- [#28](https://github.com/jmchilton/foundry-lib/pull/28) [`d3c6cd4`](https://github.com/jmchilton/foundry-lib/commit/d3c6cd45e6a95e8c8a30d85d81cdb88d74d64613) Thanks [@jmchilton](https://github.com/jmchilton)! - Absorb two site helpers both Foundry instances had written twice.

  Additive only — no existing export changes.

  `license-policy` gains `loadLicenseFiles(dir)`, `findLicenseFile(dir, id)`,
  `licenseIdFromFile(path)` and `LICENSE_FILE_EXT`, plus the `LicenseFile` type. The table
  already declares a `license_file` obligation ("a verbatim copy must accompany the carry");
  this reads the copies that satisfy it, conventionally `LICENSES/<id>.LICENSE`. The two
  instances' readers were byte-identical, one of them carrying a comment admitting it was
  cribbed from the other.

  The directory is a parameter rather than a resolved `../LICENSES`. The callers are Astro
  pages whose cwd is a subdirectory, and an implicit relative path is precisely the thing that
  does not survive being shared.

  `wiki-links` gains `addBoldTermAnchors(html)` and `slugifyTerm(term)`. `parseWikiLink`
  already carries `#section` through to the href without asking whether anything answers to
  it; for a glossary rendered from loose markdown nothing does unless something mints the ids.
  That is the other half of the same contract, so it stops living in two site trees.

  **`slugifyTerm` is deliberately NOT `slugify`.** They diverge on spaced hyphens (`A - B` →
  `a---b` vs `a-b`), underscores (kept vs dropped) and repeated hyphens (kept vs collapsed).
  Both glossaries already carry ids minted by `slugifyTerm`, so unifying them would silently
  repoint every existing `#term` deep link — a break no build would catch. A test pins each
  divergent case.

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
