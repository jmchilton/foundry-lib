import { describe, expect, it } from 'vitest';

import {
  checkCompanions,
  companionsOf,
  NOTE_FILE,
  type CompanionDeclaration,
  type DirectoryEntry,
} from '../src/companions.js';

const mold: CompanionDeclaration = {
  kind: 'mold',
  shape: 'directory',
  companions: [
    {
      file: 'eval.md',
      requirement: 'recommended',
      purpose: 'Abstract oracle: the properties any cast of this mold must satisfy.',
      disposition: 'foundry-only',
    },
    {
      file: 'scenarios.md',
      requirement: 'recommended',
      purpose: 'Concrete cases bound to expected values, run against the eval properties.',
      disposition: 'foundry-only',
    },
    {
      file: 'casting.md',
      requirement: 'optional',
      purpose: 'Per-mold condensation prompts, read by the caster.',
      disposition: 'cast-input',
    },
    {
      file: 'refinements/',
      requirement: 'optional',
      purpose: 'Dated journal of refinement passes, each entry carrying its own frontmatter.',
      disposition: 'foundry-only',
    },
  ],
};

const cliTool: CompanionDeclaration = { kind: 'cli-tool', shape: 'directory', companions: [] };

const prompt: CompanionDeclaration = {
  kind: 'prompt',
  shape: 'directory',
  companions: [
    {
      file: 'upstream.prompt',
      requirement: 'required',
      purpose: 'The verbatim upstream prompt text casting packages.',
      disposition: 'bundled',
    },
  ],
};

const research: CompanionDeclaration = {
  kind: 'research',
  shape: 'directory',
  companions: [],
  additionalCompanions: 'allow',
};

const pattern: CompanionDeclaration = { kind: 'pattern', shape: 'file', companions: [] };

const listing = (...names: string[]): DirectoryEntry[] => names.map((name) => ({ name }));

describe('checkCompanions', () => {
  it('passes a directory holding exactly what its kind declares', () => {
    const companionCheck = checkCompanions(
      [...listing(NOTE_FILE, 'eval.md', 'scenarios.md'), { name: 'refinements', directory: true }],
      mold,
    );
    expect(companionCheck).toEqual({ missingRequired: [], missingRecommended: [], unknown: [] });
  });

  it('flags a missing required companion', () => {
    const companionCheck = checkCompanions(listing(NOTE_FILE), prompt);
    expect(companionCheck.missingRequired.map((companion) => companion.file)).toEqual([
      'upstream.prompt',
    ]);
    expect(companionCheck.missingRecommended).toEqual([]);
  });

  it('separates a missing recommendation from a missing requirement', () => {
    const companionCheck = checkCompanions(listing(NOTE_FILE, 'eval.md'), mold);
    expect(companionCheck.missingRequired).toEqual([]);
    expect(companionCheck.missingRecommended.map((companion) => companion.file)).toEqual([
      'scenarios.md',
    ]);
  });

  it('says nothing about a missing optional companion', () => {
    const companionCheck = checkCompanions(listing(NOTE_FILE, 'eval.md', 'scenarios.md'), mold);
    expect(companionCheck).toEqual({ missingRequired: [], missingRecommended: [], unknown: [] });
  });

  it('flags a misnamed companion under the default forbid', () => {
    const companionCheck = checkCompanions(listing(NOTE_FILE, 'eval.md', 'scenario.md'), mold);
    expect(companionCheck.unknown.map((entry) => entry.name)).toEqual(['scenario.md']);
  });

  it('accepts the same directory under allow', () => {
    expect(
      checkCompanions(listing(NOTE_FILE, 'scenario.md'), { ...mold, additionalCompanions: 'allow' })
        .unknown,
    ).toEqual([]);
  });

  it('carries an open set without declaring any of it', () => {
    const companionCheck = checkCompanions(
      listing(NOTE_FILE, 'gxformat2.schema.json', 'galaxy.xsd', 'datatypes_conf.xml.sample'),
      research,
    );
    expect(companionCheck).toEqual({ missingRequired: [], missingRecommended: [], unknown: [] });
  });

  it("never reports the note's own index.md", () => {
    expect(checkCompanions(listing(NOTE_FILE), cliTool).unknown).toEqual([]);
  });

  it('ignores sibling notes, which are never companions', () => {
    const companionCheck = checkCompanions(
      [
        { name: NOTE_FILE },
        { name: 'tool-search.md', note: true },
        { name: 'workflow-lint.md', note: true },
      ],
      cliTool,
    );
    expect(companionCheck.unknown).toEqual([]);
  });

  it('does not let an unmarked sibling note pass as declared', () => {
    expect(checkCompanions(listing(NOTE_FILE, 'tool-search.md'), cliTool).unknown).toHaveLength(1);
  });

  it('does not satisfy a directory companion with a file of the same name', () => {
    const companionCheck = checkCompanions(listing(NOTE_FILE, 'refinements'), mold);
    expect(companionCheck.unknown.map((entry) => entry.name)).toEqual(['refinements']);
    expect(companionCheck.missingRequired).toEqual([]);
    expect(companionCheck.missingRecommended.map((companion) => companion.file)).toEqual([
      'eval.md',
      'scenarios.md',
    ]);
  });

  it('does not satisfy a file companion with a directory of the same name', () => {
    const companionCheck = checkCompanions(
      [{ name: NOTE_FILE }, { name: 'eval.md', directory: true }],
      mold,
    );
    expect(companionCheck.unknown.map((entry) => entry.name)).toEqual(['eval.md']);
    expect(companionCheck.missingRecommended.map((companion) => companion.file)).toEqual([
      'eval.md',
      'scenarios.md',
    ]);
  });

  it('reports a declared-but-mistyped entry as missing even under allow', () => {
    const companionCheck = checkCompanions(listing(NOTE_FILE), {
      ...prompt,
      additionalCompanions: 'allow',
    });
    expect(companionCheck.unknown).toEqual([]);
    expect(companionCheck.missingRequired.map((companion) => companion.file)).toEqual([
      'upstream.prompt',
    ]);
  });

  it('refuses to answer for a file-shaped kind', () => {
    expect(() => checkCompanions(listing('anything'), pattern)).toThrow(/file-shaped/);
  });
});

