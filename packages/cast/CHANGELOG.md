# @galaxy-foundry/cast

## 0.2.0

### Minor Changes

- [#39](https://github.com/jmchilton/foundry-lib/pull/39) [`a708bce`](https://github.com/jmchilton/foundry-lib/commit/a708bcee7e131b92a0eebde8493f55e0650e3f9f) Thanks [@jmchilton](https://github.com/jmchilton)! - New package: the deterministic half of casting.

  Bundle placement (`bundle_path` resolution against a target's `_target.yml`), drift
  reconciliation with a `--check` mode that writes nothing, content hashing, the provenance
  record's shape at schema version 4, and enforcement of the license → redistribution-policy
  table over an assembled cast.

  Extracted from `galaxyproject/foundry`, where each piece already had a second caller — the
  caster, the verifier, the pipeline assembler and the site all needed to agree on where a
  bundle lives, and the drift decision had been written seven times across two commands with
  four different wordings for the same fault.

  Only one instance casts today, so this is N=1 by construction. It ships ahead of a second
  implementation because that instance's 54 committed bundles are a byte-identity oracle: the
  extraction is verified by re-deriving every one of them and requiring the bytes not to move.
  Adoption by a second Foundry is the test of whether the boundary is in the right place.
