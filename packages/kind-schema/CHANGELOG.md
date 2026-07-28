# @galaxy-foundry/kind-schema

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
