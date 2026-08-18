import { describe, expect, it } from 'vitest';

import { adjudicationProblems, adjudicationSchema, sourceTextDigest } from '../src/index.js';

const schema = adjudicationSchema(['exists', 'absent', 'wrong-value'] as const);

const digest = sourceTextDigest('a claim');

const review = (overrides: Record<string, unknown> = {}) => ({
  claimId: 'a1b2c3',
  sourceDigest: digest,
  classification: 'confirmed-finding',
  note: 'checked against the lock',
  ...overrides,
});

describe('a reviewed decision is bound to its verdict vocabulary', () => {
  it('accepts a verdict the checker declares', () => {
    expect(
      schema.parse(review({ classification: 'checker-false-positive', assertedVerdict: 'absent' })),
    ).toMatchObject({ assertedVerdict: 'absent' });
  });

  it('rejects a verdict from some other checker', () => {
    // The vocabulary is a parameter precisely so that one checker's verdict cannot be recorded
    // against another's claim.
    const result = schema.safeParse(
      review({ classification: 'checker-false-positive', assertedVerdict: 'resolved' }),
    );
    expect(result.success).toBe(false);
  });

  it('requires an asserted verdict when the reviewer says the checker was wrong', () => {
    const result = schema.safeParse(review({ classification: 'checker-false-positive' }));
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      'checker-false-positive requires assertedVerdict',
    );
  });

  it('forbids an asserted verdict on the two classifications it cannot mean anything for', () => {
    // An extractor false positive withdraws the claim and a confirmed finding keeps the machine's
    // verdict, so a verdict recorded beside either is a decision nothing will read.
    for (const classification of ['extractor-false-positive', 'confirmed-finding']) {
      const result = schema.safeParse(review({ classification, assertedVerdict: 'exists' }));
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(
        'assertedVerdict is meaningful only for checker-false-positive',
      );
    }
  });

  it('requires a note, because a decision with no reason is not reviewable', () => {
    expect(schema.safeParse(review({ note: '' })).success).toBe(false);
  });
});

describe('decisions that name nothing live are reported, not ranked', () => {
  const claims = [{ id: 'a1b2c3', span: { sourceDigest: digest } }];

  it('finds no problem when a decision names a live claim at the text it reviewed', () => {
    expect(adjudicationProblems(claims, [{ claimId: 'a1b2c3', sourceDigest: digest }])).toEqual([]);
  });

  it('reports a decision naming a claim this corpus does not have', () => {
    const [problem] = adjudicationProblems(claims, [{ claimId: 'ffff', sourceDigest: digest }]);
    expect(problem?.kind).toBe('unknown-claim');
  });

  it('reports the second decision to name one claim, and does not judge which wins', () => {
    const problems = adjudicationProblems(claims, [
      { claimId: 'a1b2c3', sourceDigest: digest },
      { claimId: 'a1b2c3', sourceDigest: digest },
    ]);
    expect(problems.map(({ kind }) => kind)).toEqual(['duplicate-claim']);
  });

  it('reports a decision whose reviewed text has since changed as retired', () => {
    // Reported, not thrown: the two known checkers disagree about whether this should stop a run,
    // so fatality is the consumer's call and this package only detects it.
    const [problem] = adjudicationProblems(claims, [
      { claimId: 'a1b2c3', sourceDigest: sourceTextDigest('a claim, edited') },
    ]);
    expect(problem?.kind).toBe('retired');
  });
});
