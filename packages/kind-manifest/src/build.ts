import type { z } from 'zod';

import { describeFields } from './describe.js';
import type { KindLayer, KindManifest, ManifestKind, ManifestSource } from './types.js';

/** The current manifest format version. Producers stamp it; consumers refuse anything higher. */
export const KIND_MANIFEST_VERSION = 1;

/**
 * One kind, as its instance already knows it.
 *
 * `shape` is the built zod object shape the validator runs — not a schema factory and not
 * a context. Resolving a kind's schema needs an instance's registries, and no two
 * instances resolve them the same way, so that step stays on the instance's side of the
 * line. What transfers is what happens to the shape once it exists.
 */
export interface ManifestKindInput {
  kind: string;
  title: string;
  layer: KindLayer;
  summary: string;
  shape: z.ZodRawShape;
  /** The body of the kind's kind.md, verbatim. */
  doc?: string;
}

export interface BuildKindManifestOptions {
  /** Slug identifying this Foundry in a cross-instance catalog. */
  instance: string;
  kinds: ManifestKindInput[];
  /** Where this manifest came from. Omit only if the producer genuinely cannot know. */
  source?: ManifestSource;
}

export function buildKindManifest({
  instance,
  kinds,
  source,
}: BuildKindManifestOptions): KindManifest {
  const manifest: KindManifest = {
    instance,
    version: KIND_MANIFEST_VERSION,
    kinds: kinds.map(({ kind, title, layer, summary, shape, doc }): ManifestKind => {
      const entry: ManifestKind = {
        kind,
        title,
        layer,
        summary,
        fields: describeFields(shape),
      };
      // Set rather than spread: an explicit `doc: undefined` key disappears from the
      // emitted JSON but not from the in-memory object, so the two stop agreeing.
      if (doc !== undefined) entry.doc = doc;
      return entry;
    }),
  };
  if (source !== undefined) manifest.source = source;
  return manifest;
}
