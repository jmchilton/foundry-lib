import { describe, expect, it } from 'vitest';

import { extractCitations, extractIdentifiers } from '../src/index.js';

describe('citation extraction', () => {
  it('normalizes and deduplicates strong identifiers', () => {
    expect(
      extractIdentifiers(
        'arXiv:2507.19504v2 https://arxiv.org/abs/2507.19504 ' +
          'https://doi.org/10.1000/ABC.123. PMID: 12345678 PMC1234567',
      ),
    ).toEqual([
      { kind: 'doi', value: '10.1000/abc.123' },
      { kind: 'arxiv', value: '2507.19504' },
      { kind: 'pmid', value: '12345678' },
      { kind: 'pmcid', value: 'PMC1234567' },
    ]);
  });

  it('treats only configured citation-metadata hosts as scholarly pages', () => {
    const text =
      '[paper](https://proceedings.mlr.press/v235/example.html) ' +
      '[docs](https://example.org/docs.html)';
    expect(extractIdentifiers(text, ['proceedings.mlr.press'])).toEqual([
      { kind: 'url', value: 'https://proceedings.mlr.press/v235/example.html' },
    ]);
  });

  it('extracts explicit bibliography metadata without knowing repository paths', () => {
    const scan = extractCitations([
      {
        path: 'notes/sources.md',
        artifactKind: 'research-note',
        text:
          '# Sources\n\n## Selected references\n\n' +
          '1. Example A. "A deliberately explicit scholarly title." Journal (2024).\n',
      },
    ]);
    expect(scan.candidates).toHaveLength(1);
    expect(scan.candidates[0]?.span.artifactKind).toBe('research-note');
    expect(scan.candidates[0]?.described).toMatchObject({
      title: 'A deliberately explicit scholarly title',
      authors: ['Example A'],
      year: 2024,
    });
  });

  it('keeps logical IDs stable when unrelated lines move a citation', () => {
    const citation =
      '1. Example A. "A deliberately explicit scholarly title." Journal (2024). ' +
      '[DOI](https://doi.org/10.1000/example)';
    const first = extractCitations([
      {
        path: 'notes/example.md',
        artifactKind: 'note',
        text: `## References\n${citation}\n`,
      },
    ]);
    const moved = extractCitations([
      {
        path: 'notes/example.md',
        artifactKind: 'note',
        text: `# Heading\n\n## References\n${citation}\n`,
      },
    ]);
    expect(first.candidates[0]?.id).toBe(moved.candidates[0]?.id);
    expect(first.candidates[0]?.span.startLine).not.toBe(moved.candidates[0]?.span.startLine);
  });

  it('measures author-year patterns without extracting them and excludes generic URLs', () => {
    const scan = extractCitations([
      {
        path: 'notes/example.md',
        artifactKind: 'note',
        text: 'Su et al. (2025) provide [code](https://github.com/example/tool).\n',
      },
    ]);
    expect(scan.candidates).toHaveLength(0);
    expect(scan.diagnostics.authorYearPatternCount).toBe(1);
    expect(scan.diagnostics.excludedUrls).toHaveLength(1);
  });

  it('keeps unsupported legacy and multiline forms outside the experimental grammar', () => {
    expect(
      extractIdentifiers('arXiv:hep-th/9901001 PMID: 1234 PMC1234 https://papers.example/article', [
        'papers.example',
      ]),
    ).toEqual([]);
    const scan = extractCitations([
      {
        path: 'notes/example.md',
        artifactKind: 'note',
        text:
          '## References\n' +
          '- Example A. "A bullet reference that is intentionally unsupported." (2024).\n',
      },
    ]);
    expect(scan.candidates).toHaveLength(0);
  });

  it('counts reference-section lines it could not extract', () => {
    const scan = extractCitations([
      {
        path: 'notes/example.md',
        artifactKind: 'note',
        text:
          '# Notes\n\nProse outside the reference section.\n\n' +
          '## References\n\n' +
          '1. Example A. "A supported entry." (2024).\n' +
          '- Example B. "A bullet entry." (2024).\n',
      },
    ]);
    expect(scan.candidates).toHaveLength(1);
    expect(scan.diagnostics.unextractedReferenceLines).toEqual([
      { artifactPath: 'notes/example.md', line: 8 },
    ]);
  });

  it('splits a bibliography author list instead of keeping one blob', () => {
    const scan = extractCitations([
      {
        path: 'notes/example.md',
        artifactKind: 'note',
        text:
          '## References\n' +
          '1. Sidarta-Oliveira D, Domingos AI. "A multi-author entry." (2025).\n',
      },
    ]);
    expect(scan.candidates[0]?.described?.authors).toEqual(['Sidarta-Oliveira D', 'Domingos AI']);
  });

  it('keeps a family-name-first author list from splitting on its own commas', () => {
    const scan = extractCitations([
      {
        path: 'notes/example.md',
        artifactKind: 'note',
        text: '## References\n1. Smith, J., Doe, A. "A compressed author list." (2024).\n',
      },
    ]);
    expect(scan.candidates[0]?.described?.authors).toEqual(['Smith, J.', 'Doe, A']);
  });
});
