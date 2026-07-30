import { describe, it, expect } from 'vitest';

import {
  CONTRACT_GROUPS,
  INHERITED_GROUPS,
  REFERENCE_CONTRACT_FILE,
  bundledContractPath,
  bundledContractText,
  bundledVocabularies,
  buildReferenceContract,
  contractKeys,
  findReferenceContractPath,
  loadInstanceKinds,
  parseInheritedVocabularies,
  type KindTerm,
} from '../src/index.js';

import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const SPEC_URL =
  'https://github.com/galaxyproject/foundry-pattern/blob/main/content/pattern/anatomy-of-an-instance.md';

const kinds: Record<string, KindTerm> = {
  pattern: { label: 'Pattern', description: 'A domain pattern page.', ref_shape: 'wiki-link' },
};

describe('the bundled vocabularies', () => {
  const inherited = bundledVocabularies();

  it('ships the four groups every instance inherits, and not `kinds`', () => {
    expect(Object.keys(inherited).sort()).toEqual([...INHERITED_GROUPS].sort());
    expect(inherited).not.toHaveProperty('kinds');
  });

  it('ships the terms both instances actually author against', () => {
    expect(Object.keys(inherited.used_at)).toEqual(['cast-time', 'runtime', 'both']);
    expect(Object.keys(inherited.load)).toEqual(['upfront', 'on-demand']);
    expect(Object.keys(inherited.modes)).toEqual(['verbatim', 'condense', 'sidecar']);
    expect(Object.keys(inherited.evidence)).toEqual([
      'hypothesis',
      'corpus-observed',
      'cast-validated',
    ]);
  });

  it('gives every term a label and a non-empty description', () => {
    for (const group of INHERITED_GROUPS) {
      for (const [id, term] of Object.entries(inherited[group])) {
        expect(term.label, `${group}.${id} label`).toBeTruthy();
        expect(term.description.length, `${group}.${id} description`).toBeGreaterThan(0);
      }
    }
  });

  it('gives every term the spec link, from one `spec_url` rather than twelve copies', () => {
    expect(bundledContractText().match(/spec_url/g)).toHaveLength(1);
    for (const group of INHERITED_GROUPS) {
      for (const [id, term] of Object.entries(inherited[group])) {
        expect(term.href, `${group}.${id}`).toBe(SPEC_URL);
      }
    }
  });

  it('keeps the enforced rules the reconciled glosses spell out', () => {
    expect(inherited.load['on-demand']?.description).toContain('Requires a `trigger`');
    expect(inherited.evidence['hypothesis']?.description).toContain('Requires a `verification`');
    expect(inherited.modes['verbatim']?.description).toContain(
      'License must permit verbatim carry',
    );
  });

  it('keeps the vocabulary domain-neutral', () => {
    const prose = INHERITED_GROUPS.flatMap((group) =>
      Object.values(inherited[group]).map((term) => `${term.label} ${term.description}`),
    ).join(' ');
    for (const word of ['workflow', 'Galaxy', 'genomic', 'statistical', 'Nextflow']) {
      expect(prose, `mentions \`${word}\``).not.toContain(word);
    }
  });
});

describe('composing an instance contract', () => {
  it('puts the instance kinds in front of the inherited four', () => {
    const contract = buildReferenceContract({ kinds });
    expect(Object.keys(contract)).toEqual([...CONTRACT_GROUPS]);
    expect(contract.kinds).toEqual(kinds);
    expect(contract.modes).toEqual(bundledVocabularies().modes);
  });

  it('refuses an instance that declares no kinds', () => {
    expect(() => buildReferenceContract({ kinds: {} })).toThrow(/`kinds` is empty/);
  });

  it('narrows an inherited group to what the instance supports', () => {
    const contract = buildReferenceContract({ kinds, narrow: { modes: ['verbatim', 'sidecar'] } });
    expect(contractKeys(contract, 'modes')).toEqual(['verbatim', 'sidecar']);
    expect(contractKeys(contract, 'evidence')).toHaveLength(3);
  });

  it('narrows in the shipped order, not the order the caller listed', () => {
    const firstContract = buildReferenceContract({
      kinds,
      narrow: { modes: ['sidecar', 'verbatim'] },
    });
    const secondContract = buildReferenceContract({
      kinds,
      narrow: { modes: ['verbatim', 'sidecar'] },
    });
    expect(JSON.stringify(firstContract)).toBe(JSON.stringify(secondContract));
  });

  it('refuses narrowing to a term the vocabulary does not have', () => {
    expect(() => buildReferenceContract({ kinds, narrow: { modes: ['verbatm'] } })).toThrow(
      /cannot narrow `modes` to unknown term\(s\) verbatm \(available: verbatim, condense, sidecar\)/,
    );
  });

  it('refuses narrowing a group to nothing', () => {
    expect(() => buildReferenceContract({ kinds, narrow: { modes: [] } })).toThrow(
      /narrowing `modes` to nothing leaves no valid value/,
    );
  });

  it('refuses narrowing a group that is not inherited', () => {
    expect(() =>
      buildReferenceContract({ kinds, narrow: { kinds: ['pattern'] } as never }),
    ).toThrow(/cannot narrow `kinds` \(narrowable: used_at, load, modes, evidence\)/);
  });

  it('leaves every group complete when nothing is narrowed', () => {
    const contract = buildReferenceContract({ kinds });
    for (const group of INHERITED_GROUPS) {
      expect(contract[group], group).toEqual(bundledVocabularies()[group]);
    }
  });

  it('accepts synthetic inherited vocabularies, so a kind can be tested in isolation', () => {
    const inherited = parseInheritedVocabularies(
      [
        'used_at:',
        '  now: {label: Now, description: d}',
        'load:',
        '  eager: {label: Eager, description: d}',
        'modes:',
        '  copy: {label: Copy, description: d}',
        'evidence:',
        '  guess: {label: Guess, description: d}',
      ].join('\n'),
    );
    const contract = buildReferenceContract({ kinds, inherited });
    expect(contractKeys(contract, 'modes')).toEqual(['copy']);
  });

  it('reads the keys of any group, which is what drives a schema enum', () => {
    const contract = buildReferenceContract({ kinds });
    expect(contractKeys(contract, 'kinds')).toEqual(['pattern']);
    expect(contractKeys(contract, 'evidence')).toEqual([
      'hypothesis',
      'corpus-observed',
      'cast-validated',
    ]);
  });
});

