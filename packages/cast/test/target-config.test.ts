// What a target declares about itself, and what the caster is allowed to conclude from it.
//
// Both halves matter for the same reason: a `_target.yml` is the one input to a cast that no
// schema upstream of it has checked. A field that is missing, or a shape that is nearly right,
// reaches the caster as `undefined` and surfaces hundreds of lines later as a property access
// on nothing — with no filename attached to say which target was wrong.

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { loadTargetConfig, ownedSubtrees, type TargetConfig } from '../src/caster/target-config.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'cast-target-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function writeTarget(body: string): string {
  writeFileSync(path.join(dir, '_target.yml'), body);
  return dir;
}

const DOCUMENT = `document:
  path: SKILL.md
  noun: skill
`;

const MINIMAL = `
${DOCUMENT}kinds:
  pattern:
    dst_dir: references/patterns/
    dst_extension: .md
    modes: [verbatim]
`;

describe('reading a target declaration', () => {
  it('accepts a target that declares its document and where its kinds land', () => {
    const config = loadTargetConfig(writeTarget(MINIMAL));
    expect(config.kinds.pattern?.dst_dir).toBe('references/patterns/');
    expect(config.document).toEqual({ path: 'SKILL.md', noun: 'skill' });
    expect(config.skill_constraints.forbidden_runtime_paths).toEqual([]);
  });

  it('reads the document a target says a cast produces', () => {
    // `SKILL.md`, the `name:`/`description:` frontmatter and the noun "skill" are one harness's
    // vocabulary, not casting's. Hardcoded, they are invisible to the byte-identity oracle,
    // which only ever runs against the instance whose vocabulary they already are.
    const config = loadTargetConfig(
      writeTarget(
        MINIMAL.replace('path: SKILL.md', 'path: PAGE.md').replace('noun: skill', 'noun: page'),
      ),
    );
    expect(config.document).toEqual({ path: 'PAGE.md', noun: 'page' });
  });

  it('refuses a target that does not say what a cast of it produces', () => {
    // No default. A default is the assumption this field exists to remove — it would put one
    // harness's filename back in the package, just spelled as a fallback.
    expect(() => loadTargetConfig(writeTarget(MINIMAL.replace(/document:\n.*\n.*\n/, '')))).toThrow(
      /document/,
    );
  });

  it('refuses a document that is not written at the bundle root', () => {
    // The sweep never visits it and provenance does not name it, so a document placed outside
    // the bundle is written once and then belongs to nothing.
    expect(() => loadTargetConfig(writeTarget(MINIMAL.replace('SKILL.md', '../SKILL.md')))).toThrow(
      /document\.path/,
    );
    expect(() =>
      loadTargetConfig(writeTarget(MINIMAL.replace('SKILL.md', 'docs/SKILL.md'))),
    ).toThrow(/document\.path/);
  });

  it('requires the outputs a cast must produce, defaulting to what it writes', () => {
    // Declaring `[SKILL.md, _provenance.json]` by hand restates what casting always writes, and
    // a restatement is only ever a chance to disagree.
    expect(loadTargetConfig(writeTarget(MINIMAL)).required_outputs).toEqual([
      'SKILL.md',
      '_provenance.json',
    ]);
    const declared = loadTargetConfig(writeTarget(`${MINIMAL}required_outputs: [manifest.json]\n`));
    expect(declared.required_outputs).toEqual(['manifest.json']);
  });

  it('names the file when the declaration is not a mapping', () => {
    const err = (): TargetConfig => loadTargetConfig(writeTarget('- a\n- b\n'));
    expect(err).toThrow(/_target\.yml/);
  });

  it('refuses a target that places no kinds anywhere', () => {
    // Reached the caster, this is `Cannot read properties of undefined` from ref resolution,
    // several hundred lines from the file that caused it.
    expect(() => loadTargetConfig(writeTarget('required_outputs: [SKILL.md]\n'))).toThrow(/kinds/);
  });

  it('refuses a kind that declares no destination', () => {
    expect(() =>
      loadTargetConfig(writeTarget(`${DOCUMENT}kinds:\n  pattern:\n    modes: [verbatim]\n`)),
    ).toThrow(/pattern.*dst_dir/s);
  });

  it('refuses a `modes` that is not a list', () => {
    // `modes: verbatim` is the shape a hand-written YAML file lands on, and `.includes` on a
    // string answers questions about substrings rather than about modes.
    expect(() =>
      loadTargetConfig(
        writeTarget(
          `${DOCUMENT}kinds:\n  pattern:\n    dst_dir: refs/\n    dst_extension: .md\n    modes: verbatim\n`,
        ),
      ),
    ).toThrow(/pattern.*modes/s);
  });

  it('reads bundle_path through the parser that knows braces are YAML', () => {
    // `bundle_path: {mold}` is a flow mapping, not a template — the exact trap bundlePathOf
    // exists to catch. Typed as `string` off a bare cast, it reaches a caller as an object.
    expect(() => loadTargetConfig(writeTarget(`bundle_path: {mold}\n${MINIMAL}`))).toThrow(
      /bundle_path/,
    );
  });
});

describe('which parts of a bundle a cast is allowed to prune', () => {
  const target = (dirs: string[]): TargetConfig => ({
    document: { path: 'SKILL.md', noun: 'skill' },
    required_outputs: [],
    kinds: Object.fromEntries(
      dirs.map((d, i) => [`k${i}`, { dst_dir: d, dst_extension: '.md', modes: ['verbatim'] }]),
    ),
    skill_constraints: { frontmatter_required: [], forbidden_runtime_paths: [] },
  });

  it('derives the owned subtrees from where the target puts its kinds', () => {
    // Hardcoding `references/` silently disables orphan detection for any target that spells
    // its destinations differently — and an orphan that is never swept is invisible to every
    // other check in a cast.
    expect(ownedSubtrees(target(['refs/patterns/', 'refs/notes/', 'vendor/schemas/']))).toEqual([
      'refs',
      'vendor',
    ]);
  });

  it('collapses kinds that share a subtree', () => {
    expect(ownedSubtrees(target(['references/cli/', 'references/notes/']))).toEqual(['references']);
  });

  it('refuses a kind that claims the bundle root', () => {
    // Sweeping the root against the ref list would delete SKILL.md and _provenance.json, which
    // no ref claims. Refusing is the only safe reading of a target that asks for it.
    expect(() => ownedSubtrees(target(['']))).toThrow(/bundle root/);
    expect(() => ownedSubtrees(target(['./']))).toThrow(/bundle root/);
  });

  it('refuses a destination that climbs out of the bundle', () => {
    expect(() => ownedSubtrees(target(['../elsewhere/']))).toThrow(/outside/);
  });
});
