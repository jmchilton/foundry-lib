# Produce a kind manifest

A producer publishes a deterministic description of its kinds. The instance resolves its
schemas; `kind-manifest` derives the field table and enforces the shared wire format.

## 1. Install against Zod 3

```sh
pnpm add @galaxy-foundry/kind-manifest zod@^3.25
```

The peer range is intentional. Field descriptions use Zod 3 reflection and must inspect the
same Zod instance that created the shapes.

## 2. Resolve schemas in the instance

Build each schema with the instance's own registries and context. Pass only the completed
shape into the shared package:

```ts
const inputs = KINDS.map((definition) => ({
  kind: definition.kind,
  title: definition.title,
  layer: definition.layer,
  summary: definition.summary,
  shape: definition.shape, // 'file' | 'directory'
  companions: definition.companions,
  frontmatter: definition.build(context).shape,
  doc: kindDocs[definition.kind],
}));
```

Registry resolution stays here because different instances wire it differently.

`shape` and `frontmatter` are two different facts and the format keeps them apart: the first is
whether a note is a file or a directory, the second is the Zod object validating its frontmatter.
One word for both is how a producer ends up publishing one where it meant the other.

If your kinds are defined with [`@galaxy-foundry/kind-schema`](packages/README.md), skip this map
entirely — `manifestKinds(KINDS, ctx, { docs, collections })` builds it, and derives each kind's
`locations` from the routing table rather than asking you to restate it.

## 3. Build the manifest

```ts
import { buildKindManifest } from '@galaxy-foundry/kind-manifest';

const manifest = buildKindManifest({
  instance: 'galaxy-workflow-foundry',
  kinds: inputs,
  source: {
    repo: 'galaxyproject/foundry',
    path: 'types/kinds.generated.json',
  },
});
```

The producer knows its instance slug, repository, and output path, so it declares those
facts. It must not add a `revision`; the file cannot truthfully carry the commit that contains
it before that commit exists.

## 4. Write deterministic JSON

Use stable formatting and a trailing newline:

```ts
await writeFile('types/kinds.generated.json', `${JSON.stringify(manifest, null, 2)}\n`);
```

Given the same inputs, two calls to `buildKindManifest` produce the same value. Avoid adding
timestamps, environment paths, or other build-local fields.

## 5. Add a regeneration gate

The producer's CI should regenerate the manifest and compare it byte-for-byte with the
committed artifact:

```sh
pnpm generate:kinds
git diff --exit-code -- types/kinds.generated.json
```

This catches a committed manifest that was not refreshed after a schema change.

It does not prove that the type renderer was always correct. Keep unit tests for representative
shapes—optional, defaulted, transformed, arrays, objects, enums, literals, nullable values,
and wide unions—inside `kind-manifest`.

## 6. Publish the artifact

Commit the generated file at the path declared in `source.path`. Consumers can then fetch it
at a pinned revision, validate it, and attach that revision to their copy.

Continue with [Consume a kind manifest](guides/consuming-kind-manifests.md) or read
[Manifest provenance](architecture/manifest-provenance.md).
