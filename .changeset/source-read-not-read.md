---
'@galaxy-foundry/source-note': minor
---

Add `not-read` to `SOURCE_READ_LEVELS`.

The first corpus migrated onto the contract has two notes whose source was never read: a
citation-accuracy note built from CrossRef and PubMed metadata, and a note assembled from open
surrogates because the primary is paywalled. Both are source notes; neither read the source, and
the nearest existing level, `abstract-only`, would assert a read that never happened.
