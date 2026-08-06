# @galaxy-foundry/site-kit

The reading shell for Foundry-pattern instances: document skeleton, header with derived navigation,
and footer. The kit ships the **markup, structural component styles, and client behavior**; the
instance supplies the **identity values, global theme contract, and corpus**.

```sh
pnpm add @galaxy-foundry/site-kit
```

## Two lines of configuration, both of which fail silently

This is the part to get right first, because neither mistake produces an error.

**1. Point Tailwind at the kit.** Tailwind 4's automatic source detection does not look inside
`node_modules`, so without this every utility the shell writes is missing from your stylesheet. The
build stays green and the site renders unstyled.

```css
/* your global.css, after @import "tailwindcss" */
@source "../../node_modules/@galaxy-foundry/site-kit/src";
```

A typo here is exactly as silent as omitting the line — `site-kitt` builds as cleanly as `site-kit`.
**You cannot verify this line by reading it.** Assert instead that a class only the kit writes
reaches your emitted CSS; `min-h-dvh` is a good canary, because the kit's `<body>` is the only place
it appears.

**2. Define the tokens.** The kit brings no global theme stylesheet. It names six custom properties
and wears three instance-owned classes, and you supply all nine — `SHELL_TOKENS` and
`SHELL_CLASSES` are exported so the list is a value you can check rather than a paragraph you can
read carefully. Component-scoped rules still own the overflow menu, header grid, and Pagefind
layout; those are package behavior rather than instance theme values.

```css
@theme {
  --color-chrome: #2c3143; /* the dark bar: header, More menu, footer */
  --color-accent: #e8c547;
  --color-surface: #ffffff;
  --color-text-primary: #2c3143;
  --color-text-on-dark: #f8f9fa;
  --font-sans: 'Atkinson Hyperlegible', system-ui, sans-serif;
}
```

Plus `.skip-link`, `.bg-grid` and `.nav-link-active`, which are ordinary classes rather than
utilities — Tailwind never has an opinion about them, so a missing one is markup wearing a class no
rule matches.

Miss any of the nine and that piece of the shell renders unstyled, silently. Assert on a built
stylesheet:

```ts
import { shellStyleGaps } from '@galaxy-foundry/site-kit';

expect(shellStyleGaps(everyEmittedStylesheet)).toEqual([]);
```

Use the helper rather than writing the loop. A token counts only when its **declaration** is
present, so the search needs the colon: `--color-chrome` on its own also matches the shell's own
`var(--color-chrome)`, and the check passes on exactly the sites it exists to fail.

The names are ROLES, not brands. `--color-chrome` is the dark bar; what your instance calls that
colour is its own business, and one line maps it: `--color-chrome: var(--color-my-brand-dark);`

## Use

One composition point. Every page keeps importing your own layout, which passes the identity
through:

```astro
---
// src/layouts/Base.astro
import '../styles/global.css';          // FIRST — import order decides where the <link> lands
import SiteShell from '@galaxy-foundry/site-kit/SiteShell.astro';
import { SITE_IDENTITY } from '../lib/site-identity';

interface Props { title: string; description?: string }
const { title, description } = Astro.props;
---
<SiteShell
  title={title}
  description={description}
  base={import.meta.env.BASE_URL}
  pathname={Astro.url.pathname}
  identity={SITE_IDENTITY}
>
  <slot />
</SiteShell>
```

`base` and `pathname` are passed IN rather than read by the kit, so the kit touches no environment.
That is not tidiness: under vitest, `import.meta.env.BASE_URL` is mirrored into `process.env` as
`/`, and a child `astro build` prefers it over your `astro.config.mjs`. A test suite that spawns a
build can otherwise spend months asserting against a site deployed at the wrong base.

Your `site-identity.ts` is the whole of what makes the site itself:

```ts
import type { SiteIdentity } from '@galaxy-foundry/site-kit';

export const SITE_IDENTITY: SiteIdentity = {
  name: 'Foundry',                    // wordmark and <title> suffix
  fullName: 'Galaxy Workflow Foundry', // footer
  description: '…',
  repoUrl: 'https://github.com/…',
  navLinks: [{ path: '/story/', label: 'Story' }, …],
  navVisible: 5,                       // the rest go under "More"
  footerLinks: [],
};
```

