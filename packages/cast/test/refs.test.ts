// Resolving one declared reference: the step where a contract, a target and a note either
// agree or do not. Every case here is a way they can disagree that would otherwise cast
// something plausible — the wrong file, the wrong name — and report success.

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { CastContract } from '../src/cast-contract.js';
import type { CastHooks } from '../src/caster/hooks.js';
import {
  castOneRef,
  duplicateDestinations,
  expandCompanions,
  resolveMoldRef,
  type RefResolution,
  type ResolvedRef,
} from '../src/caster/refs.js';
import type { TargetConfig } from '../src/caster/target-config.js';

const target: TargetConfig = {
  document: { path: 'SKILL.md', noun: 'skill' },
  required_outputs: [],
  kinds: {
    prompt: { dst_dir: 'references/prompts', dst_extension: '.md', modes: ['verbatim'] },
    pattern: { dst_dir: 'references/patterns', dst_extension: '.md', modes: ['verbatim'] },
  },
  skill_constraints: { frontmatter_required: [], forbidden_runtime_paths: [] },
};

/** A Foundry that attaches nothing: no renderers, no contributions, no second addresses. */
const bareHooks: CastHooks = {
  renderers: {},
  bundleFiles: [],
  skillLede: '',
  skillSections: () => [],
  bundleChecks: [],
};

const castContract: CastContract = {
  prompt: { resolve: 'payload-companion', default_mode: 'verbatim', companions: false },
  pattern: { resolve: 'note', default_mode: 'verbatim', companions: true },
  example: { resolve: 'note', default_mode: 'verbatim', companions: false },
};

const refKinds = {
  prompt: { label: 'Prompt', description: '', ref_shape: 'wiki-link' as const },
  pattern: { label: 'Pattern', description: '', ref_shape: 'wiki-link' as const },
  example: { label: 'Example', description: '', ref_shape: 'wiki-link' as const },
  // Declared vocabulary with no `cast:` block — the deliberate gap, not a typo.
  research: { label: 'Research', description: '' },
};

const slugMap = new Map([
  ['p', 'content/prompts/p/index.md'],
  ['double-dipping', 'content/patterns/double-dipping.md'],
]);

const metaByPath = new Map<string, Record<string, unknown>>([
  ['content/prompts/p/index.md', { type: 'prompt' }],
  ['content/patterns/double-dipping.md', { type: 'pattern', companions: ['table.csv'] }],
]);

function ctx(overrides: Partial<RefResolution> = {}): RefResolution {
  return {
    slugMap,
    metaByPath,
    targetName: 'claude',
    target,
    castContract,
    refKinds,
    hooks: bareHooks,
    ...overrides,
  };
}

describe('a kind that cannot be cast says which of the two reasons applies', () => {
  it('separates a typo from a deliberate gap', () => {
    // The distinction is the declaration's: vocabulary the contract never names is a mistake in
    // the Mold, vocabulary it names WITHOUT a cast: block is a caster feature nobody has needed.
    expect(resolveMoldRef({ kind: 'reserch', ref: '[[p]]' }, 0, ctx()).error).toContain(
      'unknown kind=reserch',
    );
    expect(resolveMoldRef({ kind: 'research', ref: '[[p]]' }, 0, ctx()).error).toContain(
      'kind=research is not castable',
    );
  });

  it('names the target when the contract allows a kind the target places nowhere', () => {
    expect(resolveMoldRef({ kind: 'example', ref: '[[p]]' }, 3, ctx()).error).toBe(
      'references[3]: target=claude does not declare kind=example',
    );
  });
});

