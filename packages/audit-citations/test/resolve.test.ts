import { describe, expect, it } from 'vitest';

import { ScholarlyResolver, evidenceId } from '../src/index.js';
import type { EvidenceQuery, FetchLike } from '../src/index.js';

function jsonResponse(payload: unknown, status = 200): Awaited<ReturnType<FetchLike>> {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 404 ? 'Not Found' : 'OK',
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  };
}

/** An empty but successful search result for whichever index the URL names. */
function emptySearchResponse(url: string): Awaited<ReturnType<FetchLike>> {
  if (url.includes('api.crossref.org')) return jsonResponse({ message: { items: [] } });
  if (url.includes('api.openalex.org')) return jsonResponse({ results: [] });
  if (url.includes('api.semanticscholar.org')) return jsonResponse({ data: [] });
  return jsonResponse({ result: { hits: {} } });
}

/**
 * Runs the bibliographic chain with every index empty except those named in `payloads`, so a test
 * states only the index it cares about.
 */
function resolveBibliographic(
  query: EvidenceQuery,
  payloads: Record<string, unknown>,
): Promise<Awaited<ReturnType<ScholarlyResolver['resolve']>>> {
  return new ScholarlyResolver({
    fetch: async (url) => {
      const match = Object.entries(payloads).find(([host]) => url.includes(host));
      return match ? jsonResponse(match[1]) : emptySearchResponse(url);
    },
    crossrefDelayMs: 0,
    now: () => '2026-08-02T00:00:00.000Z',
  }).resolve(query);
}

