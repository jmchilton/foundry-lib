---
'@galaxy-foundry/kind-manifest': patch
---

Emit `doc` before `fields`, matching the declared `ManifestKind` shape.

Key order is load-bearing here: the manifest is a committed artifact, so appending `doc`
after `fields` rewrote a multi-KB line in every instance's diff for no change in meaning.
Caught while wiring the first producer.