## What is a value and what is not

`navVisible` is a count set by what FITS on the bar, not a claim about which sections matter — and
what fits differs between instances because the wordmark does. Measure it against a built page.

The reading column's width is deliberately **not** a prop. The two instances this shell came from
disagreed about it once, and the disagreement was never decided: one shell was copied from the
other and the width changed in the same edit as the name. They converged before the shell moved, so
the kit holds the measure and takes no prop for it. A page wanting a narrower measure narrows its
own content. See `CONTAINER`.

Parameterizing a difference is how an accident becomes a policy.

## The reference card

`ReferenceContract.astro` renders a note's typed `references:` manifest against the contract it was
authored under. Unlike the shell it brings its own stylesheet, so there are no classes to define —
only the tokens its rules read, listed as `REFERENCE_TOKENS` and checked with `referenceStyleGaps`.

```astro
---
import ReferenceContract from '@galaxy-foundry/site-kit/ReferenceContract.astro';
import { referenceContract } from '../lib/registries';
---
<ReferenceContract
  references={entry.data.references ?? []}
  contract={referenceContract}
  resolveRef={(ref) => resolveWikiLink(ref, linkMap, base)}
/>
```

`resolveRef` is a function rather than a link map because how a `ref` becomes an href is the
instance's question — one spells wiki links, another paths — and returning `null` leaves the ref on
the page as written.

Which reference **kinds** exist is the one part of the contract an instance declares for itself, so
the card ships no per-kind colour. Each card carries `data-kind`, and an instance tints its own:

```css
[data-kind='mold'] {
  --color-kind-accent: var(--color-accent);
}
```

A kind nothing tints gets `--color-brand`. That is a real answer, not a missing one — which is why
`--color-kind-accent` is a fallback and not in `REFERENCE_TOKENS`.

Evidence chips are styled from the standing each term **declares**
(`@galaxy-foundry/reference-contract` ships `standing: provisional | grounded`), not from a list of
term names in a selector. A term added to the vocabulary gets a colour without a component release.

## The licence badge

`LicenseBadge.astro` renders what a licence **permits**, from the id a note declares and the table
in `@galaxy-foundry/license-policy`: the licence name, its redistribution policy, and a copyleft
chip where the row calls for one.

```astro
---
import LicenseBadge from '@galaxy-foundry/site-kit/LicenseBadge.astro';
import { licensePolicy } from '../lib/registries';
---
<LicenseBadge license={entry.data.license} policy={licensePolicy} />
```

The table is passed in rather than bundled. An instance validates its corpus against one specific
version of the policy, and a component reaching for its own copy could disagree with the schema
that admitted the note.

**What the badge is not** is the box around it. It reads `license` and the row, and nothing else —
no `license_file`, no attribution line, no link. That boundary is the policy table's own, stated in
its header comment: what a licence permits is shared, whether a _note_ is right about its licence
is instance-local. The credit line a particular source needs, and whether a vendored copy travels
with it, are the second question and stay per-instance.

The chip label is the row's `name`, not the SPDX id, which stays reachable as the chip's `title`.
`name` equals the id in 1 of 23 rows — rendering the id is fine for `MIT`, survives `Apache-2.0`,
and turns `LicenseRef-arXiv-nonexclusive-distrib-1.0` into a pill that teaches a reader nothing.

The policy chip is keyed on `data-policy`, the row's own value, so a row added upstream is styled
without a component release. Its three colours are `LICENSE_BADGE_TOKENS`, checked with
`licenseBadgeStyleGaps` — they were raw hexes in both instances that grew this component, the same
three to the byte, which is a duplication nothing could have caught and nothing could change.

```css
:root {
  --color-license-verbatim: #16a34a;
  --color-license-own-words: #d97706;
  --color-license-copyleft: #dc2626;
}
```

Named for the policy rather than the palette: `--color-license-own-words` is whatever this site
uses to mean "this text may not be redistributed".

## The vendored-licence route

A site that redistributes third-party text carries verbatim copies of the upstream licences, and
renders them in-app so a note can link terms without bouncing the reader to GitHub. Both instances
built that route, and both spelled its path inline — once in the page that builds it and again in
every component that links to it.

