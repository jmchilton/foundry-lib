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
