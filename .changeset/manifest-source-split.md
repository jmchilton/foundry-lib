---
'@galaxy-foundry/kind-manifest': minor
---

Split `ManifestSource` by who knows each fact, and add `withRevision`.

`revision` is now optional and is the vendoring consumer's to record, not the producer's
to declare. Wiring the first producer showed why: a manifest is a committed artifact whose
CI gate regenerates it and string-compares, so a file carrying the revision it was
generated at can never match the revision CI regenerates it at — `--check` would fail on
every commit. `revision` is also the wrong party's fact; it answers "which snapshot is
this", which only whoever took the snapshot can say.

Producers declare `{ repo, path }`. Consumers call `withRevision(manifest, rev)`, which
returns a new manifest rather than editing what it read.
