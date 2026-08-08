# @galaxy-foundry/content-reader

The headless content-reading plumbing shared by Foundry-pattern instances.

```sh
pnpm add @galaxy-foundry/content-reader
```

An instance owns its kinds, zod schemas, collection table, routes, registries, identity, theme,
and domain-specific page furniture. Once it has those, every content site asks the same mechanical
questions: which files does a collection select, what are their route IDs, which notes may wiki
links target, and how does the Markdown renderer bind those links?

```ts
import { createContentReader } from '@galaxy-foundry/content-reader';

export const contentReader = createContentReader({
  collections: COLLECTIONS,
  contentPath,
  aliases: (meta, id, collection) =>
    meta.type === 'cli-command' && typeof meta.tool === 'string' && typeof meta.command === 'string'
      ? [`${meta.tool} ${meta.command}`]
      : meta.type === 'mold' && typeof meta.name === 'string'
        ? [meta.name]
        : [],
  targetOf: (collection, id, meta) => {
    const target = { path: `${collection}/${id}` };
    return typeof meta?.summary === 'string' ? { ...target, title: meta.summary } : target;
  },
});

contentReader.noteFiles('papers');
contentReader.noteIds('papers');
contentReader.noteTargets('papers');
contentReader.contentIndex();
contentReader.wikiLinkMap();
contentReader.remarkWikiLinks({ base: '/my-foundry' });
contentReader.resolveMarkdown(source, { base: '/my-foundry' });
```

Extra content targets, such as design documents outside the typed collection table, are passed as
`{ key, target }` entries.

`aliases` is the instance vocabulary seam: the package reads each routed note's YAML frontmatter
once and registers the returned second addresses. The same frontmatter is passed to `targetOf`, so
route targets can carry a `summary` tooltip without another filesystem walk. Readers that omit
`aliases` continue to touch directory entries only; set `readFrontmatter: true` when `targetOf`
needs metadata but no aliases are required.

Address precedence is deterministic:

1. Primary note addresses are registered in collection property order, then sorted note-path
   order. A later primary overwrites an earlier primary, so collection declaration order is a
   contractual part of a content catalog with basename collisions.
2. Aliases fill empty addresses and never overwrite a primary. The first routed note wins when
   two aliases collide.
3. Explicit `extraTargets` are applied last and may deliberately override either.

Only files admitted by the collection table become primary or alias targets. Markdown companions
and other adjacent files remain visible to `markdownFiles()` but cannot leak into `wikiLinkMap()`.

`noteTargets()` is the complete routed-note view before wiki-link addressing. It returns each
note's collection, id, and instance-supplied target in deterministic collection/path order; pass a
collection name to narrow it. Unlike `wikiLinkMap()`, it does not collapse primary-address
collisions, add aliases, or include explicit extra targets. Use it when every routed note matters,
such as checking that a static build emitted a page for each one.

`contentIndex()` exposes the richer build-time view from one walk. Its `notes` retain each routed
note's content-relative source file, parsed frontmatter when enabled, and route target.
`notesByAddress` applies the same primary and alias precedence as `wikiLinkMap()`, but its values
point back to those note records rather than only their site targets. A caster can therefore
project both source maps without walking or parsing the content tree again:

```ts
const index = contentReader.contentIndex();
const sourcePath = (file: string) => `content/${file}`;

const slugMap = new Map(
  [...index.notesByAddress].map(([address, note]) => [address, sourcePath(note.file)]),
);
const metaByPath = new Map(index.notes.map((note) => [sourcePath(note.file), note.meta ?? {}]));
```

Configure `aliases` or `readFrontmatter: true` when a projection needs metadata. Explicit extra
targets remain exclusive to `wikiLinkMap()` because they are addresses without collection-backed
source records.

## Boundary

This package deliberately does not assemble zod schemas or Astro collections. Astro preserves the
frontmatter type of a collection only when each schema-bearing export is written out; mapping a
heterogeneous catalog collapses the inferred shapes. It also does not decide how a Package differs
from a Paper or how either is rendered. Those are the instance's content model.

The package touches the filesystem, so it belongs in build, validation, casting composition, and
Astro server code—not browser bundles. Reusable Astro presentation lives in
`@galaxy-foundry/site-kit`.

See the [content-reader boundary](../../docs/architecture/content-reader-boundary.md) for the
cross-package and instance ownership map.
