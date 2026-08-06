---
'@galaxy-foundry/cast': minor
---

The caster stops assuming its first instance, and validates the one input nothing else checks.

**A `package-export` ref no longer has to be of a kind named `schema`.** The strategy is declared
per kind by the contract, and what a kind is called is exactly what varies between Foundries — the
same argument `ResolvedRef.kind` already makes for being `string` rather than a union. Only the
mode is still checked, because that is a fact about these bytes: a package export synthesizes its
own file, so there is no source a renderer could transform.

**Orphan sweeping is scoped to where the target says its kinds land**, not to a hardcoded
`references/`. A target spelling its destinations any other way previously lost orphan detection
entirely, and silently: an orphan nothing sweeps is invisible to every other check in a cast, so
the run still reported clean. A target whose kinds would claim the bundle root is now refused,
since sweeping there against the ref list would take `SKILL.md` and `_provenance.json` with it.

**Two refs can no longer claim one bundle path.** A destination is a ref's identity everywhere
downstream, so a collision looked like a single ref to every step that mattered — last write won,
the sweep saw a claimed path and kept it, and the record carried two entries with different
`src_hash` for one file. The reachable case is companions, whose destination is the kind's
directory plus their own filename.

**`loadTargetConfig` parses instead of casting.** `_target.yml` is the one input to a cast that
nothing upstream validates, and a missing `kinds:` used to surface as a property access on
`undefined` hundreds of lines away with no filename attached. `bundle_path` now goes through
`bundlePathOf` rather than past it, so `bundle_path: {mold}` — unquoted braces are a YAML mapping —
is caught where it is written instead of reaching a caller typed `string`.

**Breaking: `CastHooks.slugAliases` is removed**, along with the `SlugAliases` type. Nothing in the
package ever consulted it; a cast receives `slugMap` already built, so a note's second addresses
are settled before it arrives. Every adopter had to supply a function that could not be called.
Delete the field — where the knowledge belongs is now documented on `CastRequest.slugMap`.

Also breaking for a target that was relying on `loadTargetConfig` to accept a malformed
declaration, or on a `package-export` error message's wording.
