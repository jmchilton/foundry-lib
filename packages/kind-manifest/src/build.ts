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

/** The current manifest format version. Producers stamp it; consumers refuse anything higher. */
export const KIND_MANIFEST_VERSION = 1;

/**
 * One kind, as its instance already knows it.
 *
 * `frontmatter` is the built zod object shape the validator runs — not a schema factory and not
 * a context. Resolving a kind's schema needs an instance's registries, and no two
 * instances resolve them the same way, so that step stays on the instance's side of the
 * line. What transfers is what happens to the shape once it exists.
 *
 * Named `frontmatter` rather than `shape`, because `shape` is a kind's NOTE shape and one word
 * cannot mean both: a producer mapping `definition.shape` and `definition.build(ctx).shape` onto
 * two differently-named fields is legible, and onto one word is a bug waiting to be written.
 */
export interface ManifestKindInput {
  kind: string;
  title: string;
  layer: KindLayer;
  summary: string;
  frontmatter: z.ZodRawShape;
  /** Whether this kind's notes are files or directories. */
  shape: NoteShape;
  /** Files this kind's notes may carry beside them. `[]` means none. */
  companions: readonly Companion[];
  additionalCompanions?: 'forbid' | 'allow';
  /** Collection base paths routing to this kind, in the producer's own frame. */
  locations?: readonly string[];
  /** The body of the kind's kind.md, verbatim. */
  doc?: string;
  /** The body of the kind's worked example.md, verbatim. */
  example?: string;
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
    kinds: kinds.map((input): ManifestKind => {
      const { kind, title, layer, summary, shape, companions } = input;
      const { additionalCompanions, locations, doc, example, frontmatter } = input;
      // Conditional spreads rather than an assignment, for two reasons. An explicit
      // `doc: undefined` key disappears from the emitted JSON but not from the in-memory
      // object, so the two stop agreeing. And key ORDER is load-bearing here: a manifest
      // is a committed artifact, so appending a key after `fields` rewrites a multi-KB
      // line in every instance's diff for no change in meaning. Spelling the orderings out
      // as literals would be 32 of them for three optional keys.
      //
      // The two large strings sit last before `fields` on purpose: a `doc` or `example` body
      // is multi-KB, and keeping the short scalar keys above them means a shape or companion
      // change is readable in a diff instead of being buried under prose.
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

/**
 * Record which revision a vendored copy was taken at.
 *
 * The producer cannot answer this — see `ManifestSource` — but a consumer reading a
 * checkout can, and should, so the rendered catalog can say what it is showing. Returns a
 * new manifest: vendoring reads, it does not edit what it read.
 *
 * Throws if the manifest declares no `source`, because a revision with no repo to hang it
 * on is not provenance, just a string.
 */
export function withRevision(manifest: KindManifest, revision: string): KindManifest {
  if (manifest.source === undefined) {
    throw new Error(`${manifest.instance}: manifest declares no source to attach a revision to`);
  }
  return { ...manifest, source: { ...manifest.source, revision } };
}
