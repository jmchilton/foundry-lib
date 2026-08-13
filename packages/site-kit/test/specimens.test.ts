import { readdirSync, readFileSync } from 'node:fs';

import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import type { AstroComponentFactory } from 'astro/runtime/server/index.js';
import { describe, expect, it } from 'vitest';

import LicenseBadge from '../src/components/LicenseBadge.astro';
import LicenseFileBody from '../src/components/LicenseFileBody.astro';
import KindCatalog from '../src/components/KindCatalog.astro';
import KindReference from '../src/components/KindReference.astro';
import ReferenceContract from '../src/components/ReferenceContract.astro';
import ContentNote from '../src/components/ContentNote.astro';
import SiteFooter from '../src/components/SiteFooter.astro';
import SiteHeader from '../src/components/SiteHeader.astro';
import SiteShell from '../src/components/SiteShell.astro';
import TagChips from '../src/components/TagChips.astro';
import { PAGEFIND_BODY_ATTR } from '../src/index.js';
import {
  FOOTER_SPECIMENS,
  HEADER_SPECIMENS,
  REFERENCE_SPECIMENS,
  SHELL_SPECIMENS,
  SPECIMENS,
  sharesPage,
  specimenPath,
  type SpecimenGroup,
} from '../src/specimens.js';

// A specimen is a claim that a component handles a case. Nothing about writing one down makes it
// true: props drift from the component that reads them, a case stops rendering, a group names an
// import path the package does not expose — and a gallery is the last place any of it is noticed,
// because a gallery that renders nothing looks like a gallery that is not finished.
//
// So every specimen is rendered here, through the same Astro transform a build gives it.

const COMPONENTS: Record<string, AstroComponentFactory> = {
  KindCatalog,
  KindReference,
  LicenseBadge,
  LicenseFileBody,
  ReferenceContract,
  ContentNote,
  SiteHeader,
  SiteFooter,
  SiteShell,
  TagChips,
};

const render = async (
  group: SpecimenGroup,
  props: unknown,
  slots?: Record<string, string>,
): Promise<string> => {
  const container = await AstroContainer.create();
  const component = COMPONENTS[group.component];
  if (!component) throw new Error(`no component wired for ${group.component}`);
  return container.renderToString(component, {
    props: props as Record<string, unknown>,
    ...(slots ? { slots } : {}),
  });
};

// The shell has a slot, and an empty one renders an empty reading column — which is a fair page
// but a poor specimen. Every other group ignores this.
const slotsFor = (group: SpecimenGroup): Record<string, string> | undefined => {
  if (group.surface === 'document') return { default: '<p>Specimen body.</p>' };
  if (group.component === 'KindReference') {
    return { documentation: '<h2>Why this kind exists</h2><p>Instance-rendered rationale.</p>' };
  }
  if (group.component === 'ContentNote') return { default: '<h1>Note body</h1><p>Evidence.</p>' };
  return undefined;
};

describe('every specimen renders', () => {
  for (const group of SPECIMENS) {
    for (const specimen of group.specimens) {
      it(`${specimenPath(group, specimen)}`, async () => {
        const html = await render(group, specimen.props, slotsFor(group));
        expect(typeof html).toBe('string');
      });
    }
  }
});

// A specimen that shares a page renders INSIDE a consumer's own document, so every href it emits
// lands in that consumer's route space. An absolute one either points at a route the instance does
// not have — a live 404 in its gallery — or, worse, collides with one it does and sends a reader
// somewhere the specimen never meant. Neither is visible from here, which is why it is asserted
// here: the kit cannot see the site it is rendered in.
//
// Framed groups are exempt. They render as whole documents at their own routes, so their nav and
// footer paths are that demo page's chrome rather than a claim on the host's.
describe('an inline specimen claims no destination', () => {
  for (const group of SPECIMENS.filter(sharesPage)) {
    for (const specimen of group.specimens) {
      it(`${specimenPath(group, specimen)}`, async () => {
        const html = await render(group, specimen.props, slotsFor(group));
        const absolute = [...html.matchAll(/href="(\/[^"]*)"/g)].map((m) => m[1]);
        expect(absolute).toEqual([]);
      });
    }
  }
});

