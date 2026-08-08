/**
 * String and personal-name mechanics shared by evidence acquisition and evidence evaluation.
 *
 * This module answers only "how alike are these two strings". It holds no opinion about what a
 * difference means, so both the resolver and the evaluator can depend on it without depending on
 * each other.
 */

/**
 * Title similarity is applied at two points whose error costs run in opposite directions, so both
 * calibration points live here rather than in the modules that consume them. Reading one without
 * the other invites tightening a threshold that is loose on purpose.
 *
 * A search accepts a candidate loosely. A close-but-wrong hit is not trusted by being accepted — it
 * is passed to the comparison below, which flags it. Accepting too strictly is the worse failure:
 * it reports a real work as though no index had ever heard of it.
 *
 * A comparison disputes identity strictly, because falling below it puts a person in the review
 * queue. Flagging too loosely wastes review; flagging too strictly lets a fabricated citation pass.
 */
export const TITLE_SEARCH_THRESHOLD = 0.75;
export const TITLE_IDENTITY_THRESHOLD = 0.88;

/**
 * Reduces a string to lowercase alphanumeric words, dropping diacritics and punctuation, so that
 * comparisons do not turn typography into meaning.
 */
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

/** Normalized edit distance over {@link normalizeWords}, scaled to 0–1 where 1 is identical. */
export function titleSimilarity(left: string, right: string): number {
  const normalizedLeft = normalizeWords(left);
  const normalizedRight = normalizeWords(right);
  if (normalizedLeft === normalizedRight) return 1;
  const longest = Math.max(normalizedLeft.length, normalizedRight.length);
  if (longest === 0) return 1;
  return 1 - levenshteinDistance(normalizedLeft, normalizedRight) / longest;
}

/**
 * Compares personal names token-wise so that initials, diacritics, and reversed given/family order
 * do not read as different people.
 */
export function authorNameMatches(left: string, right: string): boolean {
  const leftTokens = nameTokens(left);
  const rightTokens = nameTokens(right);
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

/** Reduces an author blob to the leading family name, or `undefined` when none can be read. */
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

/** A capitalized run of two or three letters, which Vancouver style uses for given-name initials. */
const INITIALS_RUN = /^\p{Lu}{2,3}$/u;

/**
 * Splits a name into comparable tokens, expanding an unpunctuated run of initials into one token
 * per letter so that `Domingos AI` and `Ana I Domingos` describe the same person.
 *
 * Two conditions keep the expansion from consuming a real name. The run must not lead the name,
 * because that is where a family name sits and a short one in capitals — `LI Wang` — would
 * otherwise match two unrelated given names. And the name must contain a lowercase letter
 * somewhere, because nothing inside a uniformly capitalized name distinguishes initials from a
 * shouted spelling.
 */
function nameTokens(value: string): string[] {
  const rawTokens = value.split(/[\s,]+/u).filter(Boolean);
  const hasLowercase = /\p{Ll}/u.test(value);
  return rawTokens.flatMap((raw, index) =>
    index > 0 && hasLowercase && INITIALS_RUN.test(raw)
      ? [...raw.toLocaleLowerCase()]
      : normalizeWords(raw).split(' ').filter(Boolean),
  );
}

function tokenMatches(left: string, right: string): boolean {
  if (left === right) return true;
  if (left.length === 1) return right.startsWith(left);
  if (right.length === 1) return left.startsWith(right);
  return false;
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
