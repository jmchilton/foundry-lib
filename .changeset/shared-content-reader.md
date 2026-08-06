---
'@galaxy-foundry/content-reader': minor
'@galaxy-foundry/site-kit': minor
---

Extract the collection-backed content-reading plumbing and invariant note frame proven by the
Statistical Genomics Foundry so new Foundry instances do not grow independent Astro infrastructure.

`@galaxy-foundry/content-reader` owns filesystem enumeration from a collection table, note-id
derivation, collection-backed wiki-link maps, and the remark/raw-Markdown bindings over that map.
Instances keep their schema assembly, routing policy, registries, and domain model.

`@galaxy-foundry/site-kit` gains `ContentNote.astro` and `TagChips.astro`. The note frame provides
semantic slots for instance metadata, badges, references, and prose while keeping package facts,
source attribution, Mold state, and all other domain furniture outside the package.
