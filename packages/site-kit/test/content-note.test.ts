import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';

import ContentNote from '../src/components/ContentNote.astro';

describe('content note frame', () => {
  it('frames an H1-owning body without duplicating its heading', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(ContentNote, {
      props: {
        title: 'Package A',
        eyebrow: 'Package',
        summary: 'Package summary.',
        tags: ['method/a'],
        back: { href: '/packages/', label: 'Packages' },
        showHeading: false,
      },
      slots: { default: '<h1>Package A body heading</h1>' },
    });
    // The arrow is `aria-hidden`, so the link reads as its label alone.
    expect(html).toMatch(/<span aria-hidden="true"[^>]*>&larr;<\/span> Packages<\/a>/);
    expect(html).toContain('Package');
    expect(html).toContain('Package summary.');
    expect(html).toContain('<h1>Package A body heading</h1>');
    expect(html).not.toContain('data-pagefind-meta="title">Package A</h1>');
  });

  it('can own the heading for a body that starts in prose', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(ContentNote, {
      props: {
        title: 'Design record',
        eyebrow: 'Design Record',
        summary: 'Why the system has this shape.',
      },
      slots: { default: '<p>The argument.</p>' },
    });
    expect(html).toMatch(/data-pagefind-meta="title"[^>]*>Design record<\/h1>/);
    expect(html).toMatch(/data-pagefind-meta="summary"[^>]*>Why the system has this shape\.<\/p>/);
  });
});
