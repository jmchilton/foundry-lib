---
'@galaxy-foundry/license-policy': minor
---

**Breaking:** `licenseIdFromFilePath` is now `licenseFileIdFromPath`, and `LicenseFile.licenseId`
is now `LicenseFile.id`. Two new documented types, `LicenseId` and `LicenseFileId`, say which id a
signature means.

The package exported two different ids under one name. `licenseId` meant an SPDX id — `MIT`,
`CC-BY-4.0`, what a note's `license:` carries and what `resolveLicenseRow` takes — except in
`license-files.ts`, where it meant the stem of a vendored filename: `msmb`, `nf-schema`. Those name
the **source** whose licence text was vendored, never a licence. `msmb.LICENSE` holds
CC-BY-NC-SA-2.0.

The two met on one line of a consumer's route, comparing a file stem to a file stem while reading
as a licence comparison, and the site's `/licenses/<id>/` pages are keyed by the first while their
subject is the second.

Nothing enforces the distinction at runtime — both are strings off a filesystem — so the names
carry it, and a new test pins the failure the old name invited: `findLicenseFileById` handed a
`LicenseId` returns `undefined`. Not an error, not the wrong file; a silent miss that reads as
"this source vendored nothing".

Consumers rename the import and the field; no behaviour changed.
