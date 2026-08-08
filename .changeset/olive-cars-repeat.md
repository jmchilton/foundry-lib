---
'@galaxy-foundry/license-policy': patch
'@galaxy-foundry/site-kit': patch
---

Name an uncurated `LicenseRef-` after itself instead of reporting it as unresolved. Such a ref
identifies a real licence the table has not curated, so every policy field of the `default` row
still applies to it verbatim — `policy`, `license_file`, `copyleft`, `defect`, and the table's own
`obligations` — because its terms are genuinely unknown. Only `name` differs, which states identity
rather than policy: the default row's "unresolved / missing" said a resolved licence was absent. A
curated row still wins, and remains the right move for a ref that recurs. Adds a `LicenseBadge`
specimen for the state, which renders identically to the unresolved one apart from the label.
