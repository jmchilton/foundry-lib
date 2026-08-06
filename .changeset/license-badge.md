---
'@galaxy-foundry/site-kit': minor
---

`LicenseBadge.astro`: what a licence permits, as chips, from the id a note declares.

Both instances that depend on `@galaxy-foundry/license-policy` wrote this row themselves and
reached the same three colours as literals — `#16a34a`, `#d97706`, `#dc2626` — in two
repositories. The markup agreed as well; only the padding and the letter-spacing differed, by
amounts nobody chose. Those are settled here rather than parameterized.

The badge takes the policy table as a prop and reads nothing else off the note. It renders the
row's `name` rather than the SPDX id, which equals the id in 1 of 23 rows, and keeps the id as the
chip's `title`. The policy chip is keyed on `data-policy`, so a row added upstream is styled
without a component release — the rule the reference card already follows for evidence standings.

`LICENSE_BADGE_TOKENS` and `licenseBadgeStyleGaps` name the custom properties the badge reads and
does not define. The three policy hues are the reason: a chip whose background resolves to nothing
is still legible and no longer distinguishable from the chip beside it that means the opposite.
