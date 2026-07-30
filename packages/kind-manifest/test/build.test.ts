import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { KIND_MANIFEST_VERSION, buildKindManifest, withRevision } from '../src/index.js';

const MOLD = {
  kind: 'mold',
  title: 'Mold',
  layer: 'substrate' as const,
  summary: 'A reusable shape.',
  shape: 'directory' as const,
  companions: [
    {
      file: 'eval.md',
      requirement: 'recommended' as const,
      purpose: 'The properties a cast must satisfy.',
      disposition: 'foundry-only' as const,
    },
  ],
  frontmatter: { tags: z.array(z.string()), summary: z.string().optional() },
};

describe('buildKindManifest', () => {
  it('stamps the format version rather than taking it from the caller', () => {
    const manifest = buildKindManifest({ instance: 'gwf', kinds: [MOLD] });
    expect(manifest.version).toBe(KIND_MANIFEST_VERSION);
    expect(manifest.instance).toBe('gwf');
  });

  it('derives each kind’s fields from its frontmatter shape, and carries its layout', () => {
    const manifest = buildKindManifest({ instance: 'gwf', kinds: [MOLD] });
    expect(manifest.kinds).toEqual([
      {
        kind: 'mold',
        title: 'Mold',
        layer: 'substrate',
        summary: 'A reusable shape.',
        shape: 'directory',
        companions: [
          {
            file: 'eval.md',
            requirement: 'recommended',
            purpose: 'The properties a cast must satisfy.',
            disposition: 'foundry-only',
          },
        ],
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

  it('omits `doc` entirely rather than emitting an undefined key', () => {
    const manifest = buildKindManifest({ instance: 'gwf', kinds: [MOLD] });
    expect(Object.hasOwn(manifest.kinds[0] as object, 'doc')).toBe(false);
  });

  it('emits every optional key in declared order, with the prose last before `fields`', () => {
    const manifest = buildKindManifest({
      instance: 'gwf',
      kinds: [
        {
          ...MOLD,
          additionalCompanions: 'allow',
          locations: ['content/molds'],
          doc: '# Mold',
          example: '# Example',
        },
      ],
    });
    expect(Object.keys(manifest.kinds[0] as object)).toEqual([
      'kind',
      'title',
      'layer',
      'summary',
      'shape',
      'companions',
      'additionalCompanions',
      'locations',
      'doc',
      'example',
      'fields',
    ]);
  });

  it('omits every absent optional key rather than emitting undefined ones', () => {
    const [kind] = buildKindManifest({ instance: 'gwf', kinds: [MOLD] }).kinds;
    for (const key of ['additionalCompanions', 'locations', 'example']) {
      expect(Object.hasOwn(kind as object, key)).toBe(false);
    }
  });

  it('copies the companion list rather than aliasing the caller’s', () => {
    const manifest = buildKindManifest({ instance: 'gwf', kinds: [MOLD] });
    expect(manifest.kinds[0]?.companions).not.toBe(MOLD.companions);
    expect(manifest.kinds[0]?.companions).toEqual(MOLD.companions);
  });
});

describe('provenance', () => {
  const source = { repo: 'galaxyproject/foundry', path: 'types/kinds.generated.json' };

  it('emits the source envelope when the producer declares one', () => {
    const manifest = buildKindManifest({ instance: 'gwf', kinds: [MOLD], source });
    expect(manifest.source).toEqual(source);
  });

  it('omits `source` entirely when the producer does not declare it', () => {
    const manifest = buildKindManifest({ instance: 'gwf', kinds: [MOLD] });
    expect(Object.hasOwn(manifest, 'source')).toBe(false);
  });

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
