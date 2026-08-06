// @ts-check
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import pagefind from 'astro-pagefind';

/**
 * The reference gallery, built into the documentation site.
 *
 * `outDir` writes into `docs/`, which the Documentation workflow uploads to Pages whole — the same
 * path the generated API reference takes. So this deploys with the docs rather than through a
 * second pipeline, and the docsify site links it as an ordinary page.
 *
 * `pagefind` is here because the shell's header renders a search box: the component imports
 * `astro-pagefind/components/Search.astro` unconditionally, so a gallery without the integration
 * builds a box that no index answers. The SiteShell specimens are exactly where a reader would
 * notice.
 */
export default defineConfig({
  site: 'https://jmchilton.github.io',
  base: '/foundry-lib/gallery',
  outDir: '../../docs/gallery',
  compressHTML: true,
  // The root is not a page. Both galleries are the same specimens, so there is no third thing to
  // put here, and a landing page whose only content is two links is a click charged to everyone.
  redirects: { '/': '/foundry-lib/gallery/minimum/' },
  integrations: [pagefind()],
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      external: [
        '@galaxy-foundry/license-policy',
        '@galaxy-foundry/reference-contract',
        '@galaxy-foundry/site-kit',
      ],
    },
    ssr: {
      /*
       * Kept out of the prerender bundle, because two of them read a file they ship beside.
       *
       * `reference-contract` and `license-policy` locate their bundled vocabulary and policy
       * tables with `new URL('../data/…', import.meta.url)`. Inlined into a build chunk that URL
       * points at `.astro/.prerender/data/…`, which does not exist, and the build dies on the
       * first page that renders a specimen. An instance installing these from npm never sees it —
       * Vite externalises node_modules by default — so this is the cost of being the repository
       * that holds both halves.
       */
      external: [
        '@galaxy-foundry/license-policy',
        '@galaxy-foundry/reference-contract',
        '@galaxy-foundry/site-kit',
      ],
    },
  },
});
