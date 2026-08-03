import { describe, expect, it } from 'vitest';

import {
  TITLE_IDENTITY_THRESHOLD,
  TITLE_SEARCH_THRESHOLD,
  authorNameMatches,
  firstAuthorFamily,
  titleSimilarity,
} from '../src/text.js';

describe('title similarity thresholds', () => {
  it('accepts search hits more loosely than it disputes identity', () => {
    // If search were the stricter of the two, every hit it accepted would already satisfy the
    // identity comparison, and a bibliographic citation could never be reported as mismatched.
    expect(TITLE_SEARCH_THRESHOLD).toBeLessThan(TITLE_IDENTITY_THRESHOLD);
  });

  it('leaves a band where a search hit is accepted and then flagged', () => {
    const similarity = titleSimilarity(
      'Deep learning for protein structure prediction',
      'Deep learning for protein structure prediction in bacteria',
    );
    expect(similarity).toBeGreaterThanOrEqual(TITLE_SEARCH_THRESHOLD);
    expect(similarity).toBeLessThan(TITLE_IDENTITY_THRESHOLD);
  });

  it('scores an unrelated title below the search threshold', () => {
    expect(
      titleSimilarity('Deep learning for protein structure prediction', 'A field guide to moss'),
    ).toBeLessThan(TITLE_SEARCH_THRESHOLD);
  });
});

describe('personal name comparison', () => {
  it('treats initials, diacritics, and reversed order as the same person', () => {
    expect(authorNameMatches('Ada Lovelace', 'A. Lovelace')).toBe(true);
    expect(authorNameMatches('Lovelace, Ada', 'Ada Lovelace')).toBe(true);
    // A medial accent, so the assertion fails if diacritics stop being folded. A leading accent
    // would pass either way: the stray first letter matches as though it were an initial.
    expect(authorNameMatches('Hans Muller', 'Hans Müller')).toBe(true);
  });

  it('does not treat a shared surname as the same person', () => {
    expect(authorNameMatches('Ada Lovelace', 'Grace Lovelace')).toBe(false);
    expect(authorNameMatches('Ada Lovelace', '')).toBe(false);
  });

  it('reads the family name from either ordering', () => {
    expect(firstAuthorFamily('Lovelace A, Hopper G')).toBe('lovelace');
    expect(firstAuthorFamily('Ada Lovelace and Grace Hopper')).toBe('lovelace');
    expect(firstAuthorFamily('Lovelace et al.')).toBe('lovelace');
    expect(firstAuthorFamily(undefined)).toBeUndefined();
  });
});
