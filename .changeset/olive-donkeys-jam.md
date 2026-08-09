---
'@galaxy-foundry/license-policy': minor
---

Curate `GPL-3.0-or-later` and `AGPL-3.0-or-later`.

The table carried `GPL-2.0-only`, `GPL-2.0-or-later` and `GPL-3.0-only`, but not the `-or-later`
form of GPL 3, and no AGPL row at all. Those are what upstream topological-data-analysis libraries
actually declare — RIVET is GPL-3.0-or-later, giotto-ph and pyflagser are AGPL-3.0-or-later — so an
instance profiling them had three bad options: state `GPL-3.0-only` and be wrong about the terms,
reach for a `LicenseRef-` naming an id SPDX already lists, or leave the id absent and let the row
resolve to deny-by-default with `defect: true`. None of those is a licensing answer.

The AGPL row matches the GPL 3 row on every policy field, which is the substantive decision here
rather than an oversight. AGPL adds one obligation to GPL 3: a user served a modified version over
a network must be offered its source. That constrains running the software, not carrying its text,
and this table answers only the second question. The extra term is spelled out in `obligations`
regardless, because an instance that packages or hosts AGPL software owes it whether or not this
table governs that act.
