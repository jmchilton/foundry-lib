export type KindLayer = 'substrate' | 'instance';

export interface ManifestField {
  name: string;
  /** Defaulted fields are optional because authors need not write them. */
  required: boolean;
  type: string;
}

export type NoteShape = 'file' | 'directory';

export type CompanionRequirement = 'required' | 'recommended' | 'optional';

/**
 * Whether a companion stays in the Foundry, informs casting, or ships in the artifact.
 */
export type CompanionDisposition = 'foundry-only' | 'cast-input' | 'bundled';

export interface Companion {
  /**
   * Exact filename, or a directory named with a trailing slash (`refinements/`).
   * Globs and nested paths are not supported.
   */
  file: string;
  requirement: CompanionRequirement;
  purpose: string;
  disposition: CompanionDisposition;
}

export interface ManifestKind {
  kind: string;
  title: string;
  layer: KindLayer;
  summary: string;
  shape: NoteShape;
  /** Always present; `[]` explicitly means the kind has no companions. */
  companions: Companion[];
  /** Absent means undeclared companions are forbidden. */
  additionalCompanions?: 'forbid' | 'allow';
  locations?: string[];
  doc?: string;
  example?: string;
  fields: ManifestField[];
}

export interface ManifestSource {
  repo: string;
  path: string;
  revision?: string;
}

export interface KindManifest {
  instance: string;
  version: number;
  kinds: ManifestKind[];
  source?: ManifestSource;
}
