import { sha256, stableJson } from '@galaxy-foundry/audit-base';

import type { CitationCandidate, CitationEvidenceSnapshot, EvidenceQuery } from './schema.js';

export function evidenceId(query: EvidenceQuery): string {
  return sha256(stableJson(query)).slice(0, 16);
}

export function evidenceSnapshotDigest(snapshot: CitationEvidenceSnapshot): string {
  return sha256(stableJson(snapshot));
}

export function candidateCorpusDigest(candidates: readonly CitationCandidate[]): string {
  return sha256(stableJson(candidates));
}
