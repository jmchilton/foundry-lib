---
'@galaxy-foundry/cast': patch
---

Leave `_provenance.json` untouched when a re-cast records nothing else.

`cast_at` and `mold.commit` were stamped fresh on every run, so re-casting an unchanged Mold rewrote its record. Across a corpus that made `cast` non-idempotent — the flagship's 50 bundles all rewrote on every sweep, burying the few that had actually changed. The drift gate already normalized both fields away before comparing, so they were understood to carry no verdict; the write path now reaches the same conclusion and keeps the committed values. A record whose content did change still restamps both.
