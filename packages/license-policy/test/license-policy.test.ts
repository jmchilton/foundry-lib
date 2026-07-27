// The table is the product; the loader is packaging around it. So the assertions
// split in two: structural rules the loader must enforce on ANY table it is handed,
// and invariants the SHIPPED table must satisfy — the ones that make a row
// meaningful rather than merely well-formed.

import { describe, it, expect } from 'vitest';

import {
  LICENSE_POLICY_FILE,
  LICENSE_REF_RE,
  allowsMode,
  bundledPolicy,
  bundledPolicyPath,
  bundledPolicyText,
  isValidLicenseId,
  licenseIds,
  loadLicensePolicy,
  parseLicensePolicy,
  resolveLicenseRow,
  type LicensePolicy,
} from '../src/index.js';

describe('the bundled table', () => {
  const policy = bundledPolicy();

  it('is version 1 and carries the curated rows', () => {
    expect(policy.version).toBe(1);
    // A guard against a path change turning every assertion below vacuous: an
    // empty table would satisfy each per-row invariant trivially.
    expect(licenseIds(policy).length).toBeGreaterThan(20);
    expect(Object.keys(policy.global_rules).length).toBeGreaterThan(0);
  });

  it('ships the ids both instances actually author against', () => {
    // Not an exhaustive list — a spot-check that the shipped table is the real
    // one and not a fixture that happened to parse.
    for (const id of ['MIT', 'CC-BY-4.0', 'CC-BY-NC-4.0', 'GPL-3.0-only', 'Apache-2.0']) {
      expect(licenseIds(policy)).toContain(id);
    }
  });

  it('resolves an unknown or missing id to the default row', () => {
    const fallback = policy.default;
    expect(fallback.policy).toBe('own-words-only');
    expect(fallback.defect).toBe(true);

    expect(resolveLicenseRow(policy, 'NoSuchLicense-9.9')).toBe(fallback);
    expect(resolveLicenseRow(policy, undefined)).toBe(fallback);
    expect(resolveLicenseRow(policy, null)).toBe(fallback);
    expect(resolveLicenseRow(policy, '')).toBe(fallback);
  });

  it('resolves a known id to its own row', () => {
    const row = resolveLicenseRow(policy, 'MIT');
    expect(row.policy).toBe('verbatim-ok');
    expect(row.defect).toBeUndefined();
  });

  it('does not leak `default` into the curated id list', () => {
    // `default` is a sibling key of `licenses:`, not a row inside it. If it ever
    // leaked in, `default` would validate as a license id in every instance.
    expect(licenseIds(policy)).not.toContain('default');
    expect(isValidLicenseId(policy, 'default')).toBe(false);
  });
});

describe('id validation', () => {
  const policy = bundledPolicy();

  it('accepts a curated SPDX id', () => {
    expect(isValidLicenseId(policy, 'MIT')).toBe(true);
  });

  it('accepts the LicenseRef escape hatch', () => {
    expect(isValidLicenseId(policy, 'LicenseRef-all-rights-reserved')).toBe(true);
    expect(isValidLicenseId(policy, 'LicenseRef-arXiv-nonexclusive-distrib-1.0')).toBe(true);
    expect(LICENSE_REF_RE.test('LicenseRef-x')).toBe(true);
  });

  it('rejects an unknown id, a malformed ref, and the empty string', () => {
    expect(isValidLicenseId(policy, 'NoSuchLicense-9.9')).toBe(false);
    expect(isValidLicenseId(policy, 'LicenseRef-')).toBe(false);
    expect(isValidLicenseId(policy, 'licenseref-lowercase')).toBe(false);
    expect(isValidLicenseId(policy, '')).toBe(false);
  });
});

