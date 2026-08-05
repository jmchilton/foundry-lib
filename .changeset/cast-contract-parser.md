---
'@galaxy-foundry/cast': minor
---

The `cast:` half of a reference kind now parses here.

`loadCastContract` reads the blocks; `loadCastReferenceContract` composes both halves of one
file — the fields a site renders, from `@galaxy-foundry/reference-contract`, and the resolve
strategy the caster needs. It is the only function that knows a kind has two readers, and it
delegates the `cast` key so the shared parser permits what it does not read.

`default_mode` is validated against the COMPOSED `modes`, so an instance that narrows the
vocabulary cannot default a kind to a mode it just declined.
