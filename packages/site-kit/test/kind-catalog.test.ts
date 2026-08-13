import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';

import KindCatalog from '../src/components/KindCatalog.astro';
import KindReference from '../src/components/KindReference.astro';
import { KIND_CATALOG_SPECIMENS, KIND_REFERENCE_SPECIMENS } from '../src/specimens.js';

const catalogSpecimen = (id: string): (typeof KIND_CATALOG_SPECIMENS.specimens)[number] => {
  const found = KIND_CATALOG_SPECIMENS.specimens.find((entry) => entry.id === id);
  if (!found) throw new Error(`no specimen ${KIND_CATALOG_SPECIMENS.id}/${id}`);
  return found;
};

const referenceSpecimen = (id: string): (typeof KIND_REFERENCE_SPECIMENS.specimens)[number] => {
  const found = KIND_REFERENCE_SPECIMENS.specimens.find((entry) => entry.id === id);
  if (!found) throw new Error(`no specimen ${KIND_REFERENCE_SPECIMENS.id}/${id}`);
  return found;
};

describe('KindCatalog', () => {
  it('renders declared layers and keeps open companion sets distinct from empty sets', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(KindCatalog, {
      props: { ...catalogSpecimen('mixed-inventory').props },
    });

    expect(html).toContain('Shared substrate');
    expect(html).toContain('Instance vocabulary');
    expect(html).toContain('0 + open set');
    expect(html).toContain('47 Molds');
    expect(html).toContain('content/packages');
  });

  it('names an empty inventory', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(KindCatalog, {
      props: { ...catalogSpecimen('empty-inventory').props },
    });
    expect(html).toContain('This Foundry declares no kinds.');
  });
});

describe('KindReference', () => {
  it('renders fields, companions, escaped example source, and instance documentation', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(KindReference, {
      props: { ...referenceSpecimen('directory-with-companions').props },
      slots: { documentation: '<h3>Why this kind exists</h3><p>Rendered here.</p>' },
    });

    expect(html).toContain('Metadata contract');
    expect(html).toContain('eval.md');
    expect(html).toContain('recommended · foundry-only');
    expect(html).toContain('type: mold');
    expect(html).toContain('Why this kind exists');
    expect(html).toContain('data-pagefind-ignore');
  });

  it('states that an optional example is absent', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(KindReference, {
      props: { ...referenceSpecimen('flat-without-example').props },
    });
    expect(html).toContain('This manifest does not publish a worked example');
    expect(html).toContain('package.md');
  });

  it('states that an empty declared list is open when additional companions are allowed', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(KindReference, {
      props: { ...referenceSpecimen('open-companion-set').props },
    });
    expect(html).toContain('0 + open set');
    expect(html).toContain('additional companions allowed');
    expect(html).not.toContain('No companions are declared');
  });
});
