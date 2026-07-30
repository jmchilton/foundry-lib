import type { ManifestKindInput } from '@galaxy-foundry/kind-manifest';

import type { CollectionTable } from './collections.js';
import type { AnyKindDefinition } from './index.js';

export interface ManifestKindExtras {
  docs?: Record<string, string>;
  examples?: Record<string, string>;
  collections?: CollectionTable;
}

export function manifestKinds<Context>(
  kinds: readonly AnyKindDefinition<Context>[],
  context: Context,
  extras: ManifestKindExtras = {},
): ManifestKindInput[] {
  const { docs: kindDocs = {}, examples, collections } = extras;
  return kinds.map((definition) => {
    const kindDoc = kindDocs[definition.kind];
    const example = examples?.[definition.kind];
    const locations =
      collections === undefined
        ? undefined
        : Object.values(collections)
            .filter((route) => route.kind === definition.kind)
            .map((route) => route.base);
    // Omit undefined optionals so runtime objects match serialized manifests.
    return {
      kind: definition.kind,
      title: definition.title,
      layer: definition.layer,
      summary: definition.summary,
      shape: definition.shape,
      companions: definition.companions,
      frontmatter: definition.build(context).shape,
      ...(definition.additionalCompanions === undefined
        ? {}
        : { additionalCompanions: definition.additionalCompanions }),
      ...(locations === undefined || locations.length === 0 ? {} : { locations }),
      ...(kindDoc === undefined ? {} : { doc: kindDoc }),
      ...(example === undefined ? {} : { example }),
    };
  });
}
