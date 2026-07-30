import { describe, it, expect } from 'vitest';

import {
  WIKI_LINK_RE,
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
