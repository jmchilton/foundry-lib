import { z } from 'zod';

/**
 * The fields that name the corpus a run audited.
 *
 * Exported as fields rather than only as a finished schema because checkers record different
 * counts beside them, and a count is not a shared contract: one audit's denominator is candidates,
 * another's is claims. Spread these into a local `z.object({...}).strict()` to add one.
 */
export const corpusIdentityFields = {
  digest: z.string().regex(/^[a-f0-9]{64}$/u),
  headRevision: z.string().optional(),
  workingTreeDirty: z.boolean().optional(),
};

/**
 * How the digest is computed is deliberately not shared. One checker hashes its full candidate
 * records and another hashes the ordered claim ids, and those answer different questions about
 * what counts as the same corpus. The field is a digest; which digest is the checker's decision.
 */
export const corpusIdentitySchema = z.object(corpusIdentityFields).strict();

export type CorpusIdentity = z.infer<typeof corpusIdentitySchema>;
