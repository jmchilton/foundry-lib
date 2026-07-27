---
'@galaxy-foundry/wiki-links': minor
---

New package: the `[[Target]]` wiki-link grammar and the resolver both a Foundry's renderers
and its validator run on.

Ships no link map — which notes exist and what each is addressable by does not transfer
between instances. What transfers is the grammar and the lookup rule, which three repos had
independently arrived at and written four byte-identical copies of `slugify` for.

Two rules are settled here rather than left implicit, because they were the source of every
divergence found during the extraction:

- **Resolution is exact.** No prefix fallback. Surveyed across ~4,200 links in two Foundries,
  prefix matching resolved exactly two — an ellipsis (`[[...]]`, which slugifies to the empty
  string and therefore prefixes every key) and a deliberate glob (`[[murrell-*]]`, meaning two
  papers, narrowed to one). Both were bugs.
- **A backtick means the syntax, not a link.** The `./remark` transform rewrites text nodes
  only. `` `[[Target]]` `` is how the docs name the token and how a note names a slot it
  cannot link.

Dependency-free, including the remark transform: the walk is short, and taking
`unist-util-visit` or `@types/mdast` would couple every consuming site to a version pinned
here.
