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

const INVALID_COMPANION_NAME_CHARACTER = /[*?[\]{}!/\\]/;

export function companionsOf(
  declaration: CompanionDeclaration,
): ReadonlyMap<string, NormalizedCompanion> {
  const errorPrefix =
    declaration.kind === undefined ? 'companions' : `${declaration.kind}: companions`;

  if (declaration.shape === 'file' && declaration.companions.length > 0) {
    throw new Error(
      `${errorPrefix}: a file-shaped kind has no directory to put them in — declare shape: 'directory' or companions: []`,
    );
  }

  const companionsByName = new Map<string, NormalizedCompanion>();
  for (const companion of declaration.companions) {
    const { file } = companion;
    const isDirectory = file.endsWith('/');
    const entryName = isDirectory ? file.slice(0, -1) : file;

    if (entryName === '') throw new Error(`${errorPrefix}: a companion needs a name`);
    if (INVALID_COMPANION_NAME_CHARACTER.test(entryName)) {
      throw new Error(
        `${errorPrefix}: '${file}' must be a literal name in one directory — no globs, no separators`,
      );
    }
    if (entryName === '.' || entryName === '..') {
      throw new Error(`${errorPrefix}: '${file}' is not a name`);
    }
    if (entryName === NOTE_FILE) {
      throw new Error(`${errorPrefix}: '${file}' is the note itself, not a companion of it`);
    }
    if (companionsByName.has(entryName)) {
      throw new Error(`${errorPrefix}: '${entryName}' declared twice`);
    }

    companionsByName.set(entryName, { ...companion, name: entryName, directory: isDirectory });
  }
  return companionsByName;
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
    const kindLabel = declaration.kind === undefined ? 'this kind' : `kind '${declaration.kind}'`;
    throw new Error(`${kindLabel} is file-shaped: its notes have no directory to hold companions`);
  }

  const declaredCompanions = companionsOf(declaration);
  const allowsUnknownEntries = declaration.additionalCompanions === 'allow';

  const satisfiedCompanions = new Set<string>();
  const unknownEntries: DirectoryEntry[] = [];

  for (const entry of entries) {
    if (entry.name === NOTE_FILE || entry.note === true) continue;
    const declaredCompanion = declaredCompanions.get(entry.name);
    if (
      declaredCompanion !== undefined &&
      declaredCompanion.directory === (entry.directory === true)
    ) {
      satisfiedCompanions.add(declaredCompanion.name);
      continue;
    }
    if (!allowsUnknownEntries) unknownEntries.push(entry);
  }

  const missingRequired: NormalizedCompanion[] = [];
  const missingRecommended: NormalizedCompanion[] = [];
  for (const companion of declaredCompanions.values()) {
    if (satisfiedCompanions.has(companion.name)) continue;
    if (companion.requirement === 'required') missingRequired.push(companion);
    else if (companion.requirement === 'recommended') missingRecommended.push(companion);
  }

  return { missingRequired, missingRecommended, unknown: unknownEntries };
}
