import { describe, expect, it } from 'vitest';

import { slugify } from '../src/index.js';
import { addBoldTermAnchors, slugifyTerm } from '../src/anchors.js';

describe('slugifyTerm', () => {
  it('lowercases and hyphenates', () => {
    expect(slugifyTerm('Cast Bundle')).toBe('cast-bundle');
    expect(slugifyTerm('Mold')).toBe('mold');
  });

  it('drops punctuation but keeps hyphens', () => {
    expect(slugifyTerm('C++ / R')).toBe('c-r');
    expect(slugifyTerm('“Phase”')).toBe('phase');
  });

  it('collapses runs of whitespace, and trims', () => {
    expect(slugifyTerm('  Phase  2  ')).toBe('phase-2');
  });

  it('returns the empty string when nothing survives', () => {
    expect(slugifyTerm('***')).toBe('');
    expect(slugifyTerm('   ')).toBe('');
  });

  it('is deliberately NOT slugify', () => {
    expect(slugifyTerm('A - B')).toBe('a---b');
    expect(slugify('A - B')).toBe('a-b');

    expect(slugifyTerm('snake_case term')).toBe('snake_case-term');
    expect(slugify('snake_case term')).toBe('snakecase-term');

    expect(slugifyTerm('Foo--Bar')).toBe('foo--bar');
    expect(slugify('Foo--Bar')).toBe('foo-bar');
  });
});

describe('addBoldTermAnchors', () => {
  it('ids a bold-led paragraph by its term', () => {
    expect(addBoldTermAnchors('<p><strong>Mold</strong> is a thing.</p>')).toBe(
      '<p id="mold"><strong>Mold</strong> is a thing.</p>',
    );
  });

  it('preserves the whitespace between the tag and the term', () => {
    expect(addBoldTermAnchors('<p>\n  <strong>Cast</strong> x</p>')).toBe(
      '<p id="cast">\n  <strong>Cast</strong> x</p>',
    );
  });

  it('ids every entry, not just the first', () => {
    const html = '<p><strong>One</strong> a</p><p><strong>Two</strong> b</p>';
    expect(addBoldTermAnchors(html)).toBe(
      '<p id="one"><strong>One</strong> a</p><p id="two"><strong>Two</strong> b</p>',
    );
  });

  it('leaves a paragraph that does not lead with bold alone', () => {
    const html = '<p>Prose with <strong>bold</strong> inside.</p>';
    expect(addBoldTermAnchors(html)).toBe(html);
  });

  it('leaves a term that slugifies to nothing alone', () => {
    const html = '<p><strong>***</strong> x</p>';
    expect(addBoldTermAnchors(html)).toBe(html);
  });

  it('leaves html with no bold-led paragraphs untouched', () => {
    expect(addBoldTermAnchors('<h1>Glossary</h1>')).toBe('<h1>Glossary</h1>');
  });
});