describe('a specimen is addressable', () => {
  it('gives every group a distinct prefix', () => {
    // A consumer's own groups share this address space, so a collision here is a collision there:
    // two sections under one anchor, two routes at one path.
    const ids = SPECIMENS.map((group) => group.id);
    expect(ids).toEqual([...new Set(ids)]);
  });

  it('gives every case a distinct address', () => {
    const paths = SPECIMENS.flatMap((group) =>
      group.specimens.map((specimen) => specimenPath(group, specimen)),
    );
    expect(paths).toEqual([...new Set(paths)]);
  });

  it('names an import path the package actually exposes', () => {
    const manifest = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    ) as { name: string; exports: Record<string, unknown> };

    // A group naming a subpath that is not exported fails at the consumer's build, in a gallery
    // that has never been built here — which is the whole reason the group carries the path.
    const exposed = Object.keys(manifest.exports).map((subpath) =>
      subpath === '.' ? manifest.name : `${manifest.name}${subpath.slice(1)}`,
    );
    for (const group of SPECIMENS) {
      expect(exposed, `${group.component} import path`).toContain(group.importPath);
    }
  });
});

/**
 * Components deliberately without specimens, and why.
 *
 * Empty is a claim rather than a stub. It stays empty unless a component has a reason a reader
 * would accept — and "nobody got to it" is not one, which is the whole point of writing the reason
 * beside the name rather than keeping it in someone's head.
 */
const UNSPECIMENED: Record<string, string> = {};

describe('the components the kit ships', () => {
  const shipped = (): string[] =>
    readdirSync(new URL('../src/components', import.meta.url))
      .filter((entry) => entry.endsWith('.astro'))
      .map((entry) => entry.replace(/\.astro$/, ''));

  it('all have specimens, or a declared reason not to', () => {
    // Read from the directory, not from a list here. Two components shipped for months with no
    // cases at all, and nothing was wrong with the specimens that existed — the gap was that
    // nothing compared them to what the package contains. A second consumer found it by reaching
    // for a component the specimens had never heard of.
    const covered = new Set(SPECIMENS.map((group) => group.component));
    const missing = shipped().filter(
      (component) => !covered.has(component) && !(component in UNSPECIMENED),
    );
    expect(missing, '\ncomponents with no specimens').toEqual([]);
  });

  it('are the only components the groups name', () => {
    // The mirror image, and what keeps the exemption list honest: a name left behind after a
    // component is renamed goes on excusing a file that no longer exists.
    const components = new Set(shipped());
    const named = [...SPECIMENS.map((group) => group.component), ...Object.keys(UNSPECIMENED)];

    expect(
      named.filter((component) => !components.has(component)),
      '\nnamed but not shipped',
    ).toEqual([]);
  });
});

