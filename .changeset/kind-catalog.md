---
'@galaxy-foundry/kind-schema': minor
'@galaxy-foundry/site-kit': minor
---

Publish the generated kind contract as an instance-themed reading surface.

`@galaxy-foundry/kind-schema/docs` now loads each kind's schema-validated `example.md` beside its
`kind.md`, removing the loader the first complete producer had to write locally.

`@galaxy-foundry/site-kit` adds `KindCatalog` and `KindReference`: a compact single-Foundry
inventory and a deep kind reference covering fields, layout, companions, validated example source,
and instance-rendered rationale. Routes, corpus counts, Markdown rendering, and theme values remain
explicit consumer inputs. Both components ship specimens and a checkable theme-token contract.
