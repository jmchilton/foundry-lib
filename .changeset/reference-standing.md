---
'@galaxy-foundry/reference-contract': minor
---

Ship the reference SHAPE, and make `evidence` say where each term stands.

**`evidence` terms now require `standing: provisional | grounded`.** An instance passing its own
`inherited` vocabularies must add it; the shipped table already has it. Terms are parsed with the
value validated, and a missing one throws at load rather than rendering in whatever style a
component's fallback happened to be.

Every renderer of this vocabulary had drawn that line already — `hypothesis` styled one way and the
other two another, by name, in a class selector. That is a copy of this table kept where the table
cannot see it, and it is silently undecided the moment a fifth term appears.

New exports: `REFERENCE_FIELDS` maps each typed reference field to the group its value comes from,
`REFERENCE_CHIP_FIELDS` derives the inherited subset, `REFERENCE_PROSE_FIELDS` names the free-text
ones, and `Reference` is the record they describe. The mapping had been written three times — here
as groups, in a schema as `kind: enumOf("kinds")`, and in a view as `pillInfo('modes', ref.mode)` —
and the irregular pairs (`mode`/`modes`, `kind`/`kinds`) are why no two of them could be compared
by eye. A schema and a renderer now derive from one value.
