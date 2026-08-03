import { z } from 'zod';

import { candidateCorpusDigest, evidenceId, sourceTextDigest } from './identity.js';

export const CITATION_AUDIT_SCHEMA_VERSION = 1 as const;

export const citationVerdicts = [
  'resolved',
  'resolved-mismatched',
  'unresolved',
  'unavailable',
] as const;

export const evidenceStates = ['resolved', 'unresolved', 'unavailable'] as const;

/**
 * A mismatch is an `error` when it disputes the identity of the cited work, and a `warning` when it
 * reflects ordinary publication drift. Only errors make a citation a finding, so a preprint that
 * later acquired a journal year does not enter the manual-review queue alongside a wrong author.
 */
export const mismatchSeverities = ['error', 'warning'] as const;

export const mismatchCodes = [
  'title',
  'author',
  'author-list',
  'year',
  'cross-identifier',
] as const;

export const citationMismatchSchema = z
  .object({
    code: z.enum(mismatchCodes),
    severity: z.enum(mismatchSeverities),
    detail: z.string().min(1),
  })
  .strict();

export const citationIdentifierSchema = z
  .object({
    kind: z.string().min(1),
    value: z.string().min(1),
  })
  .strict();

export const artifactSpanSchema = z
  .object({
    artifactKind: z.string().min(1),
    artifactPath: z.string().min(1),
    startLine: z.number().int().positive(),
    endLine: z.number().int().positive(),
    sourceText: z.string(),
    sourceDigest: z.string().regex(/^[a-f0-9]{64}$/u),
  })
  .strict()
  .refine((span) => span.endLine >= span.startLine, {
    message: 'endLine must not precede startLine',
    path: ['endLine'],
  })
  .refine((span) => span.sourceDigest === sourceTextDigest(span.sourceText), {
    message: 'source digest does not match sourceText',
    path: ['sourceDigest'],
  });

export const describedCitationSchema = z
  .object({
    title: z.string().min(1).optional(),
    authors: z.array(z.string().min(1)).optional(),
    year: z.number().int().min(1000).max(9999).optional(),
  })
  .strict();

export const citationCandidateSchema = z
  .object({
    id: z.string().min(1),
    span: artifactSpanSchema,
    identifiers: z.array(citationIdentifierSchema),
    described: describedCitationSchema.optional(),
  })
  .strict()
  .refine(
    (candidate) => candidate.identifiers.length > 0 || candidate.described?.title !== undefined,
    {
      message: 'citation candidate requires an identifier or described title',
      path: ['identifiers'],
    },
  );

export const extractionDiagnosticsSchema = z
  .object({
    excludedUrls: z.array(
      z
        .object({
          artifactPath: z.string(),
          line: z.number().int().positive(),
          url: z.string(),
        })
        .strict(),
    ),
    authorYearPatternCount: z.number().int().nonnegative(),
    /**
     * Non-blank lines inside a reference section that produced no candidate. Reporting resolution
     * rates without this denominator would let a narrow extractor look like a clean corpus. A
     * wrapped entry contributes one line per physical line, so extraction coverage is a lower
     * bound.
     */
    unextractedReferenceLines: z.array(
      z
        .object({
          artifactPath: z.string(),
          line: z.number().int().positive(),
        })
        .strict(),
    ),
  })
  .strict();

export const citationScanSchema = z
  .object({
    schemaVersion: z.literal(CITATION_AUDIT_SCHEMA_VERSION),
    candidates: z.array(citationCandidateSchema),
    diagnostics: extractionDiagnosticsSchema,
  })
  .strict();

export const evidenceQuerySchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('identifier'),
      identifier: citationIdentifierSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal('bibliographic'),
      title: z.string().min(1),
      year: z.number().int().optional(),
      firstAuthor: z.string().min(1).optional(),
    })
    .strict(),
]);

export const scholarlyMetadataSchema = z
  .object({
    title: z.string().trim().min(1),
    authors: z.array(z.string().trim().min(1)),
    year: z.number().int().optional(),
    identifiers: z.array(citationIdentifierSchema),
  })
  .strict();

const evidenceLocatorSchema = z
  .object({
    url: z.string().optional(),
    externalId: z.string().optional(),
  })
  .strict();

export const citationEvidenceSchema = z
  .object({
    id: z.string().min(1),
    query: evidenceQuerySchema,
    provider: z.string().min(1),
    state: z.enum(evidenceStates),
    observedAt: z.string().datetime({ offset: true }),
    matchedIdentifier: citationIdentifierSchema.optional(),
    metadata: scholarlyMetadataSchema.optional(),
    locator: evidenceLocatorSchema.optional(),
    error: z.string().optional(),
  })
  .strict()
  .superRefine((record, context) => {
    if (record.state === 'resolved' && record.metadata === undefined) {
      context.addIssue({
        code: 'custom',
        message: 'resolved evidence requires metadata',
        path: ['metadata'],
      });
    }
    if (record.state !== 'resolved' && record.metadata !== undefined) {
      context.addIssue({
        code: 'custom',
        message: `${record.state} evidence must not carry resolved metadata`,
        path: ['metadata'],
      });
    }
  });