describe('table invariants — what makes a row meaningful', () => {
  const policy = bundledPolicy();
  const rows = Object.entries(policy.licenses);

  it('never lets an own-words-only row permit verbatim carry', () => {
    // The whole point of the policy column. A row breaking this would silently
    // authorize the redistribution the table exists to prevent.
    for (const [id, row] of rows) {
      if (row.policy === 'own-words-only') {
        expect(allowsMode(row, 'verbatim'), `${id} is own-words-only`).toBe(false);
      }
    }
  });

  it('always lets a verbatim-ok row permit verbatim carry', () => {
    for (const [id, row] of rows) {
      if (row.policy === 'verbatim-ok') {
        expect(allowsMode(row, 'verbatim'), `${id} is verbatim-ok`).toBe(true);
      }
    }
  });

  it('never lets a copyleft row permit condense', () => {
    // Header rule: condensing a copyleft source into own words is copyleft
    // laundering, so copyleft rows get verbatim + sidecar only.
    for (const [id, row] of rows) {
      if (row.copyleft) {
        expect(allowsMode(row, 'condense'), `${id} is copyleft`).toBe(false);
      }
    }
  });

  it('never requires a license_file for an own-words-only row', () => {
    // Nothing is redistributed verbatim, so there is no notice obligation to
    // honor — `license_file_tracks_verbatim` in global_rules.
    for (const [id, row] of rows) {
      if (row.policy === 'own-words-only') {
        expect(row.license_file, `${id} is own-words-only`).toBe(false);
      }
    }
  });

  it('gives every row a non-empty obligations note', () => {
    for (const [id, row] of rows) {
      expect(row.obligations.length, `${id} obligations`).toBeGreaterThan(0);
    }
  });
});

describe('parsing an arbitrary table', () => {
  const minimal = `
version: 1
global_rules: {}
licenses:
  MIT:
    name: MIT
    policy: verbatim-ok
    allowed_modes: [verbatim, condense, sidecar]
    license_file: true
    copyleft: false
    obligations: keep the notice
default:
  name: unresolved
  policy: own-words-only
  allowed_modes: [condense]
  license_file: false
  copyleft: false
  defect: true
  obligations: resolve it
`;

  it('accepts a well-formed table', () => {
    const parsed = parseLicensePolicy(minimal);
    expect(licenseIds(parsed)).toEqual(['MIT']);
    expect(parsed.default.defect).toBe(true);
  });

  it.each([
    ['not a mapping', 'just a string'],
    ['no licenses block', 'version: 1\ndefault:\n  name: x'],
    ['no default row', 'version: 1\nlicenses:\n  MIT:\n    name: MIT'],
    ['empty document', ''],
  ])('rejects a table with %s', (_label, text) => {
    expect(() => parseLicensePolicy(text)).toThrow();
  });

  it('rejects a row with an unknown policy value', () => {
    const bad = minimal.replace('policy: verbatim-ok', 'policy: whatever-ok');
    expect(() => parseLicensePolicy(bad)).toThrow(/whatever-ok/);
  });

  it('rejects a row with an unknown cast mode', () => {
    const bad = minimal.replace('[verbatim, condense, sidecar]', '[verbatim, paraphrase]');
    expect(() => parseLicensePolicy(bad)).toThrow(/paraphrase/);
  });

  it('rejects a row missing a required field', () => {
    const bad = minimal.replace('    license_file: true\n', '');
    expect(() => parseLicensePolicy(bad)).toThrow(/license_file/);
  });

  it('names the source in the error, so a caller knows which file failed', () => {
    expect(() => parseLicensePolicy('nope', '/some/where/license-policy.yml')).toThrow(
      /\/some\/where\/license-policy\.yml/,
    );
  });
});

describe('locating a table on disk', () => {
  it('exposes the bundled copy by path, and it round-trips', () => {
    expect(bundledPolicyPath().endsWith(LICENSE_POLICY_FILE)).toBe(true);
    // The text accessor is what an instance's conformance test string-compares
    // against its own copy, so it must be the same bytes the parser saw.
    expect(parseLicensePolicy(bundledPolicyText())).toEqual(bundledPolicy());
  });

  it('loads a table from a directory holding one', () => {
    const dir = bundledPolicyPath().slice(0, -(LICENSE_POLICY_FILE.length + 1));
    const loaded: LicensePolicy = loadLicensePolicy(dir);
    expect(licenseIds(loaded)).toEqual(licenseIds(bundledPolicy()));
  });

  it('throws a path-naming error when the directory has no table', () => {
    expect(() => loadLicensePolicy('/definitely/not/a/repo')).toThrow(/definitely/);
  });
});
