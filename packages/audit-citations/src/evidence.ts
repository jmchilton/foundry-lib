import { evidenceId } from './identity.js';
import type {
  CitationCandidate,
  CitationEvidence,
  CitationEvidenceSnapshot,
  EvidenceQuery,
} from './schema.js';
import { CITATION_AUDIT_SCHEMA_VERSION, parseCitationEvidenceSnapshot } from './schema.js';

export { evidenceId, evidenceSnapshotDigest } from './identity.js';

export interface CitationResolver {
  resolve(query: EvidenceQuery): Promise<CitationEvidence>;
}

export interface CollectEvidenceOptions {
  refresh?: boolean;
  resolver?: CitationResolver;
  observedAt?: () => string;
  /** Persist or inspect each newly collected record; useful for interruption-safe refreshes. */
  onEvidence?: (snapshot: CitationEvidenceSnapshot) => void | Promise<void>;
}

export interface CollectedEvidence {
  snapshot: CitationEvidenceSnapshot;
  byCandidate: Map<string, CitationEvidence[]>;
}

export function evidenceQueries(candidate: CitationCandidate): EvidenceQuery[] {
  const hasArxiv = candidate.identifiers.some((identifier) => identifier.kind === 'arxiv');
  const identifierQueries = candidate.identifiers
    .filter(
      (identifier) =>
        !(identifier.kind === 'doi' && identifier.value.startsWith('10.48550/arxiv.') && hasArxiv),
    )
    .map((identifier): EvidenceQuery => ({ type: 'identifier', identifier }));
  if (identifierQueries.length > 0) return identifierQueries;

  const title = candidate.described?.title;
  if (!title) return [];
  const firstAuthor = candidate.described?.authors?.[0];
  return [
    {
      type: 'bibliographic',
      title,
      ...(candidate.described?.year !== undefined ? { year: candidate.described.year } : {}),
      ...(firstAuthor ? { firstAuthor } : {}),
    },
  ];
}

export async function collectEvidence(
  candidates: readonly CitationCandidate[],
  existing: CitationEvidenceSnapshot = {
    schemaVersion: CITATION_AUDIT_SCHEMA_VERSION,
    evidence: [],
  },
  options: CollectEvidenceOptions = {},
): Promise<CollectedEvidence> {
  existing = parseCitationEvidenceSnapshot(existing);
  const records = new Map(existing.evidence.map((record) => [record.id, record]));
  const byCandidate = new Map<string, CitationEvidence[]>();
  const refreshed = new Set<string>();
  const observedAt = options.observedAt ?? (() => new Date().toISOString());

  for (const candidate of candidates) {
    const candidateEvidence: CitationEvidence[] = [];
    for (const query of evidenceQueries(candidate)) {
      const id = evidenceId(query);
      let record = records.get(id);
      if (record === undefined || (options.refresh === true && !refreshed.has(id))) {
        record = options.resolver
          ? await options.resolver.resolve(query)
          : unavailableEvidence(
              query,
              observedAt(),
              'No resolver is configured; supply one for refresh or provide cached evidence.',
            );
        if (record.id !== id) {
          throw new Error(
            `resolver returned evidence id ${record.id} for query ${id}; use evidenceId(query)`,
          );
        }
        records.set(id, record);
        refreshed.add(id);
        await options.onEvidence?.(snapshotFrom(records));
      }
      candidateEvidence.push(record);
    }
    if (candidateEvidence.length === 0) {
      const query: EvidenceQuery = {
        type: 'bibliographic',
        title: `candidate:${candidate.id}`,
      };
      const record = unavailableEvidence(
        query,
        observedAt(),
        'Candidate has no resolvable identifier or bibliographic title.',
      );
      records.set(record.id, record);
      await options.onEvidence?.(snapshotFrom(records));
      candidateEvidence.push(record);
    }
    byCandidate.set(candidate.id, candidateEvidence);
  }

  const snapshot = snapshotFrom(records);
  const normalizedById = new Map(snapshot.evidence.map((record) => [record.id, record]));
  for (const [candidateId, candidateEvidence] of byCandidate) {
    byCandidate.set(
      candidateId,
      candidateEvidence.map((record) => normalizedById.get(record.id)!),
    );
  }
  return { snapshot, byCandidate };
}

function snapshotFrom(records: ReadonlyMap<string, CitationEvidence>): CitationEvidenceSnapshot {
  return parseCitationEvidenceSnapshot({
    schemaVersion: CITATION_AUDIT_SCHEMA_VERSION,
    evidence: [...records.values()].sort((left, right) => left.id.localeCompare(right.id)),
  });
}

function unavailableEvidence(
  query: EvidenceQuery,
  observedAt: string,
  error: string,
): CitationEvidence {
  return {
    id: evidenceId(query),
    query,
    provider: 'evidence-cache',
    state: 'unavailable',
    observedAt,
    error,
  };
}
