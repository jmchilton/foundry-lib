// The transform's job is narrow: rewrite `[[x]]` in prose, and leave every other place it
// can appear exactly as written. Most of these tests are about the "leave it alone" half,
// because that is where the three implementations this replaces disagreed.

import { describe, it, expect } from 'vitest';

import remarkWikiLinks, { type MdNode } from '../src/remark.js';
import { resolveWikiLink } from '../src/index.js';

const MAP = new Map([
  ['foo', { id: 'notes/foo', summary: 'The foo note.' }],
  ['bar', { id: 'notes/bar', summary: 'The bar note.' }],
]);

const transform = remarkWikiLinks({
  resolve: (link) => {
    const t = resolveWikiLink(link.target, MAP);
    return t ? { href: `/site/${t.id}/`, title: t.summary } : null;
  },
});

const para = (...children: MdNode[]): MdNode => ({ type: 'paragraph', children });
const text = (value: string): MdNode => ({ type: 'text', value });
const run = (tree: MdNode): MdNode => (transform(tree), tree);

describe('rewriting prose', () => {
  it('turns a resolved link into an anchor carrying the summary as its title', () => {
    const tree = run(para(text('See [[foo]] now.')));
    expect(tree.children).toEqual([
      text('See '),
      {
        type: 'link',
        url: '/site/notes/foo/',
        title: 'The foo note.',
        children: [text('foo')],
      },
      text(' now.'),
    ]);
  });

  it('appends the anchor to the href and shows the alias', () => {
    const tree = run(para(text('[[foo#part|that bit]]')));
    expect(tree.children).toEqual([
      {
        type: 'link',
        url: '/site/notes/foo/#part',
        title: 'The foo note.',
        children: [text('that bit')],
      },
    ]);
  });

  it('rewrites several links in one text node', () => {
    const tree = run(para(text('[[foo]] and [[bar]]')));
    expect(tree.children?.map((c) => c.type)).toEqual(['link', 'text', 'link']);
  });

  // Visible to a reader, obvious to an author, and never claims to lead anywhere.
  it('renders an unresolved link bold rather than as a dead anchor', () => {
    const tree = run(para(text('See [[missing]].')));
    expect(tree.children).toEqual([
      text('See '),
      { type: 'strong', children: [text('missing')] },
      text('.'),
    ]);
  });

  it('descends into nested containers', () => {
    const tree = run({
      type: 'root',
      children: [{ type: 'blockquote', children: [para(text('[[foo]]'))] }],
    });
    const quoted = tree.children?.[0]?.children?.[0];
    expect(quoted?.children?.[0]?.type).toBe('link');
  });

  it('leaves a text node with no wiki link untouched', () => {
    const node = text('nothing to see');
    const tree = run(para(node));
    expect(tree.children).toEqual([node]);
  });
});

describe('what it deliberately does not rewrite', () => {
  // The rule the whole extraction turned on. A backtick is how the docs name the token and
  // how a note names a slot it cannot link — `[[summary-<source>]]` in the Galaxy Workflow
  // Foundry is a template placeholder, not a broken link.
  it('leaves inlineCode alone, even when it is exactly one resolvable link', () => {
    const code: MdNode = { type: 'inlineCode', value: '[[foo]]' };
    const tree = run(para(text('Write '), code));
    expect(tree.children).toEqual([text('Write '), code]);
  });

  it('leaves a fenced code block alone', () => {
    const block: MdNode = { type: 'code', value: 'see [[foo]]' };
    const tree = run({ type: 'root', children: [block] });
    expect(tree.children).toEqual([block]);
  });

  it('leaves raw html alone', () => {
    const html: MdNode = { type: 'html', value: '<!-- [[foo]] -->' };
    const tree = run({ type: 'root', children: [html] });
    expect(tree.children).toEqual([html]);
  });

  // A nested anchor is invalid HTML and renders unpredictably. One of the three
  // implementations replaced had no guard here at all.
  it('never rewrites inside an existing link', () => {
    const label = text('a [[foo]] label');
    const link: MdNode = { type: 'link', url: '/elsewhere', children: [label] };
    const tree = run(para(link));
    expect(tree.children).toEqual([link]);
    expect(link.children).toEqual([label]);
  });

  it('never rewrites inside a link reference', () => {
    const label = text('[[foo]]');
    const ref: MdNode = { type: 'linkReference', children: [label] };
    run(para(ref));
    expect(ref.children).toEqual([label]);
  });

  // An empty bold run reads as a rendering glitch; the source text is more honest.
  it('leaves an empty payload as written', () => {
    const node = text('an empty [[ ]] payload');
    const tree = run(para(node));
    expect(tree.children).toEqual([node]);
  });

  it('leaves an unclosed bracket as written', () => {
    const node = text('an unclosed [[foo and then some');
    const tree = run(para(node));
    expect(tree.children).toEqual([node]);
  });
});

describe('the resolver is the instance half', () => {
  it('asks the caller once per occurrence, with the parsed link', () => {
    const seen: string[] = [];
    const t = remarkWikiLinks({
      resolve: (l) => {
        seen.push(`${l.target}|${l.anchor}|${l.display}`);
        return null;
      },
    });
    t(para(text('[[a]] [[b#c]] [[d|e]]')));
    expect(seen).toEqual(['a||a', 'b|#c|b#c', 'd||e']);
  });
});
