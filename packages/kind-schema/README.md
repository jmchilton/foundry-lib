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

One part is an exception, and says so rather than borrowing that claim: [Companions](#companions)
is not code either instance had. Both instances answer the question it models, four times over in
four disagreeing mechanisms; this replaces them.

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
  shape: 'directory',
  companions: [
    {
      file: 'eval.md',
      requirement: 'recommended',
      purpose: 'Abstract oracle: the properties a cast must satisfy.',
      disposition: 'foundry-only',
    },
  ],
  build: (ctx) => z.object({ type: z.literal('mold'), ...ctx.base, axis: AXIS }).strict(),
  refine: (data, issues, kctx) => {
    /* rules over this kind's own fields */
  },
});
```

`build` returns the bare strict object so a manifest generator can walk its `.shape`; `refine`
is applied separately, by `assemble`.

`shape` and `companions` are the other half of the declaration — where a note **is**, alongside
what it **says**. Both are required of every kind; see [Companions](#companions).

Go through `defineKind` rather than annotating `: KindDefinition`. The annotation widens the
shape back to the default, and the erasure travels to whatever reads a note's frontmatter.

Don't rely on your site typecheck to catch that. Measured across the two instances, widening to
the default shape costs 1 `astro check` error in one and fails the package build in the other,
while widening to an `any` shape costs 8 errors in one and none at all in the other — an `any`
satisfies every field access rather than failing one. If it matters to you, assert it directly.

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

Pass a tuple, not a widened array, if you care about the union's type:

```ts
export const KINDS = [mold, pattern, book] as const; //          ^ this
export const schema = buildKindUnion(KINDS, ctx);
```

`z.infer` of that is the discriminated union of the kinds' outputs. Hand it a
`readonly AnyKindDefinition<Ctx>[]` instead and validation still works exactly the same, but the
output type degrades to `any` — every field access compiles and yields nothing. That matters most
if you re-export the union's type from your own published package, where the erasure would reach
consumers who never called this one.

## Manifests

`manifestKinds` describes your kinds for
[`@galaxy-foundry/kind-manifest`](https://github.com/jmchilton/foundry-lib/tree/main/packages/kind-manifest):

```ts
buildKindManifest({
  instance: 'galaxy-workflow-foundry',
  source: MANIFEST_SOURCE,
  kinds: manifestKinds(KINDS, ctx, { docs, collections: COLLECTIONS }),
});
```

It lives here rather than in kind-manifest because kind-manifest describes a kind it is _handed_
and must not learn what a `KindDefinition` is — its reader half has a consumer that only reads
manifests other Foundries produced and never defines a kind. This package knows both sides.

`instance` and `source` stay with the caller: they are the producer's own identity, and a shared
helper filling them in would be asserting provenance rather than recording it.

The third argument is an options object — `{ docs, examples, collections }` — rather than trailing
positionals. Three record-shaped inputs from three different places, read positionally, is where a
caller silently passes examples as docs.

`collections` is your routing table, and each kind's `locations` are **derived** from it. Supplying
a location list per kind would be a second encoding of the table — the same reason the field table
is derived from the zod shape that validates. It also handles the many-to-many for free: two
collections resolving to one kind yield two locations.

`docs` is the prose beside each kind's schema, which `@galaxy-foundry/kind-schema/docs` will read:

```ts
import { loadKindDocs } from '@galaxy-foundry/kind-schema/docs';

manifestKinds(KINDS, ctx, { docs: loadKindDocs(KINDS, 'src/types'), collections: COLLECTIONS });
```

It reads `<typesDir>/<kind>/kind.md` for every kind in the list and trims each body — trimmed
because the manifest is byte-compared by your `--check` gate, and a trailing newline that varies
by editor would fail it on whitespace.

Driven by the kind list rather than by a directory listing, so a kind with no `kind.md` is an
error naming itself and an unrelated directory under `types/` is not mistaken for a kind. It
**throws** on a missing doc rather than exiting: whether that means exit 1 is your command's
call, not this package's.

This is a separate entry point because it is the only part of kind-schema that touches a
filesystem. Everything else imports nothing from `node:`, which is what lets an instance's site
pull `KindDefinition` into browser code without dragging `fs` in behind it.

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

## Companions

A **companion** is a non-note file in a note's directory: `eval.md` beside a mold, `upstream.prompt`
beside a prompt, a vendored schema beside a research note. Only a directory-shaped kind can have
them, which is why `shape` and `companions` arrive together — the second is meaningless without
the first.

The kind declares them, and `checkCompanions` compares a listing you already have against that
declaration. It is **pure**: no I/O, so it stays in the barrel and the barrel stays browser-safe.

```ts
import { checkCompanions } from '@galaxy-foundry/kind-schema';
import { kindOf } from '@galaxy-foundry/kind-schema/collections';

const entries = readdirSync(dir, { withFileTypes: true }).map((e) => ({
  name: e.name,
  directory: e.isDirectory(),
  // Whether an entry is itself a NOTE — passed in, never inferred. See below.
  note: kindOf(COLLECTIONS, `${rel}/${e.name}`) !== undefined,
}));

const { missingRequired, missingRecommended, unknown } = checkCompanions(entries, DEFINITIONS.mold);
```

Missing required is an error, missing recommended a warning, and `unknown` is what makes a typo'd
`scenario.md` visible instead of silently dropped. `optional` companions appear in no bucket.

Three things worth knowing before you declare any:

**`note` is information you supply.** `content/cli/<tool>/` is why: `index.md` is a `cli-tool` and
every sibling `.md` is a `cli-command`, so a `cli-tool` has a directory full of markdown and no
companions at all. Infer from the extension and every CLI command in the corpus reports as a stray.
`kindOf` from [`./collections`](#routing) is the answer. The note's own `index.md` needs no marking.

**`file` is literal.** No globs — `companionsOf` throws on one. A directory is named with a
trailing slash (`refinements/`) and is satisfied by existing; what is inside it is that directory's
business.

**`disposition` is one axis: whether the file reaches a skill artifact.** `foundry-only` never
leaves, `cast-input` is read by the caster but does not ship (a template a renderer consumes),
`bundled` is copied in. A target's list of files forbidden from a bundle is therefore every
companion that is not `bundled` — both of the other two, which is the distinction a boolean loses.

Companions describe **layout**, not dependencies. If a declaration starts wanting `load` or `mode`
or `used_at`, it has become a dependency contract, and the answer to that is a note's `references:`
entry instead.

`additionalCompanions: 'allow'` is for a kind whose set is genuinely open — vendored research
sidecars, the acquisition files beside a book. It is not "unmodelled": a kind may declare what it
knows _and_ permit the rest. There is no absent-versus-empty distinction to learn, because
`companions: []` is required and means none.

## Install

```sh
npm install @galaxy-foundry/kind-schema
```

`zod` (v4) is a peer dependency — the instance owns the version, since its kind definitions are
built from the same `z`.