describe('the surface a group declares', () => {
  // `surface` decides whether a gallery may put two of these on one page, and getting it wrong
  // does not fail — it produces a page where the second copy's menu and theme toggle silently do
  // nothing. So the declaration is measured against what the component emits, not trusted.

  // `<html>`, not the doctype: the container omits the doctype a build emits, and the root element
  // is the property that matters anyway — it is what cannot be nested inside a page.
  const anyDocument = async (group: SpecimenGroup): Promise<boolean> => {
    for (const specimen of group.specimens) {
      const html = await render(group, specimen.props, slotsFor(group));
      if (/<html[\s>]/i.test(html)) return true;
    }
    return false;
  };

  const anyGlobalName = async (group: SpecimenGroup): Promise<boolean> => {
    for (const specimen of group.specimens) {
      const html = await render(group, specimen.props, slotsFor(group));
      // `id` is the one that bites: the kit's own scripts bind by it, so a repeated element takes
      // the bindings of the first copy and nothing reports the collision.
      if (/\sid="/.test(html)) return true;
    }
    return false;
  };

  for (const group of SPECIMENS) {
    it(`${group.component} declares ${group.surface}`, async () => {
      const emitsDocument = await anyDocument(group);
      const emitsGlobalName = await anyGlobalName(group);

      expect(emitsDocument, 'emits its own <html>').toBe(group.surface === 'document');
      if (group.surface === 'inline') {
        expect(emitsGlobalName, 'carries a document-unique id').toBe(false);
      }
      if (group.surface === 'isolated') {
        // The reason it is not `inline`. A group that stopped carrying one is a group that could
        // be shown beside its siblings, and the gallery should be told.
        expect(emitsGlobalName, 'carries a document-unique id').toBe(true);
      }
    });
  }
});

describe('the cases the reference card exists for', () => {
  const specimen = (id: string) => {
    const found = REFERENCE_SPECIMENS.specimens.find((entry) => entry.id === id);
    if (!found) throw new Error(`no reference specimen ${id}`);
    return found;
  };

  const renderCase = (id: string) => render(REFERENCE_SPECIMENS, specimen(id).props);

  it('renders nothing at all for a note with no references', async () => {
    expect((await renderCase('no-references')).trim()).toBe('');
  });

  it('leaves no anchor without an href when a kind has no destination', async () => {
    const html = await renderCase('kind-without-destination');
    expect(html).toContain('>Research<');
    expect(html.match(/<a (?![^>]*href)[^>]*>/g) ?? []).toEqual([]);
  });

  it('marks a ref that resolved to no page', async () => {
    expect(await renderCase('dangling-ref')).toContain('class="dangling"');
  });

  it('says so rather than rendering a blank chip for a term outside the vocabulary', async () => {
    const html = await renderCase('unregistered-term');
    expect(html).toContain('vibes');
    expect(html).toContain('Not a registered');
  });

  it('colours an evidence chip by the standing its term declares', async () => {
    expect(await renderCase('provisional-evidence')).toContain('data-standing="provisional"');
  });
});

describe('the cases the header exists for', () => {
  const renderCase = async (id: string): Promise<string> => {
    const found = HEADER_SPECIMENS.specimens.find((entry) => entry.id === id);
    if (!found) throw new Error(`no header specimen ${id}`);
    return render(HEADER_SPECIMENS, found.props);
  };

  it('renders no overflow menu when everything fits', async () => {
    expect(await renderCase('everything-fits')).not.toContain('nav-more-trigger');
  });

  it('renders one when it does not', async () => {
    expect(await renderCase('overflows')).toContain('nav-more-trigger');
  });

  it('marks the overflow button when the reader is inside a destination it holds', async () => {
    const html = await renderCase('active-under-more');
    expect(html).toMatch(/id="nav-more-trigger"[\s\S]*?nav-link-active/);
  });

  it('leaves a destination dark on a path that merely starts the same', async () => {
    // `/tags/` against a `/tag/` destination. The prefix bug renders both as current.
    expect(await renderCase('sibling-prefix')).not.toContain('aria-current="page"');
  });
});

describe('the cases the shell exists for', () => {
  const renderCase = async (id: string): Promise<string> => {
    const found = SHELL_SPECIMENS.specimens.find((entry) => entry.id === id);
    if (!found) throw new Error(`no shell specimen ${id}`);
    return render(SHELL_SPECIMENS, found.props, { default: '<p>Specimen body.</p>' });
  };

  it('puts the page in the search index by default', async () => {
    expect(await renderCase('searchable')).toContain(PAGEFIND_BODY_ATTR);
  });

  it('leaves it out when the page opts out', async () => {
    expect(await renderCase('unsearchable')).not.toContain(PAGEFIND_BODY_ATTR);
  });
});

describe('the footer', () => {
  it('links the repository even with no instance links', async () => {
    const found = FOOTER_SPECIMENS.specimens.find((entry) => entry.id === 'repository-only');
    const html = await render(FOOTER_SPECIMENS, found?.props);
    expect(html).toContain('github.com/galaxyproject/foundry');
  });
});
