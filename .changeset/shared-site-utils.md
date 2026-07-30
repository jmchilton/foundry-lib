---
'@galaxy-foundry/license-policy': minor
'@galaxy-foundry/wiki-links': minor
---

Absorb two site helpers both Foundry instances had written twice.

Additive only — no existing export changes.

`license-policy` gains `loadLicenseFiles(dir)`, `findLicenseFile(dir, id)`,
`licenseIdFromFile(path)` and `LICENSE_FILE_EXT`, plus the `LicenseFile` type. The table
already declares a `license_file` obligation ("a verbatim copy must accompany the carry");
this reads the copies that satisfy it, conventionally `LICENSES/<id>.LICENSE`. The two
instances' readers were byte-identical, one of them carrying a comment admitting it was
cribbed from the other.

The directory is a parameter rather than a resolved `../LICENSES`. The callers are Astro
pages whose cwd is a subdirectory, and an implicit relative path is precisely the thing that
does not survive being shared.

`wiki-links` gains `addBoldTermAnchors(html)` and `slugifyTerm(term)`. `parseWikiLink`
already carries `#section` through to the href without asking whether anything answers to
it; for a glossary rendered from loose markdown nothing does unless something mints the ids.
That is the other half of the same contract, so it stops living in two site trees.

**`slugifyTerm` is deliberately NOT `slugify`.** They diverge on spaced hyphens (`A - B` →
`a---b` vs `a-b`), underscores (kept vs dropped) and repeated hyphens (kept vs collapsed).
Both glossaries already carry ids minted by `slugifyTerm`, so unifying them would silently
repoint every existing `#term` deep link — a break no build would catch. A test pins each
divergent case.
