import type { KnipConfig } from 'knip';

/**
 * TypeScript rather than JSON because this repo needs a compiler, which JSON cannot hold.
 *
 * site-kit publishes Astro components as entry points — `exports` maps a subpath straight at each
 * one — so what a component imports is a real dependency of the package. Without a compiler knip
 * reads only the `.ts` beside them, finds no importer, and reports a dependency the shipped card
 * cannot render without as unused. An `ignoreDependencies` entry would have silenced that at the
 * cost of silencing the next one too.
 *
 * knip takes compilers only at the root, so it then hints that the other workspaces exclude the
 * extension it compiles. There is no configuration that satisfies it: adding `.astro` to their
 * project globs trades those hints for seven "no matches" ones, and suppressing hints wholesale
 * would hide the next real bit of config drift. The hints are accurate and do not fail the run —
 * one workspace has Astro files, and it is the one that lists them.
 */
const config: KnipConfig = {
  compilers: {
    // Everything knip needs is inside the `---` fence. The template and styles below it hold no
    // imports, and handing them over makes knip parse markup as code.
    astro: (text: string) => text.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '',
  },
  workspaces: {
    '.': { entry: ['scripts/*.mjs'], project: ['scripts/*.mjs'] },
    'packages/audit-citations': {
      entry: ['test/**/*.test.ts'],
      project: ['src/**/*.ts', 'test/**/*.ts'],
    },
    'packages/cast': { entry: ['test/**/*.test.ts'], project: ['src/**/*.ts', 'test/**/*.ts'] },
    'packages/kind-manifest': {
      entry: ['test/**/*.test.ts'],
      project: ['src/**/*.ts', 'test/**/*.ts'],
    },
    'packages/license-policy': {
      entry: ['test/**/*.test.ts'],
      project: ['src/**/*.ts', 'test/**/*.ts'],
    },
    'packages/reference-contract': {
      entry: ['test/**/*.test.ts'],
      project: ['src/**/*.ts', 'test/**/*.ts'],
    },
    'packages/site-kit': {
      entry: ['test/**/*.test.ts', 'src/components/*.astro'],
      project: ['src/**/*.ts', 'src/**/*.astro', 'test/**/*.ts'],
    },
    'packages/tag-registry': {
      entry: ['test/**/*.test.ts'],
      project: ['src/**/*.ts', 'test/**/*.ts'],
    },
  },
};

export default config;