describe('scholarly resolvers', () => {
  it('normalizes Crossref responses to matcher fields', async () => {
    const fetch: FetchLike = async () =>
      jsonResponse({
        message: {
          DOI: '10.1000/EXAMPLE',
          title: ['An example'],
          author: [{ given: 'Ada', family: 'Lovelace' }],
          published: { 'date-parts': [[2024]] },
          abstract: 'must not be retained',
        },
      });
    const query: EvidenceQuery = {
      type: 'identifier',
      identifier: { kind: 'doi', value: '10.1000/example' },
    };
    const evidence = await new ScholarlyResolver({
      fetch,
      crossrefDelayMs: 0,
      now: () => '2026-08-02T00:00:00.000Z',
    }).resolve(query);
    expect(evidence).toMatchObject({
      id: evidenceId(query),
      state: 'resolved',
      provider: 'crossref',
      metadata: {
        title: 'An example',
        authors: ['Ada Lovelace'],
        year: 2024,
        identifiers: [{ kind: 'doi', value: '10.1000/example' }],
      },
    });
    expect(JSON.stringify(evidence)).not.toContain('abstract');
  });

  it('distinguishes a missing identifier from provider failure', async () => {
    const query: EvidenceQuery = {
      type: 'identifier',
      identifier: { kind: 'doi', value: '10.1000/missing' },
    };
    const missing = await new ScholarlyResolver({
      fetch: async () => jsonResponse({}, 404),
      crossrefDelayMs: 0,
    }).resolve(query);
    const failed = await new ScholarlyResolver({
      fetch: async () => {
        throw new Error('network offline');
      },
      crossrefDelayMs: 0,
    }).resolve(query);
    expect(missing.state).toBe('unresolved');
    expect(failed.state).toBe('unavailable');
  });

  it('resolves a DOI Crossref does not register through content negotiation', async () => {
    const query: EvidenceQuery = {
      type: 'identifier',
      identifier: { kind: 'doi', value: '10.5281/zenodo.1234567' },
    };
    const requested: string[] = [];
    const fetch: FetchLike = async (url) => {
      requested.push(url);
      if (url.includes('api.crossref.org')) return jsonResponse({}, 404);
      return jsonResponse({
        DOI: '10.5281/ZENODO.1234567',
        title: 'A deposited dataset',
        author: [{ given: 'Ada', family: 'Lovelace' }, { literal: 'Example Consortium' }],
        issued: { 'date-parts': [[2024, 3, 1]] },
      });
    };
    const evidence = await new ScholarlyResolver({
      fetch,
      crossrefDelayMs: 0,
      now: () => '2026-08-02T00:00:00.000Z',
    }).resolve(query);
    expect(requested.some((url) => url.startsWith('https://doi.org/'))).toBe(true);
    expect(evidence).toMatchObject({
      state: 'resolved',
      provider: 'doi-content-negotiation',
      metadata: {
        title: 'A deposited dataset',
        authors: ['Ada Lovelace', 'Example Consortium'],
        year: 2024,
        identifiers: [{ kind: 'doi', value: '10.5281/zenodo.1234567' }],
      },
    });
  });

  it('keeps a DOI no registration agency knows unresolved', async () => {
    const query: EvidenceQuery = {
      type: 'identifier',
      identifier: { kind: 'doi', value: '10.1000/invented' },
    };
    const evidence = await new ScholarlyResolver({
      fetch: async () => jsonResponse({}, 404),
      crossrefDelayMs: 0,
    }).resolve(query);
    expect(evidence.state).toBe('unresolved');
  });

  it('does not call a DOI unresolved when the second agency check could not run', async () => {
    const query: EvidenceQuery = {
      type: 'identifier',
      identifier: { kind: 'doi', value: '10.5281/zenodo.1234567' },
    };
    const evidence = await new ScholarlyResolver({
      fetch: async (url) => {
        if (url.includes('api.crossref.org')) return jsonResponse({}, 404);
        throw new Error('network offline');
      },
      crossrefDelayMs: 0,
    }).resolve(query);
    expect(evidence.state).toBe('unavailable');
  });

  it('searches further indexes when the earlier ones do not carry the title', async () => {
    const query: EvidenceQuery = {
      type: 'bibliographic',
      title: 'A conference paper indexed only by DBLP',
    };
    const semanticScholar = await resolveBibliographic(query, {
      'api.semanticscholar.org': {
        data: [
          {
            title: 'A conference paper indexed only by DBLP',
            authors: [{ name: 'Ada Lovelace' }],
            year: 2024,
            externalIds: { DOI: '10.1000/S2', ArXiv: '2401.00001' },
          },
        ],
      },
    });
    expect(semanticScholar).toMatchObject({
      state: 'resolved',
      provider: 'semantic-scholar',
      metadata: {
        authors: ['Ada Lovelace'],
        year: 2024,
        identifiers: [
          { kind: 'doi', value: '10.1000/s2' },
          { kind: 'arxiv', value: '2401.00001' },
        ],
      },
    });

    const dblp = await resolveBibliographic(query, {
      'dblp.org': {
        result: {
          hits: {
            hit: [
              {
                info: {
                  title: 'A conference paper indexed only by DBLP.',
                  authors: { author: { text: 'Ada Lovelace' } },
                  year: '2024',
                  doi: '10.1000/DBLP',
                },
              },
            ],
          },
        },
      },
    });
    expect(dblp).toMatchObject({
      state: 'resolved',
      provider: 'dblp',
      metadata: {
        title: 'A conference paper indexed only by DBLP',
        authors: ['Ada Lovelace'],
        year: 2024,
        identifiers: [{ kind: 'doi', value: '10.1000/dblp' }],
      },
    });
  });

  it('reports a search that could not run as unavailable rather than unresolved', async () => {
    const query: EvidenceQuery = { type: 'bibliographic', title: 'A title nobody indexed' };
    const searched = await resolveBibliographic(query, {});
    expect(searched.state).toBe('unresolved');

    const outage = await new ScholarlyResolver({
      fetch: async (url) => {
        if (url.includes('api.openalex.org')) throw new Error('network offline');
        return emptySearchResponse(url);
      },
      crossrefDelayMs: 0,
    }).resolve(query);
    expect(outage.state).toBe('unavailable');
    expect(outage.error).toContain('openalex');
  });

  it('rejects Crossref payloads with missing metadata or the wrong DOI', async () => {
    const query: EvidenceQuery = {
      type: 'identifier',
      identifier: { kind: 'doi', value: '10.1000/example' },
    };
    const wrongIdentity = await new ScholarlyResolver({
      fetch: async () =>
        jsonResponse({
          message: { DOI: '10.1000/other', title: ['Another paper'] },
        }),
      crossrefDelayMs: 0,
    }).resolve(query);
    const missingTitle = await new ScholarlyResolver({
      fetch: async () =>
        jsonResponse({
          message: { DOI: '10.1000/example', title: [] },
        }),
      crossrefDelayMs: 0,
    }).resolve(query);
    expect(wrongIdentity).toMatchObject({
      state: 'unavailable',
      error: expect.stringContaining('did not identify requested'),
    });
    expect(missingTitle).toMatchObject({
      state: 'unavailable',
      error: expect.stringContaining('Invalid provider metadata'),
    });
  });

  it('falls back to the arXiv feed when OpenAlex returns the wrong identity', async () => {
    const query: EvidenceQuery = {
      type: 'identifier',
      identifier: { kind: 'arxiv', value: '2401.00001' },
    };
    const fetch: FetchLike = async (url) => {
      if (url.includes('api.openalex.org')) {
        return jsonResponse({
          display_name: 'An unrelated paper',
          doi: 'https://doi.org/10.1000/other',
        });
      }
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({}),
        text: async () =>
          '<feed><entry><title>The arXiv paper</title>' +
          '<author><name>Ada Example</name></author>' +
          '<published>2024-01-02T00:00:00Z</published></entry></feed>',
      };
    };
    const evidence = await new ScholarlyResolver({ fetch }).resolve(query);
    expect(evidence).toMatchObject({
      state: 'resolved',
      provider: 'arxiv',
      metadata: {
        title: 'The arXiv paper',
        identifiers: [{ kind: 'arxiv', value: '2401.00001' }],
      },
    });
  });

  it('requires Europe PMC results to contain the requested identifier', async () => {
    const query: EvidenceQuery = {
      type: 'identifier',
      identifier: { kind: 'pmid', value: '12345' },
    };
    const evidence = await new ScholarlyResolver({
      fetch: async () =>
        jsonResponse({
          resultList: {
            result: [{ pmid: '99999', title: 'The wrong paper', authorString: 'Other A' }],
          },
        }),
    }).resolve(query);
    expect(evidence).toMatchObject({
      state: 'unavailable',
      error: expect.stringContaining('did not identify requested'),
    });
  });

  it('re-checks the allowlist after redirects before reading citation meta tags', async () => {
    const query: EvidenceQuery = {
      type: 'identifier',
      identifier: { kind: 'url', value: 'https://trusted.example/paper.html' },
    };
    const evidence = await new ScholarlyResolver({
      scholarlyPageHosts: ['trusted.example'],
      now: () => '2026-08-02T00:00:00.000Z',
      fetch: async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        url: 'https://elsewhere.example/paper.html',
        json: async () => ({}),
        text: async () => '<meta name="citation_title" content="Redirected paper">',
      }),
    }).resolve(query);
    expect(evidence).toMatchObject({ state: 'unavailable' });
    expect(evidence.error).toMatch(/elsewhere\.example/u);
    expect(evidence.metadata).toBeUndefined();
  });

  it('requires an allowlisted host before reading citation meta tags', async () => {
    const query: EvidenceQuery = {
      type: 'identifier',
      identifier: { kind: 'url', value: 'https://papers.example/a.html' },
    };
    const fetch: FetchLike = async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({}),
      text: async () =>
        '<meta name="citation_title" content="A paper">' +
        '<meta name="citation_author" content="Ada Example">' +
        '<meta name="citation_publication_date" content="2024/01/02">',
    });
    const denied = await new ScholarlyResolver({ fetch }).resolve(query);
    const allowed = await new ScholarlyResolver({
      fetch,
      scholarlyPageHosts: ['papers.example'],
    }).resolve(query);
    expect(denied.state).toBe('unavailable');
    expect(allowed).toMatchObject({
      state: 'resolved',
      metadata: { title: 'A paper', year: 2024 },
    });
  });
});
