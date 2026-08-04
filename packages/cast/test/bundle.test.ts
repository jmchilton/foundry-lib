import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { copyVerbatim, pruneEmptyDirs, reconcileTreeTo } from '../src/bundle.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'cast-bundle-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('copying a verbatim ref', () => {
  it('creates the destination directory', () => {
    const src = path.join(dir, 'note.md');
    writeFileSync(src, 'body');
    const dst = path.join(dir, 'bundle', 'references', 'notes', 'note.md');
    copyVerbatim(src, dst);
    expect(existsSync(dst)).toBe(true);
  });
});

describe('pruning directories a cast emptied', () => {
  it('removes a nested empty tree, deepest first', () => {
    // One pass that only looked at the top level would leave `references/` behind, because
    // `references/` only becomes empty once `notes/` is gone.
    mkdirSync(path.join(dir, 'references', 'notes'), { recursive: true });
    pruneEmptyDirs(dir);
    expect(existsSync(path.join(dir, 'references'))).toBe(false);
  });

  it('keeps directories that still hold a file', () => {
    mkdirSync(path.join(dir, 'references', 'notes'), { recursive: true });
    writeFileSync(path.join(dir, 'references', 'notes', 'kept.md'), 'body');
    mkdirSync(path.join(dir, 'references', 'schemas'), { recursive: true });
    pruneEmptyDirs(dir);
    expect(existsSync(path.join(dir, 'references', 'notes', 'kept.md'))).toBe(true);
    expect(existsSync(path.join(dir, 'references', 'schemas'))).toBe(false);
  });

  it('keeps the bundle root itself, empty or not', () => {
    pruneEmptyDirs(dir);
    expect(existsSync(dir)).toBe(true);
  });

  it('is silent about a bundle that was never cast', () => {
    expect(() => pruneEmptyDirs(path.join(dir, 'never-cast'))).not.toThrow();
  });
});

describe('reducing a subtree to what is declared', () => {
  function seed(): void {
    mkdirSync(path.join(dir, 'references', 'notes'), { recursive: true });
    writeFileSync(path.join(dir, 'references', 'notes', 'kept.md'), 'body');
    writeFileSync(path.join(dir, 'references', 'notes', 'orphan.md'), 'stale');
  }

  it('removes what nothing declares and keeps what does', () => {
    seed();
    const stale = reconcileTreeTo({
      root: path.join(dir, 'references'),
      declared: new Set(['references/notes/kept.md']),
      relativeTo: dir,
      check: false,
    });
    expect(stale.map((s) => s.file)).toEqual(['references/notes/orphan.md']);
    expect(existsSync(path.join(dir, 'references', 'notes', 'kept.md'))).toBe(true);
    expect(existsSync(path.join(dir, 'references', 'notes', 'orphan.md'))).toBe(false);
  });

  it('reports without deleting on a check run, and leaves empty dirs alone', () => {
    seed();
    mkdirSync(path.join(dir, 'references', 'schemas'), { recursive: true });
    const stale = reconcileTreeTo({
      root: path.join(dir, 'references'),
      declared: new Set(['references/notes/kept.md']),
      relativeTo: dir,
      check: true,
    });
    expect(stale).toHaveLength(1);
    expect(existsSync(path.join(dir, 'references', 'notes', 'orphan.md'))).toBe(true);
    // Pruning on a check run would mutate the tree a check promised not to touch — and the
    // deletion would not even show up in the report, since empty dirs are not listed files.
    expect(existsSync(path.join(dir, 'references', 'schemas'))).toBe(true);
  });

  // The guard that matters most. A bundle holds things a cast never wrote — harvested run
  // output, a note a human dropped in — and a sweep scoped to the whole bundle would delete
  // them. Nothing outside `root` is even looked at.
  it('never touches a sibling subtree the caster does not own', () => {
    seed();
    mkdirSync(path.join(dir, 'runs', 'run-1'), { recursive: true });
    writeFileSync(path.join(dir, 'runs', 'run-1', 'summary.json'), '{}');
    reconcileTreeTo({
      root: path.join(dir, 'references'),
      declared: new Set(['references/notes/kept.md']),
      relativeTo: dir,
      check: false,
    });
    expect(existsSync(path.join(dir, 'runs', 'run-1', 'summary.json'))).toBe(true);
  });

  it('prunes directories its own deletions emptied', () => {
    seed();
    const stale = reconcileTreeTo({
      root: path.join(dir, 'references'),
      declared: new Set<string>(),
      relativeTo: dir,
      check: false,
    });
    expect(stale).toHaveLength(2);
    expect(existsSync(path.join(dir, 'references', 'notes'))).toBe(false);
  });

  it('takes the wording for why a file is stale from the caller', () => {
    seed();
    const stale = reconcileTreeTo({
      root: path.join(dir, 'references'),
      declared: new Set(['references/notes/kept.md']),
      relativeTo: dir,
      reason: (rel) => `orphan (no ref claims ${rel})`,
      check: true,
    });
    expect(stale).toEqual([
      {
        file: 'references/notes/orphan.md',
        reason: 'orphan (no ref claims references/notes/orphan.md)',
      },
    ]);
  });

  it('is silent about a bundle that was never cast', () => {
    const stale = reconcileTreeTo({
      root: path.join(dir, 'never-cast'),
      declared: new Set<string>(),
      relativeTo: dir,
      check: false,
    });
    expect(stale).toEqual([]);
  });
});
