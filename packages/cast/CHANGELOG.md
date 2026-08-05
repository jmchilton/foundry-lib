# @galaxy-foundry/cast

## 0.5.0

### Minor Changes

- [#55](https://github.com/jmchilton/foundry-lib/pull/55) [`2d72821`](https://github.com/jmchilton/foundry-lib/commit/2d728218809e0446bf4de60d197b5746bc476ba5) Thanks [@jmchilton](https://github.com/jmchilton)! - Give provenance one extension slot, and make key order this package's job.

  **Breaking:** `Provenance` no longer declares `artifacts`, and `ProvenanceArtifacts`,
  `ProvenanceArtifactOutput` and `ProvenanceArtifactInput` are gone. They described one Foundry's
  `output_artifacts` / `input_artifacts` vocabulary and its producer index. Nothing in this package
  read them — a shared type that names one instance's domain makes every other instance's record
  wrong by construction, and this package holds only what does not vary by domain.

  New `provenanceRecord({ head, refs, extensions, tail })` returns `Provenance & Ext`, writing the
  instance's own fields between `refs` and `validation_results` — after what was compiled, before
  what checking it concluded.

  The point is key order. A provenance record is compared by its bytes, which is what makes a drift
  gate possible, and `JSON.stringify` emits keys in insertion order — so where a field is written
  decides whether re-casting an unchanged Mold produces an identical file. That made byte-identity a
  property of however a caster happened to write one object literal, which is not something a second
  instance can read off a type. The builder writes every key explicitly, so the order is asserted
  here and holds no matter how a caller orders the head it hands over.

  Migrating: pass what you were setting on `artifacts` as `extensions: { artifacts }`, and declare
  its type where the vocabulary lives. Same bytes.

## 0.4.0

### Minor Changes

- [#44](https://github.com/jmchilton/foundry-lib/pull/44) [`2c582e4`](https://github.com/jmchilton/foundry-lib/commit/2c582e45ef79ec811357c55073c5467630f73747) Thanks [@jmchilton](https://github.com/jmchilton)! - Reconcile a file, or a subtree, to ABSENT.

  `reconcile` answers "does this file match what we would write?", and had no way to say "this
  file should not be there at all" — there is no expected content to hash. So every caller that
  needed it hand-rolled the same three lines: exists, check, unlink. The flagship had two, and
  its own comment named the gap.

  `reconcileAbsent` is the single-file form. `reconcileTreeTo` is the sweep: reduce a subtree to
  exactly the files a manifest declares, reporting whatever else was there. `listFilesUnder` comes
  along because the sweep needs it and a bundle is not the only tree worth listing.

  Absent is the desired state, so arriving at it is silent — reporting would make every cast that
  declares no tools announce a stale manifest it never had. A `check` run reports and changes
  nothing, including leaving empty directories alone, since pruning on a check run mutates a tree
  the check promised not to touch and does so invisibly, because empty directories are not listed
  files.

  `reconcileTreeTo` takes the subtree as an argument rather than assuming the bundle root. A
  bundle holds things a cast never wrote — harvested run output, a note a human added — and a
  sweep scoped to the whole bundle would delete them.

  Returns `Absence` rather than `Drift`. A file that should not exist has no expected hash, and
  widening `Drift.expectedHash` to null would push an impossible case onto every caller that reads
  it, to describe a state none of them produce.

## 0.3.0

### Minor Changes

- [#42](https://github.com/jmchilton/foundry-lib/pull/42) [`15c20a0`](https://github.com/jmchilton/foundry-lib/commit/15c20a0886a2af63a93d1b1c891b7b8666e545bb) Thanks [@jmchilton](https://github.com/jmchilton)! - Stop policing Foundry-authored notes with the redistribution table.

  `applyLicensePolicy` treated the presence of a `license` field as proof that third-party content
  was being redistributed, and asked `mode` whether it was permitted. Both were wrong. An instance
  whose corpus is written from published sources records the source's license on its own notes, for
  attribution — and `mode` describes how a bundle is built, never whether text may be carried.

  The table already said so. `global_rules.foundry_content_out_of_scope` reads "this table governs
  third-party pass-through content only. Foundry-authored notes are covered by the root LICENSE and
  are never conflated with it," and nothing implemented it.

  `declaresVerbatimCarry` now lives in `@galaxy-foundry/license-policy` beside that rule, and the
  cast-time check consults it. The question is about the source and is settled when the note is
  written, so it keys off the note's `derived` posture — new on `ProvenanceRefEntry`, a widening of
  provenance v4. Notes that keep load-bearing quotes still carry protected expression and are still
  governed; only own-words prose is out of scope. `license_file_hash` stamping is unchanged, because
  recording what a note cites is provenance rather than permission.

  The nine `own-words-only` rows drop `[condense]` for `[]`. No instance implements `condense`, and
  condensing at cast time would still require the restricted text in the repository to condense
  from. Such a source is used by summarizing it when the note is written, which takes the note out
  of this table entirely.

  **Breaking:** the `allowed_modes` column is gone, along with `allowsMode` and the `CastMode`
  type. A license constrains what a note may contain, never how a bundle is assembled from it, so
  mapping a license to casting transforms was the wrong axis — and the column was derivable from
  (`policy`, `copyleft`) on every row without exception, which is how it went unnoticed. `policy`
  is now the whole answer: pass-through content under an `own-words-only` row may not be carried in
  any form, and under a `verbatim-ok` row it may be, subject to `license_file` and `copyleft`.

### Patch Changes

- Updated dependencies [[`15c20a0`](https://github.com/jmchilton/foundry-lib/commit/15c20a0886a2af63a93d1b1c891b7b8666e545bb)]:
  - @galaxy-foundry/license-policy@0.3.0

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
