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

/**
 * Whether a kind's notes are single files or directories.
 *
 * Carried because it is a real substrate difference the catalog exists to surface: `mold` is a
 * directory in both instances, while `pattern` is a directory in one and a flat file in the other.
 * Expressible today only inside each instance's collection globs, which never reach a manifest.
 */
export type NoteShape = 'file' | 'directory';

/**
 * How hard a companion's absence is.
 *
 * `recommended` is the level that earns its keep: `eval.md` sits beside 33 of 47 molds in one
 * instance and `scenarios.md` beside 27, and that instance's spec calls both "strongly
 * recommended, warning-only for now". Without a middle level, that state has to be recorded as
 * `optional` — which says the opposite — or as `required`, which fails 14 molds today.
 */
export type CompanionRequirement = 'required' | 'recommended' | 'optional';

/**
 * What casting may do with a companion. ONE axis: whether the file reaches a skill artifact.
 *
 *   `foundry-only`  Never leaves. `eval.md`, `scenarios.md` — authoring and evaluation surface.
 *   `cast-input`    The caster READS it; it does not appear in the output. A per-mold `casting.md`
 *                   supplies condensation prompts; `cast-skill-verification.md` steers the
 *                   post-cast review. Both are consumed and neither ships.
 *   `bundled`       Copied into the artifact. `upstream.prompt`, a vendored schema.
 *
 * `cast-input` is the value that makes three right and two wrong. A target's list of files
 * forbidden from a bundle is every companion whose disposition is NOT `bundled` — both of the
 * other two — and one instance's cast target omits `casting.md` from that list today, which is
 * exactly the file a boolean cannot tell apart from a packaged one.
 *
 * There is no `rendered`. A site serving `eval.md` at a raw route (one does) is a property of that
 * site's routes: orthogonal to this, true of every companion, and a second axis if named here.
 *
 * Deliberately not a reference contract. A companion describes LAYOUT — that a file sits here,
 * under this name. A declaration that starts wanting `load` / `mode` / `used_at` has become a
 * dependency, and the answer to that is a note's `references:` entry instead.
 */
export type CompanionDisposition = 'foundry-only' | 'cast-input' | 'bundled';

/**
 * A non-note file in a note's directory.
 *
 * The vocabulary lives here, in the format package, for the same reason `KindLayer` does: the
 * manifest carries these values across a repository boundary, so the closed set is part of the
 * format. `@galaxy-foundry/kind-schema` re-exports it rather than declaring a second copy that
 * would have to be kept in agreement with this one.
 */
export interface Companion {
  /**
   * Exact filename, or a directory named with a trailing slash (`refinements/`).
   *
   * LITERAL — no globs. The one case that wanted a wildcard, `<slug>.upstream.prompt`, was fixed by
   * changing the layout so the file is just `upstream.prompt` (galaxyproject/foundry#403). A
   * pattern escape hatch is very hard to remove once a corpus leans on it, and nothing is asking.
   * `@galaxy-foundry/kind-schema`'s `companionsOf` is what enforces it at the authoring end.
   *
   * A trailing-slash entry is satisfied by the directory EXISTING. What is inside it is that
   * directory's own business — a refinements journal holds entries with their own frontmatter,
   * which is a nested-notes question, not a companion question.
   */
  file: string;
  requirement: CompanionRequirement;
  /** One line: what this file is for. Rendered in the catalog. */
  purpose: string;
  disposition: CompanionDisposition;
}

export interface ManifestKind {
  kind: string;
  title: string;
  layer: KindLayer;
  summary: string;
  /** Whether this kind's notes are files or directories. `directory` implies an `index.md`. */
  shape: NoteShape;
  /**
   * Files this kind's notes may carry beside them. `[]` means none, as an assertion.
   *
   * Always present, never absent-meaning-unmodelled. A kind whose companion set is genuinely open
   * says so with `additionalCompanions`, so a consumer rendering `[]` as "none" is always right —
   * which it could not be if absence were also a possibility it had to distinguish.
   */
  companions: Companion[];
  /** `'allow'` for a kind whose companion set is open. Absent means `'forbid'`. */
  additionalCompanions?: 'forbid' | 'allow';
  /**
   * Collection base paths routing to this kind, in the producer's own frame.
   *
   * Plural, and not derivable from the kind name in either direction: one directory can hold two
   * kinds and two collections can resolve to one kind, and each instance has one of those cases.
   */
  locations?: string[];
  /** The body of the kind's kind.md, verbatim. Supplied by the caller, which knows the paths. */
  doc?: string;
  /**
   * The body of the kind's worked `example.md`, verbatim.
   *
   * Both instances already assert every kind ships one and that it validates against its own
   * schema, then throw it away. Carrying it lets the catalog render the example beside the prose.
   */
  example?: string;
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
