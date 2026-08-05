import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { REFERENCE_TOKENS, referenceStyleGaps, styleGaps } from '../src/index.js';

// The reference card's half of the style contract.
//
// Different from the shell's in one way that matters: this component SHIPS its stylesheet, so an
// instance cannot fail to write a rule. What it can fail to supply is a value inside one — and a
// scoped `var(--color-brand)` that resolves to nothing renders exactly like a design decision.
//
// The test that earns its place is `names nothing the contract does not list`, below. It reads the
// component rather than the list, so the list cannot drift away from the file it describes: a
// token added to the stylesheet and not to REFERENCE_TOKENS would otherwise be a gap that the gap
// check itself is blind to.

const COMPONENT = fileURLToPath(
  new URL('../src/components/ReferenceContract.astro', import.meta.url),
);

/** A property the component reads with a fallback, so an instance owes it nothing. See the doc. */
const FALLBACK_TOKENS = ['--color-kind-accent'];

/** A stylesheet declaring everything the card names. */
const complete = (): string => `:root{${REFERENCE_TOKENS.map((t) => `${t}:#000`).join(';')}}`;

describe('referenceStyleGaps', () => {
  it('reports nothing against a stylesheet that supplies all seventeen', () => {
    expect(referenceStyleGaps(complete())).toEqual([]);
  });

  it('reports a token that is used but never declared', () => {
    // Same trap as the shell's: the component's own `var(--color-brand)` puts the name in the
    // built CSS, so a search without the colon finds it and passes on a site that declared nothing.
    const css = `.x{color:var(--color-brand)}\n${complete().replace('--color-brand:#000;', '')}`;
    expect(referenceStyleGaps(css)).toEqual(['--color-brand']);
  });

  it('reports every missing token, not the first', () => {
    expect(referenceStyleGaps(':root{--color-brand:#000}')).toEqual(
      REFERENCE_TOKENS.filter((token) => token !== '--color-brand'),
    );
  });

  it('names roles rather than any instance brand', () => {
    // `--color-brand` is the role "whatever colour this site is". `--color-galaxy-primary`, which
    // this component used to name, billed every instance that is not Galaxy for a reference card.
    expect(REFERENCE_TOKENS.filter((token) => /galaxy|foundry|statgen/i.test(token))).toEqual([]);
  });

  it('names nothing the contract does not list', () => {
    const source = readFileSync(COMPONENT, 'utf8');
    const named = [...source.matchAll(/var\((--[\w-]+)/g)].map((match) => match[1]!);
    const unlisted = [...new Set(named)].filter(
      (token) =>
        !(REFERENCE_TOKENS as readonly string[]).includes(token) &&
        !FALLBACK_TOKENS.includes(token),
    );
    expect(unlisted, `${path.basename(COMPONENT)} names these and nothing declares them`).toEqual(
      [],
    );
  });

  it('lists nothing the component stopped naming', () => {
    const source = readFileSync(COMPONENT, 'utf8');
    const dead = REFERENCE_TOKENS.filter((token) => !source.includes(`var(${token})`));
    expect(dead, 'listed as required, asked for nowhere').toEqual([]);
  });
});

describe('styleGaps', () => {
  it('takes classes as optional, since a component that ships its styles names none', () => {
    expect(styleGaps(':root{--a:1}', ['--a'])).toEqual([]);
    expect(styleGaps(':root{--a:1}', ['--a'], ['.b'])).toEqual(['.b']);
  });
});
