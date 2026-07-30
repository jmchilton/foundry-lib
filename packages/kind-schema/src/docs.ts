import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { AnyKindDefinition } from './index.js';

export function loadKindDocs<Ctx>(
  kinds: readonly AnyKindDefinition<Ctx>[],
  typesDir: string,
): Record<string, string> {
  const docs: Record<string, string> = {};
  for (const definition of kinds) {
    const file = path.join(typesDir, definition.kind, 'kind.md');
    try {
      docs[definition.kind] = readFileSync(file, 'utf8').trim();
    } catch {
      throw new Error(`${definition.kind}: cannot read ${file}`);
    }
  }
  return docs;
}
