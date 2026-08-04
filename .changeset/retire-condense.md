---
'@galaxy-foundry/reference-contract': minor
'@galaxy-foundry/license-policy': patch
'@galaxy-foundry/kind-schema': patch
---

Retire `modes.condense`.

**Breaking:** `condense` is no longer a term in the inherited `modes` vocabulary. An instance
that narrows to it now gets the unknown-term error, which is the intended reading — the word is
gone, not deprecated.

It was kept on the argument that the shared vocabulary belongs to the pattern rather than to any
instance, and that removing a term would say no Foundry may ever have an LLM phase. Two things
undid that. The pattern's own model no longer names condensation as a transform mode, so the
reason had lost its referent. And both instances had already declined the term through `narrow`,
independently, for the same reason: a mode with no renderer is a word an author can spell and no
caster can perform. A capacity nobody has built, that every instance separately refuses, is not
capacity — it is a term waiting for the one instance that forgets to decline it.

Nothing casts differently. No instance had a live `condense` reference, and both were already
narrowing it away; this removes the narrowing's reason to exist rather than any behaviour. An
instance that wants an LLM phase adds the term back with the renderer that performs it, which is
the same bargain every other mode is under.

The narrowing examples in the README and guide move to `sidecar`, which is a live one: one
instance implements it, the other narrows it out having written no renderer.

Two pieces of prose that named the retired term are corrected with it — the license table's note
on the `allowed_modes` column it no longer has, and a README paragraph still counting four
shipped-table invariants when three of the four went with that column.
