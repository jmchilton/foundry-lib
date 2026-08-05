/**
 * What a `.astro` import is, to `tsc`.
 *
 * An Astro SITE gets this generated into `.astro/types.d.ts` by `astro sync`. This package is
 * components rather than a site, so nothing generates it and the render test does not compile
 * without it — vitest is happy either way, because the Astro Vite plugin does the transform and
 * never asks TypeScript anything.
 *
 * Deliberately just the factory: a hand-written `Props` shape here would be a second copy of the
 * component's own, kept where nothing compares the two.
 */
declare module '*.astro' {
  const component: import('astro/runtime/server/index.js').AstroComponentFactory;
  export default component;
}