export const citationEvidenceSnapshotSchema = z
  .object({
    schemaVersion: z.literal(CITATION_AUDIT_SCHEMA_VERSION),
    evidence: z.array(citationEvidenceSchema),
  })
  .strict();

export const citationFindingSchema = z
  .object({
    candidateId: z.string().min(1),
    evidenceIds: z.array(z.string().min(1)).min(1),
    verdict: z.enum(citationVerdicts),
    effectiveVerdict: z.enum(citationVerdicts),
    mismatches: z.array(citationMismatchSchema),
    excludedFromDenominator: z.boolean(),
  })
  .strict()
  .refine(
    (finding) =>
      finding.mismatches.some((mismatch) => mismatch.severity === 'error') ===
      (finding.verdict === 'resolved-mismatched'),
    {
      message: 'resolved-mismatched must carry an error mismatch, and no other verdict may',
      path: ['verdict'],
    },
  );

export const citationAdjudicationSchema = z
  .object({
    candidateId: z.string().min(1),
    sourceDigest: z.string().regex(/^[a-f0-9]{64}$/u),
    classification: z.enum([
      'confirmed-finding',
      'extractor-false-positive',
      'resolver-false-positive',
    ]),
    adjudicatedVerdict: z.enum(citationVerdicts).optional(),
    note: z.string().min(1),
    reviewer: z.string().optional(),
    reviewedAt: z.string().datetime({ offset: true }).optional(),
  })
  .strict()
  .superRefine((review, context) => {
    if (
      review.classification === 'resolver-false-positive' &&
      review.adjudicatedVerdict === undefined
    ) {
      context.addIssue({
        code: 'custom',
        message: 'resolver-false-positive requires adjudicatedVerdict',
        path: ['adjudicatedVerdict'],
      });
    }
  });

export const citationAdjudicationsSchema = z
  .object({
    schemaVersion: z.literal(CITATION_AUDIT_SCHEMA_VERSION),
    reviews: z.array(citationAdjudicationSchema),
  })
  .strict();

const verdictCountsSchema = z
  .object({
    total: z.number().int().nonnegative(),
    resolved: z.number().int().nonnegative(),
    'resolved-mismatched': z.number().int().nonnegative(),
    unresolved: z.number().int().nonnegative(),
    unavailable: z.number().int().nonnegative(),
    extractorFalsePositives: z.number().int().nonnegative(),
  })
  .strict();

export const corpusIdentitySchema = z
  .object({
    digest: z.string().regex(/^[a-f0-9]{64}$/u),
    headRevision: z.string().optional(),
    workingTreeDirty: z.boolean().optional(),
  })
  .strict();

export const citationAuditRunSchema = z
  .object({
    schemaVersion: z.literal(CITATION_AUDIT_SCHEMA_VERSION),
    auditKind: z.literal('citation-integrity'),
    generatedAt: z.string().datetime({ offset: true }),
    corpus: corpusIdentitySchema,
    evidenceSnapshotDigest: z.string().regex(/^[a-f0-9]{64}$/u),
    manualReviewStatus: z.enum(['not-required', 'not-reviewed', 'partial', 'completed']),
    manualReview: z
      .object({
        required: z.number().int().nonnegative(),
        completed: z.number().int().nonnegative(),
      })
      .strict(),
    summary: verdictCountsSchema,
    candidates: z.array(citationCandidateSchema),
    findings: z.array(citationFindingSchema),
    adjudications: z.array(citationAdjudicationSchema),
    diagnostics: extractionDiagnosticsSchema,
  })
  .strict();

export type CitationIdentifier = z.infer<typeof citationIdentifierSchema>;
export type CitationMismatch = z.infer<typeof citationMismatchSchema>;
export type MismatchSeverity = (typeof mismatchSeverities)[number];
export type MismatchCode = (typeof mismatchCodes)[number];
export type ArtifactSpan = z.infer<typeof artifactSpanSchema>;
export type DescribedCitation = z.infer<typeof describedCitationSchema>;
export type CitationCandidate = z.infer<typeof citationCandidateSchema>;
export type ExtractionDiagnostics = z.infer<typeof extractionDiagnosticsSchema>;
export type CitationScan = z.infer<typeof citationScanSchema>;
export type EvidenceQuery = z.infer<typeof evidenceQuerySchema>;
export type ScholarlyMetadata = z.infer<typeof scholarlyMetadataSchema>;
export type CitationEvidence = z.infer<typeof citationEvidenceSchema>;
export type CitationEvidenceSnapshot = z.infer<typeof citationEvidenceSnapshotSchema>;
export type CitationVerdict = (typeof citationVerdicts)[number];
export type EvidenceState = (typeof evidenceStates)[number];
export type CitationFinding = z.infer<typeof citationFindingSchema>;
export type CitationAdjudication = z.infer<typeof citationAdjudicationSchema>;
export type CitationAdjudications = z.infer<typeof citationAdjudicationsSchema>;
export type CorpusIdentity = z.infer<typeof corpusIdentitySchema>;
export type CitationAuditRun = z.infer<typeof citationAuditRunSchema>;

