export interface CollectionRoute {
  /** Must use the same path frame as paths passed to this API. */
  base: string;
  pattern: readonly string[];
  kind: string;
}

export type CollectionTable = Record<string, CollectionRoute>;

function globToRegExp(pattern: string): RegExp {
  let out = '';
  for (let i = 0; i < pattern.length; i += 1) {
    const rest = pattern.slice(i);
    if (rest.startsWith('**/')) {
      out += '(?:[^/]+/)*';
      i += 2;
    } else if (pattern[i] === '*') {
      out += '[^/]*';
    } else if ('.+^${}()|[]\\?'.includes(pattern[i]!)) {
      out += `\\${pattern[i]}`;
    } else {
      out += pattern[i];
    }
  }
  return new RegExp(`^${out}$`);
}

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

export function collectionOf<T extends CollectionTable>(
  table: T,
  path: string,
): (keyof T & string) | undefined {
  // Ambiguous routes are table errors; callers can detect them with `collectionsClaiming`.
  for (const name of Object.keys(table) as (keyof T & string)[]) {
    if (matchesCollection(path, table[name]!)) return name;
  }
  return undefined;
}

export function collectionsClaiming<T extends CollectionTable>(
  table: T,
  path: string,
): (keyof T & string)[] {
  return (Object.keys(table) as (keyof T & string)[]).filter((name) =>
    matchesCollection(path, table[name]!),
  );
}

export function kindOf(table: CollectionTable, path: string): string | undefined {
  const name = collectionOf(table, path);
  return name === undefined ? undefined : table[name]!.kind;
}
