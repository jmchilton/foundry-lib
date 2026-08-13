import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { AnyKindDefinition } from './index.js';

function loadKindFile<Context>(
  kinds: readonly AnyKindDefinition<Context>[],
  typesDirectory: string,
  filename: string,
): Record<string, string> {
  const bodies: Record<string, string> = {};
  for (const definition of kinds) {
    const file = path.join(typesDirectory, definition.kind, filename);
    try {
      bodies[definition.kind] = readFileSync(file, 'utf8').trim();
    } catch {
      throw new Error(`${definition.kind}: cannot read ${file}`);
    }
  }
  return bodies;
}

export function loadKindDocs<Context>(
  kinds: readonly AnyKindDefinition<Context>[],
  typesDirectory: string,
): Record<string, string> {
  return loadKindFile(kinds, typesDirectory, 'kind.md');
}

/** Read each declared kind's schema-validated worked example. */
export function loadKindExamples<Context>(
  kinds: readonly AnyKindDefinition<Context>[],
  typesDirectory: string,
): Record<string, string> {
  return loadKindFile(kinds, typesDirectory, 'example.md');
}
