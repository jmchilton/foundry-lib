import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { describe, expect, it } from 'vitest';

import {
  citationAuditConfigSchema,
  loadCitationAuditConfig,
  loadConfiguredDocuments,
  referenceHeadingPattern,
} from '../src/config.js';
import type { CitationAuditConfig } from '../src/config.js';

const execFileAsync = promisify(execFile);

async function fixtureRepository(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'audit-citations-config-'));
  await mkdir(path.join(root, 'nested'), { recursive: true });
  await writeFile(path.join(root, 'top.md'), 'top\n', 'utf8');
  await writeFile(path.join(root, 'nested', 'deep.md'), 'deep\n', 'utf8');
  await execFileAsync('git', ['-C', root, 'init', '-q']);
  await execFileAsync('git', ['-C', root, 'add', '-A']);
  return root;
}

function config(overrides: Partial<CitationAuditConfig> = {}): CitationAuditConfig {
  return {
    schemaVersion: 1,
    sources: [{ include: ['*.md'], artifactKind: 'note' }],
    ...overrides,
  };
}

describe('citation audit configuration', () => {
  it('selects the same documents whether or not the corpus is restricted to tracked files', async () => {
    const root = await fixtureRepository();
    const untracked = await loadConfiguredDocuments(root, config());
    const tracked = await loadConfiguredDocuments(root, config({ trackedOnly: true }));
    expect(untracked.map((document) => document.path)).toEqual(['top.md']);
    expect(tracked.map((document) => document.path)).toEqual(['top.md']);
  });

  it('restricts a recursive pattern to tracked files without widening it', async () => {
    const root = await fixtureRepository();
    await writeFile(path.join(root, 'nested', 'ignored.md'), 'ignored\n', 'utf8');
    const recursive = config({
      sources: [{ include: ['**/*.md'], artifactKind: 'note' }],
      trackedOnly: true,
    });
    const documents = await loadConfiguredDocuments(root, recursive);
    expect(documents.map((document) => document.path)).toEqual(['nested/deep.md', 'top.md']);
  });

  it('orders documents by code point so the corpus digest does not depend on locale', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'audit-citations-order-'));
    for (const name of ['Zebra.md', 'apple.md', 'a-b.md', 'ab.md']) {
      await writeFile(path.join(root, name), `${name}\n`, 'utf8');
    }
    const documents = await loadConfiguredDocuments(root, config());
    expect(documents.map((document) => document.path)).toEqual([
      'Zebra.md',
      'a-b.md',
      'ab.md',
      'apple.md',
    ]);
  });

  it('rejects a path claimed by two artifact kinds', async () => {
    const root = await fixtureRepository();
    const conflicting = config({
      sources: [
        { include: ['*.md'], artifactKind: 'note' },
        { include: ['top.md'], artifactKind: 'paper' },
      ],
    });
    await expect(loadConfiguredDocuments(root, conflicting)).rejects.toThrow(
      /matches source rules for both note and paper/u,
    );
  });

  it('honours exclude patterns in both tracked and untracked modes', async () => {
    const root = await fixtureRepository();
    const excluded = config({
      sources: [{ include: ['**/*.md'], exclude: ['nested/**'], artifactKind: 'note' }],
    });
    expect((await loadConfiguredDocuments(root, excluded)).map((item) => item.path)).toEqual([
      'top.md',
    ]);
    expect(
      (await loadConfiguredDocuments(root, { ...excluded, trackedOnly: true })).map(
        (item) => item.path,
      ),
    ).toEqual(['top.md']);
  });

  it('escapes heading terms so they match literally', () => {
    const pattern = referenceHeadingPattern(config({ referenceHeadingTerms: ['Sources (a.b)'] }));
    expect(pattern?.test('## Sources (a.b)')).toBe(true);
    expect(pattern?.test('## Sources (axb)')).toBe(false);
  });

  it('rejects unknown configuration fields', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'audit-citations-badconfig-'));
    const configPath = path.join(root, 'config.json');
    await writeFile(
      configPath,
      JSON.stringify({ ...config(), unexpected: true, $schema: undefined }),
      'utf8',
    );
    await expect(loadCitationAuditConfig(configPath)).rejects.toThrow();
  });

  it('accepts a declared note-frontmatter field set', () => {
    const parsed = citationAuditConfigSchema.parse({
      ...config(),
      noteFrontmatter: { descriptionField: 'citation', identifierFields: ['doi', 'arxiv'] },
    });
    expect(parsed.noteFrontmatter?.identifierFields).toEqual(['doi', 'arxiv']);
  });

  /**
   * A field name IS an identifier kind here, so an unknown one is a typo that would otherwise fail
   * silently — the field would be read as ordinary text and its identifier never seen.
   */
  it('rejects an identifier field that is not an identifier kind', () => {
    expect(() =>
      citationAuditConfigSchema.parse({
        ...config(),
        noteFrontmatter: { descriptionField: 'citation', identifierFields: ['source_url'] },
      }),
    ).toThrow();
  });
});
