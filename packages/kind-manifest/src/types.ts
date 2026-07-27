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
 * Split by who actually knows each fact. `repo` and `path` are the producer's own
 * identity, so the producer declares them — a consumer that fills them in is asserting
 * provenance rather than recording it.
 *
 * `revision` is not a producer field, and trying to make it one breaks the generator: a
 * manifest is a COMMITTED artifact whose CI gate regenerates it and string-compares. A
 * file carrying the revision it was generated at never matches the revision CI regenerates
 * it at, so `--check` fails on every commit. It is also the wrong party — `revision`
 * answers "which snapshot is this", which only whoever took the snapshot can say.
 */
export interface ManifestSource {
  /** `owner/name` of the instance's repository. Declared by the producer. */
  repo: string;
  /** Repo-relative path the manifest lives at. Declared by the producer. */
  path: string;
  /** The commit this copy was taken at. Recorded by whoever vendored it. */
  revision?: string;
}

export interface KindManifest {
  /** Slug identifying this Foundry in a cross-instance catalog. */
  instance: string;
  version: number;
  kinds: ManifestKind[];
  source?: ManifestSource;
}
