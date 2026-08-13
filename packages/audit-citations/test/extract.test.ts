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

  it('decodes a percent-encoded DOI link', () => {
    // A DOI containing parentheses has to be percent-encoded inside a Markdown link, because an
    // unescaped closing parenthesis would end the link. Reading the encoded form literally
    // truncates the identifier at the first escape and queries a DOI that does not exist.
    expect(extractIdentifiers('[DOI](https://doi.org/10.1016/S1359-0278%2897%2900024-2)')).toEqual([
      { kind: 'doi', value: '10.1016/s1359-0278(97)00024-2' },
    ]);
    expect(extractIdentifiers('https://doi.org/10.1016/S0006-3495%2801%2976033-X')).toEqual([
      { kind: 'doi', value: '10.1016/s0006-3495(01)76033-x' },
    ]);
  });

  it('keeps a stray percent that is not an escape sequence', () => {
    // decodeURIComponent throws on a lone %, and a DOI is not worth losing to it.
    expect(extractIdentifiers('https://doi.org/10.1000/50%off')).toEqual([
      { kind: 'doi', value: '10.1000/50%off' },
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

/**
 * A note whose frontmatter is a typed source-note record carries the two halves of a citation in
 * adjacent fields: `citation` describes the work, and typed identifier fields name it. Read line by
 * line they never meet — the description resolves nothing and the identifiers describe nothing, so
 * a wrong DOI four lines below its own title reports `resolved` and nothing is checked.
 */
describe('typed note frontmatter', () => {
  const NOTE_FRONTMATTER = {
    descriptionField: 'citation',
    identifierFields: ['doi', 'arxiv', 'pmid', 'pmcid'],
  };

  const note = (frontmatter: string, body = '') => [
    {
      path: 'content/papers/example.md',
      artifactKind: 'paper-note',
      text: `---\n${frontmatter}---\n${body}`,
    },
  ];

  it('joins typed identifiers to the citation that describes them', () => {
    const scan = extractCitations(
      note(
        'type: paper\n' +
          'title: Persistent Spectral Graph\n' +
          'citation: Rui Wang, Duc Duy Nguyen, and Guo-Wei Wei, "Persistent spectral graph,"' +
          ' International Journal for Numerical Methods in Biomedical Engineering 36(9) (2020).\n' +
          'source_ids:\n' +
          '  status: declared\n' +
          '  doi: 10.1002/cnm.3376\n' +
          '  arxiv: "1912.04135"\n',
      ),
      { noteFrontmatter: NOTE_FRONTMATTER },
    );

    expect(scan.candidates).toHaveLength(1);
    const candidate = scan.candidates[0];
    expect(candidate?.described?.title).toBe('Persistent spectral graph');
    expect(candidate?.identifiers).toEqual([
      { kind: 'doi', value: '10.1002/cnm.3376' },
      { kind: 'arxiv', value: '1912.04135' },
    ]);
  });

  it('spans the whole frontmatter block rather than one line of it', () => {
    const scan = extractCitations(
      note(
        'title: A Note\ncitation: Example A. "A described work." Journal (2024).\ndoi: 10.1000/x\n',
      ),
      { noteFrontmatter: NOTE_FRONTMATTER },
    );
    expect(scan.candidates[0]?.span.startLine).toBe(2);
    expect(scan.candidates[0]?.span.endLine).toBe(4);
  });

  /** A bare identifier has no prefix for the prose grammar to find, so nothing used to see it. */
  it('reads identifier kinds from the field name rather than a prose prefix', () => {
    const scan = extractCitations(
      note(
        'citation: Example A. "A described work." Journal (2024).\narxiv: "2507.19504"\npmid: "20838408"\npmcid: PMC3880143\n',
      ),
      { noteFrontmatter: NOTE_FRONTMATTER },
    );
    expect(scan.candidates[0]?.identifiers).toEqual([
      { kind: 'arxiv', value: '2507.19504' },
      { kind: 'pmid', value: '20838408' },
      { kind: 'pmcid', value: 'PMC3880143' },
    ]);
  });

  it('does not emit a second candidate for a line inside the block', () => {
    const scan = extractCitations(
      note(
        'citation: Example A. "A described work." Journal (2024).\n' +
          'source_url: https://doi.org/10.1000/x\n' +
          'doi: 10.1000/x\n',
      ),
      { noteFrontmatter: NOTE_FRONTMATTER },
    );
    expect(scan.candidates).toHaveLength(1);
  });

  it('still extracts the body, which owns its own bibliography', () => {
    const scan = extractCitations(
      note(
        'citation: Example A. "A described work." Journal (2024).\ndoi: 10.1000/x\n',
        '## References\n1. Other B. "A different work." Journal (2023). https://doi.org/10.1000/y\n',
      ),
      { noteFrontmatter: NOTE_FRONTMATTER },
    );
    expect(scan.candidates).toHaveLength(2);
    expect(scan.candidates[1]?.described?.title).toBe('A different work');
  });

  /**
   * Opt-in: a corpus that has not declared its fields is extracted exactly as before — which is
   * to say the bare `doi:` line becomes a candidate that describes nothing, and the `citation:`
   * line that describes the same work becomes no candidate at all.
   */
  it('leaves frontmatter to the line grammar when unconfigured', () => {
    const scan = extractCitations(
      note('citation: Example A. "A described work." Journal (2024).\ndoi: 10.1000/x\n'),
    );
    expect(scan.candidates).toHaveLength(1);
    expect(scan.candidates[0]?.identifiers).toEqual([{ kind: 'doi', value: '10.1000/x' }]);
    expect(scan.candidates[0]?.described).toBeUndefined();
  });

  it('emits nothing for frontmatter that names no work', () => {
    const scan = extractCitations(note('type: mold\ntitle: A Mold\n'), {
      noteFrontmatter: NOTE_FRONTMATTER,
    });
    expect(scan.candidates).toEqual([]);
  });

  /**
   * A note may describe a source that has no identifier at all — a web chapter, a package manual,
   * an unpublished draft. Resolving its description by title would ask a provider to guess, and
   * the guess arrives as a finding against a note that is correct.
   */
  it('emits nothing for a described source that declares no identifier', () => {
    const scan = extractCitations(
      note(
        'type: book\n' +
          'citation: "Harmon LJ. Phylogenetic Comparative Methods: Learning from Trees. 2019."\n' +
          'source_ids:\n' +
          '  status: none\n' +
          '  reason: web chapter of an online textbook; no per-chapter identifier assigned\n',
      ),
      { noteFrontmatter: NOTE_FRONTMATTER },
    );
    expect(scan.candidates).toEqual([]);
  });

  it('still resolves a bibliography entry by title when it carries no identifier', () => {
    const scan = extractCitations(
      note(
        'type: paper\ncitation: Example A. "A described work." Journal (2024).\ndoi: 10.1000/x\n',
        '## References\n1. Other B. "A different work." Journal (2023).\n',
      ),
      { noteFrontmatter: NOTE_FRONTMATTER },
    );
    expect(scan.candidates).toHaveLength(2);
    expect(scan.candidates[1]?.identifiers).toEqual([]);
    expect(scan.candidates[1]?.described?.title).toBe('A different work');
  });
});
