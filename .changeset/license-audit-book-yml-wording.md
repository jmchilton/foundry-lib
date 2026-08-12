---
'@galaxy-foundry/license-policy': patch
---

Correct the `auditLicenseFiles` README on why declarations are passed in.

It said one instance declares `license_file` once per book in a `book.yml` "that merges into every
chapter". That instance retired load-time merging: `book.yml` is the authored record and a generator
*copies* it into each chapter, so a chapter validates from its own frontmatter like every other note.

The argument for taking declarations rather than crawling content survives the correction and is
actually stronger — with a copy, the `book.yml` and its copies are both declarations, and a crawler
that found only the notes would leave the record they were generated from unchecked. Documentation
only; no behaviour changes.
