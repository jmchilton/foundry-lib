import { describe, expect, it } from 'vitest';

import { artifactSpanSchema, sourceTextDigest } from '../src/span.js';

const span = (overrides: Record<string, unknown> = {}) => {
  const sourceText = 'gudhi comes from conda-forge';
  return {
    artifactKind: 'environment-manifest',
    artifactPath: 'content/environments/example/pixi.toml',
    startLine: 4,
    endLine: 4,
    sourceText,
    sourceDigest: sourceTextDigest(sourceText),
    ...overrides,
  };
};

describe('a span carries proof of the text it covers', () => {
  it('accepts a span whose digest matches its text', () => {
    expect(artifactSpanSchema.parse(span())).toMatchObject({ startLine: 4 });
  });

  it('rejects a digest that does not cover the text beside it', () => {
    // Without this the digest is carried but never checked, and a hand-edited run could retire or
    // resurrect a review decision undetected.
    const result = artifactSpanSchema.safeParse(span({ sourceDigest: sourceTextDigest('other') }));
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('source digest does not match sourceText');
  });

  it('rejects a range that ends before it starts', () => {
    const result = artifactSpanSchema.safeParse(span({ startLine: 9 }));
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('endLine must not precede startLine');
  });

  it('carries artifactKind opaquely, naming no checker vocabulary', () => {
    // A checker names its own artifacts. This package validating that vocabulary would be the
    // package deciding what a Foundry may audit.
    expect(artifactSpanSchema.parse(span({ artifactKind: 'reference-section' }))).toMatchObject({
      artifactKind: 'reference-section',
    });
  });

  it('rejects a key it does not declare', () => {
    const result = artifactSpanSchema.safeParse(span({ confidence: 0.5 }));
    expect(result.success).toBe(false);
  });
});
