---
'@galaxy-foundry/site-kit': patch
---

`LicenseFileBody` gives the licence text a section and an `<h2>` of its own.

Without one the document outline puts the licence — the thing the page IS — inside the
"Redistributed by" section, which is a list of notes. A reader moving by heading arrives at the note
list and finds no heading for the terms; the section simply ends where the text begins, and nothing
says so.

One instance shipped this heading and the other did not, and the component followed the one that did
not. That is the same kind of unchosen difference as the badge's padding, so it is settled here
rather than made a prop. Instances adopting the route supply one `<h1>` and nothing between it and
the component.
