import { describe, expect, it } from 'vitest';

import {
  collectionOf,
  collectionsClaiming,
  kindOf,
  matchesCollection,
  type CollectionRoute,
} from '../src/collections.js';

const GALAXY_WORKFLOW_COLLECTIONS = {
  molds: { base: 'content/molds', pattern: ['**/index.md'], kind: 'mold' },
  patterns: { base: 'content/patterns', pattern: ['**/*.md'], kind: 'pattern' },
  'cli-tools': { base: 'content/cli', pattern: ['*/index.md'], kind: 'cli-tool' },
  'cli-commands': { base: 'content/cli', pattern: ['*/*.md', '!*/index.md'], kind: 'cli-command' },
  prompts: { base: 'content/prompts', pattern: ['**/*.md'], kind: 'prompt' },
} as const satisfies Record<string, CollectionRoute>;

const STATISTICAL_GENOMICS_COLLECTIONS = {
  books: { base: 'content/research/books', pattern: ['**/index.md'], kind: 'book' },
  papers: { base: 'content/research/papers', pattern: ['**/index.md'], kind: 'paper' },
  molds: { base: 'content/molds', pattern: ['**/index.md'], kind: 'mold' },
  experiments: { base: 'content/research/experiments', pattern: ['**/index.md'], kind: 'mold' },
} as const satisfies Record<string, CollectionRoute>;

describe('routing a path to its collection', () => {
  it('routes a directory note by its index.md', () => {
    expect(
      collectionOf(GALAXY_WORKFLOW_COLLECTIONS, 'content/molds/summarize-nextflow/index.md'),
    ).toBe('molds');
  });

  it("does not claim a directory note's siblings", () => {
    expect(
      collectionOf(GALAXY_WORKFLOW_COLLECTIONS, 'content/molds/summarize-nextflow/eval.md'),
    ).toBeUndefined();
    expect(
      collectionOf(GALAXY_WORKFLOW_COLLECTIONS, 'content/molds/summarize-nextflow/scenarios.md'),
    ).toBeUndefined();
  });

  it('routes a flat collection at any depth', () => {
    expect(collectionOf(GALAXY_WORKFLOW_COLLECTIONS, 'content/patterns/tabular-joins.md')).toBe(
      'patterns',
    );
    expect(
      collectionOf(GALAXY_WORKFLOW_COLLECTIONS, 'content/patterns/galaxy/collections/map-over.md'),
    ).toBe('patterns');
  });

  it('returns undefined for a file no collection claims', () => {
    expect(collectionOf(GALAXY_WORKFLOW_COLLECTIONS, 'content/Dashboard.md')).toBeUndefined();
    expect(collectionOf(GALAXY_WORKFLOW_COLLECTIONS, 'content/meta/glossary.md')).toBeUndefined();
    expect(collectionOf(GALAXY_WORKFLOW_COLLECTIONS, 'docs/ARCHITECTURE.md')).toBeUndefined();
  });

  it('does not match a base that is only a string prefix of the path', () => {
    expect(
      collectionOf(GALAXY_WORKFLOW_COLLECTIONS, 'content/moldsmith/x/index.md'),
    ).toBeUndefined();
  });

  it('normalizes Windows separators', () => {
    expect(
      collectionOf(GALAXY_WORKFLOW_COLLECTIONS, 'content\\molds\\summarize-nextflow\\index.md'),
    ).toBe('molds');
  });
});

