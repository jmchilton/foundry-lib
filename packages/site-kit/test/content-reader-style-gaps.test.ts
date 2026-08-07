import { describe, expect, it } from 'vitest';

import { CONTENT_READER_TOKENS, contentReaderStyleGaps } from '../src/index.js';

describe('contentReaderStyleGaps', () => {
  it('reports no gaps when every content-reader role is declared', () => {
    const css = `:root{${CONTENT_READER_TOKENS.map((token) => `${token}:x`).join(';')}}`;
    expect(contentReaderStyleGaps(css)).toEqual([]);
  });

  it('reports a missing role even when component CSS references it', () => {
    expect(contentReaderStyleGaps('.x{color:var(--color-brand)}')).toContain('--color-brand');
  });
});
