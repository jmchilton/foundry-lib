import { describe, expect, it } from 'vitest';

import { sha256, stableJson } from '../src/digest.js';

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

describe('a value JSON cannot represent is refused, not digested', () => {
  // This feeds identity: two values that digest the same are treated as the same claim, the same
  // corpus, the same review target. Every case here would otherwise return a lie quietly.

  it('refuses a value that stringifies to nothing at all', () => {
    // The declared return type is `string`, and `JSON.stringify(undefined)` is not one.
    expect(() => stableJson(undefined)).toThrow(/must be JSON/u);
    expect(() => stableJson(() => 'x')).toThrow(/must be JSON/u);
  });

  it('keeps two instants apart instead of collapsing them onto one digest', () => {
    const first = new Date('2026-08-18T00:00:00.000Z');
    const second = new Date('2019-01-01T00:00:00.000Z');
    expect(sha256(stableJson({ at: first }))).not.toBe(sha256(stableJson({ at: second })));
    expect(stableJson({ at: first })).toBe('{"at":"2026-08-18T00:00:00.000Z"}');
  });

  it('refuses a collection that has no JSON representation to fall back on', () => {
    // A Map and a Set both enumerate as `{}`, so any two of them would share a digest.
    expect(() => stableJson({ seen: new Set(['a']) })).toThrow(/Set/u);
    expect(() => stableJson({ byId: new Map([['a', 1]]) })).toThrow(/Map/u);
  });
});