export function parseCitationScan(value: unknown): CitationScan {
  const scan = citationScanSchema.parse(value);
  assertUnique(
    scan.candidates.map((candidate) => candidate.id),
    'candidate ID',
  );
  return scan;
}

export function parseCitationEvidenceSnapshot(value: unknown): CitationEvidenceSnapshot {
  const snapshot = citationEvidenceSnapshotSchema.parse(value);
  assertUnique(
    snapshot.evidence.map((record) => record.id),
    'evidence ID',
  );
  for (const record of snapshot.evidence) {
    if (record.id !== evidenceId(record.query)) {
      throw new Error(`evidence ID ${record.id} does not match its query`);
    }
  }
  return snapshot;
}

export function parseCitationAdjudications(value: unknown): CitationAdjudications {
  const adjudications = citationAdjudicationsSchema.parse(value);
  assertUnique(
    adjudications.reviews.map((review) => review.candidateId),
    'adjudicated candidate ID',
  );
  return adjudications;
}

export function parseCitationAuditRun(value: unknown): CitationAuditRun {
  const run = citationAuditRunSchema.parse(value);
  const candidateIds = run.candidates.map((candidate) => candidate.id);
  assertUnique(candidateIds, 'candidate ID');
  assertUnique(
    run.findings.map((finding) => finding.candidateId),
    'finding candidate ID',
  );
  const candidateIdSet = new Set(candidateIds);
  for (const finding of run.findings) {
    if (!candidateIdSet.has(finding.candidateId)) {
      throw new Error(`finding references unknown candidate ${finding.candidateId}`);
    }
    assertUnique(finding.evidenceIds, `evidence ID for candidate ${finding.candidateId}`);
  }
  if (run.findings.length !== run.candidates.length) {
    throw new Error(
      `audit run has ${run.candidates.length} candidates but ${run.findings.length} findings`,
    );
  }
  assertUnique(
    run.adjudications.map((review) => review.candidateId),
    'adjudicated candidate ID',
  );
  for (const review of run.adjudications) {
    const candidate = run.candidates.find((item) => item.id === review.candidateId);
    if (!candidate)
      throw new Error(`adjudication references unknown candidate ${review.candidateId}`);
    if (candidate.span.sourceDigest !== review.sourceDigest) {
      throw new Error(`adjudication for ${review.candidateId} has a stale source digest`);
    }
  }
  const included = run.findings.filter((finding) => !finding.excludedFromDenominator);
  const expectedTotal = included.length;
  if (run.summary.total !== expectedTotal) {
    throw new Error('audit summary total does not match included findings');
  }
  for (const verdict of citationVerdicts) {
    const expected = included.filter((finding) => finding.effectiveVerdict === verdict).length;
    if (run.summary[verdict] !== expected) {
      throw new Error(`audit summary ${verdict} count does not match findings`);
    }
  }
  if (run.summary.extractorFalsePositives !== run.findings.length - included.length) {
    throw new Error('audit summary extractor false-positive count does not match findings');
  }
  if (run.corpus.digest !== candidateCorpusDigest(run.candidates)) {
    throw new Error('audit corpus digest does not match candidates');
  }
  const required = new Set(
    run.findings
      .filter((finding) => finding.verdict !== 'resolved')
      .map((finding) => finding.candidateId),
  );
  const completed = run.adjudications.filter((review) => required.has(review.candidateId)).length;
  if (run.manualReview.required !== required.size || run.manualReview.completed !== completed) {
    throw new Error('audit manual-review counts do not match findings and adjudications');
  }
  const expectedStatus =
    required.size === 0
      ? 'not-required'
      : completed === 0
        ? 'not-reviewed'
        : completed === required.size
          ? 'completed'
          : 'partial';
  if (run.manualReviewStatus !== expectedStatus) {
    throw new Error('audit manual-review status does not match findings and adjudications');
  }
  return run;
}

function assertUnique(values: readonly string[], label: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) throw new Error(`duplicate ${label}: ${value}`);
    seen.add(value);
  }
}
