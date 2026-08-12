# @galaxy-foundry/kind-schema

## 0.5.2

### Patch Changes

- [#120](https://github.com/jmchilton/foundry-lib/pull/120) [`68482e2`](https://github.com/jmchilton/foundry-lib/commit/68482e25f8355eabc8a414f91d4e8f9b08485804) Thanks [@jmchilton](https://github.com/jmchilton)! - Document `additionalCompanions: 'allow'` with a case an instance actually declares.

  The README offered two examples and the second was one an instance had considered and rejected in
  writing: the acquisition files beside a book sit at the BOOK level, one directory above the chapter
  that is the note, so `allow` on the chapter would claim its set is open when the truth is that
  those files are somewhere else. The package was recommending the thing the instance argued against.

  The remaining example — vendored research sidecars — is the one kind declaring `allow` across the
  foundries today, so a true example was already in hand. Added beside it is what the flag is not
  for, because that is the distinction the bad example blurred: an open set and a set held elsewhere
  are different shapes.

## 0.5.1

### Patch Changes

- [#49](https://github.com/jmchilton/foundry-lib/pull/49) [`4e3f1d7`](https://github.com/jmchilton/foundry-lib/commit/4e3f1d70983262c58c6824969ea9e7daedc74198) Thanks [@jmchilton](https://github.com/jmchilton)! - Retire `modes.condense`.

  **Breaking:** `condense` is no longer a term in the inherited `modes` vocabulary. An instance
  that narrows to it now gets the unknown-term error, which is the intended reading — the word is
  gone, not deprecated.

  It was kept on the argument that the shared vocabulary belongs to the pattern rather than to any
  instance, and that removing a term would say no Foundry may ever have an LLM phase. Two things
  undid that. The pattern's own model no longer names condensation as a transform mode, so the
  reason had lost its referent. And both instances had already declined the term through `narrow`,
  independently, for the same reason: a mode with no renderer is a word an author can spell and no
  caster can perform. A capacity nobody has built, that every instance separately refuses, is not
  capacity — it is a term waiting for the one instance that forgets to decline it.

  Nothing casts differently. No instance had a live `condense` reference, and both were already
  narrowing it away; this removes the narrowing's reason to exist rather than any behaviour. An
  instance that wants an LLM phase adds the term back with the renderer that performs it, which is
  the same bargain every other mode is under.

  The narrowing examples in the README and guide move to `sidecar`, which is a live one: one
  instance implements it, the other narrows it out having written no renderer.

  Two pieces of prose that named the retired term are corrected with it — the license table's note
  on the `allowed_modes` column it no longer has, and a README paragraph still counting four
  shipped-table invariants when three of the four went with that column.

## 0.5.0

### Minor Changes

- [#26](https://github.com/jmchilton/foundry-lib/pull/26) [`dcdf004`](https://github.com/jmchilton/foundry-lib/commit/dcdf00439d24bbe21f4da955c32eac93e62bd1c3) Thanks [@jmchilton](https://github.com/jmchilton)! - Move the `zod` peer dependency to v4.

  **Breaking: the peer range is now `zod@^4` with no v3 fallback.** Supporting both majors was
  considered and rejected — `describeType` reads zod internals, and a dual-major branch on
  internals is the kind of code that silently renders every field as `any` on the arm nobody
  tests. An instance upgrades zod and these packages together.

  `kind-manifest`:

  - `describeType` reads `_zod.def.type` instead of `_def.typeName`. Every tag was renamed
    (`ZodString` → `string`), and three accessors moved with them: an array's element is
    `element` not `type`, a literal carries `values` (an array — v4 literals may hold several)
    not `value`, and an enum carries `entries` (an object) not `values`.
  - `ZodEffects` is gone. Only `.transform()` still wraps, as a `pipe` whose `in` is the source
    type; `.refine()` now leaves the type alone and hangs a check off it, so a refined string
    describes as `string` without help.
  - A discriminated union tags as plain `union` — the discriminator moved into the def — so the
    two cases collapse to one.
  - `describeFields` casts the shape's values to the classic schema type. v4 types a
    `ZodRawShape`'s values as the CORE type, which carries neither `.isOptional()` nor enough
    structure to walk.

  `kind-schema`:

  - `z.ZodObject<T, 'strict'>` becomes `z.ZodObject<T, core.$strict>`; the second parameter is a
    config object in v4, not a mode string.
  - `Assembled` and `AssembledUnion` drop the middle `z.ZodTypeDef` parameter, which v4 removed —
    `z.ZodType` is now `<Output, Input>`.

  `superRefine`, `RefinementCtx`, `discriminatedUnion`, `ZodTypeAny` and `.strict()` all survive
  v4 unchanged, so `assemble` and `buildKindUnion` keep their existing bodies. The type-level
  assertions in `kind-schema`'s tests — the ones holding "a kind's shape survives assembly" — pass
  unmodified; only the v3-spelled `ZodEnum<['draft','reviewed']>` fixture moved to v4's
  record-keyed `ZodEnum<{ draft: 'draft'; reviewed: 'reviewed' }>`.

### Patch Changes

- Updated dependencies [[`dcdf004`](https://github.com/jmchilton/foundry-lib/commit/dcdf00439d24bbe21f4da955c32eac93e62bd1c3)]:
  - @galaxy-foundry/kind-manifest@0.4.0

## 0.4.0

### Minor Changes

- [#24](https://github.com/jmchilton/foundry-lib/pull/24) [`2a58600`](https://github.com/jmchilton/foundry-lib/commit/2a586009fa6dc104383c863433d6414d11d53363) Thanks [@jmchilton](https://github.com/jmchilton)! - A kind declares its LAYOUT, not only its frontmatter — and that declaration travels between
  instances.

  `KindDefinition` and `ManifestKind` both gain `shape: 'file' | 'directory'` and `companions`, plus
  `additionalCompanions?`, `locations?`, and `example?` on the manifest side. `kind-schema` adds
  `companionsOf` and a pure `checkCompanions(entries, definition)` over a directory listing;
  `kind-manifest` owns the vocabulary (`NoteShape`, `Companion`, and its two enums) and `kind-schema`
  re-exports it, as it already did for `KindLayer`.

  A companion is a non-note file in a note's directory. `requirement` grades absence
  (`required` / `recommended` / `optional`), `disposition` says whether casting may carry the file
  into a skill artifact (`foundry-only` / `cast-input` / `bundled`), and `additionalCompanions:
'allow'` covers a kind whose set is genuinely open. `file` is literal — no globs, enforced.

  **Breaking, and all of it in one change:**

  - `shape` and `companions` are required on every `KindDefinition`, and required of a manifest.
    `companions: []` means none and asserts it. There is no absent-versus-empty distinction anywhere,
    because a consumer that had to tell "declares none" from "did not say" would eventually stop.
  - `ManifestKindInput.shape` — the zod object shape — is renamed `frontmatter`. `shape` is now the
    note shape, and one word cannot mean both; a producer mapping `d.shape` and `d.build(ctx).shape`
    onto one key is a bug waiting to be written.
  - `manifestKinds`' third parameter is an options object, `{ docs, examples, collections }`, replacing
    the bare `docs` record. Each kind's `locations` are **derived** from `collections` rather than
    supplied — a per-kind location list is a second encoding of the routing table, the same reason the
    field table is derived from the zod shape that validates.
  - `checkCompanions` throws for a file-shaped kind rather than answering "nothing missing", and
    `companionsOf` throws on a glob, a path separator, `index.md`, a duplicate, or a file-shaped kind
    declaring companions. Those are bugs in a kind definition — code, reachable the instant it loads.

  Unlike the rest of `kind-schema`, this is not the intersection of code two instances had already
  written. It replaces four disagreeing mechanisms one instance grew instead: two hardcoded validator
  allowlists, a per-note `companions:` frontmatter list, a filename-pairing regex in the cast verifier
  whose only job is catching that list being forgotten, and a site component reading the same two
  filenames by literal path.

### Patch Changes

- Updated dependencies [[`2a58600`](https://github.com/jmchilton/foundry-lib/commit/2a586009fa6dc104383c863433d6414d11d53363)]:
  - @galaxy-foundry/kind-manifest@0.3.0

## 0.3.0

### Minor Changes

- [#22](https://github.com/jmchilton/foundry-lib/pull/22) [`68619d8`](https://github.com/jmchilton/foundry-lib/commit/68619d864d5b03affc87f7a01960c307144e25c6) Thanks [@jmchilton](https://github.com/jmchilton)! - Add `@galaxy-foundry/kind-schema/docs` with `loadKindDocs(kinds, typesDir)`, which reads each
  kind's `kind.md` and trims it — the input `manifestKinds` already takes as `docs`.

  Both instances wrote this function, with a docstring identical word for word, next to the
  `manifestKinds` map they also both wrote. It walks the kind list rather than the directory, so a
  kind with no doc errors naming itself and a stray directory is not mistaken for a kind.

  Its own entry point rather than the barrel: this is the only part of the package that touches a
  filesystem, and the rest imports nothing from `node:` so that an instance's site can pull
  `KindDefinition` into browser code without `fs` coming with it.

  It throws where the two copies called `process.exit(1)`. Both callers do want to exit, and both
  should keep saying so themselves — a library that exits cannot be tested or composed.

## 0.2.0

### Minor Changes

- [#20](https://github.com/jmchilton/foundry-lib/pull/20) [`73e2944`](https://github.com/jmchilton/foundry-lib/commit/73e2944fc2c103f7cc5cf0168415d9a449ba1bc2) Thanks [@jmchilton](https://github.com/jmchilton)! - `buildKindUnion` is now generic over the kind list, so the union keeps its members' types.

  Previously it took `readonly AnyKindDefinition<Ctx>[]` and `z.infer` of the result was `unknown`
  with an index signature — every field access compiling and yielding nothing. That was fine for
  the validators both instances wrote, which only call `safeParse` and read the issues, but not for
  `galaxyproject/foundry`, which re-exports the union's type as `NoteSchema` from its own published
  package. Its consumers were being handed the erasure without ever calling this one.

  Pass a tuple (`[...] as const`) and the per-member types survive; pass a widened array and the
  output still degrades to `any`, exactly as before. Validation is unchanged either way.

  Type-level assertions in the test suite now pin the discriminant and the per-arm shapes, so the
  next signature that erases them fails to compile rather than passing quietly.

## 0.1.0

### Minor Changes

- [#17](https://github.com/jmchilton/foundry-lib/pull/17) [`d859564`](https://github.com/jmchilton/foundry-lib/commit/d8595644247158a70a4b32a5685d973a7a1c8b81) Thanks [@jmchilton](https://github.com/jmchilton)! - New package: the shared kind machinery for Foundry-pattern instances.

  `KindDefinition` (generic over the instance's kind context), `kindDefiner`, `assemble` /
  `Assembled`, `buildKindUnion`, `manifestKinds` for feeding `@galaxy-foundry/kind-manifest`, and
  path→kind collection routing under the `/collections` entrypoint. The kinds, the field
  primitives, and the collection table stay per-instance.

  Extracted from the two instances that had written it twice — galaxyproject/foundry's
  `packages/note-schema` and statistical-genomics-foundry's `site/src/types/context.ts` — rather
  than generalized ahead of a second caller.
