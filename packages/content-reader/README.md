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
  targetOf: (collection, id) => ({ path: `${collection}/${id}` }),
});

contentReader.noteFiles('papers');
contentReader.noteIds('papers');
contentReader.wikiLinkMap();
contentReader.remarkWikiLinks({ base: '/my-foundry' });
contentReader.resolveMarkdown(source, { base: '/my-foundry' });
```

Extra content targets, such as design documents outside the typed collection table, are passed as
`{ key, target }` entries.

## Boundary

This package deliberately does not assemble zod schemas or Astro collections. Astro preserves the
frontmatter type of a collection only when each schema-bearing export is written out; mapping a
heterogeneous catalog collapses the inferred shapes. It also does not decide how a Package differs
from a Paper or how either is rendered. Those are the instance's content model.

The package touches the filesystem, so it belongs in build, validation, and Astro server code—not
browser bundles. Reusable Astro presentation lives in `@galaxy-foundry/site-kit`.

See the [content-reader boundary](../../docs/architecture/content-reader-boundary.md) for the
cross-package and instance ownership map.
