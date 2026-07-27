# Getting started

Install only the contracts your Foundry needs. The packages are independent and have
different responsibilities.

> New to the architecture? Read
> [The Foundry Pattern](https://galaxyproject.github.io/foundry-pattern/) first, then return
> here for the shared TypeScript contracts used by multiple instances.

## Prerequisites

- Node.js 20 or later
- An ES module project
- pnpm, npm, or another package manager

## Choose a package

Use `license-policy` when a tool needs to decide how licensed source material may be carried
into a Foundry. Use `kind-manifest` when an instance needs to publish its kind catalog or a
consumer needs to validate one.

```sh
pnpm add @galaxy-foundry/license-policy

# Only when producing manifests from zod 3 schemas:
pnpm add @galaxy-foundry/kind-manifest zod@^3.25
```

`zod` is a peer dependency of `kind-manifest`. The package reflects the same Zod instance
that built the schemas, so the peer must not be duplicated.

## Resolve a license policy

```ts
import { allowsMode, bundledPolicy, resolveLicenseRow } from '@galaxy-foundry/license-policy';

const policy = bundledPolicy();
const row = resolveLicenseRow(policy, 'CC-BY-4.0');

if (!allowsMode(row, 'verbatim')) {
  throw new Error('This source must be rewritten in your own words');
}
```

Unknown and missing IDs resolve to the policy's conservative default row. Check
`row.defect` when an unresolved declaration must become a validation error.

Continue with [Adopt the license policy](guides/adopting-license-policy.md).

## Produce a kind manifest

The instance resolves its own schema and passes the resulting shape across the library
boundary:

```ts
import { buildKindManifest } from '@galaxy-foundry/kind-manifest';
import { z } from 'zod';

const shape = z.object({
  title: z.string(),
  tags: z.array(z.string()).default([]),
}).shape;

const manifest = buildKindManifest({
  instance: 'example-foundry',
  kinds: [
    {
      kind: 'pattern',
      title: 'Pattern',
      layer: 'substrate',
      summary: 'A reusable solution backed by evidence.',
      shape,
      doc: 'Patterns capture a solution that can be applied again.',
    },
  ],
  source: {
    repo: 'example/example-foundry',
    path: 'types/kinds.generated.json',
  },
});
```

`fields` is derived from the Zod shape. Do not keep a second hand-written field table.

Continue with [Produce a kind manifest](guides/producing-kind-manifests.md).

## Consume a manifest

Treat manifests from another repository as untrusted input:

```ts
import { parseKindManifest, withRevision } from '@galaxy-foundry/kind-manifest';

const parsed = parseKindManifest(JSON.parse(downloadedText));
const snapshot = withRevision(parsed, sourceCommit);
```

The producer declares its repository and manifest path. The consumer records the revision
of the snapshot it actually fetched.

Continue with [Consume a kind manifest](guides/consuming-kind-manifests.md).

## Next steps

- Compare the packages in [Choose a package](packages/README.md).
- Understand the admission rule in [The shared substrate](concepts/shared-substrate.md).
- Browse all public exports in the [API reference](api/README.md).
