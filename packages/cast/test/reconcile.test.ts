import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  driftOf,
  recordedHash,
  reconcile,
  reconcileText,
  sha256Text,
  type Drift,
} from '../src/reconcile.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'cast-reconcile-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('detecting drift', () => {
  it('reports a matching file as no drift, and carries both hashes', () => {
    const file = path.join(dir, 'a.txt');
    writeFileSync(file, 'hello');
    const drift = driftOf(file, sha256Text('hello'), 'a.txt');
    expect(drift.reason).toBeUndefined();
    expect(drift.currentHash).toBe(sha256Text('hello'));
    expect(drift.expectedHash).toBe(sha256Text('hello'));
  });

  it('distinguishes a missing file from a drifted one', () => {
    const missing = driftOf(path.join(dir, 'gone.txt'), sha256Text('hello'), 'gone.txt');
    expect(missing.reason).toBe('gone.txt missing');
    expect(missing.currentHash).toBeNull();

    const file = path.join(dir, 'stale.txt');
    writeFileSync(file, 'old');
    const drifted = driftOf(file, sha256Text('new'), 'stale.txt');
    expect(drifted.reason).toBe('stale.txt content drifted');
    expect(drifted.currentHash).toBe(sha256Text('old'));
  });
});

describe('reconciling', () => {
  it('writes when the file is out of sync', () => {
    const file = path.join(dir, 'a.txt');
    writeFileSync(file, 'old');
    reconcileText({ path: file, expected: 'new', label: 'a.txt', check: false });
    expect(readFileSync(file, 'utf8')).toBe('new');
  });

  it('leaves the file alone when it already matches', () => {
    const file = path.join(dir, 'a.txt');
    writeFileSync(file, 'same');
    let wrote = false;
    reconcile({
      path: file,
      expectedHash: sha256Text('same'),
      label: 'a.txt',
      check: false,
      write: () => {
        wrote = true;
      },
    });
    expect(wrote).toBe(false);
  });

  it('never writes under --check', () => {
    const file = path.join(dir, 'a.txt');
    writeFileSync(file, 'old');
    const drift = reconcileText({ path: file, expected: 'new', label: 'a.txt', check: true });
    expect(drift.reason).toBe('a.txt content drifted');
    expect(readFileSync(file, 'utf8')).toBe('old');
  });

  it('creates the parent directory on write, and only on write', () => {
    const nested = path.join(dir, 'refs', 'notes', 'a.md');

    reconcileText({ path: nested, expected: 'body', label: 'a.md', check: true });
    // A check run that created the directory would make the NEXT check pass for the wrong
    // reason: the bundle would exist without ever having been cast.
    expect(existsSync(path.dirname(nested))).toBe(false);

    reconcileText({ path: nested, expected: 'body', label: 'a.md', check: false });
    expect(readFileSync(nested, 'utf8')).toBe('body');
  });
});

describe('what provenance records', () => {
  const drifted: Drift = { reason: 'drifted', currentHash: 'on-disk', expectedHash: 'wanted' };
  const clean: Drift = { currentHash: 'wanted', expectedHash: 'wanted' };

  it('records what a check run FOUND, not what it wanted', () => {
    expect(recordedHash(drifted, true)).toBe('on-disk');
  });

  it('records the expected hash once the bytes have been written', () => {
    expect(recordedHash(drifted, false)).toBe('wanted');
    expect(recordedHash(clean, true)).toBe('wanted');
    expect(recordedHash(clean, false)).toBe('wanted');
  });
});
