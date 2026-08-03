import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { bundledPolicy } from '@galaxy-foundry/license-policy';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { applyLicensePolicy } from '../src/license.js';
import type { ProvenanceRefEntry } from '../src/provenance.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'cast-license-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function entry(overrides: Partial<ProvenanceRefEntry> = {}): ProvenanceRefEntry {
  return {
    kind: 'research',
    mode: 'verbatim',
    ref: '[[note]]',
    src: 'content/research/note.md',
    dst: 'references/notes/note.md',
    used_at: 'runtime',
    load: 'upfront',
    src_hash: 'a',
    dst_hash: 'a',
    source: 'deterministic',
    ...overrides,
  };
}

describe('refs the policy does not cover', () => {
  it('never consults the table when nothing is redistributed', () => {
    // Foundry-authored notes fall under the repository's own LICENSE. Passing a policy that
    // would throw on use proves the table is not even read.
    const wouldThrow = new Proxy({} as ReturnType<typeof bundledPolicy>, {
      get() {
        throw new Error('the policy table was consulted for an unlicensed ref');
      },
    });
    expect(applyLicensePolicy([entry(), entry()], dir, wouldThrow)).toEqual([]);
  });
});

describe('the mode a license permits', () => {
  it('accepts a permissive license carried verbatim', () => {
    expect(applyLicensePolicy([entry({ license: 'CC-BY-4.0' })], dir)).toEqual([]);
  });

  it('names the license, its policy, the mode and the alternatives', () => {
    const errors = applyLicensePolicy([entry({ license: 'CC-BY-NC-4.0' })], dir);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('content/research/note.md');
    expect(errors[0]).toContain('CC-BY-NC-4.0');
    expect(errors[0]).toContain('mode=verbatim');
  });

  it('refuses an unknown license, because it resolves to the defect row', () => {
    expect(applyLicensePolicy([entry({ license: 'NoSuchLicense-9.9' })], dir)).toHaveLength(1);
  });
});

describe('stamping the license file', () => {
  it('records the hash of the file the ref redistributes under', () => {
    mkdirSync(path.join(dir, 'LICENSES'), { recursive: true });
    writeFileSync(path.join(dir, 'LICENSES', 'CC-BY-4.0.txt'), 'the license text\n');
    const e = entry({ license: 'CC-BY-4.0', license_file: 'LICENSES/CC-BY-4.0.txt' });
    expect(applyLicensePolicy([e], dir)).toEqual([]);
    expect(e.license_file_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('reports a declared license file that is not there', () => {
    const e = entry({ license: 'CC-BY-4.0', license_file: 'LICENSES/absent.txt' });
    const errors = applyLicensePolicy([e], dir);
    expect(errors).toEqual(['content/research/note.md: license_file missing: LICENSES/absent.txt']);
    expect(e.license_file_hash).toBeUndefined();
  });

  it('reports every violation rather than stopping at the first', () => {
    const errors = applyLicensePolicy(
      [
        entry({ license: 'CC-BY-4.0', license_file: 'LICENSES/absent.txt' }),
        entry({
          src: 'content/research/other.md',
          license: 'CC-BY-4.0',
          license_file: 'LICENSES/gone.txt',
        }),
      ],
      dir,
    );
    expect(errors).toHaveLength(2);
  });
});

describe('own-words notes about a licensed source', () => {
  // The corpus this was written against records the SOURCE's license on notes that are the
  // Foundry's own summaries of it — 33 all-rights-reserved and 20 NC sources, none of whose text
  // survives into the note. Keying the check on `mode` policed those notes as though they were
  // the papers, and no mode could satisfy it: own-words-only rows permit nothing to pass through.
  it('carries an own-words summary of an all-rights-reserved paper', () => {
    const errors = applyLicensePolicy(
      [entry({ license: 'LicenseRef-all-rights-reserved', derived: 'own-words-summary' })],
      dir,
    );
    expect(errors).toEqual([]);
  });

  it('carries an abstract-only summary of an NC paper', () => {
    const errors = applyLicensePolicy(
      [entry({ license: 'CC-BY-NC-ND-4.0', derived: 'abstract-only-own-words-summary' })],
      dir,
    );
    expect(errors).toEqual([]);
  });

  // functional_strings_verbatim: facts and short identifiers are not copyrightable expression, so
  // a posture naming both readings resolves to own-words rather than to the verbatim signal.
  it('reads own-words as winning over a verbatim signal in the same posture', () => {
    const errors = applyLicensePolicy(
      [
        entry({
          license: 'LicenseRef-arXiv-nonexclusive-distrib-1.0',
          derived:
            'own-words paraphrase (license is non-CC); functional strings (formulas, parameter names, numeric thresholds) kept verbatim as facts',
        }),
      ],
      dir,
    );
    expect(errors).toEqual([]);
  });
});

describe('notes that do reproduce upstream expression', () => {
  // The exemption is not a bypass. A posture that keeps load-bearing quotes carries protected
  // expression, and the row still governs it.
  it('refuses quote-bearing carry under an own-words-only license', () => {
    const errors = applyLicensePolicy(
      [entry({ license: 'CC-BY-NC-4.0', derived: 'faithful-summary-with-quotes' })],
      dir,
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/forbids mode=verbatim/);
  });

  it('allows quote-bearing carry under a permissive license', () => {
    const errors = applyLicensePolicy(
      [entry({ license: 'CC-BY-4.0', derived: 'faithful-summary-with-quotes' })],
      dir,
    );
    expect(errors).toEqual([]);
  });

  // A vendored schema or upstream doc is not an authored note, so it declares no posture. It must
  // stay pass-through by default rather than inheriting the exemption — global_rules.default_deny.
  it('still polices a ref that declares no posture at all', () => {
    const errors = applyLicensePolicy([entry({ license: 'LicenseRef-all-rights-reserved' })], dir);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/summarize at ingestion instead/);
  });
});

describe('license_file hashing is provenance, not permission', () => {
  // 64 notes in the second instance's corpus are own-words summaries that still declare a
  // license_file. Exempting them from the MODE check must not stop recording what they cite —
  // lifting the whole entry out of the function would have dropped every one of those hashes.
  it('stamps the hash for an exempt own-words note', () => {
    mkdirSync(path.join(dir, 'LICENSES'), { recursive: true });
    writeFileSync(path.join(dir, 'LICENSES', 'CC-BY-NC-4.0.txt'), 'nc terms\n');
    const entries = [
      entry({
        license: 'CC-BY-NC-4.0',
        derived: 'own-words-summary',
        license_file: 'LICENSES/CC-BY-NC-4.0.txt',
      }),
    ];
    expect(applyLicensePolicy(entries, dir)).toEqual([]);
    expect(entries[0]?.license_file_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('still reports a license_file that does not exist', () => {
    const entries = [
      entry({
        license: 'CC-BY-NC-4.0',
        derived: 'own-words-summary',
        license_file: 'LICENSES/missing.txt',
      }),
    ];
    expect(applyLicensePolicy(entries, dir)).toEqual([
      'content/research/note.md: license_file missing: LICENSES/missing.txt',
    ]);
  });
});
