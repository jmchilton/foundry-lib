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
    expect(describeType(z.string().refine((stringValue) => stringValue.length > 0))).toBe('string');
    expect(describeType(z.string().transform((stringValue) => stringValue.trim()))).toBe('string');
  });

  it('renders a small union as its alternatives, deduplicated', () => {
    expect(describeType(z.union([z.string(), z.number()]))).toBe('string | number');
    expect(describeType(z.union([z.string(), z.string().min(1)]))).toBe('string');
  });

  it('collapses a union with more than three distinct shapes', () => {
    const wideUnion = z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]);
    expect(describeType(wideUnion)).toBe('one of several shapes');
  });

  it('renders a discriminated union by its member shapes', () => {
    const discriminatedUnion = z.discriminatedUnion('type', [
      z.object({ type: z.literal('a') }),
      z.object({ type: z.literal('b') }),
    ]);
    expect(describeType(discriminatedUnion)).toBe('object');
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
    expect(fields.map((field) => field.name)).toEqual(['middle', 'zebra', 'alpha', 'beta']);
  });

  it('returns an empty list for an empty shape', () => {
    expect(describeFields({})).toEqual([]);
  });
});
