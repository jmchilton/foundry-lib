---
'@galaxy-foundry/license-policy': minor
'@galaxy-foundry/cast': minor
---

Stop policing Foundry-authored notes with the redistribution table.

`applyLicensePolicy` treated the presence of a `license` field as proof that third-party content
was being redistributed, and asked `mode` whether it was permitted. Both were wrong. An instance
whose corpus is written from published sources records the source's license on its own notes, for
attribution — and `mode` describes how a bundle is built, never whether text may be carried.

The table already said so. `global_rules.foundry_content_out_of_scope` reads "this table governs
third-party pass-through content only. Foundry-authored notes are covered by the root LICENSE and
are never conflated with it," and nothing implemented it.

`declaresVerbatimCarry` now lives in `@galaxy-foundry/license-policy` beside that rule, and the
cast-time check consults it. The question is about the source and is settled when the note is
written, so it keys off the note's `derived` posture — new on `ProvenanceRefEntry`, a widening of
provenance v4. Notes that keep load-bearing quotes still carry protected expression and are still
governed; only own-words prose is out of scope. `license_file_hash` stamping is unchanged, because
recording what a note cites is provenance rather than permission.

The nine `own-words-only` rows drop `[condense]` for `[]`. No instance implements `condense`, and
condensing at cast time would still require the restricted text in the repository to condense
from. Such a source is used by summarizing it when the note is written, which takes the note out
of this table entirely.

**Breaking:** the `allowed_modes` column is gone, along with `allowsMode` and the `CastMode`
type. A license constrains what a note may contain, never how a bundle is assembled from it, so
mapping a license to casting transforms was the wrong axis — and the column was derivable from
(`policy`, `copyleft`) on every row without exception, which is how it went unnoticed. `policy`
is now the whole answer: pass-through content under an `own-words-only` row may not be carried in
any form, and under a `verbatim-ok` row it may be, subject to `license_file` and `copyleft`.
