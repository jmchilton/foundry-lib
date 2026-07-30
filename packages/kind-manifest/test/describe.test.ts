// The suite that had to exist once per instance.
//
// `instructions.txt:241-246` is explicit about why the manifest needs unit tests rather
// than a regeneration gate: `--check` "regenerates with the same code and string-compares,
// so a bug in the type renderer produces a wrong manifest that `--check` then blesses
// forever". The gate can only catch a renderer that changed, never one that was always
// wrong. So the renderer gets exercised against synthetic shapes here, where a wrong
// answer is a wrong answer regardless of what the corpus happens to contain.

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { describeFields, describeType } from '../src/index.js';

describe('describeType', () => {
  it('renders the primitive types', () => {
    expect(describeType(z.string())).toBe('string');
    expect(describeType(z.number())).toBe('number');
    expect(describeType(z.boolean())).toBe('boolean');
    expect(describeType(z.coerce.date())).toBe('date');
  });

  it('renders a literal as its JSON value', () => {
    expect(describeType(z.literal('mold'))).toBe('"mold"');
    expect(describeType(z.literal(3))).toBe('3');
  });

  it('renders an enum as its members', () => {
    expect(describeType(z.enum(['npm', 'pypi']))).toBe('npm | pypi');
  });

  it('renders arrays by element type', () => {
    expect(describeType(z.array(z.string()))).toBe('string[]');
    expect(describeType(z.array(z.object({ ref: z.string() })))).toBe('object[]');
    expect(describeType(z.array(z.array(z.string())))).toBe('string[][]');
  });

  it('unwraps optional, nullable, and default to the inner type', () => {
    expect(describeType(z.string().optional())).toBe('string');
    expect(describeType(z.string().nullable())).toBe('string');
    expect(describeType(z.string().default('x'))).toBe('string');
    expect(describeType(z.array(z.string()).optional().default([]))).toBe('string[]');
  });

  it('unwraps effects — a refined string is still a string', () => {
    expect(describeType(z.string().refine((s) => s.length > 0))).toBe('string');
    expect(describeType(z.string().transform((s) => s.trim()))).toBe('string');
  });

  it('renders a small union as its alternatives, deduplicated', () => {
    expect(describeType(z.union([z.string(), z.number()]))).toBe('string | number');
    expect(describeType(z.union([z.string(), z.string().min(1)]))).toBe('string');
  });

  // A union wide enough to be unreadable is worse than useless in a metadata table: it
  // pushes the row off the page and tells the reader nothing they can act on.
  it('collapses a union with more than three distinct shapes', () => {
    const wide = z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]);
    expect(describeType(wide)).toBe('one of several shapes');
  });

  it('renders a discriminated union by its member shapes', () => {
    const du = z.discriminatedUnion('type', [
      z.object({ type: z.literal('a') }),
      z.object({ type: z.literal('b') }),
    ]);
    expect(describeType(du)).toBe('object');
  });

  it('falls back to `any` for shapes it has no rendering for', () => {
    expect(describeType(z.lazy(() => z.string()))).toBe('any');
    expect(describeType(z.unknown())).toBe('any');
    expect(describeType(z.record(z.string(), z.string()))).toBe('any');
  });

  it('renders a nested object as `object` rather than expanding it', () => {
    expect(describeType(z.object({ a: z.string(), b: z.number() }))).toBe('object');
  });
});

describe('describeFields', () => {
  it('reads optionality off the schema', () => {
    const fields = describeFields({ a: z.string(), b: z.string().optional() });
    expect(fields).toEqual([
      { name: 'a', required: true, type: 'string' },
      { name: 'b', required: false, type: 'string' },
    ]);
  });

  // `required` answers "must an author write this key". A defaulted field validates
  // without the author writing anything, so it is optional to them even though the
  // parsed output always carries it.
  it('counts a defaulted field as optional', () => {
    const [field] = describeFields({ tags: z.array(z.string()).default([]) });
    expect(field).toEqual({ name: 'tags', required: false, type: 'string[]' });
  });

  it('sorts required first, then alphabetically within each group', () => {
    const fields = describeFields({
      zebra: z.string(),
      alpha: z.string().optional(),
      middle: z.string(),
      beta: z.string().optional(),
    });
    expect(fields.map((f) => f.name)).toEqual(['middle', 'zebra', 'alpha', 'beta']);
  });

  it('returns an empty list for an empty shape', () => {
    expect(describeFields({})).toEqual([]);
  });
});
