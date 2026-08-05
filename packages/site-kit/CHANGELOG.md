# @galaxy-foundry/site-kit

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
