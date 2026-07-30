import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { findLicenseFileById, licenseIdFromFilePath, loadLicenseFiles } from '../src/index.js';

const licenseDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'license-files-'));
fs.writeFileSync(path.join(licenseDirectory, 'nf-schema.LICENSE'), 'MIT text\n');
fs.writeFileSync(path.join(licenseDirectory, 'msmb.LICENSE'), 'CC text\n');
fs.writeFileSync(path.join(licenseDirectory, 'README.md'), 'not a license\n');

afterAll(() => fs.rmSync(licenseDirectory, { recursive: true, force: true }));

describe('licenseIdFromFilePath', () => {
  it('strips the directory and the extension', () => {
    expect(licenseIdFromFilePath('LICENSES/nf-schema.LICENSE')).toBe('nf-schema');
    expect(licenseIdFromFilePath('nf-schema.LICENSE')).toBe('nf-schema');
  });

  it('leaves a name with no extension alone', () => {
    expect(licenseIdFromFilePath('nf-schema')).toBe('nf-schema');
  });
});

describe('loadLicenseFiles', () => {
  it('reads every .LICENSE with its text', () => {
    const licenseFiles = loadLicenseFiles(licenseDirectory);
    expect(licenseFiles.map((licenseFile) => licenseFile.licenseId)).toEqual(['msmb', 'nf-schema']);
    expect(licenseFiles.find((licenseFile) => licenseFile.licenseId === 'nf-schema')?.text).toBe(
      'MIT text\n',
    );
  });

  it('ignores files that are not licenses', () => {
    expect(
      loadLicenseFiles(licenseDirectory).some(
        (licenseFile) => licenseFile.filename === 'README.md',
      ),
    ).toBe(false);
  });

  it('sorts by filename', () => {
    expect(loadLicenseFiles(licenseDirectory).map((licenseFile) => licenseFile.filename)).toEqual([
      'msmb.LICENSE',
      'nf-schema.LICENSE',
    ]);
  });

  it('keeps the filename frontmatter references', () => {
    expect(loadLicenseFiles(licenseDirectory)[0]?.filename).toBe('msmb.LICENSE');
  });

  it('throws when the directory is missing', () => {
    expect(() => loadLicenseFiles(path.join(licenseDirectory, 'nope'))).toThrow();
  });
});

describe('findLicenseFileById', () => {
  it('finds one by id', () => {
    expect(findLicenseFileById(licenseDirectory, 'msmb')?.text).toBe('CC text\n');
  });

  it('returns undefined for an id nothing carries', () => {
    expect(findLicenseFileById(licenseDirectory, 'nosuch')).toBeUndefined();
  });
});
