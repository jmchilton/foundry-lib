---
'@galaxy-foundry/cast': minor
---

Cast companion files from the instance's Kind layout instead of a retired per-note declaration.

`CastRequest` and `CastCommandSpec` now require `kindLayouts`, keyed by note `type`. Fixed
companions whose Kind disposition is `bundled` travel automatically, declared directories expand
to one provenance entry per file, and absent recommended or optional companions stay absent.
Open-ended membership remains possible only where the Kind declares
`additionalCompanions: 'allow'`.

The redundant `CastDeclaration.companions` flag is removed. Delete `companions: true|false` from
the `cast:` blocks in `reference_contract.yml`; the Kind definition is now the sole source for
companion membership and disposition.

Callers of the lower-level helpers also supply `repoRoot` and `kindLayouts` through
`RefResolution`. `expandCompanions` now returns `{ refs, errors }` so a missing Kind layout is a
collected cast error instead of a silent omission.
