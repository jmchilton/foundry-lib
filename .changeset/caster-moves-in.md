---
'@galaxy-foundry/cast': minor
---

`castMold` — the assembly between a loaded Mold and a published bundle.

The package held the primitives a cast uses; the ~1300 lines that compose them lived in one
instance. Now here, reached through `CastHooks` and a `CastRequest`: an instance passes its
kinds, slug map, renderers and target, and gets back errors and drift as VALUES. Nothing
prints, and nothing is read that was not handed in.

`ResolvedRef.kind` is `string` rather than a six-name union. The set of kinds is exactly what
varies by Foundry, so a union here would be a compile-time copy of a table read at runtime —
kept in the one place that cannot be right about it.

The optional fields on the provenance record types now read `?: T | undefined`, which is what
copying a frontmatter field a note may not carry actually produces. `JSON.stringify` drops an
explicitly-undefined key exactly as it drops an absent one, so the emitted record is unchanged.
