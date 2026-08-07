import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, describe, expect, it, vi } from 'vitest';

import type { CollectionRoute } from '@galaxy-foundry/kind-schema/collections';
import type { MdNode } from '@galaxy-foundry/wiki-links/remark';

import {
  createContentReader,
  noteIdFromPath,
  resolveContentLink,
  resolveContentMarkdown,
} from '../src/index.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'foundry-content-reader-'));
fs.mkdirSync(path.join(root, 'packages'), { recursive: true });
fs.mkdirSync(path.join(root, 'papers', 'nested'), { recursive: true });
fs.writeFileSync(
  path.join(root, 'packages', 'alpha.md'),
  `---
type: cli-command
tool: gxwf
command: validate
summary: Validate a Galaxy workflow.
---
# Alpha
`,
);
fs.writeFileSync(
  path.join(root, 'packages', 'ignored.md'),
  '---\ntype: cli-command\ntool: gxwf\ncommand: companion\n---\n# Untyped\n',
);
fs.writeFileSync(
  path.join(root, 'papers', 'nested', 'index.md'),
  `---
type: mold
name: Summarize Nextflow
summary: Turn a Nextflow pipeline into a structured summary.
---
# Nested
`,
);
fs.writeFileSync(path.join(root, 'glossary.md'), '# Glossary\n');

afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

const collections = {
  packages: { base: 'packages', pattern: ['alpha.md'], kind: 'package' },
  papers: { base: 'papers', pattern: ['**/index.md'], kind: 'paper' },
} as const satisfies Record<string, CollectionRoute>;

const contentReader = createContentReader({
  collections,
  contentPath: (relativePath) => path.join(root, relativePath),
  targetOf: (collection, id) => ({ path: `${collection}/${id}` }),
});

describe('collection-backed content reader', () => {
  it('enumerates collection files from the shared routing table', () => {
    expect(contentReader.noteFiles('packages')).toEqual(['packages/alpha.md']);
    expect(contentReader.noteFiles('papers')).toEqual(['papers/nested/index.md']);
  });

  it('derives flat-file and directory-note ids', () => {
    expect(contentReader.noteIds('packages')).toEqual(['alpha']);
    expect(contentReader.noteIds('papers')).toEqual(['nested']);
    expect(noteIdFromPath('one/two/index.md')).toBe('one/two');
    expect(noteIdFromPath('one.md')).toBe('one');
  });

  it('returns every routed note target in deterministic collection and path order', () => {
    expect(contentReader.noteTargets()).toEqual([
      { collection: 'packages', id: 'alpha', target: { path: 'packages/alpha' } },
      { collection: 'papers', id: 'nested', target: { path: 'papers/nested' } },
    ]);
    expect(contentReader.noteTargets('papers')).toEqual([
      { collection: 'papers', id: 'nested', target: { path: 'papers/nested' } },
    ]);
  });

  it('keeps the broader markdown inventory separate from typed notes', () => {
    expect(contentReader.markdownFiles()).toEqual([
      'glossary.md',
      'packages/alpha.md',
      'packages/ignored.md',
      'papers/nested/index.md',
    ]);
  });

  it('builds the wiki-link map from every routed collection', () => {
    expect(contentReader.wikiLinkMap().get('alpha')).toEqual({ path: 'packages/alpha' });
    expect(contentReader.wikiLinkMap().get('nested')).toEqual({ path: 'papers/nested' });
  });

  it('does not read note contents when frontmatter features are unused', () => {
    const readFile = vi.spyOn(fs, 'readFileSync');
    try {
      contentReader.noteTargets();
      contentReader.wikiLinkMap();
      expect(readFile).not.toHaveBeenCalled();
    } finally {
      readFile.mockRestore();
    }
  });

  it('derives instance aliases and target titles from one frontmatter read', () => {
    const reader = createContentReader({
      collections,
      contentPath: (relativePath) => path.join(root, relativePath),
      aliases: (meta) => {
        if (
          meta.type === 'cli-command' &&
          typeof meta.tool === 'string' &&
          typeof meta.command === 'string'
        ) {
          return [`${meta.tool} ${meta.command}`];
        }
        return meta.type === 'mold' && typeof meta.name === 'string' ? [meta.name] : [];
      },
      targetOf: (collection, id, meta) => {
        const target = { path: `${collection}/${id}` };
        return typeof meta?.summary === 'string' ? { ...target, title: meta.summary } : target;
      },
    });

    const readFile = vi.spyOn(fs, 'readFileSync');
    const targets = reader.noteTargets();
    expect(readFile).toHaveBeenCalledTimes(2);
    readFile.mockRestore();
    expect(targets).toEqual([
      {
        collection: 'packages',
        id: 'alpha',
        target: { path: 'packages/alpha', title: 'Validate a Galaxy workflow.' },
      },
      {
        collection: 'papers',
        id: 'nested',
        target: {
          path: 'papers/nested',
          title: 'Turn a Nextflow pipeline into a structured summary.',
        },
      },
    ]);

    const map = reader.wikiLinkMap();
    expect(map.get('gxwf-validate')).toEqual({
      path: 'packages/alpha',
      title: 'Validate a Galaxy workflow.',
    });
    expect(map.get('summarize-nextflow')).toEqual({
      path: 'papers/nested',
      title: 'Turn a Nextflow pipeline into a structured summary.',
    });
    expect(map.has('gxwf-companion')).toBe(false);
    expect(reader.resolveMarkdown('Run [[gxwf validate]].', { base: '/foundry' })).toBe(
      'Run [gxwf validate](/foundry/packages/alpha/).',
    );

    const tree: MdNode = {
      type: 'root',
      children: [
        { type: 'paragraph', children: [{ type: 'text', value: 'Run [[gxwf validate]].' }] },
      ],
    };
    reader.remarkWikiLinks({ base: '/foundry' })(tree);
    expect(tree).toEqual({
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            { type: 'text', value: 'Run ' },
            {
              type: 'link',
              url: '/foundry/packages/alpha/',
              title: 'Validate a Galaxy workflow.',
              children: [{ type: 'text', value: 'gxwf validate' }],
            },
            { type: 'text', value: '.' },
          ],
        },
      ],
    });
  });

  it('can opt into frontmatter for targets without defining aliases', () => {
    const reader = createContentReader({
      collections,
      contentPath: (relativePath) => path.join(root, relativePath),
      readFrontmatter: true,
      targetOf: (collection, id, meta) => {
        const target = { path: `${collection}/${id}` };
        return typeof meta?.summary === 'string' ? { ...target, title: meta.summary } : target;
      },
    });

    expect(reader.wikiLinkMap().get('alpha')).toEqual({
      path: 'packages/alpha',
      title: 'Validate a Galaxy workflow.',
    });
  });

  it('never registers Markdown companions as link targets', () => {
    expect(contentReader.wikiLinkMap().has('ignored')).toBe(false);
  });

  it('accepts extra content targets without putting them in the collection table', () => {
    const map = contentReader.wikiLinkMap([
      { key: 'Architecture', target: { path: 'design/architecture' } },
    ]);
    expect(map.get('architecture')).toEqual({ path: 'design/architecture' });
  });

  it('resolves prose and preserves code-span syntax through the shared grammar', () => {
    expect(
      contentReader.resolveMarkdown('Read [[Alpha]]. Write `[[Alpha]]`.', { base: '/foundry' }),
    ).toBe('Read [Alpha](/foundry/packages/alpha/). Write `[[Alpha]]`.');
  });

  it('returns a UI-ready href and display label', () => {
    expect(contentReader.resolveLink('[[Alpha#usage|the package]]', { base: '/foundry' })).toEqual({
      href: '/foundry/packages/alpha/#usage',
      label: 'the package',
    });
  });

  it('also binds an already-built map for consumers with one in hand', () => {
    const map = contentReader.wikiLinkMap();
    expect(resolveContentLink('[[Alpha]]', map, '/foundry').href).toBe('/foundry/packages/alpha/');
    expect(resolveContentMarkdown('[[Alpha]]', map, '/foundry')).toBe(
      '[Alpha](/foundry/packages/alpha/)',
    );
  });
});

