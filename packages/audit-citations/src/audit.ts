import { evidenceQueries } from './evidence.js';
import { candidateCorpusDigest, evidenceId, evidenceSnapshotDigest } from './identity.js';
import { evaluateCitation } from './match.js';
import type {
  CitationAdjudication,
  CitationAdjudications,
  CitationAuditRun,
  CitationEvidence,
  CitationEvidenceSnapshot,
  CitationFinding,
  CitationScan,
  CitationVerdict,
  CorpusIdentity,
} from './schema.js';
import {
  CITATION_AUDIT_SCHEMA_VERSION,
  parseCitationAuditRun,
  parseCitationEvidenceSnapshot,
  parseCitationScan,
} from './schema.js';

export interface CorpusProvenance {
  headRevision?: string;
  workingTreeDirty?: boolean;
}

export interface BuildAuditRunOptions {
  adjudications?: CitationAdjudications;
  provenance?: CorpusProvenance;
  generatedAt?: string;
}

export function buildCitationAuditRun(
  scan: CitationScan,
  snapshot: CitationEvidenceSnapshot,
  options: BuildAuditRunOptions = {},
): CitationAuditRun {
  scan = parseCitationScan(scan);
  snapshot = parseCitationEvidenceSnapshot(snapshot);
  const evidenceById = new Map(snapshot.evidence.map((record) => [record.id, record]));
  const reviews = options.adjudications?.reviews ?? [];
  validateAdjudications(scan, reviews);
  const reviewByCandidate = new Map(reviews.map((review) => [review.candidateId, review]));

  const rawFindings = scan.candidates.map((candidate) => {
    const evidence = evidenceForCandidate(candidate.id, evidenceById, scan);
    return evaluateCitation(candidate, evidence);
  });
  const findings = rawFindings.map((finding) =>
    applyAdjudication(finding, reviewByCandidate.get(finding.candidateId)),
  );
  const required = new Set(
    rawFindings
      .filter((finding) => finding.verdict !== 'resolved')
      .map((finding) => finding.candidateId),
  );
  const completed = reviews.filter((review) => required.has(review.candidateId)).length;
  const manualReviewStatus =
    required.size === 0
      ? 'not-required'
      : completed === 0
        ? 'not-reviewed'
        : completed === required.size
          ? 'completed'
          : 'partial';

  const included = findings.filter((finding) => !finding.excludedFromDenominator);
  const count = (verdict: CitationVerdict): number =>
    included.filter((finding) => finding.effectiveVerdict === verdict).length;
  const run: CitationAuditRun = {
    schemaVersion: CITATION_AUDIT_SCHEMA_VERSION,
    auditKind: 'citation-integrity',
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    corpus: corpusIdentity(scan, options.provenance),
    evidenceSnapshotDigest: evidenceSnapshotDigest(snapshot),
    manualReviewStatus,
    manualReview: { required: required.size, completed },
    summary: {
      total: included.length,
      resolved: count('resolved'),
      'resolved-mismatched': count('resolved-mismatched'),
      unresolved: count('unresolved'),
      unavailable: count('unavailable'),
      resolvedUnverified: included.filter(
        (finding) => finding.effectiveVerdict === 'resolved' && !finding.verifiable,
      ).length,
      extractorFalsePositives: findings.length - included.length,
    },
    candidates: scan.candidates,
    findings,
    adjudications: reviews,
    diagnostics: scan.diagnostics,
  };
  return parseCitationAuditRun(run);
}

function evidenceForCandidate(
  candidateId: string,
  evidenceById: ReadonlyMap<string, CitationEvidence>,
  scan: CitationScan,
): CitationEvidence[] {
  const candidate = scan.candidates.find((item) => item.id === candidateId);
  if (!candidate) throw new Error(`candidate ${candidateId} not found in scan`);
  return evidenceQueries(candidate).map((query) => {
    const id = evidenceId(query);
    const record = evidenceById.get(id);
    if (!record) throw new Error(`candidate ${candidate.id} is missing evidence ${id}`);
    return record;
  });
}

function validateAdjudications(scan: CitationScan, reviews: readonly CitationAdjudication[]): void {
  const candidates = new Map(scan.candidates.map((candidate) => [candidate.id, candidate]));
  const seen = new Set<string>();
  for (const review of reviews) {
    if (seen.has(review.candidateId)) {
      throw new Error(`duplicate adjudication for candidate ${review.candidateId}`);
    }
    seen.add(review.candidateId);
    const candidate = candidates.get(review.candidateId);
    if (!candidate)
      throw new Error(`adjudication references unknown candidate ${review.candidateId}`);
    if (candidate.span.sourceDigest !== review.sourceDigest) {
      throw new Error(`adjudication for ${review.candidateId} has a stale source digest`);
    }
  }
}

function applyAdjudication(
  finding: CitationFinding,
  review: CitationAdjudication | undefined,
): CitationFinding {
  if (!review) return finding;
  if (review.classification === 'extractor-false-positive') {
    return { ...finding, excludedFromDenominator: true };
  }
  if (review.classification === 'resolver-false-positive') {
    if (!review.adjudicatedVerdict) {
      throw new Error(`resolver false positive ${review.candidateId} needs adjudicatedVerdict`);
    }
    return { ...finding, effectiveVerdict: review.adjudicatedVerdict };
  }
  return finding;
}

function corpusIdentity(scan: CitationScan, provenance: CorpusProvenance = {}): CorpusIdentity {
  return {
    digest: candidateCorpusDigest(scan.candidates),
    ...(provenance.headRevision ? { headRevision: provenance.headRevision } : {}),
    ...(provenance.workingTreeDirty !== undefined
      ? { workingTreeDirty: provenance.workingTreeDirty }
      : {}),
  };
}
