---
'@galaxy-foundry/site-kit': minor
---

Ship the reference card, not just the vocabulary behind it.

`@galaxy-foundry/site-kit/ReferenceContract.astro` renders a note's typed `references:` manifest.
One instance had written this component; the other depended on
`@galaxy-foundry/reference-contract`, loaded it, wired it into its registries and validated twelve
notes' worth of references against it — with no component that read any of it. The package shipped
the data and left the view to be reinvented, so one site reinvented it and one never did. Nothing
failed.

`REFERENCE_TOKENS` and `referenceStyleGaps` are the card's half of the style contract, and
`styleGaps` is the shared rule `shellStyleGaps` was. The card ships its own stylesheet, so an
instance cannot fail to write a rule — but a scoped `var(--color-brand)` resolving to nothing
renders exactly like a design decision, which is what the list is for. Two tests read the component
itself, so the list cannot drift from the file it describes in either direction.

Two things the card deliberately does not decide. Per-kind accents: `kinds` is the one group an
instance declares, so each card carries `data-kind` and an instance sets `--color-kind-accent`,
with `--color-brand` behind it. And evidence colour, which comes from the `standing` a term now
declares rather than from a list of term names in a selector.

Adds a dependency on `@galaxy-foundry/reference-contract`.
