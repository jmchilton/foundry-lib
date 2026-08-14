// The note frame: what sits above a note's body on every detail page in the corpus.
//
// `ContentNote` was the thin half of this — back link, tags, optional heading, optional summary.
// The flagship's own `NoteHeader` carried four more things, and none of them are decoration: an
// eyebrow naming the note's kind, a status badge, raw/copy actions, and the pagefind weighting that
// makes a note's own summary outrank its body in search.
//
// The parts an instance cannot supply for itself are what these assert. Package component styles
// are SCOPED, so appearance is not patchable downstream; `data-pagefind-*` sits on elements the
// instance never sees; and a Copy button whose behaviour ships separately is a button that does
// nothing in whichever instance forgets to wire it.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';

import NoteHeader from '../src/components/NoteHeader.astro';
import { NOTE_HEADER_TOKENS } from '../src/index.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** The component's own source, for what the rendered markup cannot show. */
const componentSource = (): string =>
  readFileSync(path.join(HERE, '..', 'src', 'components', 'NoteHeader.astro'), 'utf8');

const BASE_PROPS = {
  title: 'Persistent homology of expression manifolds',
  eyebrow: 'Design Record',
  summary: 'Why the filtration is built on correlation distance rather than Euclidean distance.',
  tags: ['method/persistent-laplacian'],
  tagBase: '/foundry/tags',
};

const render = async (props: Record<string, unknown> = {}): Promise<string> => {
  const container = await AstroContainer.create();
  return container.renderToString(NoteHeader, { props: { ...BASE_PROPS, ...props } });
};

describe('the note frame', () => {
  it('names the kind the note belongs to', async () => {
    // The label itself is the instance's — its kind table is typed against its own kinds, so an
    // added kind is a compile error there rather than an eyebrow printing a raw type string here.
    // The frame takes the resolved string.
    const html = await render();
    expect(html).toContain('Design Record');
  });

  it('carries the search metadata onto elements the instance never sees', async () => {
    // A note's summary describes the note; its body mentions everything the note touches. Without
    // the weight, searching a term the summary leads with ranks behind any page that says it in
    // passing. The attribute belongs to whoever renders the element, and that is this component.
    const html = await render();
    expect(html).toMatch(/<h1[^>]*data-pagefind-meta="title"/);
    expect(html).toMatch(/data-pagefind-weight="10"/);
    expect(html).toMatch(/data-pagefind-meta="summary"/);
  });

  it('states status as data, not as a class the kit would have to style', () => {
    // `badge badge-${status}` puts the vocabulary in the package: a status an instance adds is
    // unstyled until the kit ships a rule for it. Keyed as data, the instance styles
    // `[data-status='...']` in its own sheet and a new value costs no release — the same seam
    // `LicenseBadge` uses for `data-policy`.
    const source = componentSource();
    expect(source).toContain('data-status');
    expect(source, '\na per-status class puts the status vocabulary in the package').not.toMatch(
      /badge-\$\{/,
    );
  });

  it('renders a status only when the note carries one', async () => {
    // Not every kind has a status. Two of six in the adopting instance do.
    expect(await render({ status: undefined })).not.toContain('data-status');
    expect(await render({ status: 'draft' })).toContain('data-status="draft"');
  });

  it('puts the tags below the summary', async () => {
    // The frame reads top-down: where you are, what this is, what it is called, what it says, how
    // it is filed. `ContentNote` had the tags above the heading, which puts filing metadata ahead
    // of the title of the thing being filed.
    const html = await render();
    expect(html.indexOf('data-pagefind-meta="summary"')).toBeLessThan(html.indexOf('content-tag'));
  });

  it('offers the source only when the instance has a route serving it', async () => {
    // Presence of the href IS the switch. A separate `showActions` boolean can be true while the
    // URL is missing, and the two disagreeing renders a Raw link pointing at nothing.
    expect(await render()).not.toContain('Raw');

    const html = await render({ rawHref: '/foundry/raw/design/filtration-choice.md' });
    expect(html).toContain('href="/foundry/raw/design/filtration-choice.md"');
    expect(html).toContain('data-url="/foundry/raw/design/filtration-choice.md"');
  });

  it('ships the behaviour behind its own Copy button', () => {
    // The flagship wires this from the page that renders the header. An instance adopting the
    // component and not the script gets a button that looks live and does nothing — and nothing
    // fails, on either side. A control the package draws is a control the package powers.
    expect(componentSource(), '\na Copy button whose handler ships elsewhere').toMatch(
      /<script[\s>]/,
    );
  });

  it('names every colour it cannot draw itself without', () => {
    // Same reason as the chip: these styles are scoped, so this list is the entire surface an
    // instance can steer the frame through. A token the component reads and this omits is checked
    // by nothing and resolves to nothing.
    const source = componentSource();
    for (const token of NOTE_HEADER_TOKENS) {
      expect(source, `\n${token} is exported as a role but never read`).toContain(`var(${token})`);
    }
    for (const token of source.matchAll(/var\((--[a-z0-9-]+)\)/g)) {
      expect(NOTE_HEADER_TOKENS, `\n${token[1]} is read but not exported as a role`).toContain(
        token[1],
      );
    }
  });
});
