import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { loadInstanceKinds } from '@galaxy-foundry/reference-contract';
import yaml from 'js-yaml';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  CAST_BLOCK_KEY,
  loadCastContract,
  loadCastReferenceContract,
} from '../src/cast-contract.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'cast-contract-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const CASTABLE = {
  label: 'Pattern',
  description: 'A domain pattern page.',
  ref_shape: 'wiki-link',
  cast: { resolve: 'note', default_mode: 'verbatim', companions: true },
};

/** Write an instance contract and return its path. `kinds` is the whole `kinds:` block. */
function writeContract(kinds: Record<string, unknown>): string {
  const contractPath = path.join(dir, 'reference_contract.yml');
  writeFileSync(contractPath, yaml.dump({ kinds }));
  return contractPath;
}

/** The modes an instance inherits, for the loads that do not compose the vocabulary. */
const MODES = ['verbatim', 'sidecar'];

describe('reading the cast half of a kind', () => {
  it('returns a declaration per castable kind', () => {
    const contractPath = writeContract({ pattern: CASTABLE });
    expect(loadCastContract(contractPath, MODES)).toEqual({
      pattern: { resolve: 'note', default_mode: 'verbatim', companions: true },
    });
  });

  it('leaves out a kind with no cast: block, which is how a kind declines to be cast', () => {
    // Absence here is the whole reason the caster refuses the kind. A second list of
    // uncastable names would be a copy of this one, free to disagree with it.
    const contractPath = writeContract({
      pattern: CASTABLE,
      example: { label: 'Example', description: 'Rendered, never compiled.' },
    });
    expect(Object.keys(loadCastContract(contractPath, MODES))).toEqual(['pattern']);
  });

  it('carries slug_field when the note slug is the wrong bundled name', () => {
    const contractPath = writeContract({
      'cli-tool': { ...CASTABLE, cast: { ...CASTABLE.cast, slug_field: 'tool' } },
    });
    expect(loadCastContract(contractPath, MODES)['cli-tool']?.slug_field).toBe('tool');
  });
});

describe('a cast declaration that cannot be honoured is refused at load', () => {
  const refuses = (cast: unknown, pattern: RegExp, modes = MODES): void => {
    const contractPath = writeContract({ pattern: { ...CASTABLE, cast } });
    expect(() => loadCastContract(contractPath, modes)).toThrow(pattern);
  };

  it('refuses an unknown field, rather than dropping it', () => {
    refuses({ ...CASTABLE.cast, slug_feild: 'tool' }, /unknown field\(s\) slug_feild/);
  });

  it('refuses a resolve strategy that names no source of bytes', () => {
    refuses({ ...CASTABLE.cast, resolve: 'sidecar' }, /resolve is `sidecar` \(expected note \|/);
  });

  it('refuses a default_mode outside the instance vocabulary', () => {
    // Checked against the composed `modes` rather than a literal list, so an instance that
    // declines a mode cannot keep defaulting a kind to it.
    refuses({ ...CASTABLE.cast, default_mode: 'sidecar' }, /not in this instance's/, ['verbatim']);
  });

  it('refuses a missing default_mode', () => {
    refuses({ resolve: 'note', companions: true }, /missing required field `default_mode`/);
  });

  it('refuses companions left unstated, since the answer decides what a bundle carries', () => {
    refuses({ resolve: 'note', default_mode: 'verbatim' }, /companions must be true or false/);
  });

  it('refuses an empty slug_field, which would name no field at all', () => {
    refuses({ ...CASTABLE.cast, slug_field: '' }, /slug_field must be a non-empty string/);
  });

  it('names the file in every message, so a caller knows what to open', () => {
    const contractPath = writeContract({ pattern: { ...CASTABLE, cast: { resolve: 'nope' } } });
    expect(() => loadCastContract(contractPath, MODES)).toThrow(
      new RegExp(`^${contractPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:`),
    );
  });
});

describe('composing both halves of a kind', () => {
  it('reads one file into a rendered half and a cast half', () => {
    const contractPath = writeContract({ pattern: CASTABLE });
    const { contract, cast } = loadCastReferenceContract(contractPath);
    expect(contract.kinds['pattern']).toEqual({
      label: 'Pattern',
      description: 'A domain pattern page.',
      ref_shape: 'wiki-link',
    });
    expect(cast['pattern']?.resolve).toBe('note');
  });

  it('keeps the cast block out of the rendered half, having only permitted it', () => {
    const contractPath = writeContract({ pattern: CASTABLE });
    const { contract } = loadCastReferenceContract(contractPath);
    expect(contract.kinds['pattern']).not.toHaveProperty(CAST_BLOCK_KEY);
  });

  it('checks default_mode against the vocabulary AFTER narrowing', () => {
    // The reason the two loads happen together. An instance that declines `sidecar` and still
    // defaults a kind to it has declared a mode it cannot run, and only the composed load can
    // see that.
    const contractPath = writeContract({
      'cli-command': { ...CASTABLE, cast: { ...CASTABLE.cast, default_mode: 'sidecar' } },
    });
    expect(() => loadCastReferenceContract(contractPath)).not.toThrow();
    expect(() =>
      loadCastReferenceContract(contractPath, { narrow: { modes: ['verbatim'] } }),
    ).toThrow(/not in this instance's `modes` vocabulary \(verbatim\)/);
  });

  it('refuses a cast: block through the shared parser when nothing delegates it', () => {
    // The composed loader is what declares the second reader. Reaching the shared parser
    // directly, a `cast:` block is a declaration nothing acts on — which it now says.
    const contractPath = writeContract({ pattern: CASTABLE });
    expect(() => loadInstanceKinds(contractPath)).toThrow(/unknown field\(s\) cast/);
  });
});
