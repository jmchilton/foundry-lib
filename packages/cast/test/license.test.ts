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
