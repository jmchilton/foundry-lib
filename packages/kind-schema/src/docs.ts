import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { AnyKindDefinition } from './index.js';

export function loadKindDocs<Context>(
  kinds: readonly AnyKindDefinition<Context>[],
  typesDirectory: string,
): Record<string, string> {
  const kindDocs: Record<string, string> = {};
  for (const definition of kinds) {
    const documentationPath = path.join(typesDirectory, definition.kind, 'kind.md');
    try {
      kindDocs[definition.kind] = readFileSync(documentationPath, 'utf8').trim();
    } catch {
      throw new Error(`${definition.kind}: cannot read ${documentationPath}`);
    }
  }
  return kindDocs;
}
