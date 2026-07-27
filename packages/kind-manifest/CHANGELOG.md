# @galaxy-foundry/kind-manifest

## 0.1.0

### Minor Changes

- [`d11f118`](https://github.com/jmchilton/foundry-lib/commit/d11f118b4524ed36f834882fd843f03ee23853ea) Thanks [@jmchilton](https://github.com/jmchilton)! - Initial release: the shared kind-manifest format.

  Types, a zod validator for reading a manifest produced elsewhere, and the deriver that
  turns a kind's zod shape into its field table. The format had four independent encodings
  — the prose spec, one per instance, and a fourth in the pattern site that consumes them —
  with the two instance copies identical apart from quote style.

  Producers now emit the `source` provenance envelope themselves, rather than a consumer
  stamping it onto data it read.
