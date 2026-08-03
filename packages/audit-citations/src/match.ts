import type {
  CitationCandidate,
  CitationEvidence,
  CitationFinding,
  CitationMismatch,
  CitationVerdict,
  ScholarlyMetadata,
} from './schema.js';
import {
  TITLE_IDENTITY_THRESHOLD,
  authorNameMatches,
  firstAuthorFamily,
  normalizeWords,
  titleSimilarity,
} from './text.js';

const AUTHOR_OVERLAP_THRESHOLD = 0.6;

/**
 * Providers truncate long author lists differently, so comparing beyond this depth measures the
 * provider's storage conventions rather than the citation.
 */
const MAX_AUTHORS_COMPARED = 10;

export function evaluateCitation(
  candidate: CitationCandidate,
  evidence: readonly CitationEvidence[],
): CitationFinding {
  const resolved = evidence.filter(
    (record): record is CitationEvidence & { metadata: ScholarlyMetadata } =>
      record.state === 'resolved' && record.metadata !== undefined,
  );
  const mismatches = uniqueMismatches([
    ...resolved.flatMap((record) =>
      mismatchesForEvidence(candidate, record).map((mismatch) => ({
        ...mismatch,
        detail: `${record.provider} (${evidenceQueryLabel(record)}): ${mismatch.detail}`,
      })),
    ),
    ...crossEvidenceMismatches(resolved),
  ]);

  let verdict: CitationVerdict;
  if (mismatches.some((mismatch) => mismatch.severity === 'error')) verdict = 'resolved-mismatched';
  else if (evidence.some((record) => record.state === 'unavailable')) verdict = 'unavailable';
  else if (evidence.some((record) => record.state === 'unresolved')) verdict = 'unresolved';
  else if (resolved.length > 0) verdict = 'resolved';
  else verdict = 'unresolved';

  return {
    candidateId: candidate.id,
    evidenceIds: evidence.map((record) => record.id),
    verdict,
    effectiveVerdict: verdict,
    mismatches,
    excludedFromDenominator: false,
  };
}

export function mismatchesForEvidence(
  candidate: CitationCandidate,
  evidence: CitationEvidence & { metadata: ScholarlyMetadata },
): CitationMismatch[] {
  const described = candidate.described;
  if (!described) return [];
  const mismatches: CitationMismatch[] = [];
  if (described.title) {
    const similarity = titleSimilarity(described.title, evidence.metadata.title);
    if (similarity < TITLE_IDENTITY_THRESHOLD) {
      mismatches.push({
        code: 'title',
        severity: 'error',
        detail:
          `title similarity ${similarity.toFixed(2)}: described ${JSON.stringify(described.title)}, ` +
          `observed ${JSON.stringify(evidence.metadata.title)}`,
      });
    }
  }
  if (
    described.year !== undefined &&
    evidence.metadata.year !== undefined &&
    described.year !== evidence.metadata.year
  ) {
    // A preprint that later acquired a journal year, and an arXiv deposit year read as the
    // publication year, are the same phenomenon: drift, not a different work.
    mismatches.push({
      code: 'year',
      severity: 'warning',
      detail: `year differs: described ${described.year}, observed ${evidence.metadata.year}`,
    });
  }
  const describedFirstAuthor = firstAuthorFamily(described.authors?.[0]);
  const observedFirstAuthor = firstAuthorFamily(evidence.metadata.authors[0]);
  const observedAuthorTokens = new Set(normalizeWords(observedFirstAuthor ?? '').split(' '));
  if (
    describedFirstAuthor &&
    observedFirstAuthor &&
    !normalizeWords(describedFirstAuthor)
      .split(' ')
      .every((token) => observedAuthorTokens.has(token))
  ) {
    mismatches.push({
      code: 'author',
      severity: 'error',
      detail:
        `first author differs: described ${JSON.stringify(describedFirstAuthor)}, ` +
        `observed ${JSON.stringify(evidence.metadata.authors[0])}`,
    });
  }
  const overlap = authorOverlap(described.authors ?? [], evidence.metadata.authors);
  if (overlap !== undefined && overlap < AUTHOR_OVERLAP_THRESHOLD) {
    mismatches.push({
      code: 'author-list',
      severity: 'error',
      detail:
        `author overlap ${overlap.toFixed(2)}: described ` +
        `${JSON.stringify(described.authors?.join('; ') ?? '')}, observed ` +
        `${JSON.stringify(evidence.metadata.authors.join('; '))}`,
    });
  }
  return mismatches;
}

/**
 * The fraction of cited authors found in the observed list, or `undefined` when the comparison
 * would not be meaningful.
 *
 * Abstaining matters as much as scoring. Two lists are compared only as deep as the shorter one
 * reaches, because a provider that stores three of thirty authors is not evidence of a fabricated
 * list. Below three compared names the check abstains unless every name matches, since one wrong
 * name out of two is an ordinary transcription slip rather than a different work — the `author`
 * check still covers the leading name in that case.
 *
 * Organisation names that some providers concatenate onto the first author are not stripped, so a
 * corporate-authored work can score low. Such a table would be provider trivia this package does
 * not own; the resulting mismatch is a review item, not a verdict.
 */
export function authorOverlap(
  cited: readonly string[],
  observed: readonly string[],
): number | undefined {
  if (cited.length < 2 || observed.length < 2) return undefined;
  const depth = Math.min(cited.length, observed.length, MAX_AUTHORS_COMPARED);
  const compared = cited.slice(0, depth);
  const matches = compared.filter((name) =>
    observed.some((candidate) => authorNameMatches(name, candidate)),
  ).length;
  if (depth <= 2) return matches === depth ? 1 : undefined;
  return matches / depth;
}

function crossEvidenceMismatches(
  evidence: readonly (CitationEvidence & { metadata: ScholarlyMetadata })[],
): CitationMismatch[] {
  const mismatches: CitationMismatch[] = [];
  const first = evidence[0];
  if (!first) return mismatches;
  for (const other of evidence.slice(1)) {
    const similarity = titleSimilarity(first.metadata.title, other.metadata.title);
    if (similarity < TITLE_IDENTITY_THRESHOLD) {
      mismatches.push({
        code: 'cross-identifier',
        severity: 'error',
        detail:
          `resolved identifiers disagree: ${evidenceQueryLabel(first)} describes ` +
          `${JSON.stringify(first.metadata.title)}, while ${evidenceQueryLabel(other)} describes ` +
          `${JSON.stringify(other.metadata.title)}`,
      });
    }
  }
  return mismatches;
}

function evidenceQueryLabel(evidence: CitationEvidence): string {
  if (evidence.query.type === 'identifier') {
    return `${evidence.query.identifier.kind}:${evidence.query.identifier.value}`;
  }
  return `title:${normalizeWords(evidence.query.title)}`;
}

function uniqueMismatches(mismatches: readonly CitationMismatch[]): CitationMismatch[] {
  const seen = new Set<string>();
  return mismatches.filter((mismatch) => {
    const key = `${mismatch.code}\0${mismatch.severity}\0${mismatch.detail}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
