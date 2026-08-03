import { describe, expect, it } from 'vitest';

import { resolveNav, shellBase, shellHref, type ShellLink } from '../src/index.js';

// The active-link rule, tested for the first time.
//
// It reached this package from two instances that each carried it as a per-entry closure — one
// line, repeated fifteen times, plus a sixteenth that excluded a route pair neither repo had ever
// had. Sixteen copies and no test between them: a closure cannot be handed to a shared component,
// and it also cannot be asserted on without building a site. Written as data, it is fourteen cases.

const NAV: ShellLink[] = [
  { path: '/story/', label: 'Story' },
  { path: '/molds/', label: 'Molds' },
  { path: '/tags/', label: 'Tags' },
  { path: '/log/', label: 'Log' },
];

const labelsOf = (links: { label: string }[]) => links.map((link) => link.label);
const activeIn = (links: { label: string; active: boolean }[]) =>
  links.filter((link) => link.active).map((link) => link.label);

describe('resolveNav', () => {
  it('marks the section the reader is in', () => {
    const nav = resolveNav(NAV, 4, '/', '/molds/');
    expect(activeIn(nav.bar)).toEqual(['Molds']);
  });

  it('marks a section the reader is beneath', () => {
    const nav = resolveNav(NAV, 4, '/', '/molds/summarize-nextflow/');
    expect(activeIn(nav.bar)).toEqual(['Molds']);
  });

  // The whole reason the comparison is on segments rather than a prefix. `/tag/` shares five
  // characters with `/tags/`, and a `startsWith` on the raw href lights up the wrong one.
  it("does not mark a section whose path is merely a prefix of the reader's", () => {
    const nav = resolveNav([{ path: '/tag/', label: 'Tag' }, ...NAV], 5, '/', '/tags/');
    expect(activeIn(nav.bar)).toEqual(['Tags']);
  });

  it('marks nothing on a page under no section', () => {
    expect(activeIn(resolveNav(NAV, 4, '/', '/glossary/').bar)).toEqual([]);
  });

  it('answers the same with or without trailing slashes on either side', () => {
    const withSlash = resolveNav(NAV, 4, '/foundry/', '/foundry/molds/');
    const without = resolveNav(NAV, 4, '/foundry', '/foundry/molds');
    expect(activeIn(withSlash.bar)).toEqual(['Molds']);
    expect(activeIn(without.bar)).toEqual(activeIn(withSlash.bar));
  });

  it('emits every href under the base the site deploys at', () => {
    const nav = resolveNav(NAV, 4, '/foundry/', '/foundry/');
    expect(nav.bar.map((link) => link.href)).toEqual([
      '/foundry/story/',
      '/foundry/molds/',
      '/foundry/tags/',
      '/foundry/log/',
    ]);
  });

  it('compares against the based href, not the bare path', () => {
    // A site deployed at `/foundry` has no page at `/molds/` — that URL belongs to something else.
    // Comparing `link.path` instead of the resolved href marks it active anyway, and the two
    // instances deploy at different bases, so the wrong answer is reachable rather than theoretical.
    expect(activeIn(resolveNav(NAV, 4, '/foundry/', '/molds/').bar)).toEqual([]);
  });

  it('cuts the list at navVisible, keeping order on both sides', () => {
    const nav = resolveNav(NAV, 2, '/', '/');
    expect(labelsOf(nav.bar)).toEqual(['Story', 'Molds']);
    expect(labelsOf(nav.more)).toEqual(['Tags', 'Log']);
  });

  it('puts nothing under More when everything fits, rather than omitting it', () => {
    const nav = resolveNav(NAV, 4, '/', '/');
    expect(nav.more).toEqual([]);
    expect(nav.moreActive).toBe(false);
  });

  it('keeps every destination on one side of the cut or the other', () => {
    const nav = resolveNav(NAV, 2, '/', '/');
    expect(labelsOf([...nav.bar, ...nav.more])).toEqual(labelsOf(NAV));
  });

  it('reports moreActive when the reader is inside a section under More, and not otherwise', () => {
    expect(resolveNav(NAV, 2, '/', '/log/entry/').moreActive).toBe(true);
    expect(resolveNav(NAV, 2, '/', '/molds/').moreActive).toBe(false);
  });

  it('holds a navVisible past the end of the list, rather than throwing', () => {
    const nav = resolveNav(NAV, 99, '/', '/');
    expect(labelsOf(nav.bar)).toEqual(labelsOf(NAV));
    expect(nav.more).toEqual([]);
  });
});

describe('shellBase and shellHref', () => {
  it('normalizes the domain root to the empty string', () => {
    expect(shellBase('/')).toBe('');
    expect(shellHref(shellBase('/'), { path: '/books/', label: 'Books' })).toBe('/books/');
  });

  it('strips a trailing slash so hrefs do not double it', () => {
    expect(shellHref(shellBase('/foundry/'), { path: '/books/', label: 'Books' })).toBe(
      '/foundry/books/',
    );
  });
});
