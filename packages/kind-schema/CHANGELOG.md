# @galaxy-foundry/kind-schema

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
