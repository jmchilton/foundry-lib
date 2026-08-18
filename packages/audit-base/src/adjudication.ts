import { z } from 'zod';

/**
 * Severity separates an identity dispute from ordinary drift, so that a claim contradicted by its
 * authority does not sit in the same queue as one that merely reads oddly.
 */
export const claimSeverities = ['error', 'warning'] as const;
export type ClaimSeverity = (typeof claimSeverities)[number];

/**
 * What a reviewer decided a flagged finding actually was.
 *
 * The three keep the machine's verdict beside the human's rather than replacing it, because an
 * extractor defect and a genuine repair are different facts about the audit. Collapsing them would
 * make the instrument unable to report its own precision — and an extractor false positive must
 * leave the denominator entirely, or a checker could improve its own score by misreading more
 * prose.
 */
export const claimClassifications = [
  'confirmed-finding',
  'extractor-false-positive',
  'checker-false-positive',
] as const;
export type ClaimClassification = (typeof claimClassifications)[number];

/**
 * Build the adjudication schema for a checker's own verdict vocabulary.
 *
 * The vocabulary is a parameter because the two known checkers share exactly one verdict between
 * them. A common union would be either a lowest common denominator or an untagged mixture, and
 * both would lose the meaning the individual verdicts carry.
 */
export function adjudicationSchema<const Verdicts extends readonly [string, ...string[]]>(
  verdicts: Verdicts,
) {
  return z
    .object({
      claimId: z.string().min(1),
      sourceDigest: z.string().regex(/^[a-f0-9]{64}$/u),
      classification: z.enum(claimClassifications),
      /**
       * What the reviewer says the verdict should have been. Required exactly for
       * `checker-false-positive`, because that classification asserts the checker got a real claim
       * wrong and is meaningless without the answer it should have given. The other two need none:
       * an extractor false positive withdraws the claim, and a confirmed finding keeps the
       * machine's own verdict.
       */
      assertedVerdict: z.enum(verdicts).optional(),
      note: z.string().min(1),
      reviewer: z.string().optional(),
      reviewedAt: z.string().datetime({ offset: true }).optional(),
    })
    .strict()
    .refine(
      (adjudication) =>
        adjudication.classification !== 'checker-false-positive' ||
        adjudication.assertedVerdict !== undefined,
      {
        message: 'checker-false-positive requires assertedVerdict',
        path: ['assertedVerdict'],
      },
    )
    .refine(
      (adjudication) =>
        adjudication.classification === 'checker-false-positive' ||
        adjudication.assertedVerdict === undefined,
      {
        message: 'assertedVerdict is meaningful only for checker-false-positive',
        path: ['assertedVerdict'],
      },
    );
}

/**
 * A reviewed decision that does not correspond to a live claim.
 *
 * The three are reported, not ranked. `retired` means a decision bound to text that has since
 * changed, which is what digest-binding is for and arguably benign; `unknown` and `duplicate` mean
 * a reviewer wrote a decision that silently does nothing. Which of them should stop a run is the
 * consumer's call — the two known checkers disagree about `retired` today, and this package
 * detects rather than settles it.
 */
export interface AdjudicationProblem {
  kind: 'unknown-claim' | 'duplicate-claim' | 'retired';
  claimId: string;
  detail: string;
}

/** A claim, seen only as an identity and the digest of the text it was reviewed against. */
export interface AdjudicableClaim {
  id: string;
  span: { sourceDigest: string };
}

/** A decision, seen only as the claim it names and the digest it was recorded against. */
export interface AdjudicationReference {
  claimId: string;
  sourceDigest: string;
}

export function adjudicationProblems(
  claims: readonly AdjudicableClaim[],
  adjudications: readonly AdjudicationReference[],
): AdjudicationProblem[] {
  const claimById = new Map(claims.map((claim) => [claim.id, claim]));
  const problems: AdjudicationProblem[] = [];
  const seen = new Set<string>();

  for (const adjudication of adjudications) {
    const { claimId: id } = adjudication;
    if (seen.has(id)) {
      problems.push({
        kind: 'duplicate-claim',
        claimId: id,
        detail: `two adjudications name claim ${id}; only one can apply and which one is arbitrary`,
      });
      continue;
    }
    seen.add(id);

    const claim = claimById.get(id);
    if (claim === undefined) {
      problems.push({
        kind: 'unknown-claim',
        claimId: id,
        detail: `no claim in this corpus has id ${id}; the decision applies to nothing`,
      });
      continue;
    }
    if (claim.span.sourceDigest !== adjudication.sourceDigest) {
      problems.push({
        kind: 'retired',
        claimId: id,
        detail: `the reviewed text at ${id} has changed since the decision was recorded`,
      });
    }
  }

  return problems;
}
