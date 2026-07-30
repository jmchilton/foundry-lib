# @galaxy-foundry/wiki-links

The `[[Target]]` wiki-link grammar Foundry-pattern instances write in, and the resolver both
their renderers and their validators run on.

```sh
npm install @galaxy-foundry/wiki-links
```

## What this package does not do

**It ships no link map.** That half is the instance's, and it does not transfer: one Foundry
keys notes by basename plus a Mold's `name` field plus a `tool command` pair, another by a
dashed collection id, the pattern site by a filename with its ordering prefix stripped.

What transfers is the grammar and the lookup rule — which three repos had independently
arrived at, and written four byte-identical copies of `slugify` for.

## The two rules

Both were the source of real divergence, so both are stated here rather than left implicit.

### Resolution is exact

There is no prefix fallback. A survey of ~4,200 links across two Foundries found exactly two
that resolved by prefix alone, and both were bugs:

| link            | what prefix matching did                                                            |
| --------------- | ----------------------------------------------------------------------------------- |
| `[[...]]`       | slugifies to `""`, which prefixes every key — linked to 1 of 264 notes, arbitrarily |
| `[[murrell-*]]` | a deliberate glob meaning two papers — silently narrowed to one                     |

Every other link in both corpora already matched exactly. A rule that has never once done its
intended job is not worth the unpredictability, so an unresolved stub stays visibly
unresolved.

### A backtick means the syntax, not a link

`` `[[Target]]` `` is how documentation names the token, and how a note names a slot it
cannot link — `` `[[summary-<source>]]` `` is a template placeholder, not a broken reference.
The remark transform therefore rewrites text nodes only, never `inlineCode`, `code`, or
`html`.

## Usage

### The string layer

```ts
import { slugify, parseWikiLink, resolveWikiLink } from '@galaxy-foundry/wiki-links';

// Build your map with slugify; both sides of a lookup must run through it.
const targetMap = new Map([[slugify('Summarize Nextflow'), { id: 'molds/summarize-nextflow' }]]);

resolveWikiLink('[[Summarize Nextflow]]', targetMap); // → { id: 'molds/summarize-nextflow' }
resolveWikiLink('[[summarize-next]]', targetMap); // → undefined (no prefix fallback)

parseWikiLink('[[tests-format#has_text|the assertion]]');
// → { target: 'tests-format', anchor: '#has_text', display: 'the assertion' }
```

`resolveWikiLink` is generic in the target, so an instance keeps whatever shape it already
stores — a route id, a path plus a summary for the tooltip.

`WIKI_LINK_RE` matches a string that is nothing but one link, which is the frontmatter-field
form. `WIKI_LINK_SCAN_RE` finds them embedded in prose.

### Anchor targets

`parseWikiLink` carries `#section` straight through to the href and never asks whether
anything answers to it. For a glossary rendered from loose markdown, nothing does — unless
something mints the ids. That is the other half of the same contract, so it lives here.

```ts
import { addBoldTermAnchors } from '@galaxy-foundry/wiki-links';

addBoldTermAnchors('<p><strong>Mold</strong> is a thing.</p>');
// → '<p id="mold"><strong>Mold</strong> is a thing.</p>'
```

It operates on rendered HTML rather than mdast because a glossary is typically rendered
outside the remark pipeline, from a file the content collections do not own.

> **`slugifyTerm` is not `slugify`.** They diverge on spaced hyphens (`A - B` → `a---b` vs
> `a-b`), underscores (kept vs dropped) and repeated hyphens (kept vs collapsed). Both
> instances' glossaries already carry ids minted by `slugifyTerm`, so unifying the two would
> silently repoint every existing `#term` deep link. A test pins the divergence.

### The remark transform

```ts
import remarkWikiLinks from '@galaxy-foundry/wiki-links/remark';
import { resolveWikiLink } from '@galaxy-foundry/wiki-links';

remarkPlugins: [
  remarkWikiLinks({
    resolve: (link) => {
      const t = resolveWikiLink(link.target, map);
      return t ? { href: `${base}/${t.id}/`, title: t.summary } : null;
    },
  }),
];
```

The transform owns the tree walk and the grammar; `resolve` is the instance's half. A link
that resolves becomes an anchor with the anchor fragment appended and `title` set; one that
does not renders **bold** — visible to a reader, obvious to an author, and never claiming to
lead somewhere.

It also never rewrites inside an existing `link` or `linkReference`, which would produce a
nested anchor.

## Dependency-free on purpose

The tree walk is short, and depending on `unist-util-visit` or `@types/mdast` would couple
every consuming site to whichever version this package pinned. The node types in
`./remark` are structural, so an mdast `Root` satisfies them with nothing imported through
here.

## License

MIT
