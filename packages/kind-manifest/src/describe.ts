// Render a zod shape as the manifest's field table.
//
// This reads `_zod.def.type`, which is zod 4 internals. That is a deliberate, pinned
// dependency rather than an oversight: zod exposes no public reflection API, and the
// alternative — a hand-written field table beside each schema — is a second encoding
// that drifts the first week. Both instances independently arrived at exactly this
// code, character for character, which is why it lives here now.
//
// The pin lives in `peerDependencies` (`zod@^4`). zod 4 renamed every tag and moved it
// off `_def.typeName`; the tests fail loudly rather than silently rendering every field
// as `any`.

import type { z } from 'zod';

import type { ManifestField } from './types.js';

interface Def {
  type?: string;
  [k: string]: unknown;
}

const defOf = (schema: z.ZodTypeAny): Def => (schema as unknown as { _zod: { def: Def } })._zod.def;

/**
 * Render a zod type as a short readable string.
 *
 * Deliberately shallow: this feeds a human-facing metadata table, not a code generator,
 * so `string[]` beats a faithful but unreadable expansion of every refinement.
 */
export function describeType(schema: z.ZodTypeAny): string {
  const def = defOf(schema);
  switch (def['type']) {
    case 'optional':
    case 'nullable':
    case 'default':
    case 'prefault':
    case 'catch':
    case 'readonly':
    case 'nonoptional':
      return describeType(def['innerType'] as z.ZodTypeAny);
    // `.transform()` is the only thing that still wraps; `.refine()` now leaves the type
    // alone and hangs a check off it, so a refined string describes as `string` unaided.
    case 'pipe':
      return describeType(def['in'] as z.ZodTypeAny);
    case 'lazy':
      return 'any';
    case 'string':
      return 'string';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'date':
      return 'date';
    case 'literal':
      return ((def['values'] ?? []) as unknown[]).map((v) => JSON.stringify(v)).join(' | ');
    case 'enum':
      return Object.values((def['entries'] ?? {}) as Record<string, unknown>).join(' | ');
    case 'array':
      return `${describeType(def['element'] as z.ZodTypeAny)}[]`;
    // zod 4 tags a discriminated union `union` like any other; the discriminator lives in
    // the def rather than in the tag.
    case 'union': {
      const opts = (def['options'] ?? []) as z.ZodTypeAny[];
      const rendered = [...new Set(opts.map(describeType))];
      // A union wide enough to be unreadable tells a reader nothing they can act on, and
      // pushes the row off the page trying.
      return rendered.length > 3 ? 'one of several shapes' : rendered.join(' | ');
    }
    case 'object':
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
  // zod 4 types a raw shape's values as the CORE schema type, which carries neither
  // `.isOptional()` nor enough structure for `describeType`. The classic type is what a
  // kind actually puts there.
  return (Object.entries(shape) as [string, z.ZodTypeAny][])
    .map(([name, field]) => ({
      name,
      required: !field.isOptional(),
      type: describeType(field),
    }))
    .sort((a, b) => Number(b.required) - Number(a.required) || a.name.localeCompare(b.name));
}
