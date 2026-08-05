import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';

import { buildReferenceContract, type Reference } from '@galaxy-foundry/reference-contract';

import ReferenceContract from '../src/components/ReferenceContract.astro';

// The first test in this package that RENDERS a component rather than reading its source.
//
// Worth the astro devDependency: every other assertion here asks whether the file says something,
// which cannot answer the question this file exists for. A pill is a link or it is not, and that
// is decided by a value the component is handed at runtime — from the instance's own contract, so
// no amount of reading the component tells you which.

const KINDS = {
  // No `href`. An instance's kinds are ITS vocabulary, and there is no shared page to point a
  // reader at — the parent Foundry gives all seven of its kinds one, so it never rendered this
  // case; a sibling gives its three none, and rendered 104 of them on eleven pages.
  research: { label: 'Research', description: 'Background synthesis from a source note.' },
} as const;

const REFERENCE: Reference = {
  kind: 'research',
  ref: '[[a-note]]',
  used_at: 'runtime',
  load: 'upfront',
  mode: 'verbatim',
  evidence: 'corpus-observed',
};

const render = async (references: Reference[] = [REFERENCE]): Promise<string> => {
  const container = await AstroContainer.create();
  return container.renderToString(ReferenceContract, {
    props: { references, contract: buildReferenceContract({ kinds: KINDS }) },
  });
};

/** Anchors with no `href` — elements that look like links and are none. */
const deadAnchors = (html: string): string[] => html.match(/<a (?![^>]*href)[^>]*>/g) ?? [];

describe('the pills a reference card renders', () => {
  it('makes a term with a destination a link', async () => {
    // The four inherited vocabularies carry spec URLs, so their chips are real links and stay so.
    const html = await render();
    expect(html).toMatch(/<a [^>]*href="https:\/\/[^"]+"[^>]*>Runtime<\/a>/);
  });

  it('does not render a term with no destination as an anchor', async () => {
    // `<a>` with no href is valid HTML and is not a link: not focusable, not clickable, announced
    // as plain text — while carrying the same pill styling as the real links beside it. A reader
    // sees something that invites a click and does nothing.
    const html = await render();

    expect(html).toContain('>Research<');
    expect(deadAnchors(html), '\npills that look like links and are not').toEqual([]);
  });

  it('still says what the term means', async () => {
    // The point is to drop the anchor, not the affordance. Whatever element it becomes carries the
    // description, so the hover text a reader could get before is the hover text they get now.
    const html = await render();
    expect(html).toMatch(/<span [^>]*title="Background synthesis from a source note\."/);
  });

  it('renders no card at all for a note that declares no references', async () => {
    expect(await render([])).not.toContain('reference-contract');
  });
});
