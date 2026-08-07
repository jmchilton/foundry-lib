// The chip a tag renders as, and what it has to be distinguishable FROM.
//
// Both instances that arrived at this component had already answered this, identically: a tag chip
// is a link, coloured like one, on `--color-surface-hover`. Both had reached it the same way, by
// fixing the same defect — a bordered mono pill that read as neutral metadata sitting beside actual
// neutral metadata, so a registered tag with a page behind it and a frontmatter value shown as
// written looked like the same thing. The package shipped the pill anyway, and the instance that
// had already removed it took it back on adoption.
//
// The instance cannot correct this. These styles are SCOPED — the rendered chip carries a
// `data-astro-cid-*` attribute and the `.tag` rule an instance declares in its own stylesheet
// cannot reach it. Everything the appearance can be steered by is in `CONTENT_READER_TOKENS`, which
// is why the token list is asserted here rather than treated as bookkeeping.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';

import TagChips from '../src/components/TagChips.astro';
import { CONTENT_READER_TOKENS } from '../src/index.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** The component's own source, for the assertions about appearance rather than markup. */
const componentCss = (): string =>
  readFileSync(path.join(HERE, '..', 'src', 'components', 'TagChips.astro'), 'utf8');

const render = async (tagBase?: string): Promise<string> => {
  const container = await AstroContainer.create();
  return container.renderToString(TagChips, {
    props: { tags: ['method/persistent-laplacian'], tagBase },
  });
};

/** The one class a tag chip renders as, linked or not. */
const CHIP_CLASS = 'content-tag';

describe('reader tag chips', () => {
  it('renders plain metadata before an instance has a tag browse route', async () => {
    const html = await render();
    expect(html).toMatch(
      new RegExp(`<span class="${CHIP_CLASS}"[^>]*>method/persistent-laplacian</span>`),
    );
    expect(html).not.toContain('href=');
  });

  it('links through the fully based route an instance supplies', async () => {
    const html = await render('/foundry/tags');
    expect(html).toContain('href="/foundry/tags/method/persistent-laplacian/"');
  });

  it('is the same chip whether or not it links', async () => {
    // Asserted because the linked case is the one every note page renders and the one nothing
    // checked: the test above reads the href and says nothing about the class, so a linked chip
    // could drift to a spelling of its own and only the unlinked case — which no adopting instance
    // renders — would report it.
    const linked = await render('/foundry/tags');
    expect(linked).toContain(`class="${CHIP_CLASS}"`);
  });

  it('is coloured as a link, not as neutral metadata', () => {
    // The failure this exists for is not a chip that looks wrong. It is a chip that looks like the
    // pill beside it: same surface, same border, same mono face, differing only in corner radius.
    // Both are legible, both are plausible, and the reader has no way to tell which one is
    // clickable. `--color-link` is the whole difference and it belongs to the chip.
    const css = componentCss();
    expect(css).toContain('var(--color-link)');
    expect(
      css,
      '\na tag chip drawn as a bordered pill reads as metadata, not as a link',
    ).not.toContain('var(--color-border-subtle)');
    expect(
      css,
      '\na mono face is what neutral frontmatter pills use in both instances',
    ).not.toContain('var(--font-mono)');
  });

  it('names every colour the chip cannot draw itself without', () => {
    // `contentReaderStyleGaps` is what tells an instance it is missing one. A token the component
    // reads and this list omits is checked by nothing and resolves to nothing.
    expect(CONTENT_READER_TOKENS).toEqual(
      expect.arrayContaining(['--color-link', '--color-surface-hover']),
    );
  });
});
