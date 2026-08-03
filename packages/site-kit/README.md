# @galaxy-foundry/site-kit

The reading shell for Foundry-pattern instances: document skeleton, header with derived navigation,
and footer. The kit ships the **markup and the rules**; the instance supplies the **values, the
stylesheet and the corpus**.

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

**2. Define the tokens.** The kit brings no stylesheet. It names
`--color-galaxy-dark`, `--color-accent`, `--color-surface`, `--color-text-primary`,
`--color-text-on-dark` and `--font-sans`, and three classes you define: `.skip-link`, `.bg-grid`,
`.nav-link-active`. Miss one and that piece of the shell renders unstyled — again, silently.

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

## Exports

| Import                                     | What                                                                                                                 |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `@galaxy-foundry/site-kit`                 | `SiteIdentity`, `ShellLink`, `ResolvedShellLink`, `ResolvedNav`, `resolveNav`, `shellBase`, `shellHref`, `CONTAINER` |
| `@galaxy-foundry/site-kit/SiteShell.astro` | the shell component                                                                                                  |

`resolveNav` is exported because it is the only part with behaviour worth asserting on: a
destination is active on its own page and everything beneath it, compared on whole path segments,
so `/tag/` does not light up on `/tags/`.

## Peer dependencies

`astro` and `astro-pagefind` — the header renders a Pagefind search box.

The `.astro` components ship as **source**, not built output. Astro compiles them in your build.