describe('one directory holding two kinds', () => {
  it("routes the tool's index.md to the tool collection", () => {
    expect(collectionOf(GALAXY_WORKFLOW_COLLECTIONS, 'content/cli/gxwf/index.md')).toBe(
      'cli-tools',
    );
    expect(kindOf(GALAXY_WORKFLOW_COLLECTIONS, 'content/cli/gxwf/index.md')).toBe('cli-tool');
  });

  it('routes every other file beside it to the command collection', () => {
    expect(collectionOf(GALAXY_WORKFLOW_COLLECTIONS, 'content/cli/gxwf/tool-search.md')).toBe(
      'cli-commands',
    );
    expect(kindOf(GALAXY_WORKFLOW_COLLECTIONS, 'content/cli/gxwf/tool-search.md')).toBe(
      'cli-command',
    );
  });

  it('keeps the two disjoint, so table order decides nothing', () => {
    expect(collectionsClaiming(GALAXY_WORKFLOW_COLLECTIONS, 'content/cli/gxwf/index.md')).toEqual([
      'cli-tools',
    ]);
    expect(
      collectionsClaiming(GALAXY_WORKFLOW_COLLECTIONS, 'content/cli/gxwf/tool-search.md'),
    ).toEqual(['cli-commands']);
  });

  it('does not reach a depth the patterns do not state', () => {
    expect(collectionOf(GALAXY_WORKFLOW_COLLECTIONS, 'content/cli/loose.md')).toBeUndefined();
    expect(
      collectionOf(GALAXY_WORKFLOW_COLLECTIONS, 'content/cli/gxwf/nested/deep.md'),
    ).toBeUndefined();
  });
});

describe('two collections resolving to one kind', () => {
  it('routes each to its own collection', () => {
    expect(
      collectionOf(STATISTICAL_GENOMICS_COLLECTIONS, 'content/molds/summarize-paper/index.md'),
    ).toBe('molds');
    expect(
      collectionOf(
        STATISTICAL_GENOMICS_COLLECTIONS,
        'content/research/experiments/blind-run-3/index.md',
      ),
    ).toBe('experiments');
  });

  it('resolves both to the same kind', () => {
    expect(kindOf(STATISTICAL_GENOMICS_COLLECTIONS, 'content/molds/summarize-paper/index.md')).toBe(
      'mold',
    );
    expect(
      kindOf(STATISTICAL_GENOMICS_COLLECTIONS, 'content/research/experiments/blind-run-3/index.md'),
    ).toBe('mold');
  });

  it('keeps sibling bases under a shared parent apart', () => {
    expect(
      collectionOf(STATISTICAL_GENOMICS_COLLECTIONS, 'content/research/books/msmb/index.md'),
    ).toBe('books');
    expect(
      collectionOf(STATISTICAL_GENOMICS_COLLECTIONS, 'content/research/papers/leek-2010/index.md'),
    ).toBe('papers');
  });

  it('claims each note exactly once across the whole table', () => {
    for (const filePath of [
      'content/research/books/msmb/index.md',
      'content/research/papers/leek-2010/index.md',
      'content/molds/summarize-paper/index.md',
      'content/research/experiments/blind-run-3/index.md',
    ]) {
      expect(collectionsClaiming(STATISTICAL_GENOMICS_COLLECTIONS, filePath)).toHaveLength(1);
    }
  });
});

describe('matchesCollection', () => {
  it('answers for one collection without consulting the table', () => {
    const molds: CollectionRoute = {
      base: 'content/molds',
      pattern: ['**/index.md'],
      kind: 'mold',
    };
    expect(matchesCollection('content/molds/a/index.md', molds)).toBe(true);
    expect(matchesCollection('content/patterns/a.md', molds)).toBe(false);
  });

  it('treats glob metacharacters in a base or pattern literally', () => {
    const literalMetacharacterRoute: CollectionRoute = {
      base: 'content/a.b',
      pattern: ['*.md'],
      kind: 'x',
    };
    expect(matchesCollection('content/a.b/note.md', literalMetacharacterRoute)).toBe(true);
    expect(matchesCollection('content/axb/note.md', literalMetacharacterRoute)).toBe(false);
  });

  it('does not let `*` cross a separator', () => {
    const flat: CollectionRoute = { base: 'content/x', pattern: ['*.md'], kind: 'x' };
    expect(matchesCollection('content/x/a.md', flat)).toBe(true);
    expect(matchesCollection('content/x/deep/a.md', flat)).toBe(false);
  });

  it('lets `**/` match zero segments', () => {
    const deep: CollectionRoute = { base: 'content/x', pattern: ['**/a.md'], kind: 'x' };
    expect(matchesCollection('content/x/a.md', deep)).toBe(true);
    expect(matchesCollection('content/x/p/q/a.md', deep)).toBe(true);
  });
});
