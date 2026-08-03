---
'@galaxy-foundry/site-kit': minor
---

New package: the reading shell — document skeleton, header with derived navigation, and footer, as
Astro components taking a site's identity as data.

It arrives with a zero diff behind it rather than ahead of it. Two instances converged their
`Base`, `Header` and `Footer` to byte-identical files one value at a time, and this package is
those files with the values lifted into a `SiteIdentity` prop. Adopting it changes nothing a reader
sees: 374 pages, no rendered difference once Astro's scoped-style hashes are normalized.

The first package here to ship unbuilt `.astro` source. `tsc` builds the TS half and ignores the
components; `files` carries both; Astro compiles them at the consumer, and `astro check` enforces
their props across the package boundary.

Two consumer-side steps fail SILENTLY and are documented as such in the README: pointing Tailwind
at the package with `@source`, and defining the tokens the shell names. A missing `@source` builds
green and renders unstyled — and so does a misspelled one, which is why the README asks for a canary
assertion rather than a careful reading.

`resolveNav` is the shell's only real behaviour, and it is now tested: sixteen per-entry `match`
closures across the two instances, fifteen of them the same line, become one rule with fourteen
cases against it.
