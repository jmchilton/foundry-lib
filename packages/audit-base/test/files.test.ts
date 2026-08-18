import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { writeJsonAtomic, writeTextAtomic } from '../src/files.js';

describe('atomic output files', () => {
  it('replaces an existing file without leaving sibling temporary files', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'audit-base-files-'));
    const pathname = path.join(directory, 'evidence.json');
    await writeTextAtomic(pathname, 'first\n');
    await writeJsonAtomic(pathname, { state: 'complete' });
    expect(await readFile(pathname, 'utf8')).toBe('{\n  "state": "complete"\n}\n');
    expect(await readdir(directory)).toEqual(['evidence.json']);
  });
});
