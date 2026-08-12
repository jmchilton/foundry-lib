---
'@galaxy-foundry/site-kit': patch
---

Stop inline specimens from linking into their host's route space.

A specimen that shares a page renders inside a consumer's own document, so every href it emits
lands in that consumer's routes. Three did:

- `tag-chips/linked` carried `tagBase: '/foundry/tags'` — the Galaxy Workflow Foundry's own prefix,
  paired with a tag from a sibling instance's vocabulary. Rendered there, the gallery shipped a
  live 404; rendered anywhere else, a link out of the site.
- `content-note/body-heading` linked back to `/packages/`.
- `site-footer/with-links` offered `/about/` and `/licenses/`.

All three now use fragments, which is what eight other specimens in this file already do. What
each case demonstrates is unchanged: a chip is still an anchor, the back link still renders, and
footer links still come before GitHub in identity order — the destinations were never the claim.

Framed groups are untouched. They render as whole documents at their own routes, so their nav and
footer paths are that page's chrome rather than a claim on anyone's.

`an inline specimen claims no destination` now asserts this per specimen, because the kit cannot
see the site it is rendered in and the consumer only finds out if it happens to check its own
built links.
