import { describe, expect, it } from 'vitest';

import { resolveWikiLink } from '../src/index.js';
import { resolveWikiLinksInMarkdown } from '../src/markdown.js';

const WIKI_LINK_TARGETS = new Map([
  ['foo', { id: 'notes/foo', summary: 'The foo note.' }],
  ['bar', { id: 'notes/bar', summary: 'The bar note.' }],
]);

const rewrite = (markdown: string): string =>
  resolveWikiLinksInMarkdown(markdown, {
    resolve: (link) => {
      const target = resolveWikiLink(link.target, WIKI_LINK_TARGETS);
      return target ? { href: `/site/${target.id}/` } : null;
    },
  });

describe('rewriting prose', () => {
  it('turns a resolved link into a markdown link', () => {
    expect(rewrite('See [[foo]] now.')).toBe('See [foo](/site/notes/foo/) now.');
  });

  it('leaves an unresolved link visibly unresolved, in bold', () => {
    expect(rewrite('See [[nowhere]] now.')).toBe('See **nowhere** now.');
  });

  it('appends the anchor to the href and shows the alias', () => {
    expect(rewrite('[[foo#part|that bit]]')).toBe('[that bit](/site/notes/foo/#part)');
  });

  it('rewrites every link on a line', () => {
    expect(rewrite('[[foo]] and [[bar]]')).toBe(
      '[foo](/site/notes/foo/) and [bar](/site/notes/bar/)',
    );
  });

  it('returns markdown with no links unchanged', () => {
    expect(rewrite('Nothing to see here.')).toBe('Nothing to see here.');
  });
});

// The rule the remark transform already holds, on the string layer that did not have it.
// Both Foundry instances resolved raw markdown with a bare `/\[\[([^\[\]]+)\]\]/g`, which
// rewrites inside code spans — so the glossary entry DEFINING the syntax rendered as
// `**Target**` in monospace. See markdown.ts.
describe('a backtick means the syntax, not a link', () => {
  it('leaves a backticked link alone', () => {
    expect(rewrite('The `[[Target]]` token.')).toBe('The `[[Target]]` token.');
  });

  it('leaves a backticked link alone even when it would resolve', () => {
    expect(rewrite('Write `[[foo]]` to link it.')).toBe('Write `[[foo]]` to link it.');
  });

  it('still rewrites prose on either side of a code span', () => {
    expect(rewrite('`[[foo]]` links to [[foo]].')).toBe(
      '`[[foo]]` links to [foo](/site/notes/foo/).',
    );
  });

  it('honours a multi-backtick span', () => {
    expect(rewrite('``[[foo]]`` stays.')).toBe('``[[foo]]`` stays.');
  });

  it('does not let a longer run close a shorter one', () => {
    // A run of 1 is closed by the next run of exactly 1, not by the run of 2.
    expect(rewrite('`a``[[foo]]` b')).toBe('`a``[[foo]]` b');
  });

  it('treats an unclosed backtick as literal text, so the link still resolves', () => {
    expect(rewrite('A stray ` and [[foo]].')).toBe('A stray ` and [foo](/site/notes/foo/).');
  });

  it('leaves a fenced block alone', () => {
    const markdown = [
      'Before [[foo]].',
      '',
      '```',
      'see [[foo]]',
      '```',
      '',
      'After [[bar]].',
    ].join('\n');
    expect(rewrite(markdown)).toBe(
      [
        'Before [foo](/site/notes/foo/).',
        '',
        '```',
        'see [[foo]]',
        '```',
        '',
        'After [bar](/site/notes/bar/).',
      ].join('\n'),
    );
  });

  it('leaves a tilde fence alone', () => {
    expect(rewrite('~~~\n[[foo]]\n~~~')).toBe('~~~\n[[foo]]\n~~~');
  });

  it('does not let a shorter fence close a longer one', () => {
    expect(rewrite('````\n```\n[[foo]]\n````')).toBe('````\n```\n[[foo]]\n````');
  });

  it('leaves an unclosed fence alone to the end of the document', () => {
    expect(rewrite('```\n[[foo]]')).toBe('```\n[[foo]]');
  });
});

// The line this function exists for: statistical-genomics-foundry's glossary entry for the
// wiki-link syntax, which the naive regex rendered as `<code>**Target**</code>`.
describe('the glossary entry that defines the syntax', () => {
  it('renders the token it names', () => {
    const entry = '**Wiki link** — `[[Target]]`. First-class in typed frontmatter fields.';
    expect(rewrite(entry)).toBe(entry);
  });
});
