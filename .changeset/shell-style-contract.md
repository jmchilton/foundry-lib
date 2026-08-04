---
'@galaxy-foundry/site-kit': minor
---

**Consumers must rename one token.** The shell's dark bar reads `--color-chrome`, not
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
