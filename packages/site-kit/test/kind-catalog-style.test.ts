import { describe, expect, it } from 'vitest';

import { KIND_CATALOG_TOKENS, kindCatalogStyleGaps } from '../src/index.js';

describe('kind catalog style contract', () => {
  it('reports every missing token', () => {
    expect(kindCatalogStyleGaps('')).toEqual(KIND_CATALOG_TOKENS);
  });

  it('accepts declarations and does not mistake usages for declarations', () => {
    const css = KIND_CATALOG_TOKENS.map((token) => `${token}: value;`).join('\n');
    expect(kindCatalogStyleGaps(css)).toEqual([]);
    expect(
      kindCatalogStyleGaps(KIND_CATALOG_TOKENS.map((token) => `color: var(${token});`).join('\n')),
    ).toEqual(KIND_CATALOG_TOKENS);
  });
});