```astro
---
import LicenseFileBody from '@galaxy-foundry/site-kit/LicenseFileBody.astro';
import { licenseFileHref, type LicenseFileUse } from '@galaxy-foundry/site-kit';
import { redistributesUnder } from '@galaxy-foundry/license-policy';

const uses: LicenseFileUse[] = notes
  .filter((note) => redistributesUnder(note.data.license_file, licenseFile.id))
  .map((note) => ({ href: `${base}/${note.id}/`, label: note.id, licenseId: note.data.license }));
---
<h1>{licenseFile.filename}</h1>
<LicenseFileBody licenseFile={licenseFile} policy={licensePolicy} uses={uses} />
```

`licenseFileHref(base, licenseFile)` builds the link, and takes either a `LicenseFileId` or the
`license_file` path a note declares — the two call sites hold different ones. It is built from
`LICENSE_FILE_ROUTE`, which the page that generates the route uses as well, so the two cannot
drift into a clean build that 404s.

**Finding the notes stays yours.** One instance walks a single collection and links `/{id}/`; the
other walks three and links `/{collection}/{id}/`. That is the one genuinely per-instance step, so
`uses` is a prop. Filter with `redistributesUnder` rather than comparing ids by hand: a vendored
copy is keyed by **source**, so two books under one licence have two copies, and the comparison is
between file ids even though it reads like a licence check.

**The page's `<h1>` and wrapper stay yours too**, and that one is not taste. One site marks this
route with `data-pagefind-body`; Pagefind reads the first such mark as "index only pages like this
one", so a component shipping the wrapper would decide a whole site's search index from inside a
licence page. See "The search index" below.

`licensesUnderFile(policy, uses)` is exported separately for a page that wants the licences a copy
covers without the body — deduped and sorted, rather than ordered by whichever note was read first.

Tokens: `LICENSE_FILE_TOKENS`, checked with `licenseFileStyleGaps`.

## The search index

The header renders a Pagefind search box. What goes IN the index is the other half, and its rule
runs backwards from what the annotation looks like:

- Mark **no** page with `data-pagefind-body` → every page is indexed, from its `<body>`.
- Mark **one** page → every unmarked page leaves the index entirely.

So adding the attribute to a single route is strictly worse for the rest of the site than never
adding it. Measured on a real instance: one annotated route, and the index held **242 of 374 pages**
— missing every artifact page, every tag page, the glossary, the dashboard, and 48 generated skill
pages. The build log printed `Pagefind indexed 374 pages` in both states, because it counts pages
processed rather than pages indexed. Nothing warns, nothing looks wrong, and the only symptom is a
search that answers "no results" for words plainly on the site.

`SiteShell` therefore puts the attribute on `<main>` **by default**. Opt out per page:

```astro
<SiteShell title="Tags" base={base} pathname={pathname} identity={SITE_IDENTITY} searchable={false}>
```

Marking `<main>` rather than falling back to `<body>` also keeps the header, nav and footer out of
every result's excerpt.

Then assert the whole built site, listing the routes that opted out:

```ts
const pages = builtPages(); // [{ path, html }, …] from dist
expect(searchIndexGaps(pages, UNSEARCHABLE)).toEqual([]);
```

The list is what makes an absence a decision. Without one, "deliberately out of the index" and
"nobody thought about this route" are the same observation — which is how 132 of them accumulated.

## Specimens, and the gallery each instance builds from them

The kit ships the cases its components are meant to handle, as props:

```ts
import { REFERENCE_SPECIMENS } from '@galaxy-foundry/site-kit/specimens';
```

Each entry is `{ id, name, why, props }`, grouped per component with its own `id`, a `summary` and
a `surface`. Rendering a group is a page of your own, in your own theme:

```astro
---
import ReferenceContract from '@galaxy-foundry/site-kit/ReferenceContract.astro';
import { REFERENCE_SPECIMENS, specimenPath } from '@galaxy-foundry/site-kit/specimens';
---
{REFERENCE_SPECIMENS.specimens.map((specimen) => (
  <section id={specimenPath(REFERENCE_SPECIMENS, specimen)}>
    <h2>{specimen.name}</h2>
    <p>{specimen.why}</p>
    <ReferenceContract {...specimen.props} />
  </section>
))}
```

