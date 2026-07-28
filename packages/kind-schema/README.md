# @galaxy-foundry/kind-schema

The kind machinery every Foundry-pattern instance needs, and none of the kinds.

A Foundry instance defines its own note kinds — a `mold`, a `paper`, a `cli-command` — each as a
zod object plus optional cross-field rules. The kinds are the instance's content model and stay
in the instance. What every instance then has to write is the same in all of them: the shape a
kind definition takes, how one is assembled into a schema, and how a file's path decides which
kind it is. That is this package.

## Why it exists

Two instances arrived at this code independently and wrote it the same way, down to the reasons
in the comments:

- [`galaxyproject/foundry`](https://github.com/galaxyproject/foundry) — `packages/note-schema/`
- [`jmchilton/statistical-genomics-foundry`](https://github.com/jmchilton/statistical-genomics-foundry) — `site/src/lib/frontmatter-schema.ts`, `site/src/types/context.ts`

Nothing here is a generalization invented for a hypothetical second caller. It is the
intersection two callers had already written twice.

## The seam

Instances disagree about exactly one thing: what a kind may draw from. One spreads a seven-field
note envelope and hands kinds a tag registry; the other spreads one field and hands kinds a
license table. So `KindDefinition` is generic over that context, and an instance aliases the
parameter away once — its kind files never mention it:

```ts
import {
  kindDefiner,
  type KindDefinition as LibKindDefinition,
  type KindShape,
} from '@galaxy-foundry/kind-schema';
import type { KindContext } from './context.js';

export type KindDefinition<T extends KindShape = KindShape> = LibKindDefinition<KindContext, T>;
export const defineKind = kindDefiner<KindContext>();
```

`kindDefiner` is curried because `defineKind` must stay generic in the kind's **shape** while
already fixed to the instance's **context**, and TypeScript has no way to bind one type parameter
of a generic function and leave the other free at the call site.

## Defining a kind

```ts
export const kind = defineKind({
  kind: 'mold',
  title: 'Mold',
  layer: 'substrate',
  summary: 'A procedural authoring skill source.',
  build: (ctx) => z.object({ type: z.literal('mold'), ...ctx.base, axis: AXIS }).strict(),
  refine: (data, issues, kctx) => {
    /* rules over this kind's own fields */
  },
});
```

`build` returns the bare strict object so a manifest generator can walk its `.shape`; `refine`
is applied separately, by `assemble`.

Go through `defineKind` rather than annotating `: KindDefinition`. The annotation widens the
shape back to the default, and the erasure travels all the way to an Astro page as
`entry.data: unknown` — one widened annotation can cost ~100 `astro check` errors on pages that
never mention the kind.

## Assembling

`assemble` gives one kind's schema, which is what a per-collection loader wants:

```ts
export const schemas = {
  mold: assemble(DEFINITIONS.mold, ctx),
  pattern: assemble(DEFINITIONS.pattern, ctx),
};
```

Write these out one per kind rather than mapping over the catalog. A `.map` produces a
homogeneous array and every kind's shape collapses to the widest common type — which is how the
pages end up with `entry.data: unknown`.

`buildKindUnion` gives all kinds in one schema dispatching on `type`, for a validator walking a
mixed corpus that does not know a note's kind before reading it. An instance may need only one of
the two; the union is not required.

## Routing

`@galaxy-foundry/kind-schema/collections` decides which collection a path belongs to. The table
stays per-instance — it names that Foundry's directories — but the matching is shared, because
the alternative is each instance writing a glob matcher and each getting `**/` subtly wrong in
its own way.

```ts
import { collectionOf, type CollectionRoute } from '@galaxy-foundry/kind-schema/collections';

export const COLLECTIONS = {
  molds: { base: 'content/molds', pattern: ['**/index.md'], kind: 'mold' },
  'cli-tools': { base: 'content/cli', pattern: ['*/index.md'], kind: 'cli-tool' },
  'cli-commands': { base: 'content/cli', pattern: ['*/*.md', '!*/index.md'], kind: 'cli-command' },
} as const satisfies Record<string, CollectionRoute>;

collectionOf(COLLECTIONS, 'content/cli/gxwf/tool-search.md'); // 'cli-commands'
```

A collection is a **location**; a kind is what a note **is**. They are deliberately not
one-to-one — one directory can hold two kinds, and two collections can resolve to one kind.

`base` is matched as a plain prefix of the paths you pass in, so the frame is yours to pick
(repo-relative, project-relative, absolute). It only has to be the same frame as the paths, and
the same frame for every row.

Supported glob constructs are `**/`, `*`, and a leading `!` to exclude — and nothing more. This
is deliberately the subset the instances' tables use. Astro's loader matches the same patterns
with picomatch, so an instance routing with both should pin them against its real corpus.

## Install

```sh
npm install @galaxy-foundry/kind-schema
```

`zod` (v3) is a peer dependency — the instance owns the version, since its kind definitions are
built from the same `z`.
