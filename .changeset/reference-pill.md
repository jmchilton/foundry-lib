---
'@galaxy-foundry/site-kit': patch
---

A reference pill is a link only when it has somewhere to go.

`ReferenceContract.astro` rendered every term as an `<a>`, whether or not the term declared an
`href`. The four inherited vocabularies carry spec URLs, so their chips were fine. `kinds` is the
instance's own, and an instance need not have a page to point a reader at.

The parent Foundry gives all seven of its kinds an `href`, so it never rendered this case. A
sibling gives its three none, and shipped **104 hrefless anchors across eleven pages** the day it
adopted the card.

An `<a>` with no `href` is valid HTML and is not a link: not focusable, not clickable, announced as
plain text — while carrying the same pill styling as the real links beside it. It looks like
something to click and is nothing. A term with no destination now renders as a `<span>`, keeping
the description that was the only affordance it ever had, and the chip hover is scoped to `a.pill`
so a non-link no longer lights up under the cursor promising a click it cannot honour.

This is also the first component in this package with a **rendering** test. Every other assertion
here reads a component's source, which cannot answer the question this fix is about: whether a pill
is a link is decided by a value the component is handed at runtime, from the instance's own
contract. `astro` joins the devDependencies and `vitest.config.ts` uses `getViteConfig`, so a
component under test gets the same transform it gets in a build.
