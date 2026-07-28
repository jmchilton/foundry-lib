// Path→kind routing: which collection a file belongs to, decided by where it lives.
//
// A collection is a LOCATION; a kind is what a note IS. They are deliberately not one-to-one.
// One directory can hold two kinds (`cli/<tool>/index.md` is a cli-tool, `cli/<tool>/<cmd>.md`
// is a cli-command) and two collections can hold one kind (a browse route that wants its own
// URL without inventing a kind for it). Both instances have one of these cases already.
//
// The TABLE stays per-instance — it names that Foundry's directories. What is shared is the
// matching, because the alternative is each instance writing a glob matcher and each getting
// `**/` subtly wrong in its own way.

/** One collection: a directory, the note files in it, and the kind they all declare. */
export interface CollectionRoute {
  /**
   * Directory holding this collection's notes.
   *
   * Matched as a plain prefix of the paths you pass to `collectionOf`, so the FRAME is yours to
   * pick — repo-relative, project-relative, absolute. It only has to be the same frame as the
   * paths, and the same frame for every row, or a collection silently claims nothing.
   */
  base: string;
  /** Globs relative to `base` selecting note files. Later `!`-prefixed entries exclude. */
  pattern: readonly string[];
  /** The `type:` every note in this collection declares. */
  kind: string;
}

/** A table of collections, keyed by collection name. Rows may carry extra fields. */
export type CollectionTable = Record<string, CollectionRoute>;

// The three glob constructs the tables use, and nothing more. Astro's loader matches these
// patterns with picomatch; this matches them for consumers with no globber — a validator walk,
// a drift test. Two implementations of the same patterns is exactly the drift this module
// exists to end, so an instance that routes with both should pin them against its real corpus.
function globToRegExp(pattern: string): RegExp {
  let out = '';
  for (let i = 0; i < pattern.length; i += 1) {
    const rest = pattern.slice(i);
    if (rest.startsWith('**/')) {
      out += '(?:[^/]+/)*'; // zero or more leading path segments
      i += 2;
    } else if (pattern[i] === '*') {
      out += '[^/]*'; // one segment, no separators
    } else if ('.+^${}()|[]\\?'.includes(pattern[i]!)) {
      out += `\\${pattern[i]}`;
    } else {
      out += pattern[i];
    }
  }
  return new RegExp(`^${out}$`);
}

/** Whether a path is one of this collection's note files. */
export function matchesCollection(path: string, collection: CollectionRoute): boolean {
  const normalized = path.split('\\').join('/');
  const prefix = `${collection.base}/`;
  if (!normalized.startsWith(prefix)) return false;
  const withinBase = normalized.slice(prefix.length);
  let matched = false;
  for (const pattern of collection.pattern) {
    const negated = pattern.startsWith('!');
    const re = globToRegExp(negated ? pattern.slice(1) : pattern);
    if (!re.test(withinBase)) continue;
    if (negated) return false;
    matched = true;
  }
  return matched;
}

/**
 * The collection a path belongs to, or `undefined` if it is not a note.
 *
 * Returns the FIRST match in table order. A path matching more than one collection is a table
 * bug rather than a caller error, so an instance should assert its table partitions its corpus
 * rather than rely on the order — `collectionsClaiming` is there to write that test with.
 */
export function collectionOf<T extends CollectionTable>(
  table: T,
  path: string,
): (keyof T & string) | undefined {
  for (const name of Object.keys(table) as (keyof T & string)[]) {
    if (matchesCollection(path, table[name]!)) return name;
  }
  return undefined;
}

/** Every collection claiming a path — for the test that asserts a table claims each note once. */
export function collectionsClaiming<T extends CollectionTable>(
  table: T,
  path: string,
): (keyof T & string)[] {
  return (Object.keys(table) as (keyof T & string)[]).filter((name) =>
    matchesCollection(path, table[name]!),
  );
}

/** The kind a path routes to, or `undefined` if it is not a note. */
export function kindOf(table: CollectionTable, path: string): string | undefined {
  const name = collectionOf(table, path);
  return name === undefined ? undefined : table[name]!.kind;
}
