---
'@galaxy-foundry/site-kit': minor
'@galaxy-foundry/license-policy': minor
---

The vendored-licence route: `LicenseFileBody.astro`, `licenseFileHref`, `licensesUnderFile`,
`LICENSE_FILE_ROUTE`, and `redistributesUnder` beside the table.

Both instances built a page per vendored `LICENSES/*.LICENSE` copy, and the parts that were
identical were the derivations rather than the markup: which licences a copy covers, which notes
redistribute under it, and the copy's own text. The parts that genuinely differ — walking one note
collection versus three, `/{id}/` versus `/{collection}/{id}/` — stay with the instance, so `uses`
is a prop rather than something the component discovers.

`redistributesUnder(note.license_file, licenseFile.id)` names the comparison that was previously
written as `licenseIdFromFilePath(...) === license.licenseId`: a file id against a file id, in an
expression that scanned as a licence check. A copy is keyed by SOURCE, so two books under one
licence have two copies and one source's page must not list the other's notes.

`LICENSE_FILE_ROUTE` and `licenseFileHref` exist because `/licenses/` was typed inline in the page
that builds the route and again in every component linking to it — in two repositories. The route
and its links agreed by coincidence, and a drift between them builds clean and 404s for readers.

The body renders the licence text with its bare URLs linked. One instance did that already; the
other rendered a `<pre>` a reader had to retype the canonical terms from. Everything outside a
matched URL is emitted verbatim, whitespace included, which is what the `license_file` obligation
is for.

The page's `<h1>` and wrapper stay with the instance on purpose: one site marks this route with
`data-pagefind-body`, and Pagefind reads the first such mark as "index only pages like this one".
A component shipping the wrapper would decide a site's entire search index from inside a licence
page.
