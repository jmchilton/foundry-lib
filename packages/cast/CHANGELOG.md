# @galaxy-foundry/cast

## 0.8.0

### Minor Changes

- [#78](https://github.com/jmchilton/foundry-lib/pull/78) [`5df7ef6`](https://github.com/jmchilton/foundry-lib/commit/5df7ef62108d92e4484ae97188b6119edd015687) Thanks [@jmchilton](https://github.com/jmchilton)! - The target names the document a cast writes, and what a cast is called.

  `SKILL.md` was written into the caster, along with the noun "skill" that `runtimeProcedureBody`
  substituted for `Mold` and that `skillSummary` fell back to. All three are one agent harness's
  vocabulary, not casting's — a target shipping pages or cards got the first Foundry's filename
  and was told by its own documents that it shipped skills.

  **Breaking.** `_target.yml` must now declare:

  ```yaml
  document:
    path: SKILL.md
    noun: skill
  ```

  Both fields are required and neither has a default. A default would be the same assumption
  spelled as a fallback, no longer visible in any target file — and this is the class of mistake
  the byte-identity oracle cannot catch, because it re-casts the one instance whose vocabulary
  the hardcoded value already is. The wrong answer and the right answer are the same bytes.

  `document.path` must be a filename at the bundle root. Placed in a subdirectory it would land
  inside a subtree the orphan sweep owns and be deleted on the next cast.

  **Breaking for callers.** `runtimeProcedureBody(body, moldName, noun)` and
  `skillSummary(meta, moldName, noun)` take the noun; `renderSkillMarkdown` takes a `noun` field.

  `required_outputs` now defaults to `[document.path, '_provenance.json']`. Spelling those out by
  hand restated what casting always writes, and a restatement is only ever a chance to disagree.

  `_provenance.json` stays the caster's, exported as `PROVENANCE_FILE`. Everything that reads a
  bundle without knowing which target produced it finds the record by that name.

  ## A command shell, behind its own entry point

  `@galaxy-foundry/cast/command` adds `castCommand`, `parseCastArgs` and `castReport` — the shape
  every casting CLI has anyway: one Mold as a positional, `--target`, `--check`, `--note`,
  `--root`, and a report that tells "nothing to do" from "the bundle on disk disagrees" from
  "this could not be built".

  It is a separate entry point on purpose. The barrel promises nothing in it prints, and that is
  worth keeping literally true, so importing the terminal-shaped part is a choice to be a command
  rather than a consequence of casting. `castReport` returns lines and an exit code as a value;
  only `castCommand` puts them on a stream, and it sets `process.exitCode` rather than calling
  `process.exit`, so nothing is cut off mid-write.

  A Foundry supplies three things nothing can guess — what to call itself in a usage line, its
  `CastHooks`, and how to read its corpus. Mold path, contract path, default target and the
  provenance extension have defaults that hold for a conventional layout.

  Not addressed, and named in the code rather than generalised on one example: the document's
  `name:`/`description:` frontmatter. The target already declares that pair in
  `skill_constraints.frontmatter_required` and the caster still hardcodes it, but closing the gap
  needs a rule for which value fills a declared key — which needs a second target to design against.

## 0.7.1

### Patch Changes

- Updated dependencies [[`e5c7578`](https://github.com/jmchilton/foundry-lib/commit/e5c75788a78b0f3cd1eb688743b5fd7cf0072f3f), [`fec0034`](https://github.com/jmchilton/foundry-lib/commit/fec003499b307fe2163ad0460f40eb375d86ee85)]:
  - @galaxy-foundry/license-policy@0.4.0

## 0.7.0

### Minor Changes

- [#64](https://github.com/jmchilton/foundry-lib/pull/64) [`62d87a5`](https://github.com/jmchilton/foundry-lib/commit/62d87a553a15aaed49dc309b4dbfa517c83ba84d) Thanks [@jmchilton](https://github.com/jmchilton)! - The caster stops assuming its first instance, and validates the one input nothing else checks.

  **A `package-export` ref no longer has to be of a kind named `schema`.** The strategy is declared
  per kind by the contract, and what a kind is called is exactly what varies between Foundries — the
  same argument `ResolvedRef.kind` already makes for being `string` rather than a union. Only the
  mode is still checked, because that is a fact about these bytes: a package export synthesizes its
  own file, so there is no source a renderer could transform.

  **Orphan sweeping is scoped to where the target says its kinds land**, not to a hardcoded
  `references/`. A target spelling its destinations any other way previously lost orphan detection
  entirely, and silently: an orphan nothing sweeps is invisible to every other check in a cast, so
  the run still reported clean. A target whose kinds would claim the bundle root is now refused,
  since sweeping there against the ref list would take `SKILL.md` and `_provenance.json` with it.

  **Two refs can no longer claim one bundle path.** A destination is a ref's identity everywhere
  downstream, so a collision looked like a single ref to every step that mattered — last write won,
  the sweep saw a claimed path and kept it, and the record carried two entries with different
  `src_hash` for one file. The reachable case is companions, whose destination is the kind's
  directory plus their own filename.

  **`loadTargetConfig` parses instead of casting.** `_target.yml` is the one input to a cast that
  nothing upstream validates, and a missing `kinds:` used to surface as a property access on
  `undefined` hundreds of lines away with no filename attached. `bundle_path` now goes through
  `bundlePathOf` rather than past it, so `bundle_path: {mold}` — unquoted braces are a YAML mapping —
  is caught where it is written instead of reaching a caller typed `string`.

  **Breaking: `CastHooks.slugAliases` is removed**, along with the `SlugAliases` type. Nothing in the
  package ever consulted it; a cast receives `slugMap` already built, so a note's second addresses
  are settled before it arrives. Every adopter had to supply a function that could not be called.
  Delete the field — where the knowledge belongs is now documented on `CastRequest.slugMap`.

  Also breaking for a target that was relying on `loadTargetConfig` to accept a malformed
  declaration, or on a `package-export` error message's wording.

## 0.6.0

### Minor Changes

- [#62](https://github.com/jmchilton/foundry-lib/pull/62) [`b03e2f6`](https://github.com/jmchilton/foundry-lib/commit/b03e2f608c25d1f1814e2d1c61110ca42271773c) Thanks [@jmchilton](https://github.com/jmchilton)! - The `cast:` half of a reference kind now parses here.

  `loadCastContract` reads the blocks; `loadCastReferenceContract` composes both halves of one
  file — the fields a site renders, from `@galaxy-foundry/reference-contract`, and the resolve
  strategy the caster needs. It is the only function that knows a kind has two readers, and it
  delegates the `cast` key so the shared parser permits what it does not read.

  `default_mode` is validated against the COMPOSED `modes`, so an instance that narrows the
  vocabulary cannot default a kind to a mode it just declined.

- [#62](https://github.com/jmchilton/foundry-lib/pull/62) [`366d4b3`](https://github.com/jmchilton/foundry-lib/commit/366d4b380d6d4b446197cd191a061174394db5d2) Thanks [@jmchilton](https://github.com/jmchilton)! - `castMold` — the assembly between a loaded Mold and a published bundle.

  The package held the primitives a cast uses; the ~1300 lines that compose them lived in one
  instance. Now here, reached through `CastHooks` and a `CastRequest`: an instance passes its
  kinds, slug map, renderers and target, and gets back errors and drift as VALUES. Nothing
  prints, and nothing is read that was not handed in.

  `CastHooks` gains `packageLoader`. A `package-export` ref names an npm module in the INSTANCE's
  dependency graph, and a bare `import(spec)` resolves relative to the file that runs it — so this
  package would look beside its own installed copy and find nothing. The instance imports; a
  contract declaring the strategy with nothing registered is an error, not a fallback.

  `ResolvedRef.kind` is `string` rather than a six-name union. The set of kinds is exactly what
  varies by Foundry, so a union here would be a compile-time copy of a table read at runtime —
  kept in the one place that cannot be right about it.

  The optional fields on the provenance record types now read `?: T | undefined`, which is what
  copying a frontmatter field a note may not carry actually produces. `JSON.stringify` drops an
  explicitly-undefined key exactly as it drops an absent one, so the emitted record is unchanged.

### Patch Changes

- Updated dependencies [[`c4a1e4f`](https://github.com/jmchilton/foundry-lib/commit/c4a1e4f7bbfd3c8cf6b43333fa28e922a98c4206), [`befe66a`](https://github.com/jmchilton/foundry-lib/commit/befe66a7386e7ba6a0e68e2c317af2772f36f0b5)]:
  - @galaxy-foundry/wiki-links@0.4.0
  - @galaxy-foundry/reference-contract@0.4.0

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
