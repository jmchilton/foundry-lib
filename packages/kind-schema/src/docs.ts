// Loading the prose that sits beside a kind's schema.
//
// A separate entry point rather than part of the barrel, because this is the only thing in this
// package that touches a filesystem. Everything else is pure and imports nothing from `node:`,
// which is what lets an instance's Astro site pull `KindDefinition` into browser code without
// dragging `fs` in behind it. `./collections` is split off for the same reason it is split off
// there: an entry point costs a line in `exports` and buys the caller not paying for what it
// does not import.
//
// The function itself was written twice, identically enough that the docstring below is the one
// both repos already carry, word for word:
//
//   galaxyproject/foundry            packages/build-cli/src/commands/generate-kind-manifest.ts
//   statistical-genomics-foundry     site/scripts/generate-kind-manifest.ts

import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { AnyKindDefinition } from './index.js';

/**
 * kind name -> kind.md body.
 *
 * Driven by the barrel rather than a directory listing: `KINDS` is the one enumeration, so a
 * kind with no `kind.md` fails naming itself, and an unrelated directory under types/ is not
 * mistaken for a kind.
 *
 * Throws rather than exiting, unlike the two copies this replaces. A library that calls
 * `process.exit` cannot be tested, cannot be composed, and takes a decision that belongs to the
 * command — both callers do want to exit 1, and both should keep saying so themselves.
 */
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
