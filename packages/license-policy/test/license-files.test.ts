import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import {
  findLicenseFileById,
  licenseFileIdFromPath,
  loadLicenseFiles,
  redistributesUnder,
} from '../src/index.js';

const licenseDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'license-files-'));
fs.writeFileSync(path.join(licenseDirectory, 'nf-schema.LICENSE'), 'MIT text\n');
fs.writeFileSync(path.join(licenseDirectory, 'msmb.LICENSE'), 'CC text\n');
fs.writeFileSync(path.join(licenseDirectory, 'README.md'), 'not a license\n');

afterAll(() => fs.rmSync(licenseDirectory, { recursive: true, force: true }));

describe('licenseFileIdFromPath', () => {
  it('strips the directory and the extension', () => {
    expect(licenseFileIdFromPath('LICENSES/nf-schema.LICENSE')).toBe('nf-schema');
    expect(licenseFileIdFromPath('nf-schema.LICENSE')).toBe('nf-schema');
  });

  it('leaves a name with no extension alone', () => {
    expect(licenseFileIdFromPath('nf-schema')).toBe('nf-schema');
  });
});

describe('loadLicenseFiles', () => {
  it('reads every .LICENSE with its text', () => {
    const licenseFiles = loadLicenseFiles(licenseDirectory);
    expect(licenseFiles.map((licenseFile) => licenseFile.id)).toEqual(['msmb', 'nf-schema']);
    expect(licenseFiles.find((licenseFile) => licenseFile.id === 'nf-schema')?.text).toBe(
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

  it('does not answer to the SPDX id of the licence the file contains', () => {
    // The whole reason these are two named types. `msmb.LICENSE` holds CC-BY-NC-SA-2.0 text, and a
    // caller arriving here with a note's `license` value gets `undefined` — not an error, not the
    // wrong file, just a silent miss that reads as "this source vendored nothing".
    expect(findLicenseFileById(licenseDirectory, 'CC-BY-NC-SA-2.0')).toBeUndefined();
    expect(findLicenseFileById(licenseDirectory, 'MIT')).toBeUndefined();
  });
});

describe('redistributesUnder', () => {
  it('matches a note whose license_file is this copy', () => {
    expect(redistributesUnder('LICENSES/msmb.LICENSE', 'msmb')).toBe(true);
  });

  it('does not match another source vendoring the same licence', () => {
    // Two books under CC-BY-NC-SA-2.0 vendor two files. A copy is keyed by SOURCE, so one
    // source's page must not list the other's notes — which is exactly what the comparison
    // looked like it might do when both sides were called `licenseId`.
    expect(redistributesUnder('LICENSES/other-book.LICENSE', 'msmb')).toBe(false);
  });

  it('treats a note with no license_file as using no copy', () => {
    // 49 of one instance's 111 licensed notes are in this state: own-words summaries that
    // redistribute nothing and vendor nothing.
    expect(redistributesUnder(undefined, 'msmb')).toBe(false);
    expect(redistributesUnder(null, 'msmb')).toBe(false);
    expect(redistributesUnder('', 'msmb')).toBe(false);
  });
});
