import { describe, expect, it } from 'vitest';

import { sha256, stableJson } from '../src/digest.js';
import { candidateCorpusDigest, sourceTextDigest } from '../src/identity.js';
import { extractCitations } from '../src/index.js';

describe('deterministic digests', () => {
  it('orders object keys by code point rather than by collation', () => {
    expect(stableJson({ b: 1, A: 2, a: 3, 'a-b': 4, ab: 5 })).toBe(
      '{"A":2,"a":3,"a-b":4,"ab":5,"b":1}',
    );
  });

  it('digests the same value identically regardless of key insertion order', () => {
    const left = stableJson({ z: [{ b: 1, a: 2 }], a: 'x' });
    const right = stableJson({ a: 'x', z: [{ a: 2, b: 1 }] });
    expect(left).toBe(right);
  });

  it('preserves array order, which carries meaning', () => {
    expect(stableJson([2, 1])).toBe('[2,1]');
  });

  it('exposes the digest helpers a caller needs to build a valid candidate span', () => {
    const scan = extractCitations([
      { path: 'notes/a.md', artifactKind: 'note', text: 'See https://doi.org/10.1000/example\n' },
    ]);
    const candidate = scan.candidates[0]!;
    expect(candidate.span.sourceDigest).toBe(sourceTextDigest(candidate.span.sourceText));
    expect(candidateCorpusDigest(scan.candidates)).toBe(sha256(stableJson(scan.candidates)));
  });
});
