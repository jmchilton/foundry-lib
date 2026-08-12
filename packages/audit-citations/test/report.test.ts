import { describe, expect, it } from 'vitest';

import {
  buildCitationAuditRun,
  collectEvidence,
  evidenceId,
  extractCitations,
  renderCitationAuditMarkdown,
} from '../src/index.js';
import type { CitationResolver } from '../src/index.js';

const scan = extractCitations([
  {
    path: 'notes/clean.md',
    artifactKind: 'note',
    text: '## References\n1. Example A. "An example citation." (2024). https://doi.org/10.1000/a\n',
  },
  {
    path: 'notes/suspect.md',
    artifactKind: 'note',
    text:
      '## References\n' +
      '1. Example B. "Another example citation." (2024). https://doi.org/10.1000/b\n' +
      '- Example C. "A bullet entry the extractor cannot read." (2024).\n',
  },
]);

const resolver: CitationResolver = {
  resolve: async (query) => ({
    id: evidenceId(query),
    query,
    provider: 'fixture',
    state: 'resolved',
    observedAt: '2026-08-02T00:00:00.000Z',
    metadata:
      query.type === 'identifier' && query.identifier.value === '10.1000/a'
        ? { title: 'An example citation', authors: ['Example A'], year: 2024, identifiers: [] }
        : {
            title: 'A completely different work',
            authors: ['Grace Other'],
            year: 2023,
            identifiers: [],
          },
  }),
};

async function render(): Promise<string> {
  const collected = await collectEvidence(scan.candidates, undefined, {
    resolver,
    refresh: true,
  });
  const run = buildCitationAuditRun(scan, collected.snapshot, {
    generatedAt: '2026-08-02T00:00:00.000Z',
  });
  return renderCitationAuditMarkdown(run, collected.snapshot);
}

describe('citation audit report', () => {
  it('reports extraction coverage beside the verdict counts', async () => {
    const markdown = await render();
    expect(markdown).toContain('## Extraction coverage');
    expect(markdown).toContain('2 of 3');
  });

  it('rolls findings up per artifact so a concentrated failure is visible', async () => {
    const markdown = await render();
    const rollup = markdown.slice(markdown.indexOf('## Findings per artifact'));
    expect(rollup).toContain('notes/suspect.md');
    expect(rollup.indexOf('notes/suspect.md')).toBeLessThan(rollup.indexOf('notes/clean.md'));
  });
});

/**
 * A bare identifier with no nearby description resolves and can report no mismatch, so counting it
 * beside genuinely verified citations makes a corpus read as fully checked when part of it was only
 * dereferenced. The report states the split rather than leaving it to be derived.
 */
describe('verification reporting', () => {
  const mixed = extractCitations([
    {
      path: 'notes/described.md',
      artifactKind: 'note',
      text: '## References\n1. Example A. "An example citation." (2024). https://doi.org/10.1000/a\n',
    },
    { path: 'notes/bare.md', artifactKind: 'note', text: 'See https://doi.org/10.1000/b\n' },
  ]);

  const agreeable: CitationResolver = {
    resolve: async (query) => ({
      id: evidenceId(query),
      query,
      provider: 'fixture',
      state: 'resolved',
      observedAt: '2026-08-02T00:00:00.000Z',
      metadata: {
        title: 'An example citation.',
        authors: ['Example A'],
        year: 2024,
        identifiers: [],
      },
    }),
  };

  it('separates verified citations from identifiers that merely resolved', async () => {
    const collected = await collectEvidence(mixed.candidates, undefined, {
      resolver: agreeable,
      refresh: true,
    });
    const run = buildCitationAuditRun(mixed, collected.snapshot, {
      generatedAt: '2026-08-02T00:00:00.000Z',
    });

    expect(run.summary.resolved).toBe(2);
    expect(run.summary.resolvedUnverified).toBe(1);

    const markdown = renderCitationAuditMarkdown(run, collected.snapshot);
    expect(markdown).toContain('Verified against a described work: **1 of 2**');
    expect(markdown).toContain('notes/bare.md:1');
    expect(markdown).not.toContain('| `notes/described.md:2` |\n');
  });
});
