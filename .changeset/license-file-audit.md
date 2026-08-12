---
'@galaxy-foundry/license-policy': minor
---

Add `auditLicenseFiles`, the conformance check for a vendored `LICENSES/` directory.

The package already shipped the primitives — `loadLicenseFiles`, `licenseFileIdFromPath`,
`redistributesUnder` — and both instances used them to render licence pages. What neither had was
anything checking that the directory and the notes agree. `license_file` is a string, so a schema
can require it and cannot open it; one instance has 64 declarations and no test that a single one
resolves to a file that exists.

The audit takes declarations rather than crawling content, because the shape of a declaration is
instance-specific: one carries `license_file` per note, the other also declares it once per book in
a `book.yml` that merges into every chapter. It returns findings rather than throwing, so an
instance decides what fails its build.

Four findings, and the second and third are the ones a hand-written existence check would miss:

- `missing-copy` — a declaration names a copy the directory does not hold.
- `unexpected-path` — the copy exists but the declared path does not point into the licence
  directory. `licenseFileIdFromPath` reads the basename, so a singular `LICENSE/` typo and a bare
  `x.LICENSE` both resolve to the right text while sending a reader somewhere there is no file.
- `unused-copy` — a vendored copy nothing declares. The reverse direction, checked for the same
  reason the tag registries are checked in both: a vocabulary policed one way accumulates, and
  licence text outlives the note that was rewritten from quotes to own words.
- `empty-copy` — a copy present but blank, which satisfies existence and grants nothing.

The path check defaults on, matching the licence directory's own name against the last segment of
the declared path, so `LICENSES/x.LICENSE` and `content/LICENSES/x.LICENSE` both pass and an
instance does not have to remember to opt in. `directoryName: null` disables it for declarations
that carry a bare id.

A missing licence directory is audited rather than thrown — that is the state an instance is in the
moment before it vendors its first copy, and naming the unmet declarations says more than `ENOENT`.
`loadLicenseFiles` still throws there, unchanged.
