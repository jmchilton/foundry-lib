import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';

import { bundledPolicy, type LicenseFile } from '@galaxy-foundry/license-policy';

import LicenseFileBody from '../src/components/LicenseFileBody.astro';
import {
  LICENSE_FILE_ROUTE,
  licenseFileHref,
  licensesUnderFile,
  type LicenseFileUse,
} from '../src/index.js';

const policy = bundledPolicy();

const LICENSE_FILE: LicenseFile = {
  id: 'msmb',
  filename: 'msmb.LICENSE',
  text: 'CC BY-NC-SA 2.0\nSee https://creativecommons.org/licenses/by-nc-sa/2.0/ for terms.\n',
};

const USES: LicenseFileUse[] = [
  { href: '/books/msmb/chap2/', label: 'msmb/chap2', licenseId: 'CC-BY-NC-SA-2.0' },
  { href: '/books/msmb/chap1/', label: 'msmb/chap1', licenseId: 'CC-BY-NC-SA-2.0' },
];

const render = async (uses: LicenseFileUse[] = USES): Promise<string> => {
  const container = await AstroContainer.create();
  return container.renderToString(LicenseFileBody, {
    props: { licenseFile: LICENSE_FILE, policy, uses },
  });
};

describe('licenseFileHref', () => {
  it('takes the id a loaded file carries', () => {
    expect(licenseFileHref('/foundry', 'msmb')).toBe('/foundry/licenses/msmb/');
  });

  it('takes the path a note declares', () => {
    // The two call sites hold different things: the route builds from a loaded `LicenseFile`, a
    // note's box holds `LICENSES/msmb.LICENSE`. Both spell the same href or the link 404s.
    expect(licenseFileHref('/foundry', 'LICENSES/msmb.LICENSE')).toBe('/foundry/licenses/msmb/');
  });

  it('is right at the domain root, where the base is empty', () => {
    expect(licenseFileHref('', 'msmb')).toBe('/licenses/msmb/');
  });

  it('does not double the slash when the base carries one', () => {
    expect(licenseFileHref('/foundry/', 'msmb')).toBe('/foundry/licenses/msmb/');
  });

  it('agrees with the route the pages are built at', () => {
    // The reason the constant exists. Both instances typed `/licenses/` inline in the page that
    // BUILDS the route and again in every component that links to it, so the two agreed only by
    // coincidence — and a drift between them builds clean and 404s for readers.
    expect(licenseFileHref('', 'msmb')).toBe(`${LICENSE_FILE_ROUTE}/msmb/`);
  });
});

describe('licensesUnderFile', () => {
  it('collapses the users to the distinct licences the copy covers', () => {
    expect(licensesUnderFile(policy, USES).map((entry) => entry.id)).toEqual(['CC-BY-NC-SA-2.0']);
  });

  it('resolves each to its row', () => {
    expect(licensesUnderFile(policy, USES)[0]?.row.policy).toBe('own-words-only');
  });

  it('sorts, rather than reporting the order the corpus happened to be walked in', () => {
    const mixed: LicenseFileUse[] = [
      { href: '/b/', label: 'b', licenseId: 'MIT' },
      { href: '/a/', label: 'a', licenseId: 'CC-BY-4.0' },
    ];
    expect(licensesUnderFile(policy, mixed).map((entry) => entry.id)).toEqual(['CC-BY-4.0', 'MIT']);
  });

  it('is empty for a copy nothing uses, rather than carrying a bare undefined', () => {
    expect(licensesUnderFile(policy, [])).toEqual([]);
    expect(licensesUnderFile(policy, [{ href: '/a/', label: 'a' }])).toEqual([]);
  });
});

describe('the licence-file body', () => {
  it('states what the copy obliges, from the row rather than the page', async () => {
    expect(await render()).toContain('attribution + citation');
  });

  it('links the notes that redistribute under it', async () => {
    const html = await render();
    expect(html).toContain('href="/books/msmb/chap2/"');
    expect(html).toContain('Redistributed by');
  });

  it('makes the licence URLs inside the text followable', async () => {
    // A licence is the document a reader is most likely to want to leave — the canonical terms
    // live upstream and the vendored copy is a courtesy. One instance linked them; the other
    // rendered a <pre> a reader had to retype from.
    expect(await render()).toContain(
      '<a href="https://creativecommons.org/licenses/by-nc-sa/2.0/"',
    );
  });

  it('reproduces the licence text around the links verbatim', async () => {
    // The whole point of a vendored copy. Reflowing or dropping any of it is what the
    // `license_file` obligation exists to prevent.
    const html = await render();
    expect(html).toContain('CC BY-NC-SA 2.0\n');
    expect(html).toContain(' for terms.\n');
  });

  it('renders the text for a copy no note uses yet', async () => {
    // A vendored file with no users is a real state — a source removed, or a copy added ahead of
    // the note. The page is still the licence text; it just has nobody to list.
    const html = await render([]);
    expect(html).not.toContain('Redistributed by');
    expect(html).toContain('CC BY-NC-SA 2.0');
  });

  it('gives the licence text a heading of its own', async () => {
    // Otherwise the document outline puts the licence — the thing the page IS — inside the
    // "Redistributed by" section, which is a list of notes. A reader moving by heading lands on
    // the note list and finds no way to reach the terms; the only other section ends where the
    // text begins, and nothing says so.
    //
    // One instance shipped this heading and the other did not, and the first draft of this
    // component followed the one that did not. That is the same accident as the padding the badge
    // settles — a difference nobody chose — so it is settled here rather than made a prop.
    expect(await render()).toContain('License text');
  });

  it('keeps the text heading even when no note uses the copy', async () => {
    // The section is the page's subject, not a footnote to the note list — so it is not
    // conditional on there being a note list at all.
    expect(await render([])).toContain('License text');
  });
});
