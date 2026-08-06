---
'@galaxy-foundry/site-kit': minor
---

Ship the cases the components handle, as props a gallery can render.

`@galaxy-foundry/site-kit/specimens` carries seventeen of them across the four components — each
one a decision the component makes, with the reason it exists written beside the props. An instance
renders them in its own theme, which is the whole of what makes one gallery differ from another.

Each group declares its `surface`, because whether two of a component may share a page is a
property of the component and not of the gallery, and getting it wrong renders cleanly.

Every specimen is rendered under test, so a case that stops working fails here rather than in a
consumer's gallery. `SiteHeader.astro` and `SiteFooter.astro` are now exported — a gallery cannot
show either otherwise. Each component's `Props` moved to the package's own module (`SiteShellProps`
and the other three), so a caller building props types them against the declaration the component
reads them from.
