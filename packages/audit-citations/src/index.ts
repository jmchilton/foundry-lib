export {
  CITATION_AUDIT_SCHEMA_VERSION,
  artifactSpanSchema,
  citationAdjudicationSchema,
  citationAdjudicationsSchema,
  citationAuditRunSchema,
  citationCandidateSchema,
  citationEvidenceSchema,
  citationEvidenceSnapshotSchema,
  citationFindingSchema,
  citationIdentifierSchema,
  citationMismatchSchema,
  citationScanSchema,
  citationVerdicts,
  corpusIdentitySchema,
  describedCitationSchema,
  evidenceQuerySchema,
  evidenceStates,
  extractionDiagnosticsSchema,
  mismatchCodes,
  mismatchSeverities,
  parseCitationAdjudications,
  parseCitationAuditRun,
  parseCitationEvidenceSnapshot,
  parseCitationScan,
  scholarlyMetadataSchema,
} from './schema.js';
export type {
  ArtifactSpan,
  CitationAdjudication,
  CitationAdjudications,
  CitationAuditRun,
  CitationCandidate,
  CitationEvidence,
  CitationEvidenceSnapshot,
  CitationFinding,
  CitationIdentifier,
  CitationMismatch,
  CitationScan,
  CitationVerdict,
  CorpusIdentity,
  DescribedCitation,
  EvidenceQuery,
  EvidenceState,
  ExtractionDiagnostics,
  MismatchCode,
  MismatchSeverity,
  ScholarlyMetadata,
} from './schema.js';

export { extractCitations, extractIdentifiers } from './extract.js';
export type {
  CitationExtractionOptions,
  NoteFrontmatterFields,
  SourceDocument,
} from './extract.js';

export {
  collectEvidence,
  evidenceId,
  evidenceQueries,
  evidenceSnapshotDigest,
} from './evidence.js';
export type { CitationResolver, CollectedEvidence, CollectEvidenceOptions } from './evidence.js';

export { authorNameMatches, firstAuthorFamily, normalizeWords, titleSimilarity } from './text.js';

export { authorOverlap, evaluateCitation, mismatchesForEvidence } from './match.js';

export { ScholarlyResolver } from './resolve.js';
export type { FetchLike, FetchResponse, ScholarlyResolverOptions } from './resolve.js';

export { buildCitationAuditRun } from './audit.js';
export type { BuildAuditRunOptions, CorpusProvenance } from './audit.js';

export { renderCitationAuditMarkdown } from './report.js';

export { candidateCorpusDigest } from './identity.js';

// Re-exported so a caller building a candidate span reaches one package, not two.
export { sourceTextDigest } from '@galaxy-foundry/audit-base';
