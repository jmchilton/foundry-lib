# Getting started with `foundry-lib`

This page is an integration guide for the packages in this repository. It is not the canonical
sequence for designing a new Foundry.

## Starting a new Foundry

Start in the Foundry Pattern documentation:

- [What a Foundry Needs](https://galaxyproject.github.io/foundry-pattern/pattern/anatomy-of-an-instance/)
  separates the shared substrate from the extension surface each domain owns.
- [Plan Your Foundry](https://galaxyproject.github.io/foundry-pattern/pattern/setting-up-a-foundry/)
  is the stack-neutral sequence from grounded domain knowledge to one working vertical slice.
- [Build with the Astro Stack](https://galaxyproject.github.io/foundry-pattern/pattern/standing-up-a-foundry/)
  owns the repository-level composition: how instance content and policy use Astro, TypeScript,
  Zod, Vitest, GitHub Pages, and the packages documented here.

Those pages own the pattern, planning sequence, and whole-repository composition. Return here for
current prerequisites, package-level integration, and links to each package's canonical behavior.

## Compose only what you need

`foundry-lib` is not an application framework or an all-or-nothing stack. Most packages are small
Node.js contracts that can be adopted independently. `site-kit` is the only Astro-specific package;
omit it when a Foundry has another reading surface.

| Capability                                      | Package(s)                     | What remains with the consumer                            |
| ----------------------------------------------- | ------------------------------ | --------------------------------------------------------- |
| Audit scholarly citations                       | `audit-citations`              | source selection, trusted hosts, and acceptance policy    |
| Reconcile and record deterministic cast bundles | `cast`                         | renderers, targets, reference resolution, and exit policy |
| Define, assemble, and publish kinds             | `kind-schema`, `kind-manifest` | kind definitions, Zod context, docs, and collection map   |
| Resolve redistribution posture                  | `license-policy`               | note-level license coherence                              |
| Bind collections and links into a content site  | `content-reader`               | schemas, collection table, routes, and domain rendering   |
| Compose typed-reference vocabularies            | `reference-contract`           | reference kinds and cross-field validation                |
| Render shared Astro reading surfaces            | `site-kit`                     | site identity, styles, corpus, and domain furniture       |
| Parse and query a tag catalog                   | `tag-registry`                 | facets, values, and corpus drift checks                   |
| Parse and rewrite `[[Target]]` links            | `wiki-links`                   | link map and unresolved-link policy                       |

Two dependency relationships are intentional: `kind-schema` uses `kind-manifest` for its manifest
bridge, and `cast` uses `license-policy` when checking redistributed references. Installing either
top-level package brings that dependency with it; no Astro package is pulled into either path.

If an implementation does not use TypeScript or Zod, use the Pattern pages above as the contract
and implement those invariants in the chosen stack. This repository is one reusable TypeScript
substrate, not the definition of a Foundry.

## Package prerequisites

- Node.js 20 or later
- An ES module project
- pnpm, npm, or another package manager

## Install by capability

```sh
pnpm add --save-dev @galaxy-foundry/audit-citations zod@^4
pnpm add @galaxy-foundry/cast
pnpm add @galaxy-foundry/kind-manifest zod@^4
pnpm add @galaxy-foundry/kind-schema zod@^4
pnpm add @galaxy-foundry/license-policy
pnpm add @galaxy-foundry/content-reader
pnpm add @galaxy-foundry/reference-contract
pnpm add @galaxy-foundry/site-kit
pnpm add @galaxy-foundry/tag-registry
pnpm add @galaxy-foundry/wiki-links
```

`zod@^4` is a peer of `audit-citations`, `kind-manifest`, and `kind-schema`; schema composition and
reflection must use the consumer's instance. `site-kit` expects an existing Astro 6+ project with
`astro-pagefind` 2+.

## Audit citations without adopting a Foundry stack

`audit-citations` is also a standalone CLI. It needs Node.js and a JSON configuration, but it does
not need Astro, `site-kit`, a Foundry directory layout, or even Git unless `trackedOnly` is enabled.
Scanning and offline replay make no network requests; only `audit --refresh` contacts scholarly
metadata providers.

After the development install above, create `audit-citations.config.json`:

```json
{
  "schemaVersion": 1,
  "sources": [
    {
      "include": ["docs/**/*.md"],
      "exclude": ["build/**"],
      "artifactKind": "documentation"
    }
  ],
  "referenceHeadingTerms": ["references"]
}
```

Extract candidates locally:

```sh
pnpm exec foundry-audit-citations scan \
  --config audit-citations.config.json \
  --output build/citation-scan.json
```

Then acquire normalized provider evidence and render an audit report:

```sh
pnpm exec foundry-audit-citations audit \
  --config audit-citations.config.json \
  --refresh \
  --evidence audit/provider-evidence.json \
  --output build/citation-audit.json \
  --markdown build/citation-audit.md
```

Commit the evidence cache when reproducible offline replay matters, then omit `--refresh` in CI.
The consuming repository decides whether unresolved citations or findings should fail its gate.

The same package remains usable as a library when the caller already has document text in memory:

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
[`cast` package documentation](https://github.com/jmchilton/foundry-lib/tree/main/packages/cast) and
[deterministic casting architecture](architecture/cast.md) for placement, tree reconciliation,
license-policy integration, and provenance.

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

const frontmatter = z.object({
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
      shape: 'file',
      companions: [],
      frontmatter,
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
for the complete Astro and Tailwind setup, then
[Site-kit runtime architecture](architecture/site-kit-runtime.md) for the package-owned theme,
search, and overflow-menu behavior.

## Load an instance tag registry

The package validates the format but does not supply a vocabulary:

```ts
import { findTagRegistryPath, groupTagsInUse, loadTagRegistry } from '@galaxy-foundry/tag-registry';

const tags = loadTagRegistry(findTagRegistryPath());

tags.isValidTag('target/galaxy');
tags.facetOf('target/galaxy');
tags.tagDescription('target/galaxy');

const groups = groupTagsInUse(tags, new Map([['target/galaxy', 4]]));
```

Membership comes from declaration under a facet, not from parsing the tag's `/` prefix.
The instance decides which notes count and supplies their usage totals; the registry owns facet
membership, browse order, glosses, and empty-facet behavior.

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

- Follow the Pattern's [stack-neutral planning sequence](https://galaxyproject.github.io/foundry-pattern/pattern/setting-up-a-foundry/)
  or [Astro composition guide](https://galaxyproject.github.io/foundry-pattern/pattern/standing-up-a-foundry/).
- Compare the packages in [Choose a package](packages/README.md).
- Understand the admission rule in [The shared substrate](concepts/shared-substrate.md).
- Browse all public exports in the [API reference](api/README.md).
