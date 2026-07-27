# Adopt wiki links

`@galaxy-foundry/wiki-links` supplies the `[[Target]]` grammar and the lookup rule. It does
not supply a link map — which notes exist, and what each is addressable by, is yours.

Adopting it is usually a consolidation rather than an addition: most instances already have
the rule encoded two or three times, in a remark plugin, a loose-document renderer, and a
validator, and those copies have drifted.

## Find every copy first

Before writing any code, grep for the slug function. In the extraction that produced this
package, one instance had **three** copies of `slugify` and they agreed; the resolvers around
them did not.

```sh
grep -rn "toLowerCase().*replace" --include="*.ts" src/ scripts/ packages/
```

Expect to find the rule in:

- the remark plugin that rewrites note bodies;
- whatever renders loose documents outside the collections — a glossary, an ops log; and
- the validator, if it checks links or builds backlinks.

Every one of them should end up calling this package.

## Build the map with `slugify`

Both sides of a lookup have to run through the same function: the key you store and the text
an author typed. That is what lets `[[Summarize Nextflow]]` find a note whose frontmatter
says `name: Summarize Nextflow`.

```ts
import { slugify } from '@galaxy-foundry/wiki-links';

const map = new Map<string, Target>();
for (const note of notes) {
  map.set(slugify(basename(note.id)), { id: note.id, summary: note.summary });
  // Additional addresses are yours to decide — a Mold's `name`, a `tool command` pair.
  if (note.name) map.set(slugify(note.name), { id: note.id, summary: note.summary });
}
```

`resolveWikiLink` is generic in the value, so keep whatever shape you already store.

## Expect exactly two behavior changes

Adoption is close to a no-op on a real corpus. Measured across ~4,200 links in two Foundries,
3,107 of 3,108 resolved identically in the first and every link in the second. What changes:

**Prefix fallback goes away.** If your resolver fell back to a prefix match, links that
relied on it stop resolving. Measure before assuming that matters — the survey found two such
links, and both were bugs:

| link            | what prefix matching did                                                  |
| --------------- | ------------------------------------------------------------------------- |
| `[[...]]`       | slugifies to `""`, which prefixes every key — linked to an arbitrary note |
| `[[murrell-*]]` | a deliberate glob meaning two papers — silently narrowed to one           |

Count yours before and after. A script that walks the corpus, resolves every `[[...]]` both
ways, and diffs the results takes a few minutes and turns this from a guess into a fact.

**Backticked links stop resolving.** If your renderer treated `` `[[x]]` `` as a link, that
stops: a backtick means the syntax. This one is not necessarily small — one instance had 671
such links — so normalize the content **in the same change**, not after it. Strip the
backticks where the target resolves, and leave them where it does not, because those are the
cases the mark is genuinely for:

| source                                        | verdict                                        |
| --------------------------------------------- | ---------------------------------------------- |
| ``Write a reference as `[[Target]]`.``        | naming the syntax — keep                       |
| ``See `[[summary-<source>]]` for the shape.`` | a template slot, unresolvable by design — keep |
| ``See `[[cwl-pickvalue-to-galaxy]]` for it.`` | a real citation — strip the backticks          |

The verdicts line up with resolution, which is what makes the sweep mechanical: strip where
the target resolves, keep where it does not.

## Wire the remark plugin

The transform owns the walk and the grammar; `resolve` is your half.

```ts
import remarkWikiLinks from '@galaxy-foundry/wiki-links/remark';
import { resolveWikiLink } from '@galaxy-foundry/wiki-links';

markdown.remarkPlugins = [
  remarkWikiLinks({
    resolve: (link) => {
      const t = resolveWikiLink(link.target, map);
      return t ? { href: `${base}/${t.id}/`, title: t.summary } : null;
    },
  }),
];
```

The transform rewrites `text` nodes only, never inside an existing link, and renders an
unresolved link bold rather than as a dead anchor.

## Use the same resolver in the validator

This is the point of the exercise. A validator that answers differently from the renderer
reports links that work and passes links that do not.

```ts
const broken = links.filter((l) => resolveWikiLink(l, map) === undefined);
```

## Verify

- Resolve every `[[...]]` in the corpus before and after; diff the results and account for
  every difference by name.
- Confirm the count of backtick-wrapped links matches the exceptions you meant to keep.
- Build the site and spot-check the densest page.
