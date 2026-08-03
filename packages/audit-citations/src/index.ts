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
  citationScanSchema,
  citationVerdicts,
  corpusIdentitySchema,
  describedCitationSchema,
  evidenceQuerySchema,
  evidenceStates,
  extractionDiagnosticsSchema,
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
  CitationScan,
  CitationVerdict,
  CorpusIdentity,
  DescribedCitation,
  EvidenceQuery,
  EvidenceState,
  ExtractionDiagnostics,
  ScholarlyMetadata,
} from './schema.js';

export { extractCitations, extractIdentifiers } from './extract.js';
export type { CitationExtractionOptions, SourceDocument } from './extract.js';

export {
  collectEvidence,
  evidenceId,
  evidenceQueries,
  evidenceSnapshotDigest,
} from './evidence.js';
export type { CitationResolver, CollectedEvidence, CollectEvidenceOptions } from './evidence.js';

export {
  evaluateCitation,
  firstAuthorFamily,
  mismatchReasonsForEvidence,
  normalizeWords,
  titleSimilarity,
} from './match.js';

export { ScholarlyResolver } from './resolve.js';
export type { FetchLike, FetchResponse, ScholarlyResolverOptions } from './resolve.js';

export { buildCitationAuditRun } from './audit.js';
export type { BuildAuditRunOptions, CorpusProvenance } from './audit.js';

export { renderCitationAuditMarkdown } from './report.js';

export { candidateCorpusDigest, sourceTextDigest } from './identity.js';
