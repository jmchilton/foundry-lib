import type { z } from 'zod';

import { describeFields } from './describe.js';
import type {
  Companion,
  KindLayer,
  KindManifest,
  ManifestKind,
  ManifestSource,
  NoteShape,
} from './types.js';

export const KIND_MANIFEST_VERSION = 1;

export interface ManifestKindInput {
  kind: string;
  title: string;
  layer: KindLayer;
  summary: string;
  frontmatter: z.ZodRawShape;
  shape: NoteShape;
  companions: readonly Companion[];
  additionalCompanions?: 'forbid' | 'allow';
  locations?: readonly string[];
  doc?: string;
  example?: string;
}

export interface BuildKindManifestOptions {
  instance: string;
  kinds: ManifestKindInput[];
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
    kinds: kinds.map((kindInput): ManifestKind => {
      const { kind, title, layer, summary, shape, companions } = kindInput;
      const { additionalCompanions, locations, doc, example, frontmatter } = kindInput;
      // Conditional spreads preserve absent-key semantics and stable serialized key order.
      return {
        kind,
        title,
        layer,
        summary,
        shape,
        companions: [...companions],
        ...(additionalCompanions === undefined ? {} : { additionalCompanions }),
        ...(locations === undefined ? {} : { locations: [...locations] }),
        ...(doc === undefined ? {} : { doc }),
        ...(example === undefined ? {} : { example }),
        fields: describeFields(frontmatter),
      };
    }),
  };
  if (source !== undefined) manifest.source = source;
  return manifest;
}

export function withRevision(manifest: KindManifest, revision: string): KindManifest {
  if (manifest.source === undefined) {
    throw new Error(`${manifest.instance}: manifest declares no source to attach a revision to`);
  }
  return { ...manifest, source: { ...manifest.source, revision } };
}
