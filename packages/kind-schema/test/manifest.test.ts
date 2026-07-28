import { buildKindManifest, parseKindManifest } from '@galaxy-foundry/kind-manifest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { kindDefiner, manifestKinds, type AnyKindDefinition } from '../src/index.js';

// Exercised against the REAL `buildKindManifest`, not a stub. The whole point of this helper is
// that it produces something that package accepts, and a stub would agree with whatever shape
// the helper happened to emit — including a wrong one.

interface Ctx {
  base: { status: z.ZodEnum<['draft', 'reviewed']> };
}

const ctx: Ctx = { base: { status: z.enum(['draft', 'reviewed']) } };
const defineKind = kindDefiner<Ctx>();

const mold = defineKind({
  kind: 'mold',
  title: 'Mold',
  layer: 'substrate',
  summary: 'A procedural authoring skill source.',
  build: (c) =>
    z
      .object({
        type: z.literal('mold'),
        ...c.base,
        tags: z.array(z.string()),
        note: z.string().optional(),
      })
      .strict(),
  // Present precisely so the assertion below — that a refined kind still exposes its `.shape` —
  // is testing something.
  refine: (data, issues) => {
    if (data.tags.length === 0) {
      issues.addIssue({ code: z.ZodIssueCode.custom, path: ['tags'], message: 'need a tag' });
    }
  },
});

const book = defineKind({
  kind: 'book',
  title: 'Book',
  layer: 'instance',
  summary: 'A book whose chapters are notes.',
  build: (c) => z.object({ type: z.literal('book'), ...c.base }).strict(),
});

const KINDS: readonly AnyKindDefinition<Ctx>[] = [mold, book];

describe('manifestKinds', () => {
  it('carries every kind, in the order given', () => {
    expect(manifestKinds(KINDS, ctx).map((k) => k.kind)).toEqual(['mold', 'book']);
  });

  it('copies the catalog fields off the definition', () => {
    const [first] = manifestKinds(KINDS, ctx);
    expect(first).toMatchObject({
      kind: 'mold',
      title: 'Mold',
      layer: 'substrate',
      summary: 'A procedural authoring skill source.',
    });
  });

  it('derives the shape by building the kind against the context', () => {
    const [first] = manifestKinds(KINDS, ctx);
    // `status` proves the CONTEXT reached the shape — it is spread in from `ctx.base`, so a
    // helper that built against the wrong context would drop it.
    expect(Object.keys(first!.shape).sort()).toEqual(['note', 'status', 'tags', 'type']);
  });

  it('exposes the shape of a refined kind, not the refinement wrapper', () => {
    // `refine` is applied by `assemble`, never here: a wrapped object has no `.shape` at all, so
    // this is the difference between a manifest with fields and one with none.
    expect(manifestKinds([mold], ctx)[0]!.shape).toHaveProperty('tags');
  });

  it('attaches a doc when one is supplied', () => {
    const [first] = manifestKinds(KINDS, ctx, { mold: '# Mold\n\nbody' });
    expect(first!.doc).toBe('# Mold\n\nbody');
  });

  // `exactOptionalPropertyTypes` distinguishes an absent key from one set to `undefined`, and an
  // explicit `doc: undefined` serializes into the manifest as a key the format does not declare.
  it('omits the doc key entirely rather than setting it undefined', () => {
    const [, second] = manifestKinds(KINDS, ctx, { mold: 'only the mold has one' });
    expect('doc' in second!).toBe(false);
    expect(JSON.stringify(second)).not.toContain('doc');
  });

  it('ignores a doc for a kind that does not exist', () => {
    expect(manifestKinds([book], ctx, { nosuch: 'x' })[0]!.doc).toBeUndefined();
  });
});

describe('feeding the real buildKindManifest', () => {
  const manifest = buildKindManifest({
    instance: 'test-foundry',
    source: { repo: 'owner/name', path: 'kinds.generated.json' },
    kinds: manifestKinds(KINDS, ctx, { mold: '# Mold' }),
  });

  it('produces a manifest the reader accepts', () => {
    const roundTripped = parseKindManifest(JSON.parse(JSON.stringify(manifest)));
    expect(roundTripped.instance).toBe('test-foundry');
    expect(roundTripped.kinds.map((k) => k.kind)).toEqual(['mold', 'book']);
  });

  it('renders the derived fields rather than leaving them empty', () => {
    const fields = manifest.kinds[0]?.fields ?? [];
    expect(fields.find((f) => f.name === 'tags')?.type).toBe('string[]');
    // An optional field is not required metadata — the distinction the catalog's table renders.
    expect(fields.find((f) => f.name === 'note')?.required).toBe(false);
    expect(fields.find((f) => f.name === 'tags')?.required).toBe(true);
  });

  it('keeps the layer of each kind, which the cross-instance catalog groups by', () => {
    expect(manifest.kinds.map((k) => k.layer)).toEqual(['substrate', 'instance']);
  });
});
