---
'@galaxy-foundry/cast': minor
---

Resolve `payload-companion` from the Kind layout, and retire the `payloadCompanion` hook.

`kindLayouts` already carries a `disposition` per companion, and `bundled` on a payload-companion
kind's note type is precisely the answer the strategy needs: "this companion IS the material, the
note is the wrapper." Casting was asking the instance for it anyway, and every implementation of
the hook derived it from that same declaration — the Galaxy Workflow Foundry's `payloadCompanionOf`
filters `companionsOf(definition)` on `bundled` and asserts it is singular, which is now what the
caster does.

**Breaking.** Delete the `payloadCompanion` hook from your `CastHooks`; the `PayloadCompanion` type
is no longer exported. Nothing replaces it — the Kind definitions you already pass as `kindLayouts`
are the source. A note type whose Kind declares no bundled companion, or more than one, is a
collected error against the ref that asked, and so is a bundled companion declared as a directory:
a payload is one file.

Instances that never declared `resolve: payload-companion` are unaffected.
