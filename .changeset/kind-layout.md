---
'@galaxy-foundry/kind-manifest': minor
'@galaxy-foundry/kind-schema': minor
---

A kind declares its LAYOUT, not only its frontmatter — and that declaration travels between
instances.

`KindDefinition` and `ManifestKind` both gain `shape: 'file' | 'directory'` and `companions`, plus
`additionalCompanions?`, `locations?`, and `example?` on the manifest side. `kind-schema` adds
`companionsOf` and a pure `checkCompanions(entries, definition)` over a directory listing;
`kind-manifest` owns the vocabulary (`NoteShape`, `Companion`, and its two enums) and `kind-schema`
re-exports it, as it already did for `KindLayer`.

A companion is a non-note file in a note's directory. `requirement` grades absence
(`required` / `recommended` / `optional`), `disposition` says whether casting may carry the file
into a skill artifact (`foundry-only` / `cast-input` / `bundled`), and `additionalCompanions:
'allow'` covers a kind whose set is genuinely open. `file` is literal — no globs, enforced.

**Breaking, and all of it in one change:**

- `shape` and `companions` are required on every `KindDefinition`, and required of a manifest.
  `companions: []` means none and asserts it. There is no absent-versus-empty distinction anywhere,
  because a consumer that had to tell "declares none" from "did not say" would eventually stop.
- `ManifestKindInput.shape` — the zod object shape — is renamed `frontmatter`. `shape` is now the
  note shape, and one word cannot mean both; a producer mapping `d.shape` and `d.build(ctx).shape`
  onto one key is a bug waiting to be written.
- `manifestKinds`' third parameter is an options object, `{ docs, examples, collections }`, replacing
  the bare `docs` record. Each kind's `locations` are **derived** from `collections` rather than
  supplied — a per-kind location list is a second encoding of the routing table, the same reason the
  field table is derived from the zod shape that validates.
- `checkCompanions` throws for a file-shaped kind rather than answering "nothing missing", and
  `companionsOf` throws on a glob, a path separator, `index.md`, a duplicate, or a file-shaped kind
  declaring companions. Those are bugs in a kind definition — code, reachable the instant it loads.

Unlike the rest of `kind-schema`, this is not the intersection of code two instances had already
written. It replaces four disagreeing mechanisms one instance grew instead: two hardcoded validator
allowlists, a per-note `companions:` frontmatter list, a filename-pairing regex in the cast verifier
whose only job is catching that list being forgotten, and a site component reading the same two
filenames by literal path.
