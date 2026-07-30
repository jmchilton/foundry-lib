import type { z } from 'zod';

import type { ManifestField } from './types.js';

interface ZodDefinition {
  type?: string;
  [key: string]: unknown;
}

// Zod has no public reflection API; tests pin this v4 internal shape.
const getZodDefinition = (schema: z.ZodTypeAny): ZodDefinition =>
  (schema as unknown as { _zod: { def: ZodDefinition } })._zod.def;

export function describeType(schema: z.ZodTypeAny): string {
  const definition = getZodDefinition(schema);
  switch (definition['type']) {
    case 'optional':
    case 'nullable':
    case 'default':
    case 'prefault':
    case 'catch':
    case 'readonly':
    case 'nonoptional':
      return describeType(definition['innerType'] as z.ZodTypeAny);
    case 'pipe':
      return describeType(definition['in'] as z.ZodTypeAny);
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
      return ((definition['values'] ?? []) as unknown[])
        .map((value) => JSON.stringify(value))
        .join(' | ');
    case 'enum':
      return Object.values((definition['entries'] ?? {}) as Record<string, unknown>).join(' | ');
    case 'array':
      return `${describeType(definition['element'] as z.ZodTypeAny)}[]`;
    case 'union': {
      const options = (definition['options'] ?? []) as z.ZodTypeAny[];
      const renderedOptions = [...new Set(options.map(describeType))];
      return renderedOptions.length > 3 ? 'one of several shapes' : renderedOptions.join(' | ');
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
    .sort(
      (leftField, rightField) =>
        Number(rightField.required) - Number(leftField.required) ||
        leftField.name.localeCompare(rightField.name),
    );
}
