import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import type { CollectionRoute } from '@galaxy-foundry/kind-schema/collections';

import {
  createContentReader,
  noteIdFromPath,
  resolveContentLink,
  resolveContentMarkdown,
} from '../src/index.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'foundry-content-reader-'));
fs.mkdirSync(path.join(root, 'packages'), { recursive: true });
fs.mkdirSync(path.join(root, 'papers', 'nested'), { recursive: true });
fs.writeFileSync(path.join(root, 'packages', 'alpha.md'), '# Alpha\n');
fs.writeFileSync(path.join(root, 'packages', 'ignored.md'), '# Untyped\n');
fs.writeFileSync(path.join(root, 'papers', 'nested', 'index.md'), '# Nested\n');
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
