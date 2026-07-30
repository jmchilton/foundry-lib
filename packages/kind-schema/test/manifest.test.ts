import { buildKindManifest, parseKindManifest } from '@galaxy-foundry/kind-manifest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { kindDefiner, manifestKinds, type AnyKindDefinition } from '../src/index.js';

// Exercised against the REAL `buildKindManifest`, not a stub. The whole point of this helper is
// that it produces something that package accepts, and a stub would agree with whatever shape
// the helper happened to emit — including a wrong one.

interface Ctx {
  base: { status: z.ZodEnum<{ draft: 'draft'; reviewed: 'reviewed' }> };
}

const ctx: Ctx = { base: { status: z.enum(['draft', 'reviewed']) } };
const defineKind = kindDefiner<Ctx>();

const mold = defineKind({
  kind: 'mold',
  title: 'Mold',
  layer: 'substrate',
  summary: 'A procedural authoring skill source.',
  shape: 'directory',
  companions: [
    {
      file: 'eval.md',
      requirement: 'recommended',
      purpose: 'Abstract oracle: the properties a cast must satisfy.',
      disposition: 'foundry-only',
    },
  ],
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
  shape: 'directory',
  companions: [],
  additionalCompanions: 'allow',
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

  it('derives the frontmatter shape by building the kind against the context', () => {
    const [first] = manifestKinds(KINDS, ctx);
    // `status` proves the CONTEXT reached the shape — it is spread in from `ctx.base`, so a
    // helper that built against the wrong context would drop it.
    expect(Object.keys(first!.frontmatter).sort()).toEqual(['note', 'status', 'tags', 'type']);
  });

  it('exposes the shape of a refined kind, not the refinement wrapper', () => {
    // `refine` is applied by `assemble`, never here: a wrapped object has no `.shape` at all, so
    // this is the difference between a manifest with fields and one with none.
    expect(manifestKinds([mold], ctx)[0]!.frontmatter).toHaveProperty('tags');
  });

  // The two `shape`s are the reason the zod one was renamed. A bridge mapping both onto one word
  // is a trap, and this is the assertion that would have caught it swapping them.
  it("keeps a kind's note shape apart from its frontmatter shape", () => {
    const [first] = manifestKinds(KINDS, ctx);
    expect(first!.shape).toBe('directory');
    expect(typeof first!.frontmatter).toBe('object');
  });

  it("copies the kind's companion declaration through", () => {
    const [first, second] = manifestKinds(KINDS, ctx);
    expect(first!.companions.map((c) => c.file)).toEqual(['eval.md']);
    expect(first!.companions[0]!.disposition).toBe('foundry-only');
    // `[]` travels as `[]`, and the open-set flag travels beside it rather than instead of it.
    expect(second!.companions).toEqual([]);
    expect(second!.additionalCompanions).toBe('allow');
  });

  it('omits additionalCompanions for a kind that does not declare it', () => {
    expect('additionalCompanions' in manifestKinds([mold], ctx)[0]!).toBe(false);
  });

  it('attaches a doc when one is supplied', () => {
    const [first] = manifestKinds(KINDS, ctx, { docs: { mold: '# Mold\n\nbody' } });
    expect(first!.doc).toBe('# Mold\n\nbody');
  });

  it('attaches a worked example when one is supplied', () => {
    const [first] = manifestKinds(KINDS, ctx, { examples: { mold: '---\ntype: mold\n---' } });
    expect(first!.example).toBe('---\ntype: mold\n---');
    expect('doc' in first!).toBe(false);
  });

  // `exactOptionalPropertyTypes` distinguishes an absent key from one set to `undefined`, and an
  // explicit `doc: undefined` serializes into the manifest as a key the format does not declare.
  it('omits the doc key entirely rather than setting it undefined', () => {
    const [, second] = manifestKinds(KINDS, ctx, { docs: { mold: 'only the mold has one' } });
    expect('doc' in second!).toBe(false);
    expect(JSON.stringify(second)).not.toContain('doc');
  });

  it('ignores a doc for a kind that does not exist', () => {
    expect(manifestKinds([book], ctx, { docs: { nosuch: 'x' } })[0]!.doc).toBeUndefined();
  });
});

describe('locations, derived from the collection table', () => {
  // Derived, not supplied, for the reason the field table is derived from the zod shape: a
  // hand-written list is a second encoding of the routing table and drifts from it. This table is
  // SGF's real shape, where `experiments` and `molds` both resolve to `mold` — the many-to-one case
  // a per-kind field has to remember to handle and a derivation gets right for free.
  const COLLECTIONS = {
    molds: { base: 'content/molds', pattern: ['**/index.md'], kind: 'mold' },
    experiments: { base: 'content/research/experiments', pattern: ['**/index.md'], kind: 'mold' },
    books: { base: 'content/research/books', pattern: ['**/index.md'], kind: 'book' },
  };

  it('reports every collection routing to a kind, not just the first', () => {
    const [first] = manifestKinds(KINDS, ctx, { collections: COLLECTIONS });
    expect(first!.locations).toEqual(['content/molds', 'content/research/experiments']);
  });

  it('reports a single location as a one-element list', () => {
    const [, second] = manifestKinds(KINDS, ctx, { collections: COLLECTIONS });
    expect(second!.locations).toEqual(['content/research/books']);
  });

  it('omits locations entirely when no table is supplied', () => {
    expect('locations' in manifestKinds(KINDS, ctx)[0]!).toBe(false);
  });

  // An empty list would report "no collection routes here" as a deliberate fact, when it is a
  // routing bug. Absent says the manifest does not answer; `[]` would say the answer is none.
  it('omits locations for a kind no collection routes to', () => {
    const orphan = manifestKinds(KINDS, ctx, {
      collections: { books: COLLECTIONS.books },
    });
    expect('locations' in orphan[0]!).toBe(false);
  });
});

describe('feeding the real buildKindManifest', () => {
  const manifest = buildKindManifest({
    instance: 'test-foundry',
    source: { repo: 'owner/name', path: 'kinds.generated.json' },
    kinds: manifestKinds(KINDS, ctx, { docs: { mold: '# Mold' } }),
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
