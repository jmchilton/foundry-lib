import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { findLicenseFile, licenseIdFromFile, loadLicenseFiles } from '../src/index.js';

// A real directory rather than a mocked fs: the thing under test is almost entirely
// "what does readdir hand back, and in what order", which a mock would simply assert
// back at itself.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'license-files-'));
fs.writeFileSync(path.join(dir, 'nf-schema.LICENSE'), 'MIT text\n');
fs.writeFileSync(path.join(dir, 'msmb.LICENSE'), 'CC text\n');
fs.writeFileSync(path.join(dir, 'README.md'), 'not a license\n');

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('licenseIdFromFile', () => {
  it('strips the directory and the extension', () => {
    expect(licenseIdFromFile('LICENSES/nf-schema.LICENSE')).toBe('nf-schema');
    expect(licenseIdFromFile('nf-schema.LICENSE')).toBe('nf-schema');
  });

  it('leaves a name with no extension alone', () => {
    expect(licenseIdFromFile('nf-schema')).toBe('nf-schema');
  });
});

describe('loadLicenseFiles', () => {
  it('reads every .LICENSE with its text', () => {
    const files = loadLicenseFiles(dir);
    expect(files.map((f) => f.id)).toEqual(['msmb', 'nf-schema']);
    expect(files.find((f) => f.id === 'nf-schema')?.text).toBe('MIT text\n');
  });

  it('ignores files that are not licenses', () => {
    expect(loadLicenseFiles(dir).some((f) => f.filename === 'README.md')).toBe(false);
  });

  // Sorted so the licenses index page has a stable order across machines; readdir does
  // not promise one.
  it('sorts by filename', () => {
    expect(loadLicenseFiles(dir).map((f) => f.filename)).toEqual([
      'msmb.LICENSE',
      'nf-schema.LICENSE',
    ]);
  });

  it('keeps the filename frontmatter references', () => {
    expect(loadLicenseFiles(dir)[0]?.filename).toBe('msmb.LICENSE');
  });

  it('throws when the directory is missing', () => {
    expect(() => loadLicenseFiles(path.join(dir, 'nope'))).toThrow();
  });
});

describe('findLicenseFile', () => {
  it('finds one by id', () => {
    expect(findLicenseFile(dir, 'msmb')?.text).toBe('CC text\n');
  });

  it('returns undefined for an id nothing carries', () => {
    expect(findLicenseFile(dir, 'nosuch')).toBeUndefined();
  });
});
