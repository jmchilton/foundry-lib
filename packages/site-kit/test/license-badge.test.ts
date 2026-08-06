import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';

import { bundledPolicy } from '@galaxy-foundry/license-policy';

import LicenseBadge from '../src/components/LicenseBadge.astro';

// What both instances rendered twice, and the one part of their licence views that reads nothing
// but the shared table. Everything ELSE in those boxes — the attribution line, the bibliography
// strip, the terms link — is either authored per note or keyed on a vendored file, and stays put.
//
// Rendered rather than read, for the reason the reference-card test gives: which chips appear is
// decided by a row the component is handed at runtime, so no amount of reading the source answers
// whether a copyleft licence gets its chip.

const policy = bundledPolicy();

const render = async (license: string): Promise<string> => {
  const container = await AstroContainer.create();
  return container.renderToString(LicenseBadge, { props: { license, policy } });
};

/** The chips, in document order, as their text. */
const chips = (html: string): string[] =>
  [...html.matchAll(/<span[^>]*class="[^"]*license-chip[^"]*"[^>]*>([^<]*)<\/span>/g)].map(
    (match) => match[1]!,
  );

describe('the chips a licence badge renders', () => {
  it('shows the row name rather than the SPDX id', async () => {
    // `name` is a column of the shared table and exists for exactly this: it equals the id in 1 of
    // 23 rows. One instance rendered the raw id and never noticed, because its corpus is MIT (where
    // they are identical) and Apache-2.0 (where they differ by a hyphen).
    const html = await render('CC-BY-4.0');
    expect(chips(html)).toContain('CC BY 4.0');
    expect(chips(html)).not.toContain('CC-BY-4.0');
  });

  it('keeps the SPDX id reachable on the chip it replaced', async () => {
    // The id is the precise answer and the name is the legible one. Dropping the id would trade a
    // citable identifier for a friendlier label; carrying it in `title` costs nothing.
    expect(await render('CC-BY-4.0')).toMatch(/title="CC-BY-4\.0"/);
  });

  it('names a licence nobody would recognize from its id', async () => {
    // The case that makes the choice above more than cosmetic. A reader meeting
    // `LicenseRef-arXiv-nonexclusive-distrib-1.0` in a pill learns less than nothing.
    expect(chips(await render('LicenseRef-arXiv-nonexclusive-distrib-1.0'))).toContain(
      'arXiv non-exclusive distribution 1.0',
    );
  });

  it('labels the two policies the way both instances already did', async () => {
    expect(chips(await render('MIT'))).toContain('verbatim OK');
    expect(chips(await render('CC-BY-NC-4.0'))).toContain('own-words only');
  });

  it('styles the policy chip by what the row says, not by the licence name', async () => {
    // The reference card's rule, applied again: a selector listing licence ids would be a copy of
    // the table kept where the table cannot see it, and silently no opinion about a 24th row.
    expect(await render('MIT')).toMatch(/data-policy="verbatim-ok"/);
    expect(await render('CC-BY-NC-4.0')).toMatch(/data-policy="own-words-only"/);
  });

  it('adds the copyleft chip only where the row declares it', async () => {
    // Never rendered on one of the two sites: its corpus is entirely MIT and Apache-2.0, so this
    // branch has no page to prove it on. The first copyleft note it vendors should not be the
    // first time anyone sees this chip.
    expect(chips(await render('GPL-3.0-only'))).toContain('copyleft');
    expect(chips(await render('MIT'))).not.toContain('copyleft');
  });

  it('renders in full for a licence that ships no licence file', async () => {
    // The badge reads `license` and the row, and nothing else. `license_file` is absent on 49 of
    // one instance's 111 licensed notes and on every own-words-only row — if it reached this
    // component, those pages would lose their chips for a reason that has nothing to do with them.
    const html = await render('LicenseRef-all-rights-reserved');
    expect(chips(html)).toEqual(['All rights reserved / read-only manuscript', 'own-words only']);
  });

  it('says something true about an id the table does not carry', async () => {
    // An unresolved id takes the default row: own-words-only, which is the safe answer rather than
    // the accurate one. It must not render as a blank chip that looks like a licence with a short
    // name.
    const html = await render('NotARealLicense-9.9');
    expect(chips(html)).toContain('own-words only');
    expect(chips(html).every((chip) => chip.trim().length > 0)).toBe(true);
  });
});
