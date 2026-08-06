import { describe, it, expect } from 'vitest';

import {
  WIKI_LINK_RE,
  fileSlug,
  parseWikiLink,
  resolveWikiLink,
  slugify,
  stripBrackets,
} from '../src/index.js';

describe('slugify', () => {
  it('lowercases and joins on whitespace', () => {
    expect(slugify('Summarize Nextflow')).toBe('summarize-nextflow');
  });

  it('treats a spaced hyphen as one separator', () => {
    expect(slugify('Foo  -  Bar')).toBe('foo-bar');
    expect(slugify('Foo -Bar')).toBe('foo-bar');
  });

  it('drops everything outside a-z, 0-9 and dash', () => {
    expect(slugify('Foo (bar)?')).toBe('foo-bar');
    expect(slugify('paired ⊏ paired_or_unpaired')).toBe('paired-pairedorunpaired');
  });

  it('collapses dash runs', () => {
    expect(slugify('foo---bar')).toBe('foo-bar');
  });

  it('lands a typed name and a filename on the same key', () => {
    expect(slugify('Summarize Nextflow')).toBe(slugify('summarize-nextflow'));
    expect(slugify('Double Dipping')).toBe(slugify('double-dipping'));
  });

  it('keeps an internal hyphen, so nf-core and nfcore are different keys', () => {
    expect(slugify('Convert nf-core Module')).toBe('convert-nf-core-module');
    expect(slugify('Convert nf-core Module')).not.toBe(slugify('convert-nfcore-module'));
  });
});

describe('fileSlug', () => {
  it('takes the basename, without the extension', () => {
    expect(fileSlug('content/patterns/double-dipping.md')).toBe('double-dipping');
    expect(fileSlug('/abs/content/cli/nf-core.md')).toBe('nf-core');
  });

  it('names a directory note for its directory, not for `index`', () => {
    expect(fileSlug('content/patterns/subworkflow/index.md')).toBe('subworkflow');
    expect(fileSlug('content/molds/summarize-nextflow/index.md')).toBe('summarize-nextflow');
  });

  it('reads a Windows path, since a repo path may arrive either way', () => {
    expect(fileSlug('content\\patterns\\subworkflow\\index.md')).toBe('subworkflow');
  });

  it('meets slugify, which is the only reason a lookup works', () => {
    // The map is built one way and queried the other. If these two ever stop agreeing, a link
    // that resolved yesterday reads as a missing note rather than as a broken rule.
    const notes = ['content/patterns/double-dipping.md', 'content/molds/nf-core-module/index.md'];
    const bySlug = new Map(notes.map((notePath) => [fileSlug(notePath), notePath]));
    expect(resolveWikiLink('[[Double Dipping]]', bySlug)).toBe(notes[0]);
    expect(resolveWikiLink('[[nf-core Module]]', bySlug)).toBe(notes[1]);
  });
});

describe('stripBrackets', () => {
  it('returns the inner text, trimmed', () => {
    expect(stripBrackets('[[Foo]]')).toBe('Foo');
    expect(stripBrackets('[[  Foo  ]]')).toBe('Foo');
  });

  it('returns null for anything that is not exactly one wiki link', () => {
    expect(stripBrackets('see [[Foo]] there')).toBeNull();
    expect(stripBrackets('plain')).toBeNull();
    expect(stripBrackets(42)).toBeNull();
    expect(stripBrackets(undefined)).toBeNull();
  });
});

describe('parseWikiLink', () => {
  it('accepts the bracketed form and the bare payload alike', () => {
    expect(parseWikiLink('[[foo]]')).toEqual({ target: 'foo', anchor: '', display: 'foo' });
    expect(parseWikiLink('foo')).toEqual({ target: 'foo', anchor: '', display: 'foo' });
  });

  it('splits an anchor and carries it through untouched', () => {
    expect(parseWikiLink('[[tests-format#has_text]]')).toEqual({
      target: 'tests-format',
      anchor: '#has_text',
      display: 'tests-format#has_text',
    });
  });

  it('splits a pipe alias', () => {
    expect(parseWikiLink('[[cwl-pickvalue-to-galaxy|the mapping]]')).toEqual({
      target: 'cwl-pickvalue-to-galaxy',
      anchor: '',
      display: 'the mapping',
    });
  });

  it('splits the alias before the anchor', () => {
    expect(parseWikiLink('[[a|b#c]]')).toEqual({ target: 'a', anchor: '', display: 'b#c' });
    expect(parseWikiLink('[[a#c|b]]')).toEqual({ target: 'a', anchor: '#c', display: 'b' });
  });

  it('returns null for an empty payload', () => {
    expect(parseWikiLink('[[]]')).toBeNull();
    expect(parseWikiLink('[[   ]]')).toBeNull();
    expect(parseWikiLink('')).toBeNull();
    expect(parseWikiLink(null)).toBeNull();
  });
});

describe('resolveWikiLink', () => {
  const targetMap = new Map([
    ['foo', '/notes/foo'],
    ['foo-bar', '/notes/foo-bar'],
    ['foo-bar-baz', '/notes/foo-bar-baz'],
  ]);

  it('resolves an exact slug match', () => {
    expect(resolveWikiLink('[[foo]]', targetMap)).toBe('/notes/foo');
    expect(resolveWikiLink('[[Foo Bar]]', targetMap)).toBe('/notes/foo-bar');
  });

  it('resolves through the anchor and the alias', () => {
    expect(resolveWikiLink('[[foo#section]]', targetMap)).toBe('/notes/foo');
    expect(resolveWikiLink('[[foo|see this]]', targetMap)).toBe('/notes/foo');
  });

  it('does NOT resolve a prefix', () => {
    expect(resolveWikiLink('[[foo-b]]', targetMap)).toBeUndefined();
    expect(resolveWikiLink('[[fo]]', targetMap)).toBeUndefined();
  });

  it('never resolves an empty slug (the `[[...]]` bug)', () => {
    expect(resolveWikiLink('[[...]]', targetMap)).toBeUndefined();
    expect(resolveWikiLink('[[***]]', targetMap)).toBeUndefined();
    expect(slugify('...')).toBe('');
  });

  it('never resolves a glob (the `[[murrell-*]]` bug)', () => {
    const papers = new Map([
      ['murrell-2012-meme', '/papers/meme'],
      ['murrell-2015-busted', '/papers/busted'],
    ]);
    expect(resolveWikiLink('[[murrell-*]]', papers)).toBeUndefined();
  });

  it('returns undefined for a non-link and an unknown target', () => {
    expect(resolveWikiLink('[[nope]]', targetMap)).toBeUndefined();
    expect(resolveWikiLink(42, targetMap)).toBeUndefined();
  });
});

describe('WIKI_LINK_RE', () => {
  it('matches a whole-string link, which is the frontmatter-field form', () => {
    expect(WIKI_LINK_RE.test('[[foo]]')).toBe(true);
    expect(WIKI_LINK_RE.test('prose [[foo]] prose')).toBe(false);
  });
});
