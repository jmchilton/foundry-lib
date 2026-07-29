---
'@galaxy-foundry/kind-schema': minor
---

Add `@galaxy-foundry/kind-schema/docs` with `loadKindDocs(kinds, typesDir)`, which reads each
kind's `kind.md` and trims it — the input `manifestKinds` already takes as `docs`.

Both instances wrote this function, with a docstring identical word for word, next to the
`manifestKinds` map they also both wrote. It walks the kind list rather than the directory, so a
kind with no doc errors naming itself and a stray directory is not mistaken for a kind.

Its own entry point rather than the barrel: this is the only part of the package that touches a
filesystem, and the rest imports nothing from `node:` so that an instance's site can pull
`KindDefinition` into browser code without `fs` coming with it.

It throws where the two copies called `process.exit(1)`. Both callers do want to exit, and both
should keep saying so themselves — a library that exits cannot be tested or composed.
