import { describe, it, expect } from 'vitest';

import {
  LICENSE_POLICY_FILE,
  LICENSE_REF_RE,
  allowsMode,
  bundledPolicy,
  bundledPolicyPath,
  bundledPolicyText,
  declaresVerbatimCarry,
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
    expect(licenseIds(policy).length).toBeGreaterThan(20);
    expect(Object.keys(policy.global_rules).length).toBeGreaterThan(0);
  });

  it('ships the ids both instances actually author against', () => {
    for (const licenseId of ['MIT', 'CC-BY-4.0', 'CC-BY-NC-4.0', 'GPL-3.0-only', 'Apache-2.0']) {
      expect(licenseIds(policy)).toContain(licenseId);
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
    const licenseRow = resolveLicenseRow(policy, 'MIT');
    expect(licenseRow.policy).toBe('verbatim-ok');
    expect(licenseRow.defect).toBeUndefined();
  });

  it('does not leak `default` into the curated id list', () => {
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

  it('never lets an own-words-only row permit a carry that copies text', () => {
    for (const [id, row] of rows) {
      if (row.policy === 'own-words-only') {
        expect(allowsMode(row, 'verbatim'), `${id} is own-words-only`).toBe(false);
        expect(allowsMode(row, 'sidecar'), `${id} is own-words-only`).toBe(false);
      }
    }
  });

  it('always lets a verbatim-ok row permit verbatim carry, and demands its notice', () => {
    for (const [id, row] of rows) {
      if (row.policy === 'verbatim-ok') {
        expect(allowsMode(row, 'verbatim'), `${id} is verbatim-ok`).toBe(true);
        expect(row.license_file, `${id} is verbatim-ok`).toBe(true);
      }
    }
  });

  // Scoped to verbatim-ok rows. An own-words-only row permitting nothing is now the point rather
  // than a defect: no mode makes such content lawful to pass through. Its emptiness is asserted
  // directly in `own-words-only rows permit no pass-through mode`, so between the two every row
  // is pinned to an exact expectation instead of merely to a non-empty one.
  it('gives every verbatim-ok row at least one mode it permits', () => {
    for (const [id, row] of rows) {
      if (row.policy === 'verbatim-ok') {
        expect(row.allowed_modes.length, `${id} permits no mode at all`).toBeGreaterThan(0);
      }
    }
  });

  it('never lets a copyleft row permit condense', () => {
    for (const [id, row] of rows) {
      if (row.copyleft) {
        expect(allowsMode(row, 'condense'), `${id} is copyleft`).toBe(false);
      }
    }
  });

  it('never requires a license_file for an own-words-only row', () => {
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
    const parsedPolicy = parseLicensePolicy(minimal);
    expect(licenseIds(parsedPolicy)).toEqual(['MIT']);
    expect(parsedPolicy.default.defect).toBe(true);
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
    const invalidPolicy = minimal.replace('policy: verbatim-ok', 'policy: whatever-ok');
    expect(() => parseLicensePolicy(invalidPolicy)).toThrow(/whatever-ok/);
  });

  it('rejects a row with an unknown cast mode', () => {
    const invalidPolicy = minimal.replace(
      '[verbatim, condense, sidecar]',
      '[verbatim, paraphrase]',
    );
    expect(() => parseLicensePolicy(invalidPolicy)).toThrow(/paraphrase/);
  });

  it('rejects a row missing a required field', () => {
    const incompletePolicy = minimal.replace('    license_file: true\n', '');
    expect(() => parseLicensePolicy(incompletePolicy)).toThrow(/license_file/);
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
    expect(parseLicensePolicy(bundledPolicyText())).toEqual(bundledPolicy());
  });

  it('loads a table from a directory holding one', () => {
    const policyDirectory = bundledPolicyPath().slice(0, -(LICENSE_POLICY_FILE.length + 1));
    const loadedPolicy: LicensePolicy = loadLicensePolicy(policyDirectory);
    expect(licenseIds(loadedPolicy)).toEqual(licenseIds(bundledPolicy()));
  });

  it('throws a path-naming error when the directory has no table', () => {
    expect(() => loadLicensePolicy('/definitely/not/a/repo')).toThrow(/definitely/);
  });
});

describe('declaresVerbatimCarry', () => {
  // Every distinct `derived` value in the corpus this was lifted from, so the regex is pinned to
  // real postures rather than to invented ones.
  it.each([
    ['own-words-summary', false],
    ['abstract-only-own-words-summary', false],
    ['attribution-check-own-words', false],
    ['license-aware-summary', true],
    ['faithful-summary-with-quotes', true],
    [
      'Verbatim load-bearing quotes permitted (CC-BY). Quotes in section 7 are exact from the preprint.',
      true,
    ],
    [
      'own-words paraphrase (license is non-CC); functional strings (formulas, parameter names, numeric thresholds) kept verbatim as facts',
      false,
    ],
  ])('reads %s as carrying=%s', (derived, expected) => {
    expect(declaresVerbatimCarry(derived as string)).toBe(expected);
  });

  // Not an authored note — a vendored schema, an upstream doc. Pass-through by default.
  it('treats an absent posture as pass-through', () => {
    expect(declaresVerbatimCarry(undefined)).toBe(true);
    expect(declaresVerbatimCarry(null)).toBe(true);
  });
});

describe('own-words-only rows permit no pass-through mode', () => {
  // `[condense]` named a mode no instance implements, and condensing at cast time would still
  // require the restricted text in the repository to condense from.
  it('leaves every own-words-only row empty', () => {
    const policy = bundledPolicy();
    const rows = [...Object.entries(policy.licenses), ['default', policy.default] as const];
    const offenders = rows
      .filter(([, row]) => row.policy === 'own-words-only' && row.allowed_modes.length > 0)
      .map(([id]) => id);
    expect(offenders).toEqual([]);
  });
});
