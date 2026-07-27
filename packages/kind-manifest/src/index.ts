// The shared kind-manifest format: what a Foundry instance publishes about its own kinds,
// so two instances can be diffed by machine instead of by eye.
//
// The FORMAT is shared across instances (spec: galaxyproject/foundry-pattern,
// `content/pattern/standing-up-a-foundry.instructions.txt`); the kinds in it are each
// instance's own. That split is why this package carries no kinds, no registries, and no
// filesystem access — only the format, the deriver, and the reader.

export { KIND_MANIFEST_VERSION, buildKindManifest } from './build.js';
export type { BuildKindManifestOptions, ManifestKindInput } from './build.js';

export { describeFields, describeType } from './describe.js';

export {
  kindManifestSchema,
  manifestFieldSchema,
  manifestKindSchema,
  manifestSourceSchema,
  parseKindManifest,
} from './schema.js';

export type {
  KindLayer,
  KindManifest,
  ManifestField,
  ManifestKind,
  ManifestSource,
} from './types.js';
