import { z } from 'zod';

import { sha256 } from './digest.js';

/** The digest a span carries, over the exact text the reviewer read. */
export function sourceTextDigest(sourceText: string): string {
  return sha256(sourceText);
}

/**
 * Where a claim lives, and proof the reviewed text has not changed since.
 *
 * A line number alone fails both ways: an unrelated insertion above invalidates a review that is
 * still correct, and an edit to the claim itself silently inherits the old decision. Carrying the
 * text and its digest makes a decision retire exactly when the thing it decided about changed.
 *
 * `artifactKind` is opaque here. A checker names its own artifacts — a note, a manifest header, a
 * reference section — and this package neither knows nor validates that vocabulary.
 */
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
  // The digest is only worth carrying if something checks it against the text it claims to cover.
  // Without this, a hand-edited run could retire or resurrect a review decision undetected.
  .refine((span) => span.sourceDigest === sourceTextDigest(span.sourceText), {
    message: 'source digest does not match sourceText',
    path: ['sourceDigest'],
  });

export type ArtifactSpan = z.infer<typeof artifactSpanSchema>;
