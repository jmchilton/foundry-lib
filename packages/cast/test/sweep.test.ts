// Casting every Mold, and what a run of many says when it is done.
//
// This is the first test in the package that casts for real — a whole small Foundry on disk,
// through `castSweep`, to bundles a second run reads back. That is deliberate rather than
// incidental: the sweep is the one piece of casting that had NO test anywhere, in either
// Foundry, because in one it was a shell loop inside a Makefile and in the other it read
// `process.exitCode` after each iteration. Neither is reachable from a test runner.
//
// The fixture is a Foundry with no references at all. Everything the sweep decides — which
// Molds are clean, which drifted, which could not be built, and what any of that should print —
// is decided above the reference layer, and a corpus here would only be scenery.

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { castSweep, sweepReport, type CastCommandSpec, type SweepResult } from '../src/command.js';

let dir: string;
let cwd: string;

const TARGET = `document:
  path: SKILL.md
  noun: skill
kinds:
  pattern:
    dst_dir: references/patterns/
    dst_extension: .md
    modes: [verbatim]
`;

const CONTRACT = `kinds:
  pattern:
    label: Pattern
    description: A domain pattern page.
    ref_shape: wiki-link
    cast:
      resolve: note
      default_mode: verbatim
      companions: false
`;

/** A Foundry that contributes nothing beyond the two files every cast writes. */
const SPEC: CastCommandSpec = {
  usage: 'test-foundry-build',
  defaultTarget: 'test',
  hooks: {
    renderers: {},
    bundleFiles: [],
    skillLede: 'Follow the procedure below.',
    skillSections: ({ body }) => [{ title: 'Procedure', body: body.trim() }],
    bundleChecks: [],
  },
  corpus: () => ({ slugMap: new Map(), metaByPath: new Map() }),
};

function writeMold(name: string, body = 'Do the thing.'): void {
  const moldDir = path.join(dir, 'content', 'molds', name);
  mkdirSync(moldDir, { recursive: true });
  writeFileSync(
    path.join(moldDir, 'index.md'),
    `---\ntype: mold\nsummary: "${name} does something."\n---\n\n# ${name}\n\n## Step\n\n${body}\n`,
  );
}

const bundleFile = (mold: string, file: string): string =>
  path.join(dir, 'casts', 'test', mold, file);

const sweep = (molds: readonly string[], check = true): Promise<SweepResult> =>
  castSweep(SPEC, { molds, target: 'test', root: dir, check });

beforeEach(() => {
  cwd = process.cwd();
  dir = mkdtempSync(path.join(tmpdir(), 'cast-sweep-'));
  mkdirSync(path.join(dir, 'casts', 'test'), { recursive: true });
  writeFileSync(path.join(dir, 'casts', 'test', '_target.yml'), TARGET);
  writeFileSync(path.join(dir, 'reference_contract.yml'), CONTRACT);
});

afterEach(() => {
  // `prepareCast` chdirs, because `--root` moves the repository a run is about.
  process.chdir(cwd);
  rmSync(dir, { recursive: true, force: true });
});

describe('sweeping every Mold', () => {
  it('casts each one and reports them in the order it was given', async () => {
    writeMold('alpha');
    writeMold('beta');

    const result = await sweep(['alpha', 'beta'], false);

    expect(result.entries.map((e) => e.mold)).toEqual(['alpha', 'beta']);
    expect(result.entries.every((e) => e.wrote)).toBe(true);
    expect(result.errored).toEqual([]);
    expect(readFileSync(bundleFile('alpha', 'SKILL.md'), 'utf8')).toContain('# alpha');

    // A first cast drifts against the bundle it does not have yet, and writes it. That is the
    // reconciliation, not a failure — which is why `sweepReport` weighs drift by `check`.
    expect(result.drifted.map((e) => e.mold)).toEqual(['alpha', 'beta']);
  });

  it('does not fail a write sweep for the drift it just reconciled', async () => {
    writeMold('alpha');
    const verdict = sweepReport(await sweep(['alpha'], false), { repoRoot: dir, check: false });
    expect(verdict.exitCode).toBe(0);
    expect(verdict.out).toContain('cast 1 of 1 mold(s)');
  });

  it('finds nothing to say about a bundle that still matches its source', async () => {
    writeMold('alpha');
    await sweep(['alpha'], false);

    const result = await sweep(['alpha']);
    expect(result.clean).toHaveLength(1);
    expect(result.drifted).toEqual([]);
    expect(result.errored).toEqual([]);
  });

  it('names the file that moved when a committed bundle disagrees with its Mold', async () => {
    writeMold('alpha');
    await sweep(['alpha'], false);
    writeFileSync(bundleFile('alpha', 'SKILL.md'), 'someone edited the bundle\n');

    const result = await sweep(['alpha']);
    expect(result.drifted).toHaveLength(1);
    expect(result.drifted[0]!.drift.map((d) => d.file)).toContain('SKILL.md');
    expect(result.errored).toEqual([]);
  });

  it('reports a Mold with no source as errored rather than throwing', async () => {
    // The single-Mold command treats this as a usage error and exits 2, because the run named
    // the Mold. In a sweep the caller built the list, so it is one bad entry among many.
    writeMold('alpha');

    const result = await sweep(['alpha', 'ghost']);
    expect(result.errored.map((e) => e.mold)).toEqual(['ghost']);
    expect(result.errored[0]!.errors[0]).toMatch(/mold source missing.*ghost/);
  });

  it('keeps going after a failure, so one bad Mold does not hide the rest', async () => {
    // A loop that stops at the first drift reports one file per run, which is how seven bundles
    // carried a dead path for two weeks while the one Mold CI checked stayed green.
    writeMold('alpha');
    writeMold('beta');
    await sweep(['alpha', 'beta'], false);
    writeFileSync(bundleFile('beta', 'SKILL.md'), 'edited\n');

    const result = await sweep(['ghost', 'alpha', 'beta']);
    expect(result.entries).toHaveLength(3);
    expect(result.errored.map((e) => e.mold)).toEqual(['ghost']);
    expect(result.drifted.map((e) => e.mold)).toEqual(['beta']);
    expect(result.clean.map((e) => e.mold)).toEqual(['alpha']);
  });

  it('checks rather than writes unless asked, so a forgotten flag cannot cast the corpus', async () => {
    writeMold('alpha');

    const result = await castSweep(SPEC, { molds: ['alpha'], target: 'test', root: dir });
    expect(result.entries[0]!.wrote).toBeNull();
    expect(result.drifted).toHaveLength(1);
  });

  it('sweeps only the Molds it was given, because which ones matter is the instance’s', async () => {
    // One Foundry requires every Mold to be cast; the other checks only what it has already
    // cast, and has two Molds it deliberately has not. The list is an argument for that reason.
    writeMold('alpha');
    writeMold('uncast');
    await sweep(['alpha'], false);

    const result = await sweep(['alpha']);
    expect(result.entries.map((e) => e.mold)).toEqual(['alpha']);
  });
});

