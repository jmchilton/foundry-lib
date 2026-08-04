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

Use `audit-citations` for replayable scholarly-citation audits and `cast` for deterministic bundle
placement, reconciliation, licensing, and provenance. Use `kind-schema` to define and assemble
instance-owned kinds, then `kind-manifest` to publish their resolved catalog. Use `license-policy`
to decide how licensed source material may be carried into a Foundry, and `reference-contract` to
compose shared casting vocabularies with instance-owned reference kinds. Use `site-kit` for the
shared Astro reading shell, `tag-registry` for an instance's tag facets, and `wiki-links` when a
renderer and validator must agree on where `[[Target]]` points.

```sh
pnpm add @galaxy-foundry/audit-citations zod@^4
pnpm add @galaxy-foundry/cast
pnpm add @galaxy-foundry/kind-manifest zod@^4
pnpm add @galaxy-foundry/kind-schema zod@^4
pnpm add @galaxy-foundry/license-policy
pnpm add @galaxy-foundry/reference-contract
pnpm add @galaxy-foundry/site-kit
pnpm add @galaxy-foundry/tag-registry
pnpm add @galaxy-foundry/wiki-links
```

`zod@^4` is a peer of `audit-citations`, `kind-manifest`, and `kind-schema`; schema composition and
reflection must use the consumer's instance. `site-kit` expects an existing Astro 6+ project with
`astro-pagefind` 1.9+.

## Audit scholarly citations

The library accepts explicit source documents; repository paths and artifact kinds stay in the
consumer. The packaged CLI can instead read them from a strict JSON configuration.

```ts
import { extractCitations } from '@galaxy-foundry/audit-citations';

const scan = extractCitations([
  { path: 'notes/paper.md', artifactKind: 'research-note', text: markdown },
]);
```

Start with the package README and the
[citation-audit architecture](architecture/audit-citations.md). The package is experimental and
does not define generic S2/S3 audit types.

## Reconcile a cast bundle

The deterministic casting helpers report drift as values so a caller can aggregate placement,
content, licensing, and provenance faults before deciding its process exit status:

```ts
import { reconcileText, recordedHash } from '@galaxy-foundry/cast';

const drift = reconcileText({
  path: outputPath,
  expected: rendered,
  label: 'SKILL.md',
  check: true,
});

const observedHash = recordedHash(drift, true);
```

The instance still owns what it renders and how references resolve. Read the
[`cast` package documentation](https://github.com/jmchilton/foundry-lib/tree/main/packages/cast)
for placement, tree reconciliation, license-policy integration, and provenance.

## Resolve a license policy

```ts
import {
  bundledPolicy,
  declaresVerbatimCarry,
  resolveLicenseRow,
} from '@galaxy-foundry/license-policy';

const policy = bundledPolicy();
const row = resolveLicenseRow(policy, 'CC-BY-4.0');

// Only content that reproduces upstream expression is governed. A note written in your own
// words about this source is your prose, whatever the source's license says.
if (declaresVerbatimCarry(note.derived) && row.policy === 'own-words-only') {
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

## Define and assemble kinds

`kind-schema` keeps each instance's actual kind definitions local while sharing their declaration,
assembly, manifest bridge, collection routing, and companion-file checks:

```ts
import { assemble, kindDefiner } from '@galaxy-foundry/kind-schema';
import { z } from 'zod';

const defineKind = kindDefiner<{ base: z.ZodRawShape }>();
const pattern = defineKind({
  kind: 'pattern',
  title: 'Pattern',
  layer: 'substrate',
  summary: 'A reusable solution backed by evidence.',
  shape: 'file',
  companions: [],
  build: (ctx) => z.object({ type: z.literal('pattern'), ...ctx.base }).strict(),
});

const patternSchema = assemble(pattern, { base: {} });
```

Read the
[`kind-schema` package documentation](https://github.com/jmchilton/foundry-lib/tree/main/packages/kind-schema)
before wiring collection routes or directory companions.

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

## Compose typed-reference vocabularies

Keep only the instance-specific `kinds` in `reference_contract.yml`, then combine them with
the package's `used_at`, `load`, `modes`, and `evidence` groups:

```ts
import {
  buildReferenceContract,
  contractKeys,
  findReferenceContractPath,
  loadInstanceKinds,
} from '@galaxy-foundry/reference-contract';

const contract = buildReferenceContract({
  kinds: loadInstanceKinds(findReferenceContractPath()),
});

const allowedModes = contractKeys(contract, 'modes');
```

The loader rejects a local copy of an inherited group. Narrow an inherited group only when
the instance deliberately does not implement that capacity.

Continue with [Compose a reference contract](guides/composing-reference-contracts.md).

## Render the shared reading shell

`site-kit` ships Astro source for the document shell, header, and footer. The instance passes its
identity, current path, and deployment base to `SiteShell.astro`, while keeping its corpus and
styles local. Two consumer steps are deliberately explicit: point Tailwind at the package source,
and define every token and class in the shell style contract.

Use `shellStyleGaps` against emitted CSS so either silent omission becomes a failing test. Read the
[`site-kit` package documentation](https://github.com/jmchilton/foundry-lib/tree/main/packages/site-kit)
for the complete Astro and Tailwind setup.

## Load an instance tag registry

The package validates the format but does not supply a vocabulary:

```ts
import { findTagRegistryPath, loadTagRegistry } from '@galaxy-foundry/tag-registry';

const tags = loadTagRegistry(findTagRegistryPath());

tags.isValidTag('target/galaxy');
tags.facetOf('target/galaxy');
tags.tagDescription('target/galaxy');
```

Membership comes from declaration under a facet, not from parsing the tag's `/` prefix.
Drive schemas, validation, and browse pages from the same loaded registry.

Continue with [Adopt the tag registry](guides/adopting-tag-registry.md).

## Resolve a wiki link

The package supplies the grammar and the lookup rule; the map is yours. Build it with
`slugify` so both sides of a lookup agree:

```ts
import { resolveWikiLink, slugify } from '@galaxy-foundry/wiki-links';

const map = new Map([[slugify('Summarize Nextflow'), { id: 'molds/summarize-nextflow' }]]);

resolveWikiLink('[[Summarize Nextflow]]', map); // the target
resolveWikiLink('[[summarize-next]]', map); // undefined — resolution is exact
```

Rewriting a markdown tree uses the same resolver through the `./remark` subpath, so the
renderer and the validator cannot answer differently.

Continue with [Adopt wiki links](guides/adopting-wiki-links.md).

## Next steps

- Compare the packages in [Choose a package](packages/README.md).
- Understand the admission rule in [The shared substrate](concepts/shared-substrate.md).
- Browse all public exports in the [API reference](api/README.md).
