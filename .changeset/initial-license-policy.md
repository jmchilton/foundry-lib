---
'@galaxy-foundry/license-policy': minor
---

Initial release: the shared license → redistribution-policy table plus its loader.

Ships the 268-line table (23 curated SPDX rows, a deny-by-default `default` row, five
`global_rules`) that two Foundry instances previously kept as hand-mirrored copies, together
with `bundledPolicy()`, strict parsing/validation, id resolution, and `bundledPolicyText()`
for conformance-testing a local copy.

Deliberately excludes license _coherence_ rules — the two instances enforce genuinely
different ones today, so those stay instance-local until they converge.
