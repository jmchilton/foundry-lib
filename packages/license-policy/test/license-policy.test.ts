import { describe, it, expect } from 'vitest';

import {
  LICENSE_POLICY_FILE,
  LICENSE_REF_RE,
  SUMMARY_POSTURES,
  bundledPolicy,
  bundledPolicyPath,
  bundledPolicyText,
  declaresVerbatimCarry,
  isSummaryPosture,
  isValidLicenseId,
  licenseIds,
  loadLicensePolicy,
  parseLicensePolicy,
  postureCarriesVerbatim,
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
    for (const licenseId of [
      'MIT',
      'CC-BY-4.0',
      'CC-BY-NC-4.0',
      'GPL-3.0-only',
      'Apache-2.0',
      // The `-or-later` GPL 3 form and the AGPL are what upstream TDA libraries actually declare
      // — RIVET, giotto-ph, pyflagser. An id absent from the table resolves to `default`, so an
      // instance profiling them had to either misstate the licence or reach for a `LicenseRef-`
      // naming an id SPDX already lists.
      'GPL-3.0-or-later',
      'AGPL-3.0-or-later',
      // What a CC BY-SA article declares. Nothing else in the table places it: the CC BY rows stop
      // at attribution, and CC-BY-NC-SA-2.0 is reachable only by also asserting a non-commercial
      // term the work does not carry.
      'CC-BY-SA-4.0',
    ]) {
      expect(licenseIds(policy)).toContain(licenseId);
    }
  });

  // Share-alike and non-commercial are different kinds of obligation and the table must not
  // collapse them. Isolation answers copyleft — only the file holding the carried text inherits
  // the licence — which is why the GPL rows carry. NC restricts use rather than licensing, so no
  // file boundary contains it. CC BY-SA therefore belongs beside the GPL and not beside the NC rows.
  it('answers share-alike by isolation, the way it answers the GPL', () => {
    const gpl = resolveLicenseRow(policy, 'GPL-3.0-or-later');
    const shareAlike = resolveLicenseRow(policy, 'CC-BY-SA-4.0');
    const nonCommercial = resolveLicenseRow(policy, 'CC-BY-NC-SA-2.0');

    expect(shareAlike.policy).toBe(gpl.policy);
    expect(shareAlike.copyleft).toBe(true);
    expect(shareAlike.license_file).toBe(true);
    expect(shareAlike.defect).toBeUndefined();
    expect(shareAlike.obligations).toMatch(/isolate/);

    // The NC row carries the share-alike term too, and still refuses carry — for the other reason.
    expect(nonCommercial.policy).toBe('own-words-only');
    expect(shareAlike.policy).not.toBe(nonCommercial.policy);
  });

  // The AGPL differs from the GPL in an obligation on RUNNING the software, never on carrying its
  // text, so it must not arrive as a stricter row than the GPL 3 one beside it.
  it('answers the AGPL the way it answers the GPL', () => {
    const gpl = resolveLicenseRow(policy, 'GPL-3.0-or-later');
    const agpl = resolveLicenseRow(policy, 'AGPL-3.0-or-later');

    expect(agpl.policy).toBe(gpl.policy);
    expect(agpl.license_file).toBe(gpl.license_file);
    expect(agpl.copyleft).toBe(gpl.copyleft);
    expect(agpl.defect).toBeUndefined();
    expect(agpl.obligations).toMatch(/network/);
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

  it('names an uncurated LicenseRef after itself, without softening the policy', () => {
    const licenseRow = resolveLicenseRow(policy, 'LicenseRef-yale-non-commercial');

    // The terms are still unknown, so the deny-by-default answer is unchanged.
    expect(licenseRow.policy).toBe('own-words-only');
    expect(licenseRow.defect).toBe(true);
    expect(licenseRow.license_file).toBe(false);
    expect(licenseRow.obligations).toBe(policy.default.obligations);

    // Only the label differs: the licence is resolved, so it may not read as unresolved.
    expect(licenseRow.name).toBe('yale-non-commercial');
    expect(licenseRow.name).not.toBe(policy.default.name);
  });

  it('prefers a curated row over the ref that names it', () => {
    const licenseRow = resolveLicenseRow(policy, 'LicenseRef-arXiv-nonexclusive-distrib-1.0');
    expect(licenseRow).toBe(policy.licenses['LicenseRef-arXiv-nonexclusive-distrib-1.0']);
    expect(licenseRow.name).toBe('arXiv non-exclusive distribution 1.0');
    expect(licenseRow.defect).toBeUndefined();
  });

  /** A ref-shaped id is the only exception; every other unplaceable id keeps the shared row. */
  it('leaves the default row itself untouched', () => {
    expect(resolveLicenseRow(policy, 'LicenseRef-')).toBe(policy.default);
    expect(policy.default.name).toBe('unresolved / missing');
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

  it('demands a notice from every verbatim-ok row', () => {
    for (const [id, row] of rows) {
      if (row.policy === 'verbatim-ok') {
        expect(row.license_file, `${id} is verbatim-ok`).toBe(true);
      }
    }
  });

  // A row says what a license permits; it does not name casting transforms. `allowed_modes` used
  // to, and it was derivable from (`policy`, `copyleft`) on every row — two other fields restated
  // in a vocabulary borrowed from casting. Asserted rather than merely deleted so the column
  // cannot reappear one row at a time.
  it('names no casting transform on any row', () => {
    for (const [id, row] of [...rows, ['default', policy.default] as const]) {
      expect(Object.keys(row), `${id}`).not.toContain('allowed_modes');
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
    license_file: true
    copyleft: false
    obligations: keep the notice
default:
  name: unresolved
  policy: own-words-only
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

  /**
   * The boundary the uncurated-ref branch has to respect: it may supply an identity the table
   * cannot have, and it may not answer a policy question the table already answered. An instance
   * whose default row says "ask us first" means that most for the ids it never curated.
   */
  it("names an uncurated ref without overruling this table's own default row", () => {
    const parsedPolicy = parseLicensePolicy(minimal);
    const licenseRow = resolveLicenseRow(parsedPolicy, 'LicenseRef-house-terms');

    expect(licenseRow.name).toBe('house-terms');

    const { name: _name, ...policyFields } = licenseRow;
    const { name: _defaultName, ...defaultPolicyFields } = parsedPolicy.default;
    expect(policyFields).toEqual(defaultPolicyFields);
    expect(licenseRow.obligations).toBe('resolve it');
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

  // The canonical postures must not depend on the free-text fallback to be read correctly.
  it('agrees with the closed vocabulary on every canonical posture', () => {
    for (const posture of SUMMARY_POSTURES) {
      expect(declaresVerbatimCarry(posture)).toBe(postureCarriesVerbatim(posture));
    }
  });
});

describe('SUMMARY_POSTURES', () => {
  it('names the two postures a source note may declare', () => {
    expect([...SUMMARY_POSTURES]).toEqual(['own-words-summary', 'verbatim-quotes-summary']);
  });

  it('reads each posture exactly, without pattern matching', () => {
    expect(postureCarriesVerbatim('own-words-summary')).toBe(false);
    expect(postureCarriesVerbatim('verbatim-quotes-summary')).toBe(true);
  });

  // The spellings this replaces. Each was a real `derived` value in some instance or doc, and the
  // free-text predicate still reads them so a Cast ref keeps working; none is a posture a note may
  // now declare.
  it.each([
    'license-aware-summary',
    'license-aware-with-quotes',
    'faithful-summary-with-quotes',
    'abstract-only-own-words-summary',
  ])('does not admit the superseded spelling %s', (legacy) => {
    expect(isSummaryPosture(legacy)).toBe(false);
  });

  it('rejects a non-string', () => {
    expect(isSummaryPosture(undefined)).toBe(false);
    expect(isSummaryPosture(7)).toBe(false);
  });
});
