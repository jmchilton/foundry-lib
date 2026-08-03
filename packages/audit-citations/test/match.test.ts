import { describe, expect, it } from 'vitest';

import { evaluateCitation } from '../src/index.js';
import type { CitationCandidate, CitationEvidence, EvidenceQuery } from '../src/index.js';

const candidate: CitationCandidate = {
  id: 'candidate',
  span: {
    artifactKind: 'note',
    artifactPath: 'notes/example.md',
    startLine: 3,
    endLine: 3,
    sourceText: 'A citation',
    sourceDigest: 'a'.repeat(64),
  },
  identifiers: [
    { kind: 'doi', value: '10.1000/correct' },
    { kind: 'arxiv', value: '2401.00001' },
  ],
  described: { title: 'The described paper', authors: ['Example, A.'], year: 2025 },
};

function evidence(
  id: string,
  query: EvidenceQuery,
  title: string,
  author = 'Ada Example',
  year = 2025,
): CitationEvidence {
  return {
    id,
    query,
    provider: id,
    state: 'resolved',
    observedAt: '2026-08-02T00:00:00.000Z',
    metadata: { title, authors: [author], year, identifiers: [] },
  };
}

describe('citation evaluation', () => {
  it('does not let one matching identifier hide another mismatch', () => {
    const finding = evaluateCitation(candidate, [
      evidence(
        'doi-provider',
        { type: 'identifier', identifier: candidate.identifiers[0]! },
        'The described paper',
      ),
      evidence(
        'arxiv-provider',
        { type: 'identifier', identifier: candidate.identifiers[1]! },
        'An unrelated paper',
        'Grace Other',
        2024,
      ),
    ]);
    expect(finding.verdict).toBe('resolved-mismatched');
    expect(finding.mismatches.some((mismatch) => mismatch.detail.includes('arxiv-provider'))).toBe(
      true,
    );
  });

  it('records a differing year as a warning rather than a finding', () => {
    const finding = evaluateCitation(candidate, [
      evidence(
        'openalex',
        { type: 'identifier', identifier: candidate.identifiers[1]! },
        'The described paper',
        'Ada Example',
        2024,
      ),
    ]);
    expect(finding.verdict).toBe('resolved');
    expect(finding.mismatches).toEqual([
      expect.objectContaining({ code: 'year', severity: 'warning' }),
    ]);
  });

  it('keeps provider unavailability separate from unresolved identifiers', () => {
    const query: EvidenceQuery = {
      type: 'identifier',
      identifier: candidate.identifiers[0]!,
    };
    const finding = evaluateCitation(candidate, [
      {
        id: 'unavailable',
        query,
        provider: 'crossref',
        state: 'unavailable',
        observedAt: '2026-08-02T00:00:00.000Z',
        error: 'timeout',
      },
    ]);
    expect(finding.verdict).toBe('unavailable');
  });

  it('matches a hyphenated multi-token family name', () => {
    const topometry = {
      ...candidate,
      described: {
        title: 'TopoMetry',
        authors: ['David Sidarta-Oliveira, Ana I. Domingos'],
        year: 2025,
      },
    };
    const finding = evaluateCitation(topometry, [
      evidence(
        'crossref',
        { type: 'identifier', identifier: candidate.identifiers[0]! },
        'TopoMetry',
        'David Sidarta-Oliveira',
      ),
    ]);
    expect(finding.verdict).toBe('resolved');
  });

  it('flags a citation that keeps the first author and fabricates the rest', () => {
    const finding = evaluateCitation(
      withAuthors(['Ada Example', 'Jean Invented', 'Kim Invented']),
      [authorEvidence(['Ada Example', 'Grace Other', 'Alan Third'])],
    );
    expect(finding.verdict).toBe('resolved-mismatched');
    expect(finding.mismatches).toContainEqual(
      expect.objectContaining({ code: 'author-list', severity: 'error' }),
    );
  });

  it('does not flag one wrong name in a two-author citation', () => {
    const finding = evaluateCitation(withAuthors(['Ada Example', 'Kim Mistyped']), [
      authorEvidence(['Ada Example', 'Grace Other']),
    ]);
    expect(finding.verdict).toBe('resolved');
    expect(finding.mismatches.some((mismatch) => mismatch.code === 'author-list')).toBe(false);
  });

  it('does not flag a provider author list the source truncated', () => {
    const full = ['Ada Example', 'Grace Other', 'Alan Third', 'Kim Fourth', 'Lee Fifth'];
    const finding = evaluateCitation(withAuthors([...full, 'Sam Sixth', 'Robin Seventh']), [
      authorEvidence(full.slice(0, 3)),
    ]);
    expect(finding.verdict).toBe('resolved');
  });

  it('matches author names across initials and reversed name order', () => {
    const finding = evaluateCitation(withAuthors(['A. Example', 'Other Grace', 'Alan Third']), [
      authorEvidence(['Ada Example', 'Grace Other', 'Alan Third']),
    ]);
    expect(finding.verdict).toBe('resolved');
  });
});

function withAuthors(authors: string[]): CitationCandidate {
  return { ...candidate, described: { ...candidate.described, authors } };
}

function authorEvidence(authors: string[]): CitationEvidence {
  const record = evidence(
    'crossref',
    { type: 'identifier', identifier: candidate.identifiers[0]! },
    'The described paper',
  );
  return { ...record, metadata: { ...record.metadata!, authors } };
}