describe('parsing an arbitrary table', () => {
  const valid = [
    'used_at:',
    '  now: {label: Now, description: d}',
    'load:',
    '  eager: {label: Eager, description: d}',
    'modes:',
    '  copy: {label: Copy, description: d}',
    'evidence:',
    '  guess: {label: Guess, description: d}',
  ].join('\n');

  it('accepts a well-formed table', () => {
    expect(Object.keys(parseInheritedVocabularies(valid).used_at)).toEqual(['now']);
  });

  it('rejects a shared table that declares `kinds`', () => {
    expect(() =>
      parseInheritedVocabularies(`kinds:\n  p: {label: P, description: d}\n${valid}`),
    ).toThrow(/`kinds` is the instance's to declare/);
  });

  it('rejects a term missing a label or a description', () => {
    expect(() =>
      parseInheritedVocabularies(
        'used_at:\n  now: {label: Now}\nload:\n  e: {label: E, description: d}\nmodes:\n  c: {label: C, description: d}\nevidence:\n  g: {label: G, description: d}',
      ),
    ).toThrow(/used_at\.now missing required field `description`/);
  });

  it('rejects an empty vocabulary block', () => {
    expect(() =>
      parseInheritedVocabularies(
        'used_at: {}\nload:\n  e: {label: E, description: d}\nmodes:\n  c: {label: C, description: d}\nevidence:\n  g: {label: G, description: d}',
      ),
    ).toThrow(/`used_at` is empty/);
  });

  it('rejects an unknown ref_shape', () => {
    expect(() =>
      parseInheritedVocabularies(
        'used_at:\n  now: {label: N, description: d, ref_shape: hyperlink}\nload:\n  e: {label: E, description: d}\nmodes:\n  c: {label: C, description: d}\nevidence:\n  g: {label: G, description: d}',
      ),
    ).toThrow(/unknown ref_shape `hyperlink`/);
  });

  it('names the source in the error, so a caller knows which file failed', () => {
    expect(() => parseInheritedVocabularies('used_at: {}', 'somewhere.yml')).toThrow(
      /^somewhere\.yml:/,
    );
  });
});

describe('reading an instance file', () => {
  let temporaryDirectory: string;
  const writeContract = (body: string): string => {
    temporaryDirectory = mkdtempSync(path.join(tmpdir(), 'rc-'));
    const contractPath = path.join(temporaryDirectory, REFERENCE_CONTRACT_FILE);
    writeFileSync(contractPath, body);
    return contractPath;
  };
  const removeTemporaryDirectory = () =>
    rmSync(temporaryDirectory, { recursive: true, force: true });

  it('reads a file holding only `kinds`', () => {
    const contractPath = writeContract(
      'kinds:\n  pattern: {label: Pattern, description: d, ref_shape: wiki-link}\n',
    );
    try {
      expect(loadInstanceKinds(contractPath)).toEqual({
        pattern: { label: 'Pattern', description: 'd', ref_shape: 'wiki-link' },
      });
    } finally {
      removeTemporaryDirectory();
    }
  });

  it('refuses an instance file that re-declares an inherited vocabulary', () => {
    const contractPath = writeContract(
      'kinds:\n  p: {label: P, description: d}\nmodes:\n  verbatim: {label: V, description: d}\n',
    );
    try {
      expect(() => loadInstanceKinds(contractPath)).toThrow(
        /declares `modes`, which is inherited from @galaxy-foundry\/reference-contract/,
      );
    } finally {
      removeTemporaryDirectory();
    }
  });

  it('refuses a file with no `kinds` block', () => {
    const contractPath = writeContract('spec_url: http://example.invalid\n');
    try {
      expect(() => loadInstanceKinds(contractPath)).toThrow(/has no `kinds` block/);
    } finally {
      removeTemporaryDirectory();
    }
  });

  it('throws a path-naming error when the file is absent', () => {
    expect(() => loadInstanceKinds('/nonexistent/reference_contract.yml')).toThrow(
      /missing reference contract/,
    );
  });
});

describe('locating a table on disk', () => {
  it('exposes the bundled copy by path, and it round-trips', () => {
    expect(bundledContractPath()).toMatch(/data[/\\]reference-contract\.yml$/);
    expect(parseInheritedVocabularies(bundledContractText())).toEqual(bundledVocabularies());
  });

  it('walks up to find an instance file', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'rc-walk-'));
    try {
      writeFileSync(
        path.join(root, REFERENCE_CONTRACT_FILE),
        'kinds:\n  p: {label: P, description: d}\n',
      );
      const nested = path.join(root, 'a', 'b');
      mkdirSync(nested, { recursive: true });
      expect(findReferenceContractPath(nested)).toBe(path.join(root, REFERENCE_CONTRACT_FILE));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
