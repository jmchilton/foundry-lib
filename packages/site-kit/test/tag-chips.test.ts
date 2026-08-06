import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';

import TagChips from '../src/components/TagChips.astro';

const render = async (tagBase?: string): Promise<string> => {
  const container = await AstroContainer.create();
  return container.renderToString(TagChips, {
    props: { tags: ['method/persistent-laplacian'], tagBase },
  });
};

describe('reader tag chips', () => {
  it('renders plain metadata before an instance has a tag browse route', async () => {
    const html = await render();
    expect(html).toMatch(/<span class="content-tag"[^>]*>method\/persistent-laplacian<\/span>/);
    expect(html).not.toContain('href=');
  });

  it('links through the fully based route an instance supplies', async () => {
    const html = await render('/foundry/tags');
    expect(html).toContain('href="/foundry/tags/method/persistent-laplacian/"');
  });
});
