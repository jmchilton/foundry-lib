# @galaxy-foundry/cast

## 0.12.1

### Patch Changes

- Updated dependencies [[`c80ef27`](https://github.com/jmchilton/foundry-lib/commit/c80ef2725d03d300eb4d3b18398f06442f2f617d)]:
  - @galaxy-foundry/license-policy@0.7.0

## 0.12.0

### Minor Changes

- [#109](https://github.com/jmchilton/foundry-lib/pull/109) [`d09bebe`](https://github.com/jmchilton/foundry-lib/commit/d09bebe9cbab0f529c9a3e308a4ef6cb9ae31803) Thanks [@jmchilton](https://github.com/jmchilton)! - Resolve `payload-companion` from the Kind layout, and retire the `payloadCompanion` hook.

  `kindLayouts` already carries a `disposition` per companion, and `bundled` on a payload-companion
  kind's note type is precisely the answer the strategy needs: "this companion IS the material, the
  note is the wrapper." Casting was asking the instance for it anyway, and every implementation of
  the hook derived it from that same declaration — the Galaxy Workflow Foundry's `payloadCompanionOf`
  filters `companionsOf(definition)` on `bundled` and asserts it is singular, which is now what the
  caster does.

  **Breaking.** Delete the `payloadCompanion` hook from your `CastHooks`; the `PayloadCompanion` type
  is no longer exported. Nothing replaces it — the Kind definitions you already pass as `kindLayouts`
  are the source. A note type whose Kind declares no bundled companion, or more than one, is a
  collected error against the ref that asked, and so is a bundled companion declared as a directory:
  a payload is one file.

  Instances that never declared `resolve: payload-companion` are unaffected.

### Patch Changes

- [#108](https://github.com/jmchilton/foundry-lib/pull/108) [`7ca327f`](https://github.com/jmchilton/foundry-lib/commit/7ca327fbfdb2a00fc5dc80a63835e37bbb214dd1) Thanks [@jmchilton](https://github.com/jmchilton)! - Report a required directory companion that carries no file, instead of claiming a path for it.

  A companion declared with a trailing slash expands to one ref per file, so a directory holding
  none expands to nothing — and `expandCompanions` said nothing about it either way. Two cases fell
  through:

  - **Absent.** The directory path itself became a ref: `src` ending in `/`, `dst` a bundle
    destination no file can occupy. That claim is read as real by `duplicateDestinations` and by the
    orphan sweep, and the only complaint arrived much later from `castOneRef` as
    `ref source missing: …/assets/`, which reads like a missing file.
  - **Present and empty.** Zero refs, zero errors. A companion the Kind declares `required`
    contributed nothing and the cast reported success.

  Both are now collected errors naming the companion and the directory. A missing _file_ companion
  is unchanged: it still travels as a ref, and `castOneRef` reports its absence against the
  destination it would have taken — there is a ref there to carry the failure. `recommended` and
  `optional` directories stay silent whether they are absent or empty, which is what those
  requirements mean.

- Updated dependencies [[`8abd703`](https://github.com/jmchilton/foundry-lib/commit/8abd703a03af0909fa62984e3db347dba6238cfc)]:
  - @galaxy-foundry/license-policy@0.6.0

## 0.11.2

### Patch Changes

- Updated dependencies [[`f54b266`](https://github.com/jmchilton/foundry-lib/commit/f54b266fe5a795f442e9072ebd5314fa412b7ab6)]:
  - @galaxy-foundry/license-policy@0.5.0

## 0.11.1

### Patch Changes

- [#102](https://github.com/jmchilton/foundry-lib/pull/102) [`5e06bdd`](https://github.com/jmchilton/foundry-lib/commit/5e06bddf09cd2cffabd1b8342588dfa3eb78b035) Thanks [@jmchilton](https://github.com/jmchilton)! - Remove a Mold's authored H1 from the generated procedure even when its reader-facing title differs
  from the stable Mold slug, preventing a second top-level title inside cast documents.
- Updated dependencies [[`5e06bdd`](https://github.com/jmchilton/foundry-lib/commit/5e06bddf09cd2cffabd1b8342588dfa3eb78b035), [`5e06bdd`](https://github.com/jmchilton/foundry-lib/commit/5e06bddf09cd2cffabd1b8342588dfa3eb78b035)]:
  - @galaxy-foundry/reference-contract@0.4.1

## 0.11.0

### Minor Changes

- [#95](https://github.com/jmchilton/foundry-lib/pull/95) [`321a074`](https://github.com/jmchilton/foundry-lib/commit/321a074681f1235152e7ddc002ad280eccedaf32) Thanks [@jmchilton](https://github.com/jmchilton)! - Cast companion files from the instance's Kind layout instead of a retired per-note declaration.

  `CastRequest` and `CastCommandSpec` now require `kindLayouts`, keyed by note `type`. Fixed
  companions whose Kind disposition is `bundled` travel automatically, declared directories expand
  to one provenance entry per file, and absent recommended or optional companions stay absent.
  Open-ended membership remains possible only where the Kind declares
  `additionalCompanions: 'allow'`.

  The redundant `CastDeclaration.companions` flag is removed. Delete `companions: true|false` from
  the `cast:` blocks in `reference_contract.yml`; the Kind definition is now the sole source for
  companion membership and disposition.

  Callers of the lower-level helpers also supply `repoRoot` and `kindLayouts` through
  `RefResolution`. `expandCompanions` now returns `{ refs, errors }` so a missing Kind layout is a
  collected cast error instead of a silent omission.

## 0.10.0

### Minor Changes

- [#91](https://github.com/jmchilton/foundry-lib/pull/91) [`c96fffe`](https://github.com/jmchilton/foundry-lib/commit/c96fffe70d563f2fdc604382b1e733498a1c8246) Thanks [@jmchilton](https://github.com/jmchilton)! - Casting every Mold is casting's job, not each Foundry's.

  Both Foundries had written "re-cast every Mold, fail if anything moved" — one as a shell loop in
  a Makefile, one as TypeScript reading `process.exitCode` after each iteration — and they disagreed
  on output, on enumeration, and on what an uncast Mold means. Three of those disagreements were
  accidents of the same cause: both built the sweep by invoking the single-Mold command N times, and
  inherited its per-run reporting N times over.

  ```ts
  const result = await castSweep(spec, { molds, target: 'claude', root });
  const verdict = sweepReport(result, {
    repoRoot,
    check: true,
    remediation: ["Drift is fixed by 'make casts' + commit;", 'an error is fixed at the source.'],
  });
  ```

  `castSweep` calls `castMold` directly and returns what it found; `sweepReport` turns that into
  lines and an exit code. Same split as `castCommand`/`castReport`, and for the same reason — the
  interesting decision is a value a test can read rather than something only visible on stdout.

  **Which Molds are swept is the instance's**, so `molds` is an argument. A Foundry that requires
  every Mold to be cast passes its Mold slugs; one that checks only what it has already cast passes
  its bundle names. That difference is real and stays declared rather than implied by which
  directory a loop happened to read.

  **Silent on success under `check`.** One `clean` line per Mold buries the run that matters in the
  forty-six that do not, and a gate that passes has said everything by exiting zero. Single-Mold
  `castReport` still says `clean: no drift, no errors`, where silence would be ambiguous — the
  difference is the number of runs, not the convention. A failing Mold names itself and indents its
  findings, and `remediation` follows them once, in the instance's own vocabulary.

  Drift counts as failure only under `check`. A write run reports drift while removing it — every
  first cast of a Mold drifts against the bundle it does not have yet — so weighing it the same way
  would fail every cast-all of a corpus that had never been cast.

  ## Also exported, because the sweep needed them split out

  `prepareCast` reads the target, the contract and the corpus once; `castOne` casts one Mold against
  the result. The target and contract are properties of the repository, not of any one Mold, and
  reading them per Mold is how a sweep ends up doing forty-seven times the work. `castCommand` is
  now these two plus `castReport`, so there is one path rather than a second one beside it.

  `MoldSourceError` is thrown when a named Mold has no usable source, because the two callers
  disagree about what that means: to `castCommand` it is a usage error and exits 2, to `castSweep`
  it is one bad entry the other Molds survive.

  Not breaking: nothing that existed changed shape or behaviour.

## 0.9.0

### Minor Changes

- [#82](https://github.com/jmchilton/foundry-lib/pull/82) [`37ce9b7`](https://github.com/jmchilton/foundry-lib/commit/37ce9b71608b6eb8c9c6aa64b5f4450e13749000) Thanks [@jmchilton](https://github.com/jmchilton)! - A kind declares the note types it cites.

  `cast.note_types` is a new optional list on a kind's `cast:` block, defaulting to the kind's own
  name — which is exactly what the caster asserted outright before.

  That assertion held because the first Foundry names each kind after the notes it points at: a
  `research` ref reaches a `type: research` note. That is a fact about that corpus, not about
  casting. The second instance splits its research corpus by publication shape, so one `research`
  kind cites `paper`, `book` and `tutorial` notes, and every such ref failed. The repairs available
  were renaming the kind after one of the three types it cites, or retyping the corpus to match the
  citation — both deforming a corpus to satisfy the caster.

  ```yaml
  research:
    cast:
      resolve: note
      default_mode: verbatim
      note_types: [paper, book, tutorial]
      companions: false
  ```

  Not breaking: a contract that declares nothing behaves exactly as before, and the error message
  now lists the accepted types rather than the kind name.

  An empty list is refused. A kind that cannot be cast says so by having no `cast:` block at all;
  an empty `note_types` would be a kind that is castable in principle and fails every reference in
  practice.

  ## Two fixes in the command shell and the noun substitution

  `parseCastArgs` now refuses a value-taking flag given no value. `--target --check` read `--check` as
  the target name, leaving `check` false — so a run asked to inspect a bundle wrote it instead,
  which is the exact accident the parser refuses unknown flags to avoid.

  `runtimeProcedureBody` treats the noun as text on both sides of the substitution. It arrives from
  a YAML file, so it is data in a pattern and data in a replacement: `$&` means "the matched text"
  to `String.replace`, so a noun containing one put the words back (`The Mold` → `The The Mold`),
  and a `(` threw outright.

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
