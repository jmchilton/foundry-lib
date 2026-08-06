import { describe, it, expect } from 'vitest';

import {
  CONTRACT_GROUPS,
  INHERITED_GROUPS,
  REFERENCE_CHIP_FIELDS,
  REFERENCE_CONTRACT_FILE,
  REFERENCE_FIELDS,
  STANDINGS,
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

const SPEC_URL = 'https://galaxyproject.github.io/foundry-pattern/pattern/anatomy-of-an-instance/';

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
    expect(Object.keys(inherited.modes)).toEqual(['verbatim', 'sidecar']);
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
    const contract = buildReferenceContract({ kinds, narrow: { modes: ['verbatim'] } });
    expect(contractKeys(contract, 'modes')).toEqual(['verbatim']);
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
      /cannot narrow `modes` to unknown term\(s\) verbatm \(available: verbatim, sidecar\)/,
    );
  });

  // An instance cannot keep the LLM mode by asking for it. `narrow` selects from what ships,
  // so the retired term reads as a typo — which is the whole point of retiring it here rather
  // than leaving every instance to decline it separately and one to forget.
  it('refuses `condense`, which no longer ships', () => {
    expect(() =>
      buildReferenceContract({ kinds, narrow: { modes: ['verbatim', 'condense'] } }),
    ).toThrow(/cannot narrow `modes` to unknown term\(s\) condense/);
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
        '  guess: {label: Guess, description: d, standing: grounded}',
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
    '  guess: {label: Guess, description: d, standing: grounded}',
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
        'used_at:\n  now: {label: Now}\nload:\n  e: {label: E, description: d}\nmodes:\n  c: {label: C, description: d}\nevidence:\n  g: {label: G, description: d, standing: grounded}',
      ),
    ).toThrow(/used_at\.now missing required field `description`/);
  });

  it('rejects an empty vocabulary block', () => {
    expect(() =>
      parseInheritedVocabularies(
        'used_at: {}\nload:\n  e: {label: E, description: d}\nmodes:\n  c: {label: C, description: d}\nevidence:\n  g: {label: G, description: d, standing: grounded}',
      ),
    ).toThrow(/`used_at` is empty/);
  });

  it('rejects a field the group does not own', () => {
    // `ref_shape` is a kind's. On a `used_at` term it is a belief about the term that nothing
    // will ever read — which is the whole failure, whether or not the value is a valid shape.
    expect(() =>
      parseInheritedVocabularies(
        'used_at:\n  now: {label: N, description: d, ref_shape: wiki-link}\nload:\n  e: {label: E, description: d}\nmodes:\n  c: {label: C, description: d}\nevidence:\n  g: {label: G, description: d, standing: grounded}',
      ),
    ).toThrow(/used_at\.now has unknown field\(s\) ref_shape \(known: label, description, href\)/);
  });

  it('rejects a standing on a group that is not evidence', () => {
    expect(() =>
      parseInheritedVocabularies(
        valid.replace('copy: {label: Copy', 'copy: {standing: grounded, label: Copy'),
      ),
    ).toThrow(/modes\.copy has unknown field\(s\) standing/);
  });

  it('names the source in the error, so a caller knows which file failed', () => {
    expect(() => parseInheritedVocabularies('used_at: {}', 'somewhere.yml')).toThrow(
      /^somewhere\.yml:/,
    );
  });

  it('rejects an evidence term that never says where it stands', () => {
    // The one a renderer cannot catch. A term with no standing renders in whichever style the
    // fallback happened to be, and a style is not an error — so this has to fail at load.
    expect(() => parseInheritedVocabularies(valid.replace(', standing: grounded', ''))).toThrow(
      /evidence\.guess missing required field `standing`/,
    );
  });

  it('rejects a standing outside the vocabulary', () => {
    expect(() =>
      parseInheritedVocabularies(valid.replace('standing: grounded', 'standing: probably')),
    ).toThrow(/unknown standing `probably`/);
  });

  it('asks for a standing only from evidence, not from every group', () => {
    expect(() => parseInheritedVocabularies(valid)).not.toThrow();
  });
});

