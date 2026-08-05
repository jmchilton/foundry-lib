---
'@galaxy-foundry/wiki-links': minor
---

`fileSlug` — the slug a note file answers to, from its path.

The other half of `slugify`. A lookup map is built from paths and queried from prose, so the
two rules only work because they agree; held in separate repos they drift silently and a link
that stops resolving reads as a missing note. Takes no `node:path` dependency, so the package
stays usable in a browser bundle.
