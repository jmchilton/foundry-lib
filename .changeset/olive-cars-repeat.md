---
'@galaxy-foundry/license-policy': patch
'@galaxy-foundry/site-kit': patch
---

Name an uncurated `LicenseRef-` after itself instead of reporting it as unresolved. Such a ref
identifies a real licence the table has not curated, so it keeps the default row's `own-words-only`
policy and `defect: true` flag — its terms are still unknown — but no longer borrows the default
row's name, which said "unresolved / missing" of a licence that was resolved. A curated row still
wins, and remains the right move for a ref that recurs. Adds a `LicenseBadge` specimen for the
state, which renders identically to the unresolved one apart from the label.