describe('an address is checked against the shape its kind declares', () => {
  it('refuses a bare ref for a wiki-link kind', () => {
    // resolveWikiLink takes the bare inner text as readily as the bracketed form, so without
    // this precheck `ref_shape: wiki-link` would be a declaration that refuses nothing.
    const out = resolveMoldRef({ kind: 'pattern', ref: 'double-dipping' }, 0, ctx());
    expect(out.resolved).toBeUndefined();
    expect(out.error).toContain('must be a [[wiki-link]]');
  });

  it('refuses a ref whose note is a different type than the kind claims', () => {
    expect(resolveMoldRef({ kind: 'pattern', ref: '[[p]]' }, 0, ctx()).error).toContain(
      'resolves to type=prompt, expected pattern',
    );
  });

  it('refuses a mode the target does not admit for the kind', () => {
    expect(
      resolveMoldRef({ kind: 'pattern', ref: '[[double-dipping]]', mode: 'sidecar' }, 0, ctx())
        .error,
    ).toContain('does not support mode=sidecar');
  });
});

describe('the bundled name comes from the note, not from the file holding it', () => {
  it('names a directory note for its directory, never index', () => {
    const out = resolveMoldRef({ kind: 'pattern', ref: '[[double-dipping]]' }, 0, ctx());
    expect(out.resolved?.dst).toBe('references/patterns/double-dipping.md');
  });

  it('refuses a note missing the field its kind declares as slug_field', () => {
    // Falling back to the note's own slug would rename every bundled file of the kind on a
    // typo'd field name, and look like a successful cast.
    const out = resolveMoldRef({ kind: 'pattern', ref: '[[double-dipping]]' }, 0, {
      ...ctx(),
      castContract: {
        ...castContract,
        pattern: {
          resolve: 'note',
          default_mode: 'verbatim',
          companions: true,
          slug_field: 'tool',
        },
      },
    });
    expect(out.resolved).toBeUndefined();
    expect(out.error).toContain('no `tool`');
  });
});

describe("the payload a companion strategy ships is the instance's answer", () => {
  it('refuses a strategy nothing implements, rather than casting the wrapper', () => {
    const out = resolveMoldRef({ kind: 'prompt', ref: '[[p]]' }, 0, ctx());
    // Falling back to the note would package the file that FRAMES the payload and report
    // success, which is the one outcome worse than an error.
    expect(out.resolved).toBeUndefined();
    expect(out.error).toContain('references[0]');
    expect(out.error).toContain('payloadCompanion');
  });

  it('ships the file the hook names, and derives the bundled name from the note', () => {
    const out = resolveMoldRef({ kind: 'prompt', ref: '[[p]]' }, 0, {
      ...ctx(),
      hooks: { ...bareHooks, payloadCompanion: () => 'not-a-name-the-caster-knows.md' },
    });
    expect(out.error).toBeUndefined();
    expect(out.resolved?.src).toBe('content/prompts/p/not-a-name-the-caster-knows.md');
    // The bundle is named for the note that frames the payload, never for the payload's file.
    expect(out.resolved?.dst).toBe('references/prompts/p.md');
  });

  it('reports a broken kind declaration against the ref that tripped over it', () => {
    // Thrown, this would arrive as a stack trace with no ref index — losing the only thing
    // that says WHICH reference was being resolved.
    const out = resolveMoldRef({ kind: 'prompt', ref: '[[p]]' }, 7, {
      ...ctx(),
      hooks: {
        ...bareHooks,
        payloadCompanion: () => {
          throw new Error('kind=prompt declares no single bundled companion');
        },
      },
    });
    expect(out.error).toBe('references[7]: kind=prompt declares no single bundled companion');
  });
});

describe('companions travel only where a kind says they may', () => {
  const resolvedPattern = resolveMoldRef(
    { kind: 'pattern', ref: '[[double-dipping]]' },
    0,
    ctx(),
  ).resolved;

  it('carries the files the note declares, marked with the parent they belong to', () => {
    const out = expandCompanions([resolvedPattern!], ctx());
    expect(out.map((r) => r.dst)).toEqual([
      'references/patterns/double-dipping.md',
      'references/patterns/table.csv',
    ]);
    // The parent is recorded on the companion, so a provenance reader can tell a file that
    // travelled with a note from one a Mold asked for directly.
    expect(out[1]?.companion_of).toBe('references/patterns/double-dipping.md');
    expect(out[1]?.src).toBe('content/patterns/table.csv');
  });

  it('leaves them behind when the kind declares companions: false', () => {
    // Membership stays the note's and permission stays the kind's. A file is never packaged
    // for merely sitting in the directory.
    const out = expandCompanions([resolvedPattern!], {
      ...ctx(),
      castContract: {
        ...castContract,
        pattern: { resolve: 'note', default_mode: 'verbatim', companions: false },
      },
    });
    expect(out).toHaveLength(1);
  });
});

