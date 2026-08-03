import { describe, expect, it } from 'vitest';

import {
  CITATION_AUDIT_SCHEMA_VERSION,
  collectEvidence,
  evidenceId,
  extractCitations,
} from '../src/index.js';
import type { CitationEvidenceSnapshot, CitationResolver } from '../src/index.js';

const scan = extractCitations([
  {
    path: 'notes/example.md',
    artifactKind: 'note',
    text:
      'Primary source: Example A. "An example citation." (2024). ' +
      'https://doi.org/10.1000/example\n',
  },
]);

describe('evidence collection', () => {
  it('reports missing offline evidence as unavailable', async () => {
    const collected = await collectEvidence(scan.candidates, undefined, {
      observedAt: () => '2026-08-02T00:00:00.000Z',
    });
    expect(collected.snapshot.evidence[0]).toMatchObject({
      state: 'unavailable',
      provider: 'evidence-cache',
    });
  });

  it('reuses normalized cached evidence without calling a resolver', async () => {
    const query = {
      type: 'identifier' as const,
      identifier: { kind: 'doi', value: '10.1000/example' },
    };
    const existing: CitationEvidenceSnapshot = {
      schemaVersion: CITATION_AUDIT_SCHEMA_VERSION,
      evidence: [
        {
          id: evidenceId(query),
          query,
          provider: 'fixture',
          state: 'resolved',
          observedAt: '2026-08-02T00:00:00.000Z',
          metadata: {
            title: 'An example citation',
            authors: ['Ada Example'],
            year: 2024,
            identifiers: [{ kind: 'doi', value: '10.1000/example' }],
          },
        },
      ],
    };
    const resolver: CitationResolver = {
      resolve: async () => {
        throw new Error('offline replay must not call the resolver');
      },
    };
    const collected = await collectEvidence(scan.candidates, existing, { resolver });
    expect(collected.snapshot).toEqual(existing);
  });

  it('exposes each refreshed record for interruption-safe persistence', async () => {
    const persisted: CitationEvidenceSnapshot[] = [];
    await collectEvidence(scan.candidates, undefined, {
      refresh: true,
      resolver: {
        resolve: async (query) => ({
          id: evidenceId(query),
          query,
          provider: 'fixture',
          state: 'unresolved',
          observedAt: '2026-08-02T00:00:00.000Z',
          error: 'not found',
        }),
      },
      onEvidence: (snapshot) => {
        persisted.push(snapshot);
      },
    });
    expect(persisted).toHaveLength(1);
    expect(persisted[0]?.evidence[0]?.state).toBe('unresolved');
  });

  it('scopes the run snapshot to the candidates while keeping unrelated evidence cached', async () => {
    const orphanQuery = {
      type: 'identifier' as const,
      identifier: { kind: 'doi', value: '10.1000/removed-citation' },
    };
    const existing: CitationEvidenceSnapshot = {
      schemaVersion: CITATION_AUDIT_SCHEMA_VERSION,
      evidence: [
        {
          id: evidenceId(orphanQuery),
          query: orphanQuery,
          provider: 'fixture',
          state: 'unresolved',
          observedAt: '2026-08-02T00:00:00.000Z',
          error: 'not found',
        },
      ],
    };
    const collected = await collectEvidence(scan.candidates, existing, {
      observedAt: () => '2026-08-02T00:00:00.000Z',
    });
    expect(collected.snapshot.evidence.map((record) => record.id)).toEqual([
      evidenceId({ type: 'identifier', identifier: { kind: 'doi', value: '10.1000/example' } }),
    ]);
    expect(collected.cache.evidence.map((record) => record.id)).toContain(evidenceId(orphanQuery));
  });

  it('produces the same run snapshot regardless of unrelated cache history', async () => {
    const noise = {
      type: 'identifier' as const,
      identifier: { kind: 'doi', value: '10.1000/unrelated' },
    };
    const withHistory = await collectEvidence(
      scan.candidates,
      {
        schemaVersion: CITATION_AUDIT_SCHEMA_VERSION,
        evidence: [
          {
            id: evidenceId(noise),
            query: noise,
            provider: 'fixture',
            state: 'unresolved',
            observedAt: '2026-08-02T00:00:00.000Z',
            error: 'not found',
          },
        ],
      },
      { observedAt: () => '2026-08-02T00:00:00.000Z' },
    );
    const withoutHistory = await collectEvidence(scan.candidates, undefined, {
      observedAt: () => '2026-08-02T00:00:00.000Z',
    });
    expect(withHistory.snapshot).toEqual(withoutHistory.snapshot);
  });

  it('rejects a resolver record that does not validate as evidence', async () => {
    await expect(
      collectEvidence(scan.candidates, undefined, {
        refresh: true,
        resolver: {
          resolve: async (query) =>
            ({
              id: evidenceId(query),
              query,
              provider: 'fixture',
              state: 'resolved',
              observedAt: '2026-08-02T00:00:00.000Z',
            }) as never,
        },
      }),
    ).rejects.toThrow(/metadata/u);
  });

  it('refreshes a shared query once and reuses the final record for every candidate', async () => {
    let calls = 0;
    const duplicateCandidates = [
      scan.candidates[0]!,
      { ...scan.candidates[0]!, id: 'second-candidate' },
    ];
    const collected = await collectEvidence(duplicateCandidates, undefined, {
      refresh: true,
      resolver: {
        resolve: async (query) => {
          calls += 1;
          return {
            id: evidenceId(query),
            query,
            provider: 'fixture',
            state: 'unresolved',
            observedAt: '2026-08-02T00:00:00.000Z',
            error: `call ${calls}`,
          };
        },
      },
    });
    expect(calls).toBe(1);
    expect(collected.snapshot.evidence).toHaveLength(1);
    expect(collected.byCandidate.get(duplicateCandidates[0]!.id)?.[0]).toBe(
      collected.snapshot.evidence[0],
    );
    expect(collected.byCandidate.get(duplicateCandidates[1]!.id)?.[0]).toBe(
      collected.snapshot.evidence[0],
    );
  });
});