describe('companionsOf', () => {
  it('keys by the name a listing reports, resolving a trailing slash', () => {
    const declared = companionsOf(mold);
    expect([...declared.keys()]).toEqual(['eval.md', 'scenarios.md', 'casting.md', 'refinements']);
    expect(declared.get('refinements')).toMatchObject({ file: 'refinements/', directory: true });
    expect(declared.get('eval.md')).toMatchObject({ directory: false });
  });

  it('rejects a glob, so the type never grows an escape hatch', () => {
    expect(() =>
      companionsOf({ shape: 'directory', companions: [{ ...only('*.prompt') }] }),
    ).toThrow(/no globs/);
  });

  it('rejects a path separator — a companion is one directory listing', () => {
    expect(() =>
      companionsOf({ shape: 'directory', companions: [{ ...only('cwl-v1.2/Workflow.yml') }] }),
    ).toThrow(/no globs, no separators/);
  });

  it('rejects the note file itself', () => {
    expect(() =>
      companionsOf({ shape: 'directory', companions: [{ ...only(NOTE_FILE) }] }),
    ).toThrow(/the note itself/);
  });

  it('rejects the same companion declared twice', () => {
    expect(() =>
      companionsOf({ shape: 'directory', companions: [only('eval.md'), only('eval.md')] }),
    ).toThrow(/declared twice/);
  });

  it('rejects a file-shaped kind that declares companions', () => {
    expect(() =>
      companionsOf({ kind: 'schema', shape: 'file', companions: [only('x.md')] }),
    ).toThrow(/no directory/);
  });

  it('names the kind in its errors when it has one', () => {
    expect(() => companionsOf({ kind: 'mold', shape: 'file', companions: [only('x.md')] })).toThrow(
      /^mold: companions:/,
    );
  });

  it('accepts a kind with no companions', () => {
    expect(companionsOf(cliTool).size).toBe(0);
  });
});

function only(companionFile: string) {
  return {
    file: companionFile,
    requirement: 'optional',
    purpose: 'under test',
    disposition: 'foundry-only',
  } as const;
}