**The theme is the specialization.** Nothing here carries a colour, and that is the point: the same
cases rendered under two instances' tokens are two galleries, and what differs between
them is exactly what each instance owns. An instance adds groups of its own for its own components
in the same shape — and a group's `id`, not its `component`, is its address, because an instance's
extra group for a kit component is the ordinary case: the parent Foundry adds a second
`ReferenceContract` group for its own seven kinds.

**`surface` is not decoration.** A group is `inline` (many to a page), `isolated` (one to a page or
one per frame — valid inline markup carrying document-unique `id`s, which the header does), or
`document` (its own `<html>`, so it needs a route and an `<iframe>`). Getting it wrong does not
fail: two headers on one page is two `#nav-more-trigger`, the second one's menu binds nothing, and
the specimen that exists to prove the overflow menu opens is the one that appears not to. Use
`sharesPage(group)` rather than reading the field.

`why` is what makes a specimen more than a screenshot. `no-references` renders **nothing** — a
correct result indistinguishable from a broken gallery until something says which it is.

The reference specimens carry their own `SPECIMEN_CONTRACT` rather than taking yours. Half of them
are about terms your contract does not contain — a kind with no destination, a value outside the
vocabulary — and fed a real contract they would collapse into the same happy-path card. Say whose
vocabulary is on screen; then add your own kinds' specimens beside them.

## Exports

| Import                                             | What                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@galaxy-foundry/site-kit`                         | `SiteIdentity`, `ShellLink`, `ResolvedShellLink`, `ResolvedNav`, `resolveNav`, `shellBase`, `shellHref`, `CONTAINER`, `SHELL_TOKENS`, `SHELL_CLASSES`, `shellStyleGaps`, `styleGaps`, `REFERENCE_TOKENS`, `referenceStyleGaps`, `LICENSE_BADGE_TOKENS`, `licenseBadgeStyleGaps`, `LICENSE_FILE_ROUTE`, `licenseFileHref`, `LicenseFileUse`, `licensesUnderFile`, `LICENSE_FILE_TOKENS`, `licenseFileStyleGaps`, `ResolvedReference`, `PAGEFIND_BODY_ATTR`, `searchIndexGaps`, `SiteShellProps`, `SiteHeaderProps`, `SiteFooterProps`, `ReferenceContractProps` |
| `@galaxy-foundry/site-kit/specimens`               | `Specimen`, `SpecimenGroup`, `SpecimenSurface`, `SPECIMENS`, `REFERENCE_SPECIMENS`, `HEADER_SPECIMENS`, `FOOTER_SPECIMENS`, `SHELL_SPECIMENS`, `SPECIMEN_CONTRACT`, `sharesPage`, `specimenPath`                                                                                                                                                                                                                                                                                                                                                               |
| `@galaxy-foundry/site-kit/SiteShell.astro`         | the shell component                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `@galaxy-foundry/site-kit/SiteHeader.astro`        | the header alone — a gallery cannot show it otherwise                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `@galaxy-foundry/site-kit/SiteFooter.astro`        | the footer alone                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `@galaxy-foundry/site-kit/ReferenceContract.astro` | the reference card                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `@galaxy-foundry/site-kit/LicenseBadge.astro`      | the licence badge                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `@galaxy-foundry/site-kit/LicenseFileBody.astro`   | the vendored-licence page body                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

`resolveNav` is exported because it is the only part of the shell with behaviour worth asserting
on: a destination is active on its own page and everything beneath it, compared on whole path
segments, so `/tag/` does not light up on `/tags/`.

`shellStyleGaps` is exported for the opposite reason — it asserts on something the kit deliberately
does NOT do. See "Define the tokens" above. `referenceStyleGaps` and `licenseBadgeStyleGaps` are
the same check for the card and the badge, and all three are `styleGaps` with a different list.

The shell also owns a small client runtime: initial dark-mode selection, persisted theme toggling,
Pagefind palette synchronization, and the overflow menu's click, outside-click, and Escape-key
behavior. Read [Site-kit runtime architecture](https://jmchilton.github.io/foundry-lib/#/architecture/site-kit-runtime)
before replacing or wrapping those controls.

## Peer dependencies

`astro` 6 or later and `astro-pagefind` 2 or later — the header renders the Pagefind 2 search-box
component and styles its `pf-searchbox` structure.

The `.astro` components ship as **source**, not built output. Astro compiles them in your build.
