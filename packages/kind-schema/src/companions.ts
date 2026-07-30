// What sits BESIDE a note — declared once by the kind, not repeatedly by each note.
//
// A companion is a non-note file in a note's directory. Only a directory-shaped kind can have
// them, which is why `shape` and `companions` land together: the second is meaningless without
// the first.
//
// This exists because one instance answers "what files belong to this note?" four times, in four
// places, with four mechanisms that do not agree — galaxyproject/foundry, measured:
//
//   packages/build-cli/src/commands/validate.ts   MOLD_TOP_FILES / PIPELINE_TOP_FILES, two
//                                                 hand-written allowlists, one per kind
//   packages/note-schema/src/types/context.ts     a per-NOTE `companions:` frontmatter list,
//                                                 which the caster copies into a bundle
//   scripts/cast-skill-verify.ts                  a `<stem>.*` scan of a bundled note's body,
//                                                 there to catch that list being FORGOTTEN
//   site/src/components/MoldHealth.astro          `eval.md` and `scenarios.md` by literal path
//
// The fourth is the tell. `eval.md` is named in a validator allowlist, in a cast target's
// `forbid_packaged_files`, in a spec table in `docs/MOLD_SPEC.md`, and in a site component, and
// nothing makes those four agree — two of them already don't. The per-note list is the one that
// shows why: it exists because nothing at the kind level knew, and the body scan exists because a
// per-note list can be forgotten. A kind that states its own layout removes the premise of both.
//
// Everything here is PURE. It takes a directory listing you already have and does no I/O, so it
// stays testable and the browser-safe barrel stays browser-safe.

// The VOCABULARY — `NoteShape`, `Companion`, and its two enums — lives a layer down, in
// `@galaxy-foundry/kind-manifest`, and is re-exported here rather than declared twice. Same
// reasoning as `KindLayer`, which this package already re-exports: a manifest carries these values
// across a repository boundary, so the closed sets are part of the FORMAT, and a second copy here
// would be two definitions that have to be kept in agreement — the thing this module exists to
// stop. What stays here is the MECHANISM: normalization, and checking a listing against it.
export type {
  Companion,
  CompanionDisposition,
  CompanionRequirement,
  NoteShape,
} from '@galaxy-foundry/kind-manifest';

// Only the two this module names below. The other two are re-exported above for callers.
import type { Companion, NoteShape } from '@galaxy-foundry/kind-manifest';

/**
 * The note file inside a directory note. Stated here rather than assumed per caller.
 *
 * `shape: 'directory'` means exactly this: the note is `index.md`, and everything else in the
 * directory is a companion or another kind's note. Both instances already select every
 * directory-shaped collection's notes by that filename, so this is a name for a convention both
 * wrote, not a new rule — and `checkCompanions` needs it to avoid reporting all 47 molds' own
 * notes as strays.
 */
export const NOTE_FILE = 'index.md';

/**
 * The companion-relevant slice of a kind — what the functions here need and nothing more.
 *
 * `KindDefinition` extends this, so a caller passes its kind straight in. Stated separately so
 * this module needs no import from the barrel and a test can describe a layout without building
 * a zod schema for it.
 */
export interface CompanionDeclaration {
  /**
   * Whether this kind's notes are files or directories. `directory` implies the note itself is
   * `NOTE_FILE` inside it.
   *
   * Required of every kind, not opt-in. No kind legitimately does not know its own shape, so
   * gradual adoption buys nothing and costs the cross-instance catalog a column with holes in it
   * — a real substrate difference (`pattern` is a directory in one instance and a flat file in
   * the other) that only shows up if every kind answers.
   */
  shape: NoteShape;
  /**
   * Declared companions. `[]` means none, and means it as an assertion.
   *
   * Required rather than optional, because an ABSENT key and an empty array would have to carry
   * different meanings — "not modelled" versus "none, enforced" — and that distinction is
   * invisible to a reader and unrenderable in a catalog without misreporting one of the two.
   * `additionalCompanions: 'allow'` says the open-set half out loud instead.
   */
  companions: readonly Companion[];
  /**
   * What to do with a file that is present but not declared.
   *
   * `'forbid'` (the default) makes a misnamed `scenario.md` an error — which is the point, since
   * the validator's walker silently drops anything it does not recognize, so a typo'd companion
   * is indistinguishable from a deliberate non-note. `'allow'` is for kinds whose companion set
   * is genuinely open: vendored research sidecars, and the acquisition files beside a book.
   *
   * `'allow'` is not "unmodelled". A kind may declare the companions it knows AND permit others.
   */
  additionalCompanions?: 'forbid' | 'allow';
  /** Optional, and only ever used to name the kind in this module's error messages. */
  kind?: string;
}

/** A declared companion with its trailing slash resolved into a name and a type. */
export interface NormalizedCompanion extends Companion {
  /** `file` without any trailing slash — what a directory listing reports. */
  name: string;
  /** Whether `file` named a directory. */
  directory: boolean;
}

// Glob metacharacters, `/`, and `\` are all rejected in a companion's `file`. The first because
// patterns are a decided non-feature; the second two because a companion is an entry in ONE
// directory listing, and a name with a separator in it is a claim about a tree.
const ILLEGAL_IN_NAME = /[*?[\]{}!/\\]/;

