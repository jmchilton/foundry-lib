---
'@galaxy-foundry/cast': patch
---

Report a required directory companion that carries no file, instead of claiming a path for it.

A companion declared with a trailing slash expands to one ref per file, so a directory holding
none expands to nothing — and `expandCompanions` said nothing about it either way. Two cases fell
through:

- **Absent.** The directory path itself became a ref: `src` ending in `/`, `dst` a bundle
  destination no file can occupy. That claim is read as real by `duplicateDestinations` and by the
  orphan sweep, and the only complaint arrived much later from `castOneRef` as
  `ref source missing: …/assets/`, which reads like a missing file.
- **Present and empty.** Zero refs, zero errors. A companion the Kind declares `required`
  contributed nothing and the cast reported success.

Both are now collected errors naming the companion and the directory. A missing _file_ companion
is unchanged: it still travels as a ref, and `castOneRef` reports its absence against the
destination it would have taken — there is a ref there to carry the failure. `recommended` and
`optional` directories stay silent whether they are absent or empty, which is what those
requirements mean.
