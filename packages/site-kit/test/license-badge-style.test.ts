import { describe, expect, it } from 'vitest';

import { LICENSE_BADGE_TOKENS, licenseBadgeStyleGaps } from '../src/index.js';

/** A stylesheet that supplies everything the badge names. */
const complete = (): string =>
  `:root{${LICENSE_BADGE_TOKENS.map((token) => `${token}:#000`).join(';')}}`;

describe('licenseBadgeStyleGaps', () => {
  it('reports nothing against a stylesheet that declares every token', () => {
    expect(licenseBadgeStyleGaps(complete())).toEqual([]);
  });

  it('reports a token the instance never declared', () => {
    const css = complete().replace('--color-license-copyleft:#000', '');
    expect(licenseBadgeStyleGaps(css)).toEqual(['--color-license-copyleft']);
  });

  it('does not count the badge asking for a token as the instance supplying it', () => {
    // The colon is the whole check. Without it this matches the component's own
    // `var(--color-license-copyleft)` and passes on exactly the sites it exists to fail.
    expect(licenseBadgeStyleGaps('.chip{background:var(--color-license-copyleft)}')).toEqual([
      ...LICENSE_BADGE_TOKENS,
    ]);
  });

  it('names the three policy hues, which are the ones that silently degrade', () => {
    // A missing font or text colour is visible on sight. A missing hue leaves a chip whose
    // background resolves to nothing — legible, plausible, and no longer distinguishable from the
    // chip beside it that means the opposite thing.
    expect(LICENSE_BADGE_TOKENS).toEqual(
      expect.arrayContaining([
        '--color-license-verbatim',
        '--color-license-own-words',
        '--color-license-copyleft',
      ]),
    );
  });
});
