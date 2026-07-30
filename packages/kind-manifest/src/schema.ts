// The reader half of the format.
//
// A cross-instance catalog consumes manifests it did not produce, from repos it does not
// control, at revisions it did not choose. Casting the parsed JSON to an interface makes
// a malformed manifest render a broken page instead of failing at the read — which is how
// the pattern site consumes them today, against a fourth hand-written copy of these types.

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

// `shape` and `companions` are required of a manifest, not tolerated as absent. A consumer of this
// format is a catalog that renders what it reads, and "this kind reports no companions" and "this
// kind's producer did not say" are different statements it must not be made to conflate. Every
// producer of this format declares both, so the reader can insist rather than defend.
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
  // Refuse a format we do not understand rather than guessing at its fields. An older
  // version is fine to read; a newer one may mean something different by the same keys.
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

// The schema and the hand-written interfaces must keep describing the same shape, and only
// one direction of that is expressible. `exactOptionalPropertyTypes` distinguishes "key
// absent" from "key present and undefined"; zod's inferred type collapses the two, so a
// schema-satisfies-interface check fails on `doc` for a difference that does not exist at
// runtime. Assert instead that everything the builder emits satisfies the reader — which
// is the direction that would actually break a consumer — and let the round-trip test in
// test/schema.test.ts cover the other way, where the runtime behaviour is what matters.
type SchemaMatchesTypes = KindManifest extends z.infer<typeof kindManifestSchema> ? true : never;
const schemaMatchesTypes: SchemaMatchesTypes = true;
void schemaMatchesTypes;

/** Validate an untrusted manifest, throwing with the offending path named. */
export function parseKindManifest(data: unknown): KindManifest {
  return kindManifestSchema.parse(data) as KindManifest;
}
