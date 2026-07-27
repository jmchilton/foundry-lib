---
'@galaxy-foundry/license-policy': patch
---

Assert three more invariants on the shipped table: an own-words-only row may not permit
`sidecar` either, a verbatim-ok row must require its `license_file`, and no row may permit
nothing at all.

Tests only — the table and the loader are unchanged. These were being asserted in an
instance's own suite against its hand-mirrored copy; they are properties of the shipped
table, so they move here rather than being deleted along with that copy.
