// What the reference gallery is FOR, asserted on what it built.
//
// The pages are not the point — the point is that a stylesheet bounded by the kit's own exported
// lists is enough to render every component the kit ships. That claim can only be made by
// something outside those lists, so it lives here rather than in the package: the package cannot
// prove its documentation is sufficient by reading itself.
//
// Everything below fails green otherwise. A token nobody declares resolves to nothing and renders
// as "no colour", which looks like a design choice; a specimen that stopped rendering leaves a gap
// that looks like a component with nothing to show.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import {
  contentReaderStyleGaps,
  licenseBadgeStyleGaps,
  licenseFileStyleGaps,
  referenceStyleGaps,
  shellStyleGaps,
  SHELL_CLASSES,
  SHELL_TOKENS,
  REFERENCE_TOKENS,
  LICENSE_BADGE_TOKENS,
  CONTENT_READER_TOKENS,
  LICENSE_FILE_TOKENS,
} from '@galaxy-foundry/site-kit';
import { SPECIMENS, specimenPath } from '@galaxy-foundry/site-kit/specimens';
import { beforeAll, describe, expect, it } from 'vitest';

const APP = new URL('../', import.meta.url).pathname;
const DIST = path.join(APP, '../../docs/gallery');
const THEMES = ['minimum', 'designed'] as const;

const newestMtime = (dir: string): number =>
  readdirSync(dir).reduce((newest, entry) => {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    return Math.max(newest, stat.isDirectory() ? newestMtime(full) : stat.mtimeMs);
  }, 0);

/** Build only when the output is missing or older than the sources — a stale dist passes. */
function ensureBuilt(): void {
  const landmark = path.join(DIST, 'minimum/index.html');
  if (existsSync(landmark) && statSync(landmark).mtimeMs > newestMtime(path.join(APP, 'src'))) {
    return;
  }
  execFileSync('pnpm', ['run', 'build'], { cwd: APP, stdio: 'inherit' });
}

const read = (file: string): string => readFileSync(file, 'utf-8');

/** The stylesheets ONE page links, which is the unit the evidence claim is about. */
const cssOf = (page: string): string =>
  [...read(page).matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)]
    .flatMap((match) => (match[1] ? [match[1]] : []))
    .map((href) => read(path.join(DIST, href.replace('/foundry-lib/gallery/', ''))))
    .join('\n');

beforeAll(() => {
  ensureBuilt();
}, 600_000);

describe('the minimum theme', () => {
  const documented = [
    ...new Set([
      ...SHELL_TOKENS,
      ...CONTENT_READER_TOKENS,
      ...REFERENCE_TOKENS,
      ...LICENSE_BADGE_TOKENS,
      ...LICENSE_FILE_TOKENS,
    ]),
  ].sort();

  it('defines every name the kit documents, and no others', () => {
    // Read from the SOURCE, not the build: Tailwind emits a pile of its own theme variables, and
    // a check against the output would drown in them. What is being asserted is the ceiling —
    // a colour added here to make a page look nicer stops this stylesheet from being evidence,
    // because then an element that renders is no longer proof the documented list was enough.
    const source = read(path.join(APP, 'src/styles/minimum.css'));
    const theme = source.slice(
      source.indexOf('@theme'),
      source.indexOf('\n}', source.indexOf('@theme')),
    );
    const defined = [...theme.matchAll(/^\s*(--[a-z0-9-]+):/gm)]
      .flatMap((match) => (match[1] ? [match[1]] : []))
      .sort();

    expect(defined, '\nthe minimum theme is not the documented list').toEqual(documented);
  });

  it('wears the three classes the shell does not define', () => {
    const source = read(path.join(APP, 'src/styles/minimum.css'));
    const missing = SHELL_CLASSES.filter((selector) => !source.includes(`${selector} {`));
    expect(missing, '\nclasses named by the kit and defined nowhere').toEqual([]);
  });

  it('leaves nothing the components name unsupplied, in the built page', () => {
    // The other direction, and the one a reader would actually notice: every token the kit's four
    // lists name has a declaration in the CSS this page links. Together with the test above, the
    // gallery says the documented lists are exactly sufficient — neither short nor padded.
    const css = cssOf(path.join(DIST, 'minimum/index.html'));

    expect(shellStyleGaps(css), '\nshell').toEqual([]);
    expect(contentReaderStyleGaps(css), '\ncontent reader').toEqual([]);
    expect(referenceStyleGaps(css), '\nreference card').toEqual([]);
    expect(licenseBadgeStyleGaps(css), '\nlicence badge').toEqual([]);
    expect(licenseFileStyleGaps(css), '\nlicence file body').toEqual([]);
  });

  it('carries the utilities Tailwind only emits if it scanned the kit', () => {
    // `min-h-dvh` is written by the kit's `<body>` and by nothing in this repository, so its rule
    // exists only if `@source` in the stylesheet points where it claims to. A typo there is as
    // silent as omitting the line: every page still wears the class, and no rule matches it.
    expect(cssOf(path.join(DIST, 'minimum/index.html'))).toContain('min-h-dvh');
  });
});

describe('both galleries', () => {
  it('render every specimen the kit ships', () => {
    // One card per case, on the index or on a route of its own. A group that quietly stopped being
    // rendered would otherwise look like a component with nothing to show.
    const total = SPECIMENS.reduce((count, group) => count + group.specimens.length, 0);

    for (const theme of THEMES) {
      const index = read(path.join(DIST, theme, 'index.html'));
      const cards = (index.match(/<article id="/g) ?? []).length;
      expect(cards, `\n${theme}: cards on the index`).toBe(total);
    }
  });

  it('emit the routes the kit says need pages of their own', () => {
    const standalone = SPECIMENS.filter((group) => group.surface !== 'inline').flatMap((group) =>
      group.specimens.map((specimen) => specimenPath(group, specimen)),
    );

    for (const theme of THEMES) {
      const missing = standalone.filter(
        (route) => !existsSync(path.join(DIST, theme, route, 'index.html')),
      );
      expect(missing, `\n${theme}: specimens with no page`).toEqual([]);
    }
  });

  it('frame only routes that exist', () => {
    // A frame whose src is a 404 renders as an empty box — indistinguishable from a specimen whose
    // case is "renders nothing", which is the ambiguity specimens exist to remove.
    for (const theme of THEMES) {
      const index = read(path.join(DIST, theme, 'index.html'));
      const framed = [...index.matchAll(/<iframe[^>]+src="([^"]+)"/g)].flatMap((match) =>
        match[1] ? [match[1]] : [],
      );

      expect(framed.length, `\n${theme}: no frames`).toBeGreaterThan(0);
      const missing = framed.filter(
        (src) =>
          !existsSync(path.join(DIST, src.replace('/foundry-lib/gallery/', ''), 'index.html')),
      );
      expect(missing, `\n${theme}: framed routes that do not exist`).toEqual([]);
    }
  });

  it('differ only in their stylesheet', () => {
    // The claim the two galleries exist to make. Same specimens, same markup structure, same
    // routes — if the designed theme were quietly rendering a different set, comparing them would
    // say nothing about what a stylesheet is responsible for.
    const cardIds = (theme: string): string[] =>
      [...read(path.join(DIST, theme, 'index.html')).matchAll(/<article id="([^"]+)"/g)].flatMap(
        (match) => (match[1] ? [match[1]] : []),
      );

    expect(cardIds('designed')).toEqual(cardIds('minimum'));
  });
});
