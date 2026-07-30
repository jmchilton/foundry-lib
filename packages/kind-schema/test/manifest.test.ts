import { buildKindManifest, parseKindManifest } from '@galaxy-foundry/kind-manifest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { kindDefiner, manifestKinds, type AnyKindDefinition } from '../src/index.js';

interface TestContext {
  base: { status: z.ZodEnum<{ draft: 'draft'; reviewed: 'reviewed' }> };
}

const context: TestContext = { base: { status: z.enum(['draft', 'reviewed']) } };
const defineKind = kindDefiner<TestContext>();

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
  build: (kindContext) =>
    z
      .object({
        type: z.literal('mold'),
        ...kindContext.base,
        tags: z.array(z.string()),
        note: z.string().optional(),
      })
      .strict(),
  refine: (frontmatter, issues) => {
    if (frontmatter.tags.length === 0) {
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
  build: (kindContext) => z.object({ type: z.literal('book'), ...kindContext.base }).strict(),
});

const KIND_DEFINITIONS: readonly AnyKindDefinition<TestContext>[] = [mold, book];

describe('manifestKinds', () => {
  it('carries every kind, in the order given', () => {
    expect(manifestKinds(KIND_DEFINITIONS, context).map((kind) => kind.kind)).toEqual([
      'mold',
      'book',
    ]);
  });

  it('copies the catalog fields off the definition', () => {
    const [first] = manifestKinds(KIND_DEFINITIONS, context);
    expect(first).toMatchObject({
      kind: 'mold',
      title: 'Mold',
      layer: 'substrate',
      summary: 'A procedural authoring skill source.',
    });
  });

  it('derives the frontmatter shape by building the kind against the context', () => {
    const [first] = manifestKinds(KIND_DEFINITIONS, context);
    expect(Object.keys(first!.frontmatter).sort()).toEqual(['note', 'status', 'tags', 'type']);
  });

  it('exposes the shape of a refined kind, not the refinement wrapper', () => {
    expect(manifestKinds([mold], context)[0]!.frontmatter).toHaveProperty('tags');
  });

  it("keeps a kind's note shape apart from its frontmatter shape", () => {
    const [first] = manifestKinds(KIND_DEFINITIONS, context);
    expect(first!.shape).toBe('directory');
    expect(typeof first!.frontmatter).toBe('object');
  });

  it("copies the kind's companion declaration through", () => {
    const [first, second] = manifestKinds(KIND_DEFINITIONS, context);
    expect(first!.companions.map((companion) => companion.file)).toEqual(['eval.md']);
    expect(first!.companions[0]!.disposition).toBe('foundry-only');
    expect(second!.companions).toEqual([]);
    expect(second!.additionalCompanions).toBe('allow');
  });

  it('omits additionalCompanions for a kind that does not declare it', () => {
    expect('additionalCompanions' in manifestKinds([mold], context)[0]!).toBe(false);
  });

  it('attaches a doc when one is supplied', () => {
    const [first] = manifestKinds(KIND_DEFINITIONS, context, {
      docs: { mold: '# Mold\n\nbody' },
    });
    expect(first!.doc).toBe('# Mold\n\nbody');
  });

  it('attaches a worked example when one is supplied', () => {
    const [first] = manifestKinds(KIND_DEFINITIONS, context, {
      examples: { mold: '---\ntype: mold\n---' },
    });
    expect(first!.example).toBe('---\ntype: mold\n---');
    expect('doc' in first!).toBe(false);
  });

  it('omits the doc key entirely rather than setting it undefined', () => {
    const [, second] = manifestKinds(KIND_DEFINITIONS, context, {
      docs: { mold: 'only the mold has one' },
    });
    expect('doc' in second!).toBe(false);
    expect(JSON.stringify(second)).not.toContain('doc');
  });

  it('ignores a doc for a kind that does not exist', () => {
    expect(manifestKinds([book], context, { docs: { nosuch: 'x' } })[0]!.doc).toBeUndefined();
  });
});

describe('locations, derived from the collection table', () => {
  const COLLECTIONS = {
    molds: { base: 'content/molds', pattern: ['**/index.md'], kind: 'mold' },
    experiments: { base: 'content/research/experiments', pattern: ['**/index.md'], kind: 'mold' },
    books: { base: 'content/research/books', pattern: ['**/index.md'], kind: 'book' },
  };

  it('reports every collection routing to a kind, not just the first', () => {
    const [first] = manifestKinds(KIND_DEFINITIONS, context, { collections: COLLECTIONS });
    expect(first!.locations).toEqual(['content/molds', 'content/research/experiments']);
  });

  it('reports a single location as a one-element list', () => {
    const [, second] = manifestKinds(KIND_DEFINITIONS, context, { collections: COLLECTIONS });
    expect(second!.locations).toEqual(['content/research/books']);
  });

  it('omits locations entirely when no table is supplied', () => {
    expect('locations' in manifestKinds(KIND_DEFINITIONS, context)[0]!).toBe(false);
  });

  it('omits locations for a kind no collection routes to', () => {
    const orphan = manifestKinds(KIND_DEFINITIONS, context, {
      collections: { books: COLLECTIONS.books },
    });
    expect('locations' in orphan[0]!).toBe(false);
  });
});

describe('feeding the real buildKindManifest', () => {
  const manifest = buildKindManifest({
    instance: 'test-foundry',
    source: { repo: 'owner/name', path: 'kinds.generated.json' },
    kinds: manifestKinds(KIND_DEFINITIONS, context, { docs: { mold: '# Mold' } }),
  });

  it('produces a manifest the reader accepts', () => {
    const roundTripped = parseKindManifest(JSON.parse(JSON.stringify(manifest)));
    expect(roundTripped.instance).toBe('test-foundry');
    expect(roundTripped.kinds.map((kind) => kind.kind)).toEqual(['mold', 'book']);
  });

  it('renders the derived fields rather than leaving them empty', () => {
    const fields = manifest.kinds[0]?.fields ?? [];
    expect(fields.find((field) => field.name === 'tags')?.type).toBe('string[]');
    expect(fields.find((field) => field.name === 'note')?.required).toBe(false);
    expect(fields.find((field) => field.name === 'tags')?.required).toBe(true);
  });

  it('keeps the layer of each kind, which the cross-instance catalog groups by', () => {
    expect(manifest.kinds.map((kind) => kind.layer)).toEqual(['substrate', 'instance']);
  });
});
