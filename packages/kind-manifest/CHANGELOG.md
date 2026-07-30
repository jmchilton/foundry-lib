# @galaxy-foundry/kind-manifest

## 0.4.0

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

## 0.3.0

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

## 0.2.1

### Patch Changes

- [`1224f6b`](https://github.com/jmchilton/foundry-lib/commit/1224f6b6528c05fd22a326eba87ed7ce24cc9db5) Thanks [@jmchilton](https://github.com/jmchilton)! - Emit `doc` before `fields`, matching the declared `ManifestKind` shape.

  Key order is load-bearing here: the manifest is a committed artifact, so appending `doc`
  after `fields` rewrote a multi-KB line in every instance's diff for no change in meaning.
  Caught while wiring the first producer.

## 0.2.0

### Minor Changes

- [`78fe611`](https://github.com/jmchilton/foundry-lib/commit/78fe611b019472e30814b694bafa57b1632be0ef) Thanks [@jmchilton](https://github.com/jmchilton)! - Split `ManifestSource` by who knows each fact, and add `withRevision`.

  `revision` is now optional and is the vendoring consumer's to record, not the producer's
  to declare. Wiring the first producer showed why: a manifest is a committed artifact whose
  CI gate regenerates it and string-compares, so a file carrying the revision it was
  generated at can never match the revision CI regenerates it at — `--check` would fail on
  every commit. `revision` is also the wrong party's fact; it answers "which snapshot is
  this", which only whoever took the snapshot can say.

  Producers declare `{ repo, path }`. Consumers call `withRevision(manifest, rev)`, which
  returns a new manifest rather than editing what it read.

## 0.1.0

### Minor Changes

- [`d11f118`](https://github.com/jmchilton/foundry-lib/commit/d11f118b4524ed36f834882fd843f03ee23853ea) Thanks [@jmchilton](https://github.com/jmchilton)! - Initial release: the shared kind-manifest format.

  Types, a zod validator for reading a manifest produced elsewhere, and the deriver that
  turns a kind's zod shape into its field table. The format had four independent encodings
  — the prose spec, one per instance, and a fourth in the pattern site that consumes them —
  with the two instance copies identical apart from quote style.

  Producers now emit the `source` provenance envelope themselves, rather than a consumer
  stamping it onto data it read.
