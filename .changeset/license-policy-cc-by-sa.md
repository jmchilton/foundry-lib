---
'@galaxy-foundry/license-policy': minor
---

Curate `CC-BY-SA-4.0`.

The table carried four CC BY versions and `CC-BY-NC-SA-2.0`, but no CC BY-SA row of any version.
That is the licence a growing share of preprints declare, and an instance reviewing one had the
three bad options the GPL rows were added to remove: state `CC-BY-4.0` and be wrong about the
share-alike term, reach for a `LicenseRef-` naming an id SPDX already lists, or leave the id absent
and resolve deny-by-default with `defect: true`. At least one instance closes the middle option by
test, rejecting a `LicenseRef-` that resolves to `default`, so the row is the only answer left.

The row is `verbatim-ok` with `copyleft: true`, matching the GPL rows rather than the NC ones, and
that is the substantive decision here. Share-alike and non-commercial are different kinds of
obligation. Copyleft is answered by isolation — put the carried text in its own file and only that
file inherits the licence — which is why this table already lets GPL and AGPL text be carried. NC
restricts use rather than licensing, so no file boundary contains it; a cast embedding NC prose is
an NC-encumbered cast wherever the prose sits. Reading CC BY-SA as own-words-only would have made a
plain copyleft licence stricter than the GPL, for the term the GPL also has.

The `CC-BY-NC-SA-2.0` obligations note is corrected to match: it had attributed its own-words answer
to "NC + share-alike", which now reads as a claim about share-alike that the new row contradicts.
Its policy fields are unchanged.
