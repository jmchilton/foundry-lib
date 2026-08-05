---
'@galaxy-foundry/site-kit': minor
---

Fill the search box the header has been rendering.

**`SiteShell` now puts `data-pagefind-body` on `<main>` by default.** Consumers relying on Pagefind
indexing whole `<body>` elements will find results no longer quote the header and footer, which is
the point; a page opts out with `searchable={false}`.

Pagefind's rule is all-or-nothing and runs backwards from what the annotation looks like. Mark no
page and every page is indexed. Mark ONE and every unmarked page leaves the index entirely — so
adding the attribute to a single route is strictly worse for the rest of the site than never adding
it.

Measured on a real instance: one annotated route, and the index held **242 of 374 pages**. Deleting
that one annotation put all 374 back. The 132 missing were every artifact page, every tag page, the
glossary, the dashboard, and 48 generated skill pages — the routes a reader is likeliest to reach by
searching rather than by following a link. The build log printed `Pagefind indexed 374 pages` in
both states, because it counts pages processed rather than pages indexed, so the only signal anyone
sees is identical in the healthy and broken cases.

`searchIndexGaps(pages, unsearchable)` asserts the whole built site, and `PAGEFIND_BODY_ATTR` is the
attribute as a value so a test and the shell cannot disagree about its spelling. The `unsearchable`
list is what makes an absence a decision: without one, "deliberately out of the index" and "nobody
thought about this route" are the same observation.

Defaulting to searchable rather than requiring the prop is deliberate — opt-in would leave every new
route one forgotten prop away from being unfindable, with no warning and nothing on the page to see.
