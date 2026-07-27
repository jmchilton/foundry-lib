---
'@galaxy-foundry/kind-manifest': minor
---

Initial release: the shared kind-manifest format.

Types, a zod validator for reading a manifest produced elsewhere, and the deriver that
turns a kind's zod shape into its field table. The format had four independent encodings
— the prose spec, one per instance, and a fourth in the pattern site that consumes them —
with the two instance copies identical apart from quote style.

Producers now emit the `source` provenance envelope themselves, rather than a consumer
stamping it onto data it read.
