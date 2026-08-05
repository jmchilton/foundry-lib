import { getViteConfig } from 'astro/config';

// The first config in this workspace, and it exists for one reason: vitest cannot parse `.astro`
// without Astro's own Vite plugin, so a test that RENDERS a component fails at import with a JSX
// syntax error rather than at an assertion.
//
// `getViteConfig` rather than a hand-assembled plugin list — the transform a component gets under
// test is then the transform it gets in a build, which is the only version worth asserting about.
export default getViteConfig(
  {
    test: {
      include: ['test/**/*.test.ts'],
      environment: 'node',
    },
  },
  // This package is components, not a site, so it has no `src/pages` and Astro says so on every
  // run. The warning is correct and not actionable — quieting it keeps a real one legible.
  { logLevel: 'error' },
);
