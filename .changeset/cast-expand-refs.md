---
'@galaxy-foundry/cast': minor
---

Add an optional `expandRefs` hook. It lets an instance say that a declared ref implies further refs, such as a map-of-content note implying the pages it links. Expanded refs resolve like authored ones, run before companion expansion, go one level deep, and are kept once per destination with the Mold's own declaration winning. Provenance records each with the new optional `expanded_from` field.