describe('what a finished sweep says', () => {
  const entry = (mold: string, over: Partial<SweepResult['entries'][number]> = {}) => ({
    mold,
    errors: [],
    drift: [],
    wrote: null,
    ...over,
  });

  const resultOf = (entries: ReturnType<typeof entry>[]): SweepResult => ({
    entries,
    clean: entries.filter((e) => !e.errors.length && !e.drift.length),
    drifted: entries.filter((e) => !e.errors.length && e.drift.length > 0),
    errored: entries.filter((e) => e.errors.length > 0),
  });

  it('says NOTHING when a check sweep finds nothing', async () => {
    // The convention this settles. One `clean` line per Mold buries the run that matters in the
    // forty-six that do not; a gate that passes has said everything by exiting zero.
    const verdict = sweepReport(resultOf([entry('alpha'), entry('beta')]), {
      repoRoot: '/repo',
      check: true,
    });
    expect(verdict).toEqual({ out: [], err: [], exitCode: 0 });
  });

  it('names each failing Mold and indents what it found', async () => {
    const verdict = sweepReport(
      resultOf([
        entry('alpha'),
        entry('beta', { drift: [{ file: 'SKILL.md', reason: 'changed' }] }),
        entry('gamma', { errors: ['[[nope]] resolves to nothing'] }),
      ]),
      { repoRoot: '/repo', check: true },
    );
    expect(verdict.exitCode).toBe(1);
    expect(verdict.err).toContain('beta:');
    expect(verdict.err).toContain('  drift: SKILL.md — changed');
    expect(verdict.err).toContain('gamma:');
    expect(verdict.err).toContain('  error: [[nope]] resolves to nothing');
    // The clean Mold is not mentioned even when others failed.
    expect(verdict.err.join('\n')).not.toContain('alpha');
  });

  it('counts the failures against the whole sweep', async () => {
    const verdict = sweepReport(resultOf([entry('alpha'), entry('beta', { errors: ['boom'] })]), {
      repoRoot: '/repo',
      check: true,
    });
    expect(verdict.err).toContain('1 of 2 cast(s) failed');
  });

  it('carries the remediation the reader needs, in the instance’s own vocabulary', async () => {
    // The half of foundry's Makefile worth keeping, and the half statgen never had: drift is
    // fixed by re-casting and committing, an error is fixed at the source. `make casts` and
    // `pnpm cast` are different words for it, so the lines are an argument.
    const verdict = sweepReport(resultOf([entry('beta', { errors: ['boom'] })]), {
      repoRoot: '/repo',
      check: true,
      remediation: ["Drift is fixed by 'make casts' + commit;", 'an error is fixed at the source.'],
    });
    expect(verdict.err.slice(-2)).toEqual([
      "Drift is fixed by 'make casts' + commit;",
      'an error is fixed at the source.',
    ]);
  });

  it('reports what a write sweep wrote, where a check sweep would stay silent', async () => {
    const verdict = sweepReport(
      resultOf([entry('alpha', { wrote: '/repo/casts/test/alpha/_provenance.json' }), entry('b')]),
      { repoRoot: '/repo', check: false },
    );
    expect(verdict.exitCode).toBe(0);
    expect(verdict.out).toEqual(['cast 1 of 2 mold(s)']);
  });
});
