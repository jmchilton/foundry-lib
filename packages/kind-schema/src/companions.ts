export type {
  Companion,
  CompanionDisposition,
  CompanionRequirement,
  NoteShape,
} from '@galaxy-foundry/kind-manifest';

import type { Companion, NoteShape } from '@galaxy-foundry/kind-manifest';

export const NOTE_FILE = 'index.md';

export interface CompanionDeclaration {
  shape: NoteShape;
  /** Always present; `[]` explicitly means no companions. */
  companions: readonly Companion[];
  /** Absent means undeclared files are forbidden. */
  additionalCompanions?: 'forbid' | 'allow';
  kind?: string;
}

export interface NormalizedCompanion extends Companion {
  name: string;
  directory: boolean;
}

const ILLEGAL_IN_NAME = /[*?[\]{}!/\\]/;

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

export interface DirectoryEntry {
  name: string;
  directory?: boolean;
  /** Supplied by the caller because filenames cannot distinguish notes from companions. */
  note?: boolean;
}

export interface CompanionCheck {
  missingRequired: readonly NormalizedCompanion[];
  missingRecommended: readonly NormalizedCompanion[];
  /** Includes declared names whose file/directory type does not match. */
  unknown: readonly DirectoryEntry[];
}

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
