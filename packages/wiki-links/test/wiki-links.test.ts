// This package ships no link map, so there is no shipped table to assert invariants on.
// Everything here is about the GRAMMAR and the LOOKUP RULE — the parts three repos wrote
// four byte-identical copies of `slugify` for, and then disagreed about everywhere else.
//
// Several cases below are transcribed from real corpus links that the divergent
// implementations got wrong. They are named as such.

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

  // First pass, and it has to be: `A - B` is one separator. Without it the spaces become
  // dashes and the run-collapse turns `a---b` into `a-b` anyway — but only by luck, and
  // not for `A -B`.
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

  // The property the whole scheme rests on: a note's `name:` and a link typed in prose land
  // on the same key, so `[[Summarize Nextflow]]` finds a note filed as summarize-nextflow.
  it('lands a typed name and a filename on the same key', () => {
    expect(slugify('Summarize Nextflow')).toBe(slugify('summarize-nextflow'));
    expect(slugify('Double Dipping')).toBe(slugify('double-dipping'));
  });

  // The limit of that, and worth pinning because it bites: an INTERNAL hyphen is content,
  // not a separator. `nf-core` keeps its hyphen, so a title-cased link does not reach a note
  // whose filename elided it. Only whitespace and spaced hyphens normalize away.
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

  // Everything left of the pipe is the address, everything right of it is prose — so a `#`
  // in the display text is text, not an anchor.
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
  const map = new Map([
    ['foo', '/notes/foo'],
    ['foo-bar', '/notes/foo-bar'],
    ['foo-bar-baz', '/notes/foo-bar-baz'],
  ]);

  it('resolves an exact slug match', () => {
    expect(resolveWikiLink('[[foo]]', map)).toBe('/notes/foo');
    expect(resolveWikiLink('[[Foo Bar]]', map)).toBe('/notes/foo-bar');
  });

  it('resolves through the anchor and the alias', () => {
    expect(resolveWikiLink('[[foo#section]]', map)).toBe('/notes/foo');
    expect(resolveWikiLink('[[foo|see this]]', map)).toBe('/notes/foo');
  });

  // The rule this package exists to settle. A prefix fallback was surveyed across ~4,200
  // links in two Foundries and resolved exactly two of them — both wrongly. A typed stub is
  // an unfinished link, and answering it with a guess is worse than leaving it visible.
  it('does NOT resolve a prefix', () => {
    expect(resolveWikiLink('[[foo-b]]', map)).toBeUndefined();
    expect(resolveWikiLink('[[fo]]', map)).toBeUndefined();
  });

  // Real link, content/meta/glossary.md in the Galaxy Workflow Foundry. It slugifies to the
  // empty string, and under a prefix rule the empty string is a prefix of every key — so
  // this rendered as a confident link to whichever of 264 notes won the tie.
  it('never resolves an empty slug (the `[[...]]` bug)', () => {
    expect(resolveWikiLink('[[...]]', map)).toBeUndefined();
    expect(resolveWikiLink('[[***]]', map)).toBeUndefined();
    expect(slugify('...')).toBe('');
  });

  // Real link, ingest-positive-selection/comparison.md in the Statistical Genomics Foundry.
  // It means "both Murrell papers"; a prefix rule silently narrowed it to one of them.
  it('never resolves a glob (the `[[murrell-*]]` bug)', () => {
    const papers = new Map([
      ['murrell-2012-meme', '/papers/meme'],
      ['murrell-2015-busted', '/papers/busted'],
    ]);
    expect(resolveWikiLink('[[murrell-*]]', papers)).toBeUndefined();
  });

  it('returns undefined for a non-link and an unknown target', () => {
    expect(resolveWikiLink('[[nope]]', map)).toBeUndefined();
    expect(resolveWikiLink(42, map)).toBeUndefined();
  });
});

describe('WIKI_LINK_RE', () => {
  it('matches a whole-string link, which is the frontmatter-field form', () => {
    expect(WIKI_LINK_RE.test('[[foo]]')).toBe(true);
    expect(WIKI_LINK_RE.test('prose [[foo]] prose')).toBe(false);
  });
});
