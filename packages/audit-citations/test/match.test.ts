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
    expect(finding.mismatchReasons.some((reason) => reason.includes('arxiv-provider'))).toBe(true);
  });

  it('does not confuse an arXiv deposit year with the publication year', () => {
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
});
