import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { describe, expect, it } from 'vitest';

import {
  citationAuditConfigSchema,
  citationExtractionOptions,
  loadCitationAuditConfig,
  loadConfiguredDocuments,
  referenceHeadingPattern,
  scholarlyResolverOptions,
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

/**
 * Every field of a configuration, and which mapping has to carry it to the machinery it governs.
 *
 * A consumer that replays an audit offline holds a second caller of the same mapping, so a field
 * the mapping drops is not a missing feature — it is a checked-in report produced by reading the
 * corpus one way and verified by reading it another. The declarations below are what make that
 * mechanical: a field must be claimed, and it must reach exactly the mappings it claims.
 */
const MAPPED_FIELDS = [
  {
    field: 'referenceHeadingTerms',
    override: { referenceHeadingTerms: ['Bibliography'] },
    reaches: ['extraction'],
  },
  {
    field: 'noteFrontmatter',
    override: {
      noteFrontmatter: { descriptionField: 'citation', identifierFields: ['doi'] },
    },
    reaches: ['extraction'],
  },
  {
    field: 'scholarlyPageHosts',
    override: { scholarlyPageHosts: ['proceedings.mlr.press'] },
    reaches: ['extraction', 'resolver'],
  },
  { field: 'userAgent', override: { userAgent: 'example-audit/1.0' }, reaches: ['resolver'] },
  { field: 'requestTimeoutMs', override: { requestTimeoutMs: 5000 }, reaches: ['resolver'] },
] as const satisfies readonly {
  field: string;
  override: Partial<CitationAuditConfig>;
  reaches: readonly ('extraction' | 'resolver')[];
}[];

/** Fields that govern which files are read, or the wire format — not how a document is read. */
const CORPUS_FIELDS = ['schemaVersion', 'sources', 'trackedOnly'] as const;

const MAPPINGS = {
  extraction: citationExtractionOptions,
  resolver: scholarlyResolverOptions,
} as const satisfies Record<string, (config: CitationAuditConfig) => unknown>;

describe('configuration to options mappings', () => {
  it('claims every configuration field', () => {
    const claimed = [...MAPPED_FIELDS.map(({ field }) => field), ...CORPUS_FIELDS];
    expect([...claimed].sort()).toEqual(Object.keys(citationAuditConfigSchema.shape).sort());
  });

  it.each(MAPPED_FIELDS)(
    'carries $field to exactly the options it governs',
    ({ override, reaches }) => {
      const base = config();
      const set = config(override);
      for (const [name, map] of Object.entries(MAPPINGS)) {
        if ((reaches as readonly string[]).includes(name)) {
          expect(map(set), `${name} ignored the field`).not.toEqual(map(base));
        } else {
          expect(map(set), `${name} read a field it does not govern`).toEqual(map(base));
        }
      }
    },
  );

  it('builds extraction options a caller would otherwise hand-write', () => {
    const options = citationExtractionOptions(
      config({
        referenceHeadingTerms: ['Bibliography'],
        scholarlyPageHosts: ['proceedings.mlr.press'],
        noteFrontmatter: { descriptionField: 'citation', identifierFields: ['doi', 'pmid'] },
      }),
    );
    expect(options.referenceHeadingPattern?.test('## Bibliography')).toBe(true);
    expect(options.scholarlyPageHosts).toEqual(['proceedings.mlr.press']);
    expect(options.noteFrontmatter).toEqual({
      descriptionField: 'citation',
      identifierFields: ['doi', 'pmid'],
    });
  });

  /**
   * An unset field is absent, never present and `undefined`. The extractor and the resolver both
   * choose their default by asking whether the key was supplied.
   */
  it('omits an unset option rather than supplying it as undefined', () => {
    expect(citationExtractionOptions(config())).toEqual({ scholarlyPageHosts: [] });
    expect(scholarlyResolverOptions(config())).toEqual({ scholarlyPageHosts: [] });
  });

  it('builds resolver options a caller would otherwise hand-write', () => {
    expect(
      scholarlyResolverOptions(
        config({
          scholarlyPageHosts: ['proceedings.mlr.press'],
          userAgent: 'example-audit/1.0 (https://example.org/contact)',
          requestTimeoutMs: 5000,
        }),
      ),
    ).toEqual({
      scholarlyPageHosts: ['proceedings.mlr.press'],
      userAgent: 'example-audit/1.0 (https://example.org/contact)',
      requestTimeoutMs: 5000,
    });
  });
});
