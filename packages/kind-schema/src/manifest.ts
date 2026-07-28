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

import type { AnyKindDefinition } from './index.js';

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
 *   kinds: manifestKinds(KINDS, ctx, docs),
 * });
 * ```
 *
 * `shape` is derived by building each kind, never hand-written, so a manifest cannot drift from
 * the schema it describes — only from its last regeneration, which is what the instances'
 * `--check` gates catch.
 */
export function manifestKinds<Ctx>(
  kinds: readonly AnyKindDefinition<Ctx>[],
  ctx: Ctx,
  docs: Record<string, string> = {},
): ManifestKindInput[] {
  return kinds.map((definition) => {
    const doc = docs[definition.kind];
    return {
      kind: definition.kind,
      title: definition.title,
      layer: definition.layer,
      summary: definition.summary,
      // `build`, not `refine`: a refinement is a rule over fields, and the manifest reports the
      // fields. Applying it here would wrap the object and hide the `.shape` entirely.
      shape: definition.build(ctx).shape,
      // A conditional spread rather than `doc: docs[kind]`, because `exactOptionalPropertyTypes`
      // distinguishes "key absent" from "key present and undefined" — and an explicit
      // `doc: undefined` serializes into the manifest JSON as a key the format does not declare.
      ...(doc === undefined ? {} : { doc }),
    };
  });
}
