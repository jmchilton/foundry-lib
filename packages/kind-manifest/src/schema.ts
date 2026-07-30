import { z } from 'zod';

import { KIND_MANIFEST_VERSION } from './build.js';
import type { KindManifest } from './types.js';

export const manifestFieldSchema = z.object({
  name: z.string(),
  required: z.boolean(),
  type: z.string(),
});

export const companionSchema = z.object({
  file: z.string(),
  requirement: z.enum(['required', 'recommended', 'optional']),
  purpose: z.string(),
  disposition: z.enum(['foundry-only', 'cast-input', 'bundled']),
});

export const manifestKindSchema = z.object({
  kind: z.string(),
  title: z.string(),
  layer: z.enum(['substrate', 'instance']),
  summary: z.string(),
  shape: z.enum(['file', 'directory']),
  companions: z.array(companionSchema),
  additionalCompanions: z.enum(['forbid', 'allow']).optional(),
  locations: z.array(z.string()).optional(),
  doc: z.string().optional(),
  example: z.string().optional(),
  fields: z.array(manifestFieldSchema),
});

export const manifestSourceSchema = z.object({
  repo: z.string(),
  path: z.string(),
  revision: z.string().optional(),
});

export const kindManifestSchema = z.object({
  instance: z.string(),
  version: z
    .number()
    .int()
    .max(
      KIND_MANIFEST_VERSION,
      `unsupported manifest version (this reader speaks ${KIND_MANIFEST_VERSION})`,
    ),
  kinds: z.array(manifestKindSchema),
  source: manifestSourceSchema.optional(),
});

type SchemaMatchesTypes = KindManifest extends z.infer<typeof kindManifestSchema> ? true : never;
// Keep builder output assignable to the reader schema at compile time.
const schemaMatchesTypes: SchemaMatchesTypes = true;
void schemaMatchesTypes;

export function parseKindManifest(manifestData: unknown): KindManifest {
  return kindManifestSchema.parse(manifestData) as KindManifest;
}
