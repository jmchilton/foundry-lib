---
'@galaxy-foundry/reference-contract': minor
---

New package: the typed-reference vocabulary a Foundry Mold's `references[]` entries draw from.

Ships the four vocabularies every instance inherits unchanged — `used_at`, `load`, `modes`,
`evidence` — and deliberately does not ship `kinds`, which is the one part of the contract
that is genuinely per-domain. `buildReferenceContract({ kinds })` composes the two halves.

`narrow` lets an instance decline an inherited term that is capacity rather than description —
`buildReferenceContract({ kinds, narrow: { modes: ['verbatim', 'sidecar'] } })` says this
Foundry's caster is deterministic and wants neither an LLM phase nor the provenance it needs.
Narrowing rebuilds a group in the shipped order so the result does not depend on how the caller
wrote the list, and refuses an unknown term rather than silently narrowing further.

The glosses reconcile five descriptions the two instances had drifted on. Three of them now
state a cross-field rule both validators already enforce but only one repo had documented
(`on-demand` requires a `trigger`, `hypothesis` requires a `verification`, `verbatim` requires
a permissive license); the other two removed one instance's domain and implementation status
from what is supposed to be shared vocabulary.
