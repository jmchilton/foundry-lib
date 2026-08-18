import { describe, expect, it } from 'vitest';

import { sha256, stableJson } from '@galaxy-foundry/audit-base';

import { candidateCorpusDigest } from '../src/identity.js';
import { extractCitations, sourceTextDigest } from '../src/index.js';

describe('citation digest identity', () => {
  it('exposes the digest helpers a caller needs to build a valid candidate span', () => {
    const scan = extractCitations([
      { path: 'notes/a.md', artifactKind: 'note', text: 'See https://doi.org/10.1000/example\n' },
    ]);
    const candidate = scan.candidates[0]!;
    expect(candidate.span.sourceDigest).toBe(sourceTextDigest(candidate.span.sourceText));
    expect(candidateCorpusDigest(scan.candidates)).toBe(sha256(stableJson(scan.candidates)));
  });
});
