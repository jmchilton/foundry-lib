import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  buildCitationAuditRun,
  citationCandidateSchema,
  citationFindingSchema,
  evidenceId,
  extractCitations,
  parseCitationAuditRun,
  parseCitationEvidenceSnapshot,
  parseCitationScan,
} from '../src/index.js';

function sourceDigest(sourceText: string): string {
  return createHash('sha256').update(sourceText, 'utf8').digest('hex');
}

describe('persisted schemas', () => {
  it('rejects unknown fields at trust boundaries', () => {
    expect(() =>
      citationCandidateSchema.parse({
        id: 'candidate',
        span: {
          artifactKind: 'note',
          artifactPath: 'notes/example.md',
          startLine: 1,
          endLine: 1,
          sourceText: 'citation',
          sourceDigest: sourceDigest('citation'),
        },
        identifiers: [],
        hiddenPolicy: true,
      }),
    ).toThrow();
  });

  it('requires normalized metadata for resolved evidence', () => {
    expect(() =>
      parseCitationEvidenceSnapshot({
        schemaVersion: 1,
        evidence: [
          {
            id: 'evidence',
            query: {
              type: 'identifier',
              identifier: { kind: 'doi', value: '10.1000/example' },
            },
            provider: 'fixture',
            state: 'resolved',
            observedAt: '2026-08-02T00:00:00.000Z',
          },
        ],
      }),
    ).toThrow(/requires metadata/u);
  });

  it('rejects duplicate IDs and dangling normalized references', () => {
    const candidate = {
      id: 'candidate',
      span: {
        artifactKind: 'note',
        artifactPath: 'notes/example.md',
        startLine: 1,
        endLine: 1,
        sourceText: 'citation',
        sourceDigest: sourceDigest('citation'),
      },
      identifiers: [{ kind: 'doi', value: '10.1000/example' }],
    };
    expect(() =>
      parseCitationScan({
        schemaVersion: 1,
        candidates: [candidate, candidate],
        diagnostics: {
          excludedUrls: [],
          authorYearPatternCount: 0,
          unextractedReferenceLines: [],
        },
      }),
    ).toThrow(/duplicate candidate ID/u);

    expect(() =>
      parseCitationAuditRun({
        schemaVersion: 1,
        auditKind: 'citation-integrity',
        generatedAt: '2026-08-02T00:00:00.000Z',
        corpus: { digest: 'b'.repeat(64) },
        evidenceSnapshotDigest: 'c'.repeat(64),
        manualReviewStatus: 'not-required',
        manualReview: { required: 0, completed: 0 },
        summary: {
          total: 1,
          resolved: 1,
          'resolved-mismatched': 0,
          unresolved: 0,
          unavailable: 0,
          resolvedUnverified: 0,
          extractorFalsePositives: 0,
        },
        candidates: [candidate],
        findings: [
          {
            candidateId: 'missing',
            evidenceIds: ['evidence'],
            verdict: 'resolved',
            effectiveVerdict: 'resolved',
            mismatches: [],
            verifiable: true,
            excludedFromDenominator: false,
          },
        ],
        adjudications: [],
        diagnostics: {
          excludedUrls: [],
          authorYearPatternCount: 0,
          unextractedReferenceLines: [],
        },
      }),
    ).toThrow(/unknown candidate/u);
  });

  it('keeps the verdict and the mismatch severities from disagreeing', () => {
    const finding = {
      candidateId: 'candidate',
      evidenceIds: ['evidence'],
      effectiveVerdict: 'resolved' as const,
      verifiable: true,
      excludedFromDenominator: false,
    };
    expect(() =>
      citationFindingSchema.parse({
        ...finding,
        verdict: 'resolved',
        mismatches: [{ code: 'title', severity: 'error', detail: 'describes another work' }],
      }),
    ).toThrow(/resolved-mismatched must carry an error mismatch/u);
    expect(() =>
      citationFindingSchema.parse({
        ...finding,
        verdict: 'resolved-mismatched',
        mismatches: [{ code: 'year', severity: 'warning', detail: 'year differs' }],
      }),
    ).toThrow(/resolved-mismatched must carry an error mismatch/u);
    expect(
      citationFindingSchema.parse({
        ...finding,
        verdict: 'resolved',
        mismatches: [{ code: 'year', severity: 'warning', detail: 'year differs' }],
      }).verdict,
    ).toBe('resolved');
  });

  it('requires enough citation identity to construct an evidence query', () => {
    expect(() =>
      citationCandidateSchema.parse({
        id: 'candidate',
        span: {
          artifactKind: 'note',
          artifactPath: 'notes/example.md',
          startLine: 1,
          endLine: 1,
          sourceText: 'citation',
          sourceDigest: sourceDigest('citation'),
        },
        identifiers: [],
      }),
    ).toThrow(/requires an identifier or described title/u);
  });

  it('rejects stale source digests and evidence IDs that do not identify their query', () => {
    expect(() =>
      parseCitationScan({
        schemaVersion: 1,
        candidates: [
          {
            id: 'candidate',
            span: {
              artifactKind: 'note',
              artifactPath: 'notes/example.md',
              startLine: 1,
              endLine: 1,
              sourceText: 'citation',
              sourceDigest: 'a'.repeat(64),
            },
            identifiers: [{ kind: 'doi', value: '10.1000/example' }],
          },
        ],
        diagnostics: {
          excludedUrls: [],
          authorYearPatternCount: 0,
          unextractedReferenceLines: [],
        },
      }),
    ).toThrow(/source digest/u);

    const query = {
      type: 'identifier' as const,
      identifier: { kind: 'doi', value: '10.1000/example' },
    };
    expect(() =>
      parseCitationEvidenceSnapshot({
        schemaVersion: 1,
        evidence: [
          {
            id: evidenceId({
              type: 'identifier',
              identifier: { kind: 'doi', value: '10.1000/different' },
            }),
            query,
            provider: 'fixture',
            state: 'unresolved',
            observedAt: '2026-08-02T00:00:00.000Z',
          },
        ],
      }),
    ).toThrow(/does not match its query/u);
  });

  it('recomputes corpus identity and manual-review fields in persisted audit runs', () => {
    const scan = extractCitations([
      {
        path: 'notes/example.md',
        artifactKind: 'note',
        text: 'https://doi.org/10.1000/example\n',
      },
    ]);
    const query = {
      type: 'identifier' as const,
      identifier: { kind: 'doi', value: '10.1000/example' },
    };
    const run = buildCitationAuditRun(scan, {
      schemaVersion: 1,
      evidence: [
        {
          id: evidenceId(query),
          query,
          provider: 'fixture',
          state: 'unresolved',
          observedAt: '2026-08-02T00:00:00.000Z',
        },
      ],
    });
    expect(() => parseCitationAuditRun({ ...run, corpus: { digest: 'a'.repeat(64) } })).toThrow(
      /corpus digest/u,
    );
    expect(() =>
      parseCitationAuditRun({
        ...run,
        manualReviewStatus: 'not-required',
        manualReview: { required: 0, completed: 0 },
      }),
    ).toThrow(/manual-review counts/u);
  });
});
