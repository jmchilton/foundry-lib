import type {
  CitationCandidate,
  CitationEvidence,
  CitationFinding,
  CitationMismatch,
  CitationVerdict,
  ScholarlyMetadata,
} from './schema.js';

const TITLE_SIMILARITY_THRESHOLD = 0.88;
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
    if (similarity < TITLE_SIMILARITY_THRESHOLD) {
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

/**
 * Compares personal names token-wise so that initials, diacritics, and reversed given/family order
 * do not read as different people.
 */
export function authorNameMatches(left: string, right: string): boolean {
  const leftTokens = normalizeWords(left).split(' ').filter(Boolean);
  const rightTokens = normalizeWords(right).split(' ').filter(Boolean);
  if (leftTokens.length === 0 || rightTokens.length === 0) return false;
  const [shorter, longer] =
    leftTokens.length <= rightTokens.length ? [leftTokens, rightTokens] : [rightTokens, leftTokens];
  const pool = [...longer];
  for (const token of shorter) {
    const index = pool.findIndex((other) => tokenMatches(token, other));
    if (index < 0) return false;
    pool.splice(index, 1);
  }
  return true;
}

function tokenMatches(left: string, right: string): boolean {
  if (left === right) return true;
  if (left.length === 1) return right.startsWith(left);
  if (right.length === 1) return left.startsWith(right);
  return false;
}

export function normalizeWords(value: string): string {
  return (
    value
      .normalize('NFKD')
      .replace(/\p{Mark}/gu, '')
      .toLocaleLowerCase()
      .match(/[a-z0-9]+/gu)
      ?.join(' ') ?? ''
  );
}

export function titleSimilarity(left: string, right: string): number {
  const normalizedLeft = normalizeWords(left);
  const normalizedRight = normalizeWords(right);
  if (normalizedLeft === normalizedRight) return 1;
  const longest = Math.max(normalizedLeft.length, normalizedRight.length);
  if (longest === 0) return 1;
  return 1 - levenshteinDistance(normalizedLeft, normalizedRight) / longest;
}

export function firstAuthorFamily(authorText: string | undefined): string | undefined {
  if (!authorText) return undefined;
  const withoutLabel = authorText.replace(/^.+?:\s*/u, '');
  const first = withoutLabel.split(/\s+and\s+|;/iu, 1)[0]?.trim();
  if (!first) return undefined;
  const beforeComma = first.includes(',') ? (first.split(',', 1)[0] ?? '') : first;
  const words = beforeComma
    .replace(/\s+et\s+al\.?$/iu, '')
    .trim()
    .split(/\s+/u);
  if (words.length === 0) return undefined;
  const final = words.at(-1)?.replace(/[^A-Za-z]/gu, '') ?? '';
  const family = final.length === 1 || final === final.toUpperCase() ? words[0] : words.at(-1);
  const normalized = family ? normalizeWords(family) : '';
  return normalized || undefined;
}

function crossEvidenceMismatches(
  evidence: readonly (CitationEvidence & { metadata: ScholarlyMetadata })[],
): CitationMismatch[] {
  const mismatches: CitationMismatch[] = [];
  const first = evidence[0];
  if (!first) return mismatches;
  for (const other of evidence.slice(1)) {
    const similarity = titleSimilarity(first.metadata.title, other.metadata.title);
    if (similarity < TITLE_SIMILARITY_THRESHOLD) {
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

function levenshteinDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitution =
        previous[rightIndex - 1]! + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1);
      current[rightIndex] = Math.min(
        previous[rightIndex]! + 1,
        current[rightIndex - 1]! + 1,
        substitution,
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length] ?? left.length;
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
