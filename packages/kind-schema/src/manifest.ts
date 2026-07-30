// The bridge from kind definitions to manifest inputs.
//
// `@galaxy-foundry/kind-manifest` describes a kind it is HANDED; this package holds the type a
// kind is DEFINED as. Neither can own the step between them — kind-manifest does not know what a
// `KindDefinition` is, and it must not learn, because its reader half has a consumer that only
// ever reads manifests other Foundries produced and never defines a kind of its own.
//
// So it lands here, in the package that knows both. Without it each instance writes the same
// five-line map, and both of them did:
//
//   galaxyproject/foundry            packages/note-schema/src/kind-manifest.ts
//   statistical-genomics-foundry     site/src/lib/kind-manifest.ts
//
// identical down to the `doc` spread. `ManifestKindInput` is a `KindDefinition` minus `build`
// and `refine`, plus what `build` returns — the same kind at two stages, which is exactly the
// shape of thing a hand-written adapter goes stale against.

import type { ManifestKindInput } from '@galaxy-foundry/kind-manifest';

import type { CollectionTable } from './collections.js';
import type { AnyKindDefinition } from './index.js';

/**
 * The prose and the paths a kind definition does not carry.
 *
 * One object rather than trailing positional arguments. Three record-shaped inputs from three
 * different places, read positionally, is where a caller silently passes examples as docs.
 */
export interface ManifestKindExtras {
  /** kind name -> `kind.md` body. `loadKindDocs` from `./docs` produces this. */
  docs?: Record<string, string>;
  /** kind name -> worked `example.md` body. */
  examples?: Record<string, string>;
  /**
   * The instance's collection table, from which each kind's `locations` are DERIVED.
   *
   * Derived rather than supplied, because a hand-written location list is a second encoding of the
   * routing table and would drift from it — the same reason the field table is derived from the zod
   * shape that validates. It also gets the many-to-many right for free: two collections resolving
   * to one kind yield two locations, which a per-kind field would have to remember to do.
   */
  collections?: CollectionTable;
}

/**
 * Describe an instance's kinds for `buildKindManifest`.
 *
 * Returns only the `kinds` array. `instance` and `source` stay with the caller because they are
 * the producer's own identity — a shared helper filling them in would be asserting provenance
 * rather than recording it.
 *
 * ```ts
 * buildKindManifest({
 *   instance: 'galaxy-workflow-foundry',
 *   source: MANIFEST_SOURCE,
 *   kinds: manifestKinds(KINDS, ctx, { docs, collections: COLLECTIONS }),
 * });
 * ```
 *
 * `frontmatter` is derived by building each kind, never hand-written, so a manifest cannot drift
 * from the schema it describes — only from its last regeneration, which is what the instances'
 * `--check` gates catch. `shape` and `companions` come straight off the definition, which is now
 * the one place either is written down.
 */
export function manifestKinds<Ctx>(
  kinds: readonly AnyKindDefinition<Ctx>[],
  ctx: Ctx,
  extras: ManifestKindExtras = {},
): ManifestKindInput[] {
  const { docs = {}, examples = {}, collections } = extras;
  return kinds.map((definition) => {
    const doc = docs[definition.kind];
    const example = examples[definition.kind];
    const locations =
      collections === undefined
        ? undefined
        : Object.values(collections)
            .filter((route) => route.kind === definition.kind)
            .map((route) => route.base);
    return {
      kind: definition.kind,
      title: definition.title,
      layer: definition.layer,
      summary: definition.summary,
      shape: definition.shape,
      companions: definition.companions,
      // `build`, not `refine`: a refinement is a rule over fields, and the manifest reports the
      // fields. Applying it here would wrap the object and hide the `.shape` entirely.
      frontmatter: definition.build(ctx).shape,
      // Conditional spreads rather than `doc: docs[kind]`, because `exactOptionalPropertyTypes`
      // distinguishes "key absent" from "key present and undefined" — and an explicit
      // `doc: undefined` serializes into the manifest JSON as a key the format does not declare.
      ...(definition.additionalCompanions === undefined
        ? {}
        : { additionalCompanions: definition.additionalCompanions }),
      // An empty list is dropped, not emitted: a kind with no collection routing to it is a
      // routing bug, and `locations: []` in a manifest would report it as a deliberate fact.
      ...(locations === undefined || locations.length === 0 ? {} : { locations }),
      ...(doc === undefined ? {} : { doc }),
      ...(example === undefined ? {} : { example }),
    };
  });
}