describe('casting a ref whose bytes come from a package export', () => {
  let bundle: string;

  beforeEach(() => {
    bundle = mkdtempSync(path.join(tmpdir(), 'cast-refs-'));
  });

  afterEach(() => {
    rmSync(bundle, { recursive: true, force: true });
  });

  /** A resolved package-export ref, whose kind the caller names. */
  const packaged = (kind: string): ResolvedRef => ({
    kind,
    mode: 'verbatim',
    ref: `[[${kind}-x]]`,
    src: '',
    dst: `references/${kind}s/x.json`,
    used_at: 'runtime',
    load: 'on-demand',
    package_source: { spec: 'pkg', exportName: 'schema' },
  });

  const loader = (): Promise<Record<string, unknown>> =>
    Promise.resolve({ schema: { title: 'x' } });

  it('does not require the kind to be named `schema`', async () => {
    // The strategy is declared per kind by the contract, and what a kind is CALLED is exactly
    // what varies between Foundries. A kind name from one instance's table, tested here,
    // refuses every sibling that spells the same idea differently.
    const out = await castOneRef(packaged('spec'), '/repo', bundle, {
      renderers: {},
      packageLoader: loader,
    });
    expect(out.error).toBeUndefined();
    expect(JSON.parse(readFileSync(path.join(bundle, 'references/specs/x.json'), 'utf8'))).toEqual({
      title: 'x',
    });
  });

  it('still refuses a mode it cannot synthesize bytes for', async () => {
    // Nothing renders a package export: the bytes ARE the stringified value. A mode asking for
    // a rendering has no renderer that could apply, so this stays refused.
    const out = await castOneRef({ ...packaged('spec'), mode: 'sidecar' }, '/repo', bundle, {
      renderers: {},
      packageLoader: loader,
    });
    expect(out.error).toMatch(/mode=verbatim/);
  });

  it('refuses when the Foundry registers no packageLoader', async () => {
    const out = await castOneRef(packaged('spec'), '/repo', bundle, { renderers: {} });
    expect(out.error).toMatch(/nothing registers a packageLoader hook/);
  });
});

describe('two refs cannot claim the same place in the bundle', () => {
  const at = (dst: string, extra: Partial<ResolvedRef> = {}): ResolvedRef => ({
    kind: 'pattern',
    mode: 'verbatim',
    ref: `[[${dst}]]`,
    src: `content/patterns/${dst}`,
    dst,
    used_at: 'runtime',
    load: 'on-demand',
    ...extra,
  });

  it('reports a destination two refs both write', () => {
    // Companion destinations are the kind's directory plus the companion's own filename, so two
    // notes of one kind that each declare `table.csv` land on one path. Last write wins, the
    // orphan sweep sees a path something claims, and provenance records two entries with
    // different src_hash pointing at one file — no step in a cast notices.
    const dupes = duplicateDestinations([
      at('references/patterns/a.md'),
      at('references/patterns/table.csv', { companion_of: 'references/patterns/a.md' }),
      at('references/patterns/b.md'),
      at('references/patterns/table.csv', { companion_of: 'references/patterns/b.md' }),
    ]);
    expect(dupes).toHaveLength(1);
    expect(dupes[0]).toContain('references/patterns/table.csv');
  });

  it('says nothing when every ref lands somewhere of its own', () => {
    expect(
      duplicateDestinations([at('references/patterns/a.md'), at('references/patterns/b.md')]),
    ).toEqual([]);
  });
});
