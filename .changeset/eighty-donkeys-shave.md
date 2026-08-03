---
'@galaxy-foundry/cast': minor
---

New package: the deterministic half of casting.

Bundle placement (`bundle_path` resolution against a target's `_target.yml`), drift
reconciliation with a `--check` mode that writes nothing, content hashing, the provenance
record's shape at schema version 4, and enforcement of the license → redistribution-policy
table over an assembled cast.

Extracted from `galaxyproject/foundry`, where each piece already had a second caller — the
caster, the verifier, the pipeline assembler and the site all needed to agree on where a
bundle lives, and the drift decision had been written seven times across two commands with
four different wordings for the same fault.

Only one instance casts today, so this is N=1 by construction. It ships ahead of a second
implementation because that instance's 54 committed bundles are a byte-identity oracle: the
extraction is verified by re-deriving every one of them and requiring the bytes not to move.
Adoption by a second Foundry is the test of whether the boundary is in the right place.
