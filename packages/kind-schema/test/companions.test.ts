import { describe, expect, it } from 'vitest';

import {
  checkCompanions,
  companionsOf,
  NOTE_FILE,
  type CompanionDeclaration,
  type DirectoryEntry,
} from '../src/companions.js';

// Every declaration below is a real one, transcribed from what the two instances have on disk.
// The cases that make this non-trivial each occur in exactly one of them, so a fixture invented
// for the test would exercise the easy half and nothing else:
//
//   mold      galaxyproject/foundry, 47 directories — the only kind with a `recommended` level
//             (eval.md beside 33, scenarios.md beside 27) and the only DIRECTORY companion.
//   cli-tool  galaxyproject/foundry — a note directory full of markdown, all of it OTHER NOTES.
//             This is the case a filename heuristic gets wrong.
//   prompt    galaxyproject/foundry#403 — exactly one required companion, named by convention.
//   research  galaxyproject/foundry — an open set (vendored sidecars), post-Phase-4.
//   pattern   flat file in one instance, so it has nowhere to put a companion at all.

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

/** A listing, in the shape `readdirSync(dir, { withFileTypes: true })` maps onto. */
const listing = (...names: string[]): DirectoryEntry[] => names.map((name) => ({ name }));

describe('checkCompanions', () => {
  it('passes a directory holding exactly what its kind declares', () => {
    const result = checkCompanions(
      [...listing(NOTE_FILE, 'eval.md', 'scenarios.md'), { name: 'refinements', directory: true }],
      mold,
    );
    expect(result).toEqual({ missingRequired: [], missingRecommended: [], unknown: [] });
  });

  it('flags a missing required companion', () => {
    const result = checkCompanions(listing(NOTE_FILE), prompt);
    expect(result.missingRequired.map((c) => c.file)).toEqual(['upstream.prompt']);
    expect(result.missingRecommended).toEqual([]);
  });

  it('separates a missing recommendation from a missing requirement', () => {
    // The 14 molds with no eval.md are a warning, not an error, and the two levels have to arrive
    // in different buckets or the validator cannot report them differently.
    const result = checkCompanions(listing(NOTE_FILE, 'eval.md'), mold);
    expect(result.missingRequired).toEqual([]);
    expect(result.missingRecommended.map((c) => c.file)).toEqual(['scenarios.md']);
  });

  it('says nothing about a missing optional companion', () => {
    const result = checkCompanions(listing(NOTE_FILE, 'eval.md', 'scenarios.md'), mold);
    expect(result).toEqual({ missingRequired: [], missingRecommended: [], unknown: [] });
  });

  it('flags a misnamed companion under the default forbid', () => {
    // The case this whole mechanism is for. `scenario.md` is what a validator that only walks a
    // collection table silently drops, so a typo is today indistinguishable from a non-note.
    const result = checkCompanions(listing(NOTE_FILE, 'eval.md', 'scenario.md'), mold);
    expect(result.unknown.map((e) => e.name)).toEqual(['scenario.md']);
  });

  it('accepts the same directory under allow', () => {
    expect(
      checkCompanions(listing(NOTE_FILE, 'scenario.md'), { ...mold, additionalCompanions: 'allow' })
        .unknown,
    ).toEqual([]);
  });

  it('carries an open set without declaring any of it', () => {
    const result = checkCompanions(
      listing(NOTE_FILE, 'gxformat2.schema.json', 'galaxy.xsd', 'datatypes_conf.xml.sample'),
      research,
    );
    expect(result).toEqual({ missingRequired: [], missingRecommended: [], unknown: [] });
  });

  it("never reports the note's own index.md", () => {
    // A kind declaring `companions: []` and a directory holding only its note is the common case;
    // if the note counted as a stray, every directory note in both instances would fail at once.
    expect(checkCompanions(listing(NOTE_FILE), cliTool).unknown).toEqual([]);
  });

  it('ignores sibling notes, which are never companions', () => {
    // content/cli/gxwf/ — index.md is the cli-tool, every sibling .md is a cli-command. The caller
    // marks them from the collection table; nothing here guesses from the extension.
    const result = checkCompanions(
      [
        { name: NOTE_FILE },
        { name: 'tool-search.md', note: true },
        { name: 'workflow-lint.md', note: true },
      ],
      cliTool,
    );
    expect(result.unknown).toEqual([]);
  });

  it('does not let an unmarked sibling note pass as declared', () => {
    // The other half of the same contract: `note` is information the caller HAS to supply. An
    // unmarked sibling is reported, which is the failure mode that says "wire up the table",
    // rather than a silent pass that says nothing.
    expect(checkCompanions(listing(NOTE_FILE, 'tool-search.md'), cliTool).unknown).toHaveLength(1);
  });

  it('does not satisfy a directory companion with a file of the same name', () => {
    // Matching on name alone would pass this, which is the one outcome worth ruling out: the
    // declared journal would read as present while nothing could be written into it.
    const result = checkCompanions(listing(NOTE_FILE, 'refinements'), mold);
    expect(result.unknown.map((e) => e.name)).toEqual(['refinements']);
    expect(result.missingRequired).toEqual([]);
    expect(result.missingRecommended.map((c) => c.file)).toEqual(['eval.md', 'scenarios.md']);
  });

  it('does not satisfy a file companion with a directory of the same name', () => {
    const result = checkCompanions(
      [{ name: NOTE_FILE }, { name: 'eval.md', directory: true }],
      mold,
    );
    expect(result.unknown.map((e) => e.name)).toEqual(['eval.md']);
    expect(result.missingRecommended.map((c) => c.file)).toEqual(['eval.md', 'scenarios.md']);
  });

  it('reports a declared-but-mistyped entry as missing even under allow', () => {
    // `allow` widens what may be PRESENT; it does not weaken what was declared.
    const result = checkCompanions(listing(NOTE_FILE), {
      ...prompt,
      additionalCompanions: 'allow',
    });
    expect(result.unknown).toEqual([]);
    expect(result.missingRequired.map((c) => c.file)).toEqual(['upstream.prompt']);
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
    // Settled by galaxyproject/foundry#403: the one case that wanted `<slug>.upstream.prompt` was
    // fixed by changing the layout instead. This is what keeps that decision from eroding.
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
    // A contradiction rather than a content error: there is no directory for them to sit in.
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

/** One minimally-specified companion, for the cases where only `file` is under test. */
function only(file: string) {
  return {
    file,
    requirement: 'optional',
    purpose: 'under test',
    disposition: 'foundry-only',
  } as const;
}
