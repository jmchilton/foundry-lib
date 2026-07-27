/** Which layer a kind belongs to. Deliberately not `origin` — a kind is free to declare a
 *  frontmatter FIELD called `origin`, and one instance does. */
export type KindLayer = 'substrate' | 'instance';

export interface ManifestField {
  name: string;
  /** Whether an author must write this key. A defaulted field is not required. */
  required: boolean;
  /** A readable rendering of the zod type, for the catalog's metadata table. */
  type: string;
}

export interface ManifestKind {
  kind: string;
  title: string;
  layer: KindLayer;
  summary: string;
  /** The body of the kind's kind.md, verbatim. Supplied by the caller, which knows the paths. */
  doc?: string;
  fields: ManifestField[];
}

/**
 * Where a manifest came from.
 *
 * Emitted by the producer, which is the only party that knows its own revision. A
 * consumer that stamps this itself is asserting provenance rather than recording it.
 */
export interface ManifestSource {
  /** `owner/name` of the instance's repository. */
  repo: string;
  /** The commit the manifest was generated at. */
  revision: string;
  /** Repo-relative path the manifest was read from. */
  path: string;
}

export interface KindManifest {
  /** Slug identifying this Foundry in a cross-instance catalog. */
  instance: string;
  version: number;
  kinds: ManifestKind[];
  source?: ManifestSource;
}
