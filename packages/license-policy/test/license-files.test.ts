import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import {
  auditLicenseFiles,
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

describe('auditLicenseFiles', () => {
  // Named `LICENSES` rather than left as a mkdtemp stem, because the directory's own name is what
  // the path check defaults to and the instances both call it that.
  const auditRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'license-audit-'));
  const auditDirectory = path.join(auditRoot, 'LICENSES');
  fs.mkdirSync(auditDirectory);
  fs.writeFileSync(path.join(auditDirectory, 'CC-BY-4.0.LICENSE'), 'CC BY 4.0 text\n');
  fs.writeFileSync(path.join(auditDirectory, 'msmb.LICENSE'), 'CC BY-NC-SA text\n');

  afterAll(() => fs.rmSync(auditRoot, { recursive: true, force: true }));

  const carriers = [
    { source: 'content/papers/a.md', licenseFile: 'LICENSES/CC-BY-4.0.LICENSE' },
    { source: 'content/books/msmb/book.yml', licenseFile: 'LICENSES/msmb.LICENSE' },
  ];

  it('finds nothing when every copy is declared and every declaration resolves', () => {
    expect(auditLicenseFiles({ licenseDirectory: auditDirectory, declarations: carriers })).toEqual(
      [],
    );
  });

  it('ignores a declaration that carries no copy', () => {
    // The common case: own-words notes outnumber verbatim ones, and none of them is a finding.
    expect(
      auditLicenseFiles({
        licenseDirectory: auditDirectory,
        declarations: [
          ...carriers,
          { source: 'content/papers/own-words.md' },
          { source: 'content/papers/explicitly-none.md', licenseFile: null },
          { source: 'content/papers/blank.md', licenseFile: '' },
        ],
      }),
    ).toEqual([]);
  });

  it('reports a declaration whose copy was never vendored', () => {
    const findings = auditLicenseFiles({
      licenseDirectory: auditDirectory,
      declarations: [
        ...carriers,
        { source: 'content/papers/b.md', licenseFile: 'LICENSES/MIT.LICENSE' },
      ],
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.code).toBe('missing-copy');
    expect(findings[0]?.licenseFileId).toBe('MIT');
    expect(findings[0]?.source).toBe('content/papers/b.md');
  });

  it('reports a copy that resolves by basename from outside the directory', () => {
    // The failure this exists for: `licenseFileIdFromPath` reads the stem, so a singular `LICENSE/`
    // typo and a bare filename both find the right text while sending a reader nowhere.
    const findings = auditLicenseFiles({
      licenseDirectory: auditDirectory,
      declarations: [
        { source: 'content/papers/typo.md', licenseFile: 'LICENSE/CC-BY-4.0.LICENSE' },
        { source: 'content/books/msmb/book.yml', licenseFile: 'msmb.LICENSE' },
      ],
    });
    expect(findings.map((finding) => finding.code)).toEqual(['unexpected-path', 'unexpected-path']);
    expect(findings.map((finding) => finding.source)).toEqual([
      'content/papers/typo.md',
      'content/books/msmb/book.yml',
    ]);
  });

  it('accepts a licence directory nested under another path', () => {
    expect(
      auditLicenseFiles({
        licenseDirectory: auditDirectory,
        declarations: [
          { source: 'content/papers/a.md', licenseFile: 'content/LICENSES/CC-BY-4.0.LICENSE' },
          { source: 'content/books/msmb/book.yml', licenseFile: 'LICENSES/msmb.LICENSE' },
        ],
      }),
    ).toEqual([]);
  });

  it('skips the path check when declarations carry a bare id', () => {
    expect(
      auditLicenseFiles({
        licenseDirectory: auditDirectory,
        declarations: [
          { source: 'a', licenseFile: 'CC-BY-4.0' },
          { source: 'b', licenseFile: 'msmb' },
        ],
        directoryName: null,
      }),
    ).toEqual([]);
  });

  it('reports a vendored copy nothing declares', () => {
    // The reverse direction, and the one a forward-only check leaves to rot: the note that carried
    // msmb was rewritten to own words and its licence text stayed behind.
    const findings = auditLicenseFiles({
      licenseDirectory: auditDirectory,
      declarations: [carriers[0]!],
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.code).toBe('unused-copy');
    expect(findings[0]?.licenseFileId).toBe('msmb');
    expect(findings[0]?.source).toBeUndefined();
  });

  it('reports a copy that is present but blank', () => {
    const blankRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'license-blank-'));
    const blankDirectory = path.join(blankRoot, 'LICENSES');
    fs.mkdirSync(blankDirectory);
    fs.writeFileSync(path.join(blankDirectory, 'MIT.LICENSE'), '   \n\n');

    const findings = auditLicenseFiles({
      licenseDirectory: blankDirectory,
      declarations: [{ source: 'content/packages/x.md', licenseFile: 'LICENSES/MIT.LICENSE' }],
    });
    expect(findings.map((finding) => finding.code)).toEqual(['empty-copy']);

    fs.rmSync(blankRoot, { recursive: true, force: true });
  });

  it('audits a missing directory instead of throwing', () => {
    // The state an instance is in the moment before it vendors its first copy. `loadLicenseFiles`
    // throws here by design; an audit that did the same would say ENOENT where it could say which
    // declarations are unmet.
    const findings = auditLicenseFiles({
      licenseDirectory: path.join(auditRoot, 'nope'),
      declarations: carriers,
    });
    expect(findings.map((finding) => finding.code)).toEqual(['missing-copy', 'missing-copy']);
  });

  it('finds nothing for an instance that vendors nothing and declares nothing', () => {
    expect(
      auditLicenseFiles({ licenseDirectory: path.join(auditRoot, 'nope'), declarations: [] }),
    ).toEqual([]);
  });

  it('orders findings deterministically', () => {
    const findings = auditLicenseFiles({
      licenseDirectory: auditDirectory,
      declarations: [
        { source: 'z.md', licenseFile: 'LICENSES/ZZZ.LICENSE' },
        { source: 'a.md', licenseFile: 'LICENSES/AAA.LICENSE' },
      ],
    });
    expect(findings.map((finding) => `${finding.code}:${finding.licenseFileId}`)).toEqual([
      'missing-copy:AAA',
      'missing-copy:ZZZ',
      'unused-copy:CC-BY-4.0',
      'unused-copy:msmb',
    ]);
  });
});
