import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { copyVerbatim, pruneEmptyDirs } from '../src/bundle.js';

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
