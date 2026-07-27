---
'@galaxy-foundry/reference-contract': minor
---

New package: the typed-reference vocabulary a Foundry Mold's `references[]` entries draw from.

Ships the four vocabularies every instance inherits unchanged — `used_at`, `load`, `modes`,
`evidence` — and deliberately does not ship `kinds`, which is the one part of the contract
that is genuinely per-domain. `buildReferenceContract({ kinds })` composes the two halves.

The glosses reconcile five descriptions the two instances had drifted on. Three of them now
state a cross-field rule both validators already enforce but only one repo had documented
(`on-demand` requires a `trigger`, `hypothesis` requires a `verification`, `verbatim` requires
a permissive license); the other two removed one instance's domain and implementation status
from what is supposed to be shared vocabulary.
