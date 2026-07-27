# @galaxy-foundry/kind-manifest

## 0.2.0

### Minor Changes

- [`78fe611`](https://github.com/jmchilton/foundry-lib/commit/78fe611b019472e30814b694bafa57b1632be0ef) Thanks [@jmchilton](https://github.com/jmchilton)! - Split `ManifestSource` by who knows each fact, and add `withRevision`.

  `revision` is now optional and is the vendoring consumer's to record, not the producer's
  to declare. Wiring the first producer showed why: a manifest is a committed artifact whose
  CI gate regenerates it and string-compares, so a file carrying the revision it was
  generated at can never match the revision CI regenerates it at — `--check` would fail on
  every commit. `revision` is also the wrong party's fact; it answers "which snapshot is
  this", which only whoever took the snapshot can say.

  Producers declare `{ repo, path }`. Consumers call `withRevision(manifest, rev)`, which
  returns a new manifest rather than editing what it read.

## 0.1.0

### Minor Changes

- [`d11f118`](https://github.com/jmchilton/foundry-lib/commit/d11f118b4524ed36f834882fd843f03ee23853ea) Thanks [@jmchilton](https://github.com/jmchilton)! - Initial release: the shared kind-manifest format.

  Types, a zod validator for reading a manifest produced elsewhere, and the deriver that
  turns a kind's zod shape into its field table. The format had four independent encodings
  — the prose spec, one per instance, and a fourth in the pattern site that consumes them —
  with the two instance copies identical apart from quote style.

  Producers now emit the `source` provenance envelope themselves, rather than a consumer
  stamping it onto data it read.
