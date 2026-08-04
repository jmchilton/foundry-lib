# Site-kit runtime architecture

`@galaxy-foundry/site-kit` is an Astro document shell, not a theme or a complete site. It ships the
document skeleton, header, footer, navigation rules, small client-side controls, and the structural
styles those controls require. A consuming Foundry supplies identity, corpus, routes, and its global
visual contract.

## Ownership boundary

| Concern                         | Package                 | Consuming Foundry                    |
| ------------------------------- | ----------------------- | ------------------------------------ |
| Document skeleton and landmarks | owns                    | wraps through its local layout       |
| Header/footer markup            | owns                    | supplies identity and links          |
| Active navigation and overflow  | derives                 | supplies one ordered link list       |
| Deployment base and pathname    | consumes as props       | reads from Astro                     |
| Theme tokens and global classes | names and checks        | defines                              |
| Structural component styles     | owns                    | compiles from shipped source         |
| Dark-mode state and controls    | owns browser behavior   | supplies token values for both modes |
| Search UI                       | embeds `astro-pagefind` | configures and indexes the site      |
| Corpus and note rendering       | does not own            | owns                                 |

`SiteIdentity` is data rather than an application singleton. `SiteShell` also receives `base` and
`pathname` explicitly, so the package never reads a consumer's build environment or guesses its
deployment root.

## Build and runtime flow

![Site-kit flow from a consumer Astro layout through Astro compilation, Tailwind scanning, and consumer CSS to the browser runtime.](assets/diagrams/site-kit-runtime.svg)

The components ship as `.astro` source instead of precompiled JavaScript. This keeps Astro's normal
component compilation and scoped-style behavior at the consumer boundary, but it also means the
consumer must include the package source in Tailwind scanning.

## The CSS contract has two owners

The package does not ship a complete global theme stylesheet. The consumer defines six role-based
custom properties and three global classes listed by `SHELL_TOKENS` and `SHELL_CLASSES`.
`shellStyleGaps` checks emitted CSS rather than source declarations, catching a missing token or
global class. A separate package-only utility canary checks whether Tailwind scanned the source.

The package does own structural component styles that should not become instance policy:

- the header grid texture;
- visibility and rotation rules for the overflow menu; and
- Pagefind search-box sizing, palette inputs, dropdown anchoring, and stacking.

This is why “the consumer owns the theme” does not mean “the package ships no CSS.” Brand and role
values remain local; behavior-critical structure travels with the component that needs it.

## Navigation is derived once

The consumer provides one ordered `navLinks` list and a `navVisible` cut point. `resolveNav` applies
the deployment base, marks a destination active on its own route and descendants using whole path
segments, and divides the result into the bar and `more` list.

When `more` is empty, the component emits neither the overflow control nor its client script. When
present, the menu opens through hover, focus, or click; closes on an outside click or Escape; and
exposes its state through `aria-expanded`. `navVisible` therefore describes measured available
space, not relative importance.

Footer links use the same site-relative `ShellLink` shape and receive the deployment base. The
repository URL is a separate absolute value on `SiteIdentity`.

## Theme state is package behavior

An inline head script chooses the initial mode before the body renders. It reads the `theme`
`localStorage` key when present and otherwise follows `prefers-color-scheme`. It synchronizes two
representations:

- the `.dark` class used by the consuming stylesheet; and
- `data-pf-theme`, which selects the Pagefind component palette.

The header toggle updates both values and persists `light` or `dark`. A wrapper that replaces the
toggle or changes the storage contract must preserve both representations or intentionally take
ownership of Pagefind theming too.

These controls are plain inline scripts rather than a hydrated framework island. They add no client
framework runtime, and their document-level IDs assume one `SiteShell` per HTML document—the shape
the component itself enforces by owning the document skeleton.

## Compatibility and silent failures

The supported integration is Astro 6 or later, Tailwind 4, and `astro-pagefind` 2 or later. Pagefind
2 matters because the component styles its `pf-searchbox` structure and uses its search-box
options.

Two consumer mistakes remain silent at build time:

1. Tailwind does not scan the package's `src` directory, so utility rules are absent.
2. The consumer does not define the exported tokens or global classes, so markup references values
   and selectors that never resolve.

The package README gives the required `@source` directive and recommends a package-only utility as
a scan canary. `shellStyleGaps` covers the token/class half. Both checks belong against built output,
because reading a correctly spelled source file cannot prove Tailwind emitted it.

Continue with the
[`site-kit` package README](https://github.com/jmchilton/foundry-lib/tree/main/packages/site-kit) for
the integration snippet or the [generated reference](api/typedoc/index.html ':ignore') for its
TypeScript exports.
