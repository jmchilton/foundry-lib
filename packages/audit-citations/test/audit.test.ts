import { describe, expect, it } from 'vitest';

import {
  CITATION_AUDIT_SCHEMA_VERSION,
  buildCitationAuditRun,
  collectEvidence,
  evidenceId,
  extractCitations,
  renderCitationAuditMarkdown,
} from '../src/index.js';
import type { CitationAdjudications, CitationResolver } from '../src/index.js';

const scan = extractCitations([
  {
    path: 'notes/example.md',
    artifactKind: 'note',
    text:
      'Primary source: Example A. "An example citation." (2024). ' +
      'https://doi.org/10.1000/example\n',
  },
]);

const resolver: CitationResolver = {
  resolve: async (query) => ({
    id: evidenceId(query),
    query,
    provider: 'fixture',
    state: 'resolved',
    observedAt: '2026-08-02T00:00:00.000Z',
    metadata: {
      title: 'A completely different work',
      authors: ['Grace Other'],
      year: 2023,
      identifiers: [],
    },
  }),
};

describe('audit runs and adjudication', () => {
  it('normalizes candidates, findings, and evidence references without embedding evidence', async () => {
    const collected = await collectEvidence(scan.candidates, undefined, {
      resolver,
      refresh: true,
    });
    const run = buildCitationAuditRun(scan, collected.snapshot, {
      generatedAt: '2026-08-02T00:00:00.000Z',
      provenance: { headRevision: 'abc123', workingTreeDirty: true },
    });
    expect(run.summary['resolved-mismatched']).toBe(1);
    expect(run.manualReviewStatus).toBe('not-reviewed');
    expect(run.findings[0]?.evidenceIds).toHaveLength(1);
    expect(run.findings[0]).not.toHaveProperty('evidence');
    expect(renderCitationAuditMarkdown(run, collected.snapshot)).toContain(
      'A completely different work',
    );
  });

  it('requires adjudications to bind the exact source digest', async () => {
    const collected = await collectEvidence(scan.candidates, undefined, {
      resolver,
      refresh: true,
    });
    const candidate = scan.candidates[0]!;
    const stale: CitationAdjudications = {
      schemaVersion: CITATION_AUDIT_SCHEMA_VERSION,
      reviews: [
        {
          candidateId: candidate.id,
          sourceDigest: 'f'.repeat(64),
          classification: 'confirmed-finding',
          note: 'Checked manually.',
        },
      ],
    };
    expect(() => buildCitationAuditRun(scan, collected.snapshot, { adjudications: stale })).toThrow(
      /stale source digest/u,
    );
  });

  it('partitions adjudicated extractor false positives outside the denominator', async () => {
    const collected = await collectEvidence(scan.candidates, undefined, {
      resolver,
      refresh: true,
    });
    const candidate = scan.candidates[0]!;
    const adjudications: CitationAdjudications = {
      schemaVersion: CITATION_AUDIT_SCHEMA_VERSION,
      reviews: [
        {
          candidateId: candidate.id,
          sourceDigest: candidate.span.sourceDigest,
          classification: 'extractor-false-positive',
          note: 'Not a scholarly citation.',
        },
      ],
    };
    const run = buildCitationAuditRun(scan, collected.snapshot, { adjudications });
    expect(run.manualReviewStatus).toBe('completed');
    expect(run.summary.total).toBe(0);
    expect(run.summary.extractorFalsePositives).toBe(1);
  });

  it('rejects an incomplete evidence snapshot for a multi-identifier citation', () => {
    const multiIdentifierScan = extractCitations([
      {
        path: 'notes/multiple.md',
        artifactKind: 'note',
        text:
          'Example A. "An example citation." (2024). ' +
          'https://doi.org/10.1000/example arXiv:2401.00001\n',
      },
    ]);
    const doiQuery = {
      type: 'identifier' as const,
      identifier: { kind: 'doi', value: '10.1000/example' },
    };
    expect(() =>
      buildCitationAuditRun(multiIdentifierScan, {
        schemaVersion: CITATION_AUDIT_SCHEMA_VERSION,
        evidence: [
          {
            id: evidenceId(doiQuery),
            query: doiQuery,
            provider: 'fixture',
            state: 'resolved',
            observedAt: '2026-08-02T00:00:00.000Z',
            metadata: {
              title: 'An example citation',
              authors: ['Example A'],
              year: 2024,
              identifiers: [doiQuery.identifier],
            },
          },
        ],
      }),
    ).toThrow(/missing evidence/u);
  });

  it('rejects reports rendered from the wrong or incomplete evidence snapshot', async () => {
    const collected = await collectEvidence(scan.candidates, undefined, {
      resolver,
      refresh: true,
    });
    const run = buildCitationAuditRun(scan, collected.snapshot);
    expect(() =>
      renderCitationAuditMarkdown(run, {
        schemaVersion: CITATION_AUDIT_SCHEMA_VERSION,
        evidence: [],
      }),
    ).toThrow(/evidence snapshot digest/u);

    const danglingRun = structuredClone(run);
    danglingRun.findings[0]!.evidenceIds = ['missing-evidence'];
    expect(() => renderCitationAuditMarkdown(danglingRun, collected.snapshot)).toThrow(
      /missing evidence/u,
    );
  });
});
