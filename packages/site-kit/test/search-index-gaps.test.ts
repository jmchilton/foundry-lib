import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { PAGEFIND_BODY_ATTR, searchIndexGaps } from '../src/index.js';

// The search contract: the header renders a box, and nothing fills it.
//
// Pagefind's rule runs backwards from what the attribute looks like. Mark nothing and every page is
// indexed; mark one page and every other page leaves the index. Measured on a real instance, one
// annotation on one route held the index to 242 of 374 pages — and the build log said
// `Pagefind indexed 374 pages` either way, because it counts pages processed.
//
// `reports nothing when no page marks itself` is the case worth reading twice: it is not an empty
// result for want of anything to say. It is the shape of Pagefind's fallback, and getting it
// backwards would fail a healthy site on every page it has.

const page = (path: string, marked: boolean) => ({
  path,
  html: `<main ${marked ? PAGEFIND_BODY_ATTR : ''}>text</main>`,
});

const SHELL = fileURLToPath(new URL('../src/components/SiteShell.astro', import.meta.url));

describe('searchIndexGaps', () => {
  it('reports nothing when no page marks itself', () => {
    // Pagefind indexes every <body> in this state. Nothing is missing, and a check that reported
    // all of them would fail the one configuration that has no gaps at all.
    const pages = ['/', '/a/', '/b/'].map((path) => page(path, false));
    expect(searchIndexGaps(pages)).toEqual([]);
  });

  it('reports every unmarked page once any page is marked', () => {
    // The real failure, in miniature: one route annotated, the rest silently out of the index.
    const pages = [page('/notes/x/', true), page('/tags/', false), page('/glossary/', false)];
    expect(searchIndexGaps(pages)).toEqual(['/glossary/', '/tags/']);
  });

  it('reports nothing when every page is marked', () => {
    expect(searchIndexGaps(['/', '/a/'].map((path) => page(path, true)))).toEqual([]);
  });

  it('accepts a page that opted out on purpose', () => {
    const pages = [page('/notes/x/', true), page('/tags/', false)];
    expect(searchIndexGaps(pages, ['/tags/'])).toEqual([]);
  });

  it('still reports the pages nobody listed', () => {
    // What the list is FOR. Without it, "deliberately out of the index" and "nobody thought about
    // this route" are the same observation.
    const pages = [page('/notes/x/', true), page('/tags/', false), page('/log/', false)];
    expect(searchIndexGaps(pages, ['/tags/'])).toEqual(['/log/']);
  });

  it('returns a stable order, so a failure reads the same twice', () => {
    const pages = [page('/z/', true), page('/c/', false), page('/a/', false), page('/b/', false)];
    expect(searchIndexGaps(pages)).toEqual(['/a/', '/b/', '/c/']);
  });
});

describe('the shell that writes the attribute', () => {
  const source = readFileSync(SHELL, 'utf8');

  it('marks main rather than letting Pagefind fall back to body', () => {
    // Keeps the header, nav and footer out of every result's excerpt.
    expect(source).toMatch(/<main[\s\S]*?data-pagefind-body[\s\S]*?>/);
  });

  it('defaults to searchable, so a forgotten prop cannot un-index a route', () => {
    // Opt-in would put every new page one missing prop away from being unfindable, with no
    // warning and nothing on the page to see.
    expect(source).toContain('searchable = true');
  });

  it('spells the attribute the way the check looks for it', () => {
    expect(source).toContain(PAGEFIND_BODY_ATTR);
  });
});
