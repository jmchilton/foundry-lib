// Render a zod shape as the manifest's field table.
//
// This reads `_def.typeName`, which is zod 3 internals. That is a deliberate, pinned
// dependency rather than an oversight: zod exposes no public reflection API, and the
// alternative — a hand-written field table beside each schema — is a second encoding
// that drifts the first week. Both instances independently arrived at exactly this
// code, character for character, which is why it lives here now.
//
// The pin lives in `peerDependencies` (`zod@^3.25`). zod 4 replaces `_def.typeName`
// entirely; the tests fail loudly rather than silently rendering every field as `any`.

import type { z } from 'zod';

import type { ManifestField } from './types.js';

/**
 * Render a zod type as a short readable string.
 *
 * Deliberately shallow: this feeds a human-facing metadata table, not a code generator,
 * so `string[]` beats a faithful but unreadable expansion of every refinement.
 */
export function describeType(schema: z.ZodTypeAny): string {
  const def = schema._def as { typeName?: string; [k: string]: unknown };
  switch (def['typeName']) {
    case 'ZodOptional':
    case 'ZodNullable':
    case 'ZodDefault':
      return describeType((def['innerType'] ?? def['type']) as z.ZodTypeAny);
    case 'ZodEffects':
      return describeType(def['schema'] as z.ZodTypeAny);
    case 'ZodLazy':
      return 'any';
    case 'ZodString':
      return 'string';
    case 'ZodNumber':
      return 'number';
    case 'ZodBoolean':
      return 'boolean';
    case 'ZodDate':
      return 'date';
    case 'ZodLiteral':
      return JSON.stringify((def as { value: unknown }).value);
    case 'ZodEnum':
      return ((def as { values?: string[] }).values ?? []).join(' | ');
    case 'ZodArray':
      return `${describeType(def['type'] as z.ZodTypeAny)}[]`;
    case 'ZodUnion':
    case 'ZodDiscriminatedUnion': {
      const opts = (def['options'] ?? []) as z.ZodTypeAny[];
      const rendered = [...new Set(opts.map(describeType))];
      // A union wide enough to be unreadable tells a reader nothing they can act on, and
      // pushes the row off the page trying.
      return rendered.length > 3 ? 'one of several shapes' : rendered.join(' | ');
    }
    case 'ZodObject':
      return 'object';
    default:
      return 'any';
  }
}

/**
 * Walk a kind's object shape into the manifest's field list, sorted required-first.
 *
 * `required` answers "must an author write this key", so a field carrying `.default()`
 * counts as optional — zod reports it optional and the note validates without it.
 */
export function describeFields(shape: z.ZodRawShape): ManifestField[] {
  return Object.entries(shape)
    .map(([name, field]) => ({
      name,
      required: !field.isOptional(),
      type: describeType(field),
    }))
    .sort((a, b) => Number(b.required) - Number(a.required) || a.name.localeCompare(b.name));
}
