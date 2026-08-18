import { describe, expect, it } from 'vitest';

import { z } from 'zod';

import { corpusIdentityFields, corpusIdentitySchema, sha256 } from '../src/index.js';

describe('corpus identity', () => {
  it('accepts a digest with optional provenance', () => {
    expect(
      corpusIdentitySchema.parse({
        digest: sha256('corpus'),
        headRevision: 'abc123',
        workingTreeDirty: false,
      }),
    ).toMatchObject({ workingTreeDirty: false });
  });

  it('lets a checker add the count its own denominator needs', () => {
    // One audit counts candidates and another counts claims, so the count is not shared. The
    // fields are exported so adding one does not mean restating the rest.
    const local = z
      .object({ ...corpusIdentityFields, claimCount: z.number().int().nonnegative() })
      .strict();
    expect(local.safeParse({ digest: sha256('corpus') }).success).toBe(false);
    expect(local.parse({ digest: sha256('corpus'), claimCount: 75 })).toMatchObject({
      claimCount: 75,
    });
  });
});
