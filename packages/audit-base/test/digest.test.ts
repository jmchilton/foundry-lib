import { describe, expect, it } from 'vitest';

import { stableJson } from '../src/digest.js';

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
});
