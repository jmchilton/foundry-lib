import type {
  CitationCandidate,
  CitationEvidence,
  CitationFinding,
  CitationVerdict,
  ScholarlyMetadata,
} from './schema.js';

const TITLE_SIMILARITY_THRESHOLD = 0.88;

export function evaluateCitation(
  candidate: CitationCandidate,
  evidence: readonly CitationEvidence[],
): CitationFinding {
  const resolved = evidence.filter(
    (record): record is CitationEvidence & { metadata: ScholarlyMetadata } =>
      record.state === 'resolved' && record.metadata !== undefined,
  );
  const mismatchReasons = unique([
    ...resolved.flatMap((record) =>
      mismatchReasonsForEvidence(candidate, record).map(
        (reason) => `${record.provider} (${evidenceQueryLabel(record)}): ${reason}`,
      ),
    ),
    ...crossEvidenceMismatchReasons(resolved),
  ]);

  let verdict: CitationVerdict;
  if (mismatchReasons.length > 0) verdict = 'resolved-mismatched';
  else if (evidence.some((record) => record.state === 'unavailable')) verdict = 'unavailable';
  else if (evidence.some((record) => record.state === 'unresolved')) verdict = 'unresolved';
  else if (resolved.length > 0) verdict = 'resolved';
  else verdict = 'unresolved';

  return {
    candidateId: candidate.id,
    evidenceIds: evidence.map((record) => record.id),
    verdict,
    effectiveVerdict: verdict,
    mismatchReasons,
    excludedFromDenominator: false,
  };
}

export function mismatchReasonsForEvidence(
  candidate: CitationCandidate,
  evidence: CitationEvidence & { metadata: ScholarlyMetadata },
): string[] {
  const described = candidate.described;
  if (!described) return [];
  const reasons: string[] = [];
  if (described.title) {
    const similarity = titleSimilarity(described.title, evidence.metadata.title);
    if (similarity < TITLE_SIMILARITY_THRESHOLD) {
      reasons.push(
        `title similarity ${similarity.toFixed(2)}: described ${JSON.stringify(described.title)}, ` +
          `observed ${JSON.stringify(evidence.metadata.title)}`,
      );
    }
  }
  if (
    described.year !== undefined &&
    evidence.metadata.year !== undefined &&
    described.year !== evidence.metadata.year &&
    !(evidence.query.type === 'identifier' && evidence.query.identifier.kind === 'arxiv')
  ) {
    reasons.push(`year differs: described ${described.year}, observed ${evidence.metadata.year}`);
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
    reasons.push(
      `first author differs: described ${JSON.stringify(describedFirstAuthor)}, ` +
        `observed ${JSON.stringify(evidence.metadata.authors[0])}`,
    );
  }
  return reasons;
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

function crossEvidenceMismatchReasons(
  evidence: readonly (CitationEvidence & { metadata: ScholarlyMetadata })[],
): string[] {
  const reasons: string[] = [];
  const first = evidence[0];
  if (!first) return reasons;
  for (const other of evidence.slice(1)) {
    const similarity = titleSimilarity(first.metadata.title, other.metadata.title);
    if (similarity < TITLE_SIMILARITY_THRESHOLD) {
      reasons.push(
        `resolved identifiers disagree: ${evidenceQueryLabel(first)} describes ` +
          `${JSON.stringify(first.metadata.title)}, while ${evidenceQueryLabel(other)} describes ` +
          `${JSON.stringify(other.metadata.title)}`,
      );
    }
  }
  return reasons;
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

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}
