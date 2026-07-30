export { KIND_MANIFEST_VERSION, buildKindManifest, withRevision } from './build.js';
export type { BuildKindManifestOptions, ManifestKindInput } from './build.js';

export { describeFields, describeType } from './describe.js';

export {
  companionSchema,
  kindManifestSchema,
  manifestFieldSchema,
  manifestKindSchema,
  manifestSourceSchema,
  parseKindManifest,
} from './schema.js';

export type {
  Companion,
  CompanionDisposition,
  CompanionRequirement,
  KindLayer,
  KindManifest,
  ManifestField,
  ManifestKind,
  ManifestSource,
  NoteShape,
} from './types.js';
