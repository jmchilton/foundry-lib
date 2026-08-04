import { describe, expect, it } from 'vitest';

import { SHELL_CLASSES, SHELL_TOKENS, shellStyleGaps } from '../src/index.js';

// The style contract, which was a paragraph in the README until it was a value.
//
// Both instances of this shell satisfied that paragraph, and neither could have told you if it had
// stopped: nothing an instance does to break this produces an error. The utility still compiles,
// the property resolves to nothing, and one region of the page renders with no background. That is
// indistinguishable from a design decision.
//
// The case that matters is `reports a token that is used but never declared` — the reason this is
// a shipped function rather than a list each instance loops over. The obvious loop searches for the
// token name, which the shell's OWN `var(--color-chrome)` satisfies on every site, including the
// ones with no `@theme` block at all.

/** A stylesheet with everything the shell names: declarations, and a rule per class. */
const complete = (): string =>
  [
    `:root{${SHELL_TOKENS.map((token) => `${token}:#000`).join(';')}}`,
    SHELL_CLASSES.map((selector) => `${selector}{color:#000}`).join(''),
    '.min-h-dvh{min-height:100dvh}',
  ].join('\n');

describe('shellStyleGaps', () => {
  it('reports nothing against a stylesheet that supplies all nine', () => {
    expect(shellStyleGaps(complete())).toEqual([]);
  });

  it('reports a token that is used but never declared', () => {
    // What a site with a missing `@theme` entry actually emits: Tailwind compiled the utility, so
    // the name IS in the file — as a reference. A search without the colon finds it and passes.
    const css = `.bg-chrome{background-color:var(--color-chrome)}\n${complete().replace(
      '--color-chrome:#000;',
      '',
    )}`;
    expect(shellStyleGaps(css)).toEqual(['--color-chrome']);
  });

  it('reports a class the instance never defined', () => {
    expect(shellStyleGaps(complete().replace('.skip-link{color:#000}', ''))).toEqual([
      '.skip-link',
    ]);
  });

  it('reports every gap at once, tokens before classes', () => {
    expect(shellStyleGaps('')).toEqual([...SHELL_TOKENS, ...SHELL_CLASSES]);
  });

  it('names roles rather than any instance brand', () => {
    // A brand name in the contract is charged to every instance that is not that brand: it has to
    // declare someone else's identity to get a header bar. Cheap to reintroduce by copying a
    // hex out of the instance you happen to be looking at, so it is asserted rather than trusted.
    expect(SHELL_TOKENS.filter((token) => /galaxy|foundry/i.test(token))).toEqual([]);
  });
});
