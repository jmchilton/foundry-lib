# @galaxy-foundry/site-kit

## 0.9.0

### Minor Changes

- [#84](https://github.com/jmchilton/foundry-lib/pull/84) [`334ff13`](https://github.com/jmchilton/foundry-lib/commit/334ff134c9d8c1eaac5087d1670449342e17cd57) Thanks [@jmchilton](https://github.com/jmchilton)! - A tag chip is coloured as a link, because that is what it is.

  `TagChips` drew a bordered mono pill on `--color-surface-raised`. Both instances that arrived at
  this component use exactly that treatment for frontmatter shown as written — a Pattern's pole, a
  design record's shelf, a note's status — so the chip and the pill beside it differed only in corner
  radius: same surface, same border colour, same face, same size, and on a status pill the same text
  colour. Both are legible. Neither says which one is clickable.

  Both instances had already removed that pill before the package reintroduced it, and one of them
  recorded why in the test it wrote at the time: "A chip spelled out at the call site renders on the
  right page, in the right place, with the right text, and is simply a different chip." Adopting the
  package put the chip back and rewrote the rule to permit it.

  The instance could not have corrected this. These styles are scoped, so an instance's own `.tag`
  rule cannot reach a rendered chip; `CONTENT_READER_TOKENS` is the entire surface it can steer them
  through. So the list is now what the chip actually reads: `--color-surface-hover`, `--color-link`,
  `--color-accent` and `--color-chrome` replace `--color-brand`, `--color-surface-raised`,
  `--color-border-subtle` and `--font-mono`. Both instances already declare all four, at identical
  values.

  Also pinned here: a linked chip carries the chip class. The linked form is the one every note page
  renders and the one nothing checked — the existing case read its `href` and said nothing about its
  class, so the only spelling under test was the unlinked one no adopting instance renders.

## 0.8.0

### Minor Changes

- [#77](https://github.com/jmchilton/foundry-lib/pull/77) [`62aa2bd`](https://github.com/jmchilton/foundry-lib/commit/62aa2bd276f037fd30871c6962edbfe9f71d8307) Thanks [@jmchilton](https://github.com/jmchilton)! - Extract the collection-backed content-reading plumbing and invariant note frame proven by the
  Statistical Genomics Foundry so new Foundry instances do not grow independent Astro infrastructure.

  `@galaxy-foundry/content-reader` owns filesystem enumeration from a collection table, note-id
  derivation, collection-backed wiki-link maps, and the remark/raw-Markdown bindings over that map.
  Instances keep their schema assembly, routing policy, registries, domain model, and alias
  vocabulary. Optional alias derivation reads routed-note frontmatter once and makes it available to
  route targets for summary tooltips, while readers without aliases retain the directory-only path.

  `@galaxy-foundry/site-kit` gains `ContentNote.astro` and `TagChips.astro`. The note frame provides
  semantic slots for instance metadata, badges, references, and prose while keeping package facts,
  source attribution, Mold state, and all other domain furniture outside the package.

## 0.7.0

### Minor Changes

- [#72](https://github.com/jmchilton/foundry-lib/pull/72) [`a8924f4`](https://github.com/jmchilton/foundry-lib/commit/a8924f4dae6b268e2e91b172b11a587d87dbc7fe) Thanks [@jmchilton](https://github.com/jmchilton)! - Specimens for every component the package ships, not four of six.

  `LICENSE_BADGE_SPECIMENS` and `LICENSE_FILE_SPECIMENS` cover the licence badge and the licence-file
  body — read against the table `@galaxy-foundry/license-policy` bundles rather than an invented one,
  because what a licence permits is the same in every instance. `LicenseBadgeProps` and
  `LicenseFileBodyProps` are exported for the same reason the other four are: a caller building props
  should type them against the declaration the component reads them from.

  A test now compares the groups against the components directory in both directions, so a component
  that ships with no cases fails in the package rather than being noticed by whoever builds a gallery.

## 0.6.1

### Patch Changes

- [#70](https://github.com/jmchilton/foundry-lib/pull/70) [`cd29e09`](https://github.com/jmchilton/foundry-lib/commit/cd29e09f5780140d17d701b6840a369ce2778ee0) Thanks [@jmchilton](https://github.com/jmchilton)! - `LicenseFileBody` gives the licence text a section and an `<h2>` of its own.

  Without one the document outline puts the licence — the thing the page IS — inside the
  "Redistributed by" section, which is a list of notes. A reader moving by heading arrives at the note
  list and finds no heading for the terms; the section simply ends where the text begins, and nothing
  says so.

  One instance shipped this heading and the other did not, and the component followed the one that did
  not. That is the same kind of unchosen difference as the badge's padding, so it is settled here
  rather than made a prop. Instances adopting the route supply one `<h1>` and nothing between it and
  the component.

## 0.6.0

### Minor Changes

- [#68](https://github.com/jmchilton/foundry-lib/pull/68) [`c8dd6ea`](https://github.com/jmchilton/foundry-lib/commit/c8dd6eaf29efdea474bc2809569b11682645c3e9) Thanks [@jmchilton](https://github.com/jmchilton)! - `LicenseBadge.astro`: what a licence permits, as chips, from the id a note declares.

  Both instances that depend on `@galaxy-foundry/license-policy` wrote this row themselves and
  reached the same three colours as literals — `#16a34a`, `#d97706`, `#dc2626` — in two
  repositories. The markup agreed as well; only the padding and the letter-spacing differed, by
  amounts nobody chose. Those are settled here rather than parameterized.

  The badge takes the policy table as a prop and reads nothing else off the note. It renders the
  row's `name` rather than the SPDX id, which equals the id in 1 of 23 rows, and keeps the id as the
  chip's `title`. The policy chip is keyed on `data-policy`, so a row added upstream is styled
  without a component release — the rule the reference card already follows for evidence standings.

  `LICENSE_BADGE_TOKENS` and `licenseBadgeStyleGaps` name the custom properties the badge reads and
  does not define. The three policy hues are the reason: a chip whose background resolves to nothing
  is still legible and no longer distinguishable from the chip beside it that means the opposite.

- [#68](https://github.com/jmchilton/foundry-lib/pull/68) [`fec0034`](https://github.com/jmchilton/foundry-lib/commit/fec003499b307fe2163ad0460f40eb375d86ee85) Thanks [@jmchilton](https://github.com/jmchilton)! - The vendored-licence route: `LicenseFileBody.astro`, `licenseFileHref`, `licensesUnderFile`,
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

### Patch Changes

- Updated dependencies [[`e5c7578`](https://github.com/jmchilton/foundry-lib/commit/e5c75788a78b0f3cd1eb688743b5fd7cf0072f3f), [`fec0034`](https://github.com/jmchilton/foundry-lib/commit/fec003499b307fe2163ad0460f40eb375d86ee85)]:
  - @galaxy-foundry/license-policy@0.4.0

## 0.5.0

### Minor Changes

- [#65](https://github.com/jmchilton/foundry-lib/pull/65) [`4622c0c`](https://github.com/jmchilton/foundry-lib/commit/4622c0c13e3b03a99f73ba191c6ae83d13567a63) Thanks [@jmchilton](https://github.com/jmchilton)! - Ship the cases the components handle, as props a gallery can render.

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

## 0.4.2

### Patch Changes

- Updated dependencies [[`befe66a`](https://github.com/jmchilton/foundry-lib/commit/befe66a7386e7ba6a0e68e2c317af2772f36f0b5)]:
  - @galaxy-foundry/reference-contract@0.4.0

## 0.4.1

### Patch Changes

- [#60](https://github.com/jmchilton/foundry-lib/pull/60) [`b3484a4`](https://github.com/jmchilton/foundry-lib/commit/b3484a495d8e7c176fe38fdc294f7dceb7a96e2d) Thanks [@jmchilton](https://github.com/jmchilton)! - A reference pill is a link only when it has somewhere to go.

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

## 0.4.0

### Minor Changes

- [#58](https://github.com/jmchilton/foundry-lib/pull/58) [`937af16`](https://github.com/jmchilton/foundry-lib/commit/937af165f4dc0efec6e382aa2992209d8a93dbbf) Thanks [@jmchilton](https://github.com/jmchilton)! - Fill the search box the header has been rendering.

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

## 0.3.0

### Minor Changes

- [#54](https://github.com/jmchilton/foundry-lib/pull/54) [`c99f685`](https://github.com/jmchilton/foundry-lib/commit/c99f685b402f9577f142d37a5e29ff5d6e6ab972) Thanks [@jmchilton](https://github.com/jmchilton)! - Ship the reference card, not just the vocabulary behind it.

  `@galaxy-foundry/site-kit/ReferenceContract.astro` renders a note's typed `references:` manifest.
  One instance had written this component; the other depended on
  `@galaxy-foundry/reference-contract`, loaded it, wired it into its registries and validated twelve
  notes' worth of references against it — with no component that read any of it. The package shipped
  the data and left the view to be reinvented, so one site reinvented it and one never did. Nothing
  failed.

  `REFERENCE_TOKENS` and `referenceStyleGaps` are the card's half of the style contract, and
  `styleGaps` is the shared rule `shellStyleGaps` was. The card ships its own stylesheet, so an
  instance cannot fail to write a rule — but a scoped `var(--color-brand)` resolving to nothing
  renders exactly like a design decision, which is what the list is for. Two tests read the component
  itself, so the list cannot drift from the file it describes in either direction.

  Two things the card deliberately does not decide. Per-kind accents: `kinds` is the one group an
  instance declares, so each card carries `data-kind` and an instance sets `--color-kind-accent`,
  with `--color-brand` behind it. And evidence colour, which comes from the `standing` a term now
  declares rather than from a list of term names in a selector.

  Adds a dependency on `@galaxy-foundry/reference-contract`.

### Patch Changes

- Updated dependencies [[`37e3120`](https://github.com/jmchilton/foundry-lib/commit/37e312096e35eb196abe0635a1643e5174e390e8)]:
  - @galaxy-foundry/reference-contract@0.3.0

## 0.2.0

### Minor Changes

- [#46](https://github.com/jmchilton/foundry-lib/pull/46) [`4637659`](https://github.com/jmchilton/foundry-lib/commit/463765931dd1e91177e9e8d2cb2e16d665ecc4a4) Thanks [@jmchilton](https://github.com/jmchilton)! - **Consumers must rename one token.** The shell's dark bar reads `--color-chrome`, not
  `--color-galaxy-dark`. One line in your `global.css` is enough, and keeps your brand token
  meaning the brand:

  ```css
  --color-chrome: var(--color-galaxy-dark);
  ```

  Miss it and there is no error: the utility still compiles to `var(--color-chrome)`, the property
  resolves to nothing, and the header, the "More" menu and the footer render with no background.
  `shellStyleGaps` below reports exactly this.

  The old name was a brand in a contract, and the bill went to instances that are not that brand — a
  statistical-genomics site was declaring `--color-galaxy-primary: #25537b` to get a header bar. The
  kit names roles now; an instance maps its palette onto them.

  Also exports the style contract as values instead of stating it in the README: `SHELL_TOKENS` (the
  six custom properties the shell names and does not define), `SHELL_CLASSES` (`.skip-link`,
  `.bg-grid`, `.nav-link-active`) and `shellStyleGaps(css)`, which reports what a built stylesheet
  does not supply.

  The helper exists rather than the list alone because the obvious loop is wrong in a way that
  passes. A token counts only when its DECLARATION is present, so the search needs the colon —
  `--color-chrome` on its own also matches the shell's own `var(--color-chrome)`, which is emitted on
  every site including one with no `@theme` block at all. Tailwind 4 tree-shakes theme variables
  nothing references, so a declaration reaching the output is evidence of both halves: the instance
  defined the token, and something asked for it.

  Not breaking for anything that reads this package's TypeScript — no existing export changed.

### Patch Changes

- [#52](https://github.com/jmchilton/foundry-lib/pull/52) [`26d830d`](https://github.com/jmchilton/foundry-lib/commit/26d830d852c2ba0148f61bfb89ef04eee08d973d) Thanks [@jmchilton](https://github.com/jmchilton)! - Point reference-contract term documentation at the rendered Foundry Pattern page, and correct
  site-kit's peer metadata to the Pagefind 2 component contract its shipped Astro source uses.
  Replace audit-citations' text pipeline with the accessible SVG used by the architecture guide.

  The Pagefind range correction excludes no published compatible version: `astro-pagefind` moved from
  1.8.6 directly to 2.0.0, so the former `>=1.9` range already resolved only to 2.x releases.

## 0.1.0

### Minor Changes

- [#37](https://github.com/jmchilton/foundry-lib/pull/37) [`4c793d7`](https://github.com/jmchilton/foundry-lib/commit/4c793d7ee7ac012f6aa163e82443984360b6fa4b) Thanks [@jmchilton](https://github.com/jmchilton)! - New package: the reading shell — document skeleton, header with derived navigation, and footer, as
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
