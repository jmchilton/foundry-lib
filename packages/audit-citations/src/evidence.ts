import { compareCodePoints } from './digest.js';
import { evidenceId } from './identity.js';
import type {
  CitationCandidate,
  CitationEvidence,
  CitationEvidenceSnapshot,
  EvidenceQuery,
} from './schema.js';
import {
  CITATION_AUDIT_SCHEMA_VERSION,
  citationEvidenceSchema,
  parseCitationEvidenceSnapshot,
} from './schema.js';

export { evidenceId, evidenceSnapshotDigest } from './identity.js';

export interface CitationResolver {
  resolve(query: EvidenceQuery): Promise<CitationEvidence>;
}

export interface CollectEvidenceOptions {
  refresh?: boolean;
  resolver?: CitationResolver;
  observedAt?: () => string;
  /**
   * Persist or inspect the cache after each newly collected record; useful for interruption-safe
   * refreshes. Receives the full cache, which is what belongs on disk.
   */
  onEvidence?: (cache: CitationEvidenceSnapshot) => void | Promise<void>;
}

export interface CollectedEvidence {
  /**
   * Exactly the evidence the supplied candidates reference, so a run's identity is a function of
   * its candidates and their evidence rather than of the cache's history.
   */
  snapshot: CitationEvidenceSnapshot;
  /** Every known record, including evidence no current candidate references. Persist this. */
  cache: CitationEvidenceSnapshot;
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
  const referenced = new Set<string>();
  const observedAt = options.observedAt ?? (() => new Date().toISOString());

  for (const candidate of candidates) {
    const queries = evidenceQueries(candidate);
    if (queries.length === 0) {
      throw new Error(
        `candidate ${candidate.id} has no resolvable identifier or bibliographic title`,
      );
    }
    const candidateEvidence: CitationEvidence[] = [];
    for (const query of queries) {
      const id = evidenceId(query);
      referenced.add(id);
      let record = records.get(id);
      if (record === undefined || (options.refresh === true && !refreshed.has(id))) {
        record = options.resolver
          ? validateEvidence(await options.resolver.resolve(query), id)
          : unavailableEvidence(
              query,
              observedAt(),
              'No resolver is configured; supply one for refresh or provide cached evidence.',
            );
        records.set(id, record);
        refreshed.add(id);
        // Records are validated as they arrive, so the checkpoint does not revalidate the
        // whole cache once per collected record.
        await options.onEvidence?.(snapshotOf(records.values()));
      }
      candidateEvidence.push(record);
    }
    byCandidate.set(candidate.id, candidateEvidence);
  }

  const cache = parseCitationEvidenceSnapshot(snapshotOf(records.values()));
  const byId = new Map(cache.evidence.map((record) => [record.id, record]));
  const snapshot = snapshotOf(cache.evidence.filter((record) => referenced.has(record.id)));
  for (const [candidateId, candidateEvidence] of byCandidate) {
    byCandidate.set(
      candidateId,
      candidateEvidence.map((record) => byId.get(record.id)!),
    );
  }
  return { snapshot, cache, byCandidate };
}

function validateEvidence(record: CitationEvidence, id: string): CitationEvidence {
  const parsed = citationEvidenceSchema.parse(record);
  if (parsed.id !== id) {
    throw new Error(
      `resolver returned evidence id ${parsed.id} for query ${id}; use evidenceId(query)`,
    );
  }
  return parsed;
}

function snapshotOf(records: Iterable<CitationEvidence>): CitationEvidenceSnapshot {
  return {
    schemaVersion: CITATION_AUDIT_SCHEMA_VERSION,
    evidence: [...records].sort((left, right) => compareCodePoints(left.id, right.id)),
  };
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
