# @galaxy-foundry/reference-contract

## 0.3.0

### Minor Changes

- [#54](https://github.com/jmchilton/foundry-lib/pull/54) [`37e3120`](https://github.com/jmchilton/foundry-lib/commit/37e312096e35eb196abe0635a1643e5174e390e8) Thanks [@jmchilton](https://github.com/jmchilton)! - Ship the reference SHAPE, and make `evidence` say where each term stands.

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

## 0.2.0

### Minor Changes

- [#49](https://github.com/jmchilton/foundry-lib/pull/49) [`4e3f1d7`](https://github.com/jmchilton/foundry-lib/commit/4e3f1d70983262c58c6824969ea9e7daedc74198) Thanks [@jmchilton](https://github.com/jmchilton)! - Retire `modes.condense`.

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

### Patch Changes

- [#52](https://github.com/jmchilton/foundry-lib/pull/52) [`26d830d`](https://github.com/jmchilton/foundry-lib/commit/26d830d852c2ba0148f61bfb89ef04eee08d973d) Thanks [@jmchilton](https://github.com/jmchilton)! - Point reference-contract term documentation at the rendered Foundry Pattern page, and correct
  site-kit's peer metadata to the Pagefind 2 component contract its shipped Astro source uses.
  Replace audit-citations' text pipeline with the accessible SVG used by the architecture guide.

  The Pagefind range correction excludes no published compatible version: `astro-pagefind` moved from
  1.8.6 directly to 2.0.0, so the former `>=1.9` range already resolved only to 2.x releases.

## 0.1.0

### Minor Changes

- [#7](https://github.com/jmchilton/foundry-lib/pull/7) [`84032f6`](https://github.com/jmchilton/foundry-lib/commit/84032f672954dac1715f82e6079f80e9acade87b) Thanks [@jmchilton](https://github.com/jmchilton)! - New package: the typed-reference vocabulary a Foundry Mold's `references[]` entries draw from.

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