/**
 * A kind's companions as a lookup, keyed by the name a directory listing would report.
 *
 * Throws on a malformed declaration rather than reporting it, because that is a bug in a kind
 * definition — code, not content — and it is reachable at the instant the kind is loaded. Same
 * reasoning as `buildKindUnion` refusing an empty kind list.
 */
export function companionsOf(
  declaration: CompanionDeclaration,
): ReadonlyMap<string, NormalizedCompanion> {
  const where = declaration.kind === undefined ? 'companions' : `${declaration.kind}: companions`;

  if (declaration.shape === 'file' && declaration.companions.length > 0) {
    throw new Error(
      `${where}: a file-shaped kind has no directory to put them in — declare shape: 'directory' or companions: []`,
    );
  }

  const byName = new Map<string, NormalizedCompanion>();
  for (const companion of declaration.companions) {
    const { file } = companion;
    const directory = file.endsWith('/');
    const name = directory ? file.slice(0, -1) : file;

    if (name === '') throw new Error(`${where}: a companion needs a name`);
    if (ILLEGAL_IN_NAME.test(name)) {
      throw new Error(
        `${where}: '${file}' must be a literal name in one directory — no globs, no separators`,
      );
    }
    if (name === '.' || name === '..') throw new Error(`${where}: '${file}' is not a name`);
    if (name === NOTE_FILE) {
      throw new Error(`${where}: '${file}' is the note itself, not a companion of it`);
    }
    if (byName.has(name)) throw new Error(`${where}: '${name}' declared twice`);

    byName.set(name, { ...companion, name, directory });
  }
  return byName;
}

/** One entry in a note directory's listing. A NAME, not a path. */
export interface DirectoryEntry {
  /** The entry's name within the note's directory. */
  name: string;
  /** Whether the entry is a directory. */
  directory?: boolean;
  /**
   * Whether this entry is itself a NOTE of some kind. Notes are never companions.
   *
   * Passed in, never inferred, because only the collection table can answer it and the answer is
   * not a property of the filename. `content/cli/<tool>/` is the case that proves it: `index.md`
   * is a `cli-tool` and every sibling `.md` is a `cli-command`, so a `cli-tool` declaring
   * `companions: []` has a directory full of markdown and no companions at all. Infer from the
   * extension and every CLI command in the corpus reports as a stray.
   *
   * `@galaxy-foundry/kind-schema/collections` is how a caller decides: `kindOf(table, path)`
   * returns a kind for a note and `undefined` for everything else.
   *
   * The note's OWN `index.md` needs no marking — see `NOTE_FILE`.
   */
  note?: boolean;
}

/** What a note directory has, measured against what its kind declares. */
export interface CompanionCheck {
  /** Declared `required` and not present. An error. */
  missingRequired: readonly NormalizedCompanion[];
  /** Declared `recommended` and not present. A warning. */
  missingRecommended: readonly NormalizedCompanion[];
  /**
   * Present, not a note, and not a declared companion — empty when `additionalCompanions` is
   * `'allow'`.
   *
   * A declared name present with the WRONG type lands here too, and is also reported as missing:
   * a file called `refinements` does not satisfy `refinements/`, and calling it undeclared is the
   * true statement about it. Matching on name alone would pass it silently, which is the one
   * outcome worth ruling out.
   */
  unknown: readonly DirectoryEntry[];
}

/**
 * Compare a note directory's listing against its kind's declaration.
 *
 * Pure: `entries` is a listing you already have (`readdirSync(dir, { withFileTypes: true })` maps
 * straight onto `DirectoryEntry`), and nothing here touches a filesystem. `optional` companions
 * are absent from every result — declared, permitted, and unremarkable either way.
 *
 * Throws for a file-shaped kind. There is no directory to list, so a caller asking has confused
 * two kinds, and answering "nothing missing" would confirm the confusion.
 */
export function checkCompanions(
  entries: readonly DirectoryEntry[],
  declaration: CompanionDeclaration,
): CompanionCheck {
  if (declaration.shape !== 'directory') {
    const where = declaration.kind === undefined ? 'this kind' : `kind '${declaration.kind}'`;
    throw new Error(`${where} is file-shaped: its notes have no directory to hold companions`);
  }

  const declared = companionsOf(declaration);
  const allowUnknown = declaration.additionalCompanions === 'allow';

  const satisfied = new Set<string>();
  const unknown: DirectoryEntry[] = [];

  for (const entry of entries) {
    if (entry.name === NOTE_FILE || entry.note === true) continue;
    const match = declared.get(entry.name);
    if (match !== undefined && match.directory === (entry.directory === true)) {
      satisfied.add(match.name);
      continue;
    }
    if (!allowUnknown) unknown.push(entry);
  }

  const missingRequired: NormalizedCompanion[] = [];
  const missingRecommended: NormalizedCompanion[] = [];
  for (const companion of declared.values()) {
    if (satisfied.has(companion.name)) continue;
    if (companion.requirement === 'required') missingRequired.push(companion);
    else if (companion.requirement === 'recommended') missingRecommended.push(companion);
  }

  return { missingRequired, missingRecommended, unknown };
}
