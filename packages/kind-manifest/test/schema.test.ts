// The consumer half of the format.
//
// A cross-instance catalog reads manifests it did not produce, from repos it does not
// control, at revisions it did not choose. Today it does that by casting the parsed JSON
// to a hand-written interface — which means a manifest missing `layer`, or carrying
// `layer: "instnace"`, renders a broken page instead of failing at the read.

import { describe, expect, it } from 'vitest';

import { KIND_MANIFEST_VERSION, buildKindManifest, parseKindManifest } from '../src/index.js';
import { z } from 'zod';

const VALID = buildKindManifest({
  instance: 'gwf',
  kinds: [
    {
      kind: 'mold',
      title: 'Mold',
      layer: 'substrate',
      summary: 'A reusable shape.',
      shape: { tags: z.array(z.string()) },
    },
  ],
  source: { repo: 'galaxyproject/foundry', path: 'types/kinds.generated.json' },
});

describe('parseKindManifest', () => {
  it('round-trips what buildKindManifest produced', () => {
    expect(parseKindManifest(JSON.parse(JSON.stringify(VALID)))).toEqual(VALID);
  });

  it('accepts a manifest with no source envelope', () => {
    const { source: _source, ...withoutSource } = VALID;
    expect(parseKindManifest(withoutSource).instance).toBe('gwf');
  });

  it.each([
    ['a missing instance', { ...VALID, instance: undefined }],
    ['a non-numeric version', { ...VALID, version: '1' }],
    ['a missing kinds array', { ...VALID, kinds: undefined }],
    ['a kind with no layer', { ...VALID, kinds: [{ ...VALID.kinds[0], layer: undefined }] }],
    ['a misspelled layer', { ...VALID, kinds: [{ ...VALID.kinds[0], layer: 'instnace' }] }],
    [
      'a field with a non-boolean required',
      {
        ...VALID,
        kinds: [{ ...VALID.kinds[0], fields: [{ name: 'a', required: 'yes', type: 'string' }] }],
      },
    ],
    ['a source envelope with no path', { ...VALID, source: { repo: 'a/b' } }],
    ['not an object at all', 'a manifest'],
  ])('rejects %s', (_label, input) => {
    expect(() => parseKindManifest(input)).toThrow();
  });

  // A reader that silently accepts a format it does not understand is worse than one
  // that refuses: it renders a plausible-looking catalog from fields it guessed at.
  it('rejects a manifest from a future format version', () => {
    expect(() => parseKindManifest({ ...VALID, version: KIND_MANIFEST_VERSION + 1 })).toThrow(
      /version/i,
    );
  });

  it('names the offending path when it rejects', () => {
    expect(() =>
      parseKindManifest({ ...VALID, kinds: [{ ...VALID.kinds[0], layer: 'instnace' }] }),
    ).toThrow(/kinds/);
  });
});
