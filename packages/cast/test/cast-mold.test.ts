// What a re-cast writes when nothing about the Mold changed.
//
// A renderer is held to determinism — "the clock, the network and the environment are not" —
// and then the one file the caster writes for itself reached for two of the three: a fresh
// `cast_at` and wherever HEAD happened to be, on every run. The drift gate compensates by
// normalizing both away, so the fields were already understood to carry no verdict; what
// remained was that a corpus-wide re-cast rewrote every record and buried the few that moved
// among the many that had not. These pin the two halves: an unchanged Mold produces an
// unchanged file, and a changed one still records when and from what it was cast.

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

import { castMold, type CastRequest } from '../src/caster/cast-mold.js';
import type { CastHooks } from '../src/caster/hooks.js';
import type { TargetConfig } from '../src/caster/target-config.js';

const target: TargetConfig = {
  document: { path: 'SKILL.md', noun: 'skill' },
  required_outputs: ['SKILL.md', '_provenance.json'],
  kinds: {},
  skill_constraints: { frontmatter_required: [], forbidden_runtime_paths: [] },
};

const hooks: CastHooks = {
  renderers: {},
  bundleFiles: [],
  skillLede: 'A skill cast from a Mold that declares no references.',
  skillSections: () => [],
  bundleChecks: [],
};

function git(repoRoot: string, ...args: string[]): string {
  return execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Test User',
      GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_COMMITTER_NAME: 'Test User',
      GIT_COMMITTER_EMAIL: 'test@example.com',
    },
  }).trim();
}

describe('provenance across repeated casts', () => {
  let repoRoot: string;
  let bundleRoot: string;

  const request = (overrides: Partial<CastRequest> = {}): CastRequest => ({
    repoRoot,
    bundleRoot,
    targetName: 'test',
    target,
    mold: {
      name: 'example-mold',
      path: 'content/molds/example-mold/index.md',
      meta: { summary: 'Does one thing, for a test.', revision: 1 },
      body: 'Do the thing.',
      contentHash: 'sha256:aaa',
    },
    castContract: {},
    refKinds: {},
    slugMap: new Map(),
    metaByPath: new Map(),
    kindLayouts: {},
    hooks,
    check: false,
    note: null,
    ...overrides,
  });

  const record = (): string => readFileSync(path.join(bundleRoot, '_provenance.json'), 'utf8');
  const parsed = (): { cast_at: string; mold: { commit: string | null } } =>
    JSON.parse(record()) as { cast_at: string; mold: { commit: string | null } };

  beforeEach(() => {
    repoRoot = mkdtempSync(path.join(os.tmpdir(), 'foundry-cast-mold-'));
    bundleRoot = path.join(repoRoot, 'casts', 'test', 'example-mold');
    mkdirSync(bundleRoot, { recursive: true });
    git(repoRoot, 'init', '-q');
    writeFileSync(path.join(repoRoot, 'seed.txt'), 'one\n');
    git(repoRoot, 'add', '.');
    git(repoRoot, 'commit', '-q', '-m', 'first');
  });

  // HEAD is what moves here rather than the clock: two casts can land in the same millisecond,
  // and a test that depends on them not to is a test that fails on a fast machine.
  function moveHead(): string {
    writeFileSync(path.join(repoRoot, 'seed.txt'), 'two\n');
    git(repoRoot, 'add', '.');
    git(repoRoot, 'commit', '-q', '-m', 'second');
    return git(repoRoot, 'rev-parse', 'HEAD');
  }

  it('records the clock and HEAD on a first cast', async () => {
    const head = git(repoRoot, 'rev-parse', 'HEAD');
    await castMold(request());
    expect(parsed().mold.commit).toBe(head);
    expect(Date.parse(parsed().cast_at)).not.toBeNaN();
  });

  it('leaves the record untouched when a re-cast changes nothing else', async () => {
    await castMold(request());
    const first = record();
    const firstHead = parsed().mold.commit;

    moveHead();
    await castMold(request());

    expect(record()).toBe(first);
    expect(parsed().mold.commit).toBe(firstHead);
  });

  it('reports no drift on that re-cast', async () => {
    await castMold(request());
    moveHead();
    const outcome = await castMold(request());
    expect(outcome.drift).toEqual([]);
  });

  // The other half: carrying the stamps forward must not freeze them. A record whose content
  // moved has to say when it moved, and from which commit — otherwise the fields stop being
  // provenance and become decoration.
  it('restamps when the Mold itself changed', async () => {
    await castMold(request());
    const firstHead = parsed().mold.commit;

    const head = moveHead();
    await castMold(
      request({
        mold: {
          name: 'example-mold',
          path: 'content/molds/example-mold/index.md',
          meta: { summary: 'Does one thing, for a test.', revision: 2 },
          body: 'Do the thing, differently.',
          contentHash: 'sha256:bbb',
        },
      }),
    );

    expect(parsed().mold.commit).toBe(head);
    expect(parsed().mold.commit).not.toBe(firstHead);
  });

  it('still reports drift on that re-cast', async () => {
    await castMold(request());
    moveHead();
    const outcome = await castMold(
      request({
        mold: {
          name: 'example-mold',
          path: 'content/molds/example-mold/index.md',
          meta: { summary: 'Does one thing, for a test.', revision: 2 },
          body: 'Do the thing, differently.',
          contentHash: 'sha256:bbb',
        },
      }),
    );
    expect(outcome.drift.map((d) => d.file)).toContain('_provenance.json');
  });

  // `--check` publishes nothing, so the committed record must survive it byte for byte even
  // though the run still assembles a full record against a staged copy.
  it('publishes nothing under --check', async () => {
    await castMold(request());
    const first = record();
    moveHead();
    const outcome = await castMold(request({ check: true }));
    expect(outcome.wrote).toBeNull();
    expect(record()).toBe(first);
  });
});
