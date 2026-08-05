---
'@galaxy-foundry/cast': minor
---

Give provenance one extension slot, and make key order this package's job.

**Breaking:** `Provenance` no longer declares `artifacts`, and `ProvenanceArtifacts`,
`ProvenanceArtifactOutput` and `ProvenanceArtifactInput` are gone. They described one Foundry's
`output_artifacts` / `input_artifacts` vocabulary and its producer index. Nothing in this package
read them — a shared type that names one instance's domain makes every other instance's record
wrong by construction, and this package holds only what does not vary by domain.

New `provenanceRecord({ head, refs, extensions, tail })` returns `Provenance & Ext`, writing the
instance's own fields between `refs` and `validation_results` — after what was compiled, before
what checking it concluded.

The point is key order. A provenance record is compared by its bytes, which is what makes a drift
gate possible, and `JSON.stringify` emits keys in insertion order — so where a field is written
decides whether re-casting an unchanged Mold produces an identical file. That made byte-identity a
property of however a caster happened to write one object literal, which is not something a second
instance can read off a type. The builder writes every key explicitly, so the order is asserted
here and holds no matter how a caller orders the head it hands over.

Migrating: pass what you were setting on `artifacts` as `extensions: { artifacts }`, and declare
its type where the vocabulary lives. Same bytes.
