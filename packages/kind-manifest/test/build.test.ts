import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { KIND_MANIFEST_VERSION, buildKindManifest, withRevision } from '../src/index.js';

const MOLD = {
  kind: 'mold',
  title: 'Mold',
  layer: 'substrate' as const,
  summary: 'A reusable shape.',
  shape: { tags: z.array(z.string()), summary: z.string().optional() },
};

describe('buildKindManifest', () => {
  it('stamps the format version rather than taking it from the caller', () => {
    const manifest = buildKindManifest({ instance: 'gwf', kinds: [MOLD] });
    expect(manifest.version).toBe(KIND_MANIFEST_VERSION);
    expect(manifest.instance).toBe('gwf');
  });

  it('derives each kind’s fields from its shape', () => {
    const manifest = buildKindManifest({ instance: 'gwf', kinds: [MOLD] });
    expect(manifest.kinds).toEqual([
      {
        kind: 'mold',
        title: 'Mold',
        layer: 'substrate',
        summary: 'A reusable shape.',
        fields: [
          { name: 'tags', required: true, type: 'string[]' },
          { name: 'summary', required: false, type: 'string' },
        ],
      },
    ]);
  });

  it('preserves the order the kinds were given in', () => {
    const manifest = buildKindManifest({
      instance: 'gwf',
      kinds: [MOLD, { ...MOLD, kind: 'pattern', title: 'Pattern' }],
    });
    expect(manifest.kinds.map((k) => k.kind)).toEqual(['mold', 'pattern']);
  });

  it('carries a doc body through when one is supplied', () => {
    const manifest = buildKindManifest({
      instance: 'gwf',
      kinds: [{ ...MOLD, doc: '# Mold\n\nbody' }],
    });
    expect(manifest.kinds[0]?.doc).toBe('# Mold\n\nbody');
  });

  // `exactOptionalPropertyTypes` is on, and a `doc: undefined` key survives
  // JSON.stringify as an absent key but shows up in a deep-equality test. Omitting it
  // entirely keeps the emitted JSON and the in-memory object telling the same story.
  it('omits `doc` entirely rather than emitting an undefined key', () => {
    const manifest = buildKindManifest({ instance: 'gwf', kinds: [MOLD] });
    expect(Object.hasOwn(manifest.kinds[0] as object, 'doc')).toBe(false);
  });
});

describe('provenance', () => {
  // The consumer used to bolt all of this on after reading the file —
  // `manifest.source = {...}` in the pattern site's vendoring script. That put the
  // producer's identity in the consumer's hands and made vendoring a mutation.
  const source = { repo: 'galaxyproject/foundry', path: 'types/kinds.generated.json' };

  it('emits the source envelope when the producer declares one', () => {
    const manifest = buildKindManifest({ instance: 'gwf', kinds: [MOLD], source });
    expect(manifest.source).toEqual(source);
  });

  it('omits `source` entirely when the producer does not declare it', () => {
    const manifest = buildKindManifest({ instance: 'gwf', kinds: [MOLD] });
    expect(Object.hasOwn(manifest, 'source')).toBe(false);
  });

  // The constraint that put `revision` on the consumer's side. A manifest is a committed
  // artifact whose CI gate regenerates it and string-compares; anything in it that varies
  // with the current commit makes that gate fail on every commit. So two builds of the
  // same kinds must be byte-identical no matter when they run.
  it('produces byte-identical output across builds, so a --check gate can pass', () => {
    const a = buildKindManifest({ instance: 'gwf', kinds: [MOLD], source });
    const b = buildKindManifest({ instance: 'gwf', kinds: [MOLD], source });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('withRevision', () => {
  const source = { repo: 'galaxyproject/foundry', path: 'types/kinds.generated.json' };
  const base = buildKindManifest({ instance: 'gwf', kinds: [MOLD], source });

  it('records the snapshot revision alongside the declared source', () => {
    expect(withRevision(base, 'abc1234').source).toEqual({ ...source, revision: 'abc1234' });
  });

  it('does not mutate the manifest it was given', () => {
    withRevision(base, 'abc1234');
    expect(base.source).toEqual(source);
    expect(Object.hasOwn(base.source as object, 'revision')).toBe(false);
  });

  it('refuses a manifest with no declared source', () => {
    const orphan = buildKindManifest({ instance: 'gwf', kinds: [MOLD] });
    expect(() => withRevision(orphan, 'abc1234')).toThrow(/no source/);
  });
});
