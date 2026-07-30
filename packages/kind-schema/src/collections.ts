export interface CollectionRoute {
  /** Must use the same path frame as paths passed to this API. */
  base: string;
  pattern: readonly string[];
  kind: string;
}

export type CollectionTable = Record<string, CollectionRoute>;

function globToRegExp(pattern: string): RegExp {
  let expression = '';
  for (let i = 0; i < pattern.length; i += 1) {
    const patternSuffix = pattern.slice(i);
    if (patternSuffix.startsWith('**/')) {
      expression += '(?:[^/]+/)*';
      i += 2;
    } else if (pattern[i] === '*') {
      expression += '[^/]*';
    } else if ('.+^${}()|[]\\?'.includes(pattern[i]!)) {
      expression += `\\${pattern[i]}`;
    } else {
      expression += pattern[i];
    }
  }
  return new RegExp(`^${expression}$`);
}

export function matchesCollection(filePath: string, collection: CollectionRoute): boolean {
  const normalizedPath = filePath.split('\\').join('/');
  const collectionPrefix = `${collection.base}/`;
  if (!normalizedPath.startsWith(collectionPrefix)) return false;
  const relativePath = normalizedPath.slice(collectionPrefix.length);
  let hasIncludedPattern = false;
  for (const pattern of collection.pattern) {
    const isExcludedPattern = pattern.startsWith('!');
    const patternExpression = globToRegExp(isExcludedPattern ? pattern.slice(1) : pattern);
    if (!patternExpression.test(relativePath)) continue;
    if (isExcludedPattern) return false;
    hasIncludedPattern = true;
  }
  return hasIncludedPattern;
}

export function collectionOf<Collections extends CollectionTable>(
  collections: Collections,
  filePath: string,
): (keyof Collections & string) | undefined {
  // Ambiguous routes are table errors; callers can detect them with `collectionsClaiming`.
  for (const collectionName of Object.keys(collections) as (keyof Collections & string)[]) {
    if (matchesCollection(filePath, collections[collectionName]!)) return collectionName;
  }
  return undefined;
}

export function collectionsClaiming<Collections extends CollectionTable>(
  collections: Collections,
  filePath: string,
): (keyof Collections & string)[] {
  return (Object.keys(collections) as (keyof Collections & string)[]).filter((collectionName) =>
    matchesCollection(filePath, collections[collectionName]!),
  );
}

export function kindOf(collections: CollectionTable, filePath: string): string | undefined {
  const collectionName = collectionOf(collections, filePath);
  return collectionName === undefined ? undefined : collections[collectionName]!.kind;
}
