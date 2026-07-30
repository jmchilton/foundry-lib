import { describe, it, expect } from 'vitest';

import remarkWikiLinks, { type MdNode } from '../src/remark.js';
import { resolveWikiLink } from '../src/index.js';

const WIKI_LINK_TARGETS = new Map([
  ['foo', { id: 'notes/foo', summary: 'The foo note.' }],
  ['bar', { id: 'notes/bar', summary: 'The bar note.' }],
]);

const transform = remarkWikiLinks({
  resolve: (link) => {
    const target = resolveWikiLink(link.target, WIKI_LINK_TARGETS);
    return target ? { href: `/site/${target.id}/`, title: target.summary } : null;
  },
});

const para = (...children: MdNode[]): MdNode => ({ type: 'paragraph', children });
const text = (value: string): MdNode => ({ type: 'text', value });
const transformTree = (tree: MdNode): MdNode => (transform(tree), tree);

describe('rewriting prose', () => {
  it('turns a resolved link into an anchor carrying the summary as its title', () => {
    const tree = transformTree(para(text('See [[foo]] now.')));
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
    const tree = transformTree(para(text('[[foo#part|that bit]]')));
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
    const tree = transformTree(para(text('[[foo]] and [[bar]]')));
    expect(tree.children?.map((child) => child.type)).toEqual(['link', 'text', 'link']);
  });

  it('renders an unresolved link bold rather than as a dead anchor', () => {
    const tree = transformTree(para(text('See [[missing]].')));
    expect(tree.children).toEqual([
      text('See '),
      { type: 'strong', children: [text('missing')] },
      text('.'),
    ]);
  });

  it('descends into nested containers', () => {
    const tree = transformTree({
      type: 'root',
      children: [{ type: 'blockquote', children: [para(text('[[foo]]'))] }],
    });
    const quoted = tree.children?.[0]?.children?.[0];
    expect(quoted?.children?.[0]?.type).toBe('link');
  });

  it('leaves a text node with no wiki link untouched', () => {
    const node = text('nothing to see');
    const tree = transformTree(para(node));
    expect(tree.children).toEqual([node]);
  });
});

describe('what it deliberately does not rewrite', () => {
  it('leaves inlineCode alone, even when it is exactly one resolvable link', () => {
    const code: MdNode = { type: 'inlineCode', value: '[[foo]]' };
    const tree = transformTree(para(text('Write '), code));
    expect(tree.children).toEqual([text('Write '), code]);
  });

  it('leaves a fenced code block alone', () => {
    const block: MdNode = { type: 'code', value: 'see [[foo]]' };
    const tree = transformTree({ type: 'root', children: [block] });
    expect(tree.children).toEqual([block]);
  });

  it('leaves raw html alone', () => {
    const html: MdNode = { type: 'html', value: '<!-- [[foo]] -->' };
    const tree = transformTree({ type: 'root', children: [html] });
    expect(tree.children).toEqual([html]);
  });

  it('never rewrites inside an existing link', () => {
    const label = text('a [[foo]] label');
    const link: MdNode = { type: 'link', url: '/elsewhere', children: [label] };
    const tree = transformTree(para(link));
    expect(tree.children).toEqual([link]);
    expect(link.children).toEqual([label]);
  });

  it('never rewrites inside a link reference', () => {
    const label = text('[[foo]]');
    const linkReference: MdNode = { type: 'linkReference', children: [label] };
    transformTree(para(linkReference));
    expect(linkReference.children).toEqual([label]);
  });

  it('leaves an empty payload as written', () => {
    const node = text('an empty [[ ]] payload');
    const tree = transformTree(para(node));
    expect(tree.children).toEqual([node]);
  });

  it('leaves an unclosed bracket as written', () => {
    const node = text('an unclosed [[foo and then some');
    const tree = transformTree(para(node));
    expect(tree.children).toEqual([node]);
  });
});

describe('the resolver is the instance half', () => {
  it('asks the caller once per occurrence, with the parsed link', () => {
    const seen: string[] = [];
    const trackingTransform = remarkWikiLinks({
      resolve: (link) => {
        seen.push(`${link.target}|${link.anchor}|${link.display}`);
        return null;
      },
    });
    trackingTransform(para(text('[[a]] [[b#c]] [[d|e]]')));
    expect(seen).toEqual(['a||a', 'b|#c|b#c', 'd||e']);
  });
});