describe('wiki-link address precedence', () => {
  const collisionRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'foundry-content-collisions-'));
  fs.mkdirSync(path.join(collisionRoot, 'first'), { recursive: true });
  fs.mkdirSync(path.join(collisionRoot, 'second'), { recursive: true });
  fs.writeFileSync(
    path.join(collisionRoot, 'first', 'same.md'),
    '---\nalias: shared address\n---\n# First\n',
  );
  fs.writeFileSync(
    path.join(collisionRoot, 'first', 'first-only.md'),
    '---\nalias: shared address\n---\n# First only\n',
  );
  fs.writeFileSync(
    path.join(collisionRoot, 'second', 'same.md'),
    '---\nalias: first-only\n---\n# Second\n',
  );

  afterAll(() => fs.rmSync(collisionRoot, { recursive: true, force: true }));

  const collisionCollections = {
    first: { base: 'first', pattern: ['*.md'], kind: 'first' },
    second: { base: 'second', pattern: ['*.md'], kind: 'second' },
  } as const satisfies Record<string, CollectionRoute>;

  const reader = createContentReader({
    collections: collisionCollections,
    contentPath: (relativePath) => path.join(collisionRoot, relativePath),
    aliases: (meta) => (typeof meta.alias === 'string' ? [meta.alias] : []),
    targetOf: (collection, id) => ({ path: `${collection}/${id}` }),
  });

  it('lets later collections win primary collisions', () => {
    expect(reader.wikiLinkMap().get('same')).toEqual({ path: 'second/same' });
  });

  it('keeps every routed target even when wiki-link primary addresses collide', () => {
    expect(reader.noteTargets().filter(({ id }) => id === 'same')).toEqual([
      { collection: 'first', id: 'same', target: { path: 'first/same' } },
      { collection: 'second', id: 'same', target: { path: 'second/same' } },
    ]);
  });

  it('never lets an alias overwrite a primary address', () => {
    expect(reader.wikiLinkMap().get('first-only')).toEqual({ path: 'first/first-only' });
  });

  it('lets the first routed note win an alias collision', () => {
    expect(reader.wikiLinkMap().get('shared-address')).toEqual({ path: 'first/first-only' });
  });
});
