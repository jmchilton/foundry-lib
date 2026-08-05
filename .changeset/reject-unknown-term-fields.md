---
'@galaxy-foundry/reference-contract': minor
---

A term's unknown field is now refused rather than dropped.

Known fields are per group — `ref_shape` is a kind's, `standing` is an evidence term's — so a
field on the wrong group fails too, which a single union would have let through. A key a
DIFFERENT parser owns stays legitimate, but the instance has to say so: pass it in
`loadInstanceKinds(path, { delegatedFields: ['cast'] })`.

Breaking for a contract carrying keys nothing reads. The `cast:` block is the case this was
written for: dropped silently, an instance that declares casting behaviour and runs no caster
gets a block that parses, renders, and does nothing.
