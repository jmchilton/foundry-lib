import type { z } from 'zod';

import type { ManifestField } from './types.js';

interface Def {
  type?: string;
  [k: string]: unknown;
}

// Zod has no public reflection API; tests pin this v4 internal shape.
const defOf = (schema: z.ZodTypeAny): Def => (schema as unknown as { _zod: { def: Def } })._zod.def;

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
    case 'union': {
      const opts = (def['options'] ?? []) as z.ZodTypeAny[];
      const rendered = [...new Set(opts.map(describeType))];
      return rendered.length > 3 ? 'one of several shapes' : rendered.join(' | ');
    }
    case 'object':
      return 'object';
    default:
      return 'any';
  }
}

export function describeFields(shape: z.ZodRawShape): ManifestField[] {
  return (Object.entries(shape) as [string, z.ZodTypeAny][])
    .map(([name, field]) => ({
      name,
      required: !field.isOptional(),
      type: describeType(field),
    }))
    .sort((a, b) => Number(b.required) - Number(a.required) || a.name.localeCompare(b.name));
}
