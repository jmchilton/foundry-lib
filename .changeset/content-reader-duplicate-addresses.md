---
'@galaxy-foundry/content-reader': minor
---

Report wiki-link addresses that more than one note claims.

A note's primary address is its collection-relative id, flattened and slugified, so two notes reach the same address without sharing a path — `a/b.md` and `a-b.md`, or a flat note and a directory note of the same name in another collection. Which one keeps it was already settled and tested: the later collection wins, and both notes stay routed. What nothing said was that it had happened, so the loser was a published page no `[[...]]` could reach and no build reported.

`ContentIndex` now carries `duplicateAddresses`: one entry per contested address, listing every claimant in routing order, the last of which holds it. Resolution is unchanged — this is a fact the reader now surfaces, not a policy it enforces. Whether a corpus may contain an unaddressable note stays the instance's call, alongside `targetOf` and `aliases`.