describe('the reference shape', () => {
  it('maps every typed field to a group the contract actually has', () => {
    for (const group of Object.values(REFERENCE_FIELDS)) {
      expect(CONTRACT_GROUPS).toContain(group);
    }
  });

  it('names a chip for each inherited group, and none for `kinds`', () => {
    // The point of deriving these rather than listing them. `kind` is absent because `kinds` is
    // the group an instance declares — the same line loadInstanceKinds enforces, read from the
    // same place, so a group that changed sides moves here too.
    expect(REFERENCE_CHIP_FIELDS.map((field) => REFERENCE_FIELDS[field]).sort()).toEqual(
      [...INHERITED_GROUPS].sort(),
    );
    expect(REFERENCE_CHIP_FIELDS).not.toContain('kind');
  });

  it('keeps the irregular pairs that made the copies uncomparable', () => {
    // `mode`/`modes` and `kind`/`kinds`: the two a reader checking three hand-written lists by eye
    // would let past, and the reason this is a value.
    expect(REFERENCE_FIELDS.mode).toBe('modes');
    expect(REFERENCE_FIELDS.kind).toBe('kinds');
  });
});

describe('standings', () => {
  const inherited = bundledVocabularies();

  it('places every shipped evidence term', () => {
    for (const [key, term] of Object.entries(inherited.evidence)) {
      expect(STANDINGS, `evidence.${key}`).toContain(term.standing);
    }
  });

  it('draws the line the renderers had been drawing by name', () => {
    expect(inherited.evidence['hypothesis']?.standing).toBe('provisional');
    expect(inherited.evidence['corpus-observed']?.standing).toBe('grounded');
    expect(inherited.evidence['cast-validated']?.standing).toBe('grounded');
  });

  it('survives narrowing, which is where a widened type would have dropped it', () => {
    const contract = buildReferenceContract({
      kinds,
      narrow: { evidence: ['cast-validated'] },
    });
    expect(contract.evidence['cast-validated']?.standing).toBe('grounded');
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

  it('rejects an unknown ref_shape', () => {
    const contractPath = writeContract(
      'kinds:\n  pattern: {label: Pattern, description: d, ref_shape: hyperlink}\n',
    );
    try {
      expect(() => loadInstanceKinds(contractPath)).toThrow(/unknown ref_shape `hyperlink`/);
    } finally {
      removeTemporaryDirectory();
    }
  });

  it('refuses a kind field no reader here claims, rather than dropping it', () => {
    // The `cast:` block is the real case: it says what a caster does with the kind, and this
    // parser has no use for it. Dropped silently, an instance that declares casting behaviour
    // and runs no caster gets a contract that parses, a site that renders, and a block that
    // does nothing — indistinguishable from working.
    const contractPath = writeContract(
      'kinds:\n  pattern:\n    label: Pattern\n    description: d\n    cast: {resolve: note}\n',
    );
    try {
      expect(() => loadInstanceKinds(contractPath)).toThrow(
        /kinds\.pattern has unknown field\(s\) cast .*delegatedFields/s,
      );
    } finally {
      removeTemporaryDirectory();
    }
  });

  it('keeps a delegated field out of its own result, having only permitted it', () => {
    const contractPath = writeContract(
      'kinds:\n  pattern:\n    label: Pattern\n    description: d\n    cast: {resolve: note}\n',
    );
    try {
      expect(loadInstanceKinds(contractPath, { delegatedFields: ['cast'] })).toEqual({
        pattern: { label: 'Pattern', description: 'd' },
      });
    } finally {
      removeTemporaryDirectory();
    }
  });

  it('catches a typo inside a term, which is what dropping used to hide', () => {
    const contractPath = writeContract(
      'kinds:\n  pattern: {label: Pattern, description: d, ref_shpae: wiki-link}\n',
    );
    try {
      expect(() => loadInstanceKinds(contractPath)).toThrow(/unknown field\(s\) ref_shpae/);
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
