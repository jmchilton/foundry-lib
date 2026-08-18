import { createHash } from 'node:crypto';

export function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/**
 * Orders by UTF-16 code point. Digest inputs must not depend on the runtime locale, so this is
 * used instead of `localeCompare`, which orders differently under different collations.
 */
export function compareCodePoints(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * Serialize a value to JSON with object keys in a fixed order, or refuse it.
 *
 * The refusals matter more than the ordering, because this feeds identity: two values that digest
 * the same are treated as the same claim, the same corpus, the same review target. Anything JSON
 * cannot represent therefore throws rather than returning quietly, and the signature is honest —
 * `JSON.stringify(undefined)` is `undefined`, not a string.
 */
export function stableJson(value: unknown): string {
  const json = JSON.stringify(sortJson(value));
  if (json === undefined) {
    throw new TypeError(
      `stableJson cannot represent a value of type ${describe(value)}; digest inputs must be JSON`,
    );
  }
  return json;
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value !== null && typeof value === 'object') {
    // A value that knows how to represent itself does so before its keys are read, exactly as
    // `JSON.stringify` would. Without this a Date reaches `Object.entries`, which finds none, and
    // every Date digests as `{}` — two different instants sharing one identity.
    const self = value as { toJSON?: (key?: string) => unknown };
    if (typeof self.toJSON === 'function') return sortJson(self.toJSON());

    // A Map or a Set would enumerate as `{}` for the same reason, and unlike a Date there is no
    // representation to fall back to. Refusing is the only option that does not silently collapse
    // distinct values onto one digest.
    if (value instanceof Map || value instanceof Set) {
      throw new TypeError(
        `stableJson cannot represent a ${value.constructor.name}; digest inputs must be JSON`,
      );
    }

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => compareCodePoints(left, right))
        .map(([key, item]) => [key, sortJson(item)]),
    );
  }
  return value;
}

const describe = (value: unknown): string => (value === undefined ? 'undefined' : typeof value);
