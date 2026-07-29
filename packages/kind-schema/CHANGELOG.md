# @galaxy-foundry/kind-schema

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
