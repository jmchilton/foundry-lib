import { evidenceId } from './identity.js';
import { firstAuthorFamily, titleSimilarity } from './match.js';
import type {
  CitationEvidence,
  CitationIdentifier,
  EvidenceQuery,
  ScholarlyMetadata,
} from './schema.js';
import { scholarlyMetadataSchema } from './schema.js';

const DEFAULT_USER_AGENT =
  '@galaxy-foundry/audit-citations (https://github.com/jmchilton/foundry-lib)';

const CSL_JSON_MEDIA_TYPE = 'application/vnd.citationstyles.csl+json';

export interface FetchResponse {
  ok: boolean;
  status: number;
  statusText: string;
  /** Final URL after redirects, when the transport reports one. */
  url?: string;
  json(): Promise<unknown>;
  text(): Promise<string>;
}

export type FetchLike = (
  url: string,
  init?: { headers?: Record<string, string> },
) => Promise<FetchResponse>;

export interface ScholarlyResolverOptions {
  fetch?: FetchLike;
  userAgent?: string;
  scholarlyPageHosts?: readonly string[];
  now?: () => string;
  crossrefDelayMs?: number;
}

export class ScholarlyResolver {
  readonly #fetch: FetchLike;
  readonly #userAgent: string;
  readonly #scholarlyPageHosts: readonly string[];
  readonly #now: () => string;
  readonly #crossrefDelayMs: number;
  #lastCrossrefRequest = 0;

  constructor(options: ScholarlyResolverOptions = {}) {
    const nativeFetch = globalThis.fetch as unknown as FetchLike;
    if (!options.fetch && !nativeFetch) throw new Error('global fetch is unavailable');
    this.#fetch = options.fetch ?? nativeFetch;
    this.#userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
    this.#scholarlyPageHosts = options.scholarlyPageHosts ?? [];
    this.#now = options.now ?? (() => new Date().toISOString());
    this.#crossrefDelayMs = options.crossrefDelayMs ?? 250;
  }

  async resolve(query: EvidenceQuery): Promise<CitationEvidence> {
    if (query.type === 'bibliographic') return this.#resolveBibliographic(query);
    switch (query.identifier.kind) {
      case 'doi':
        return this.#resolveDoi(query);
      case 'arxiv':
        return this.#resolveArxiv(query);
      case 'pmid':
        return this.#resolveEuropePmc(query, 'EXT_ID');
      case 'pmcid':
        return this.#resolveEuropePmc(query, 'PMCID');
      case 'url':
        return this.#resolveScholarlyPage(query);
      default:
        return this.#unavailable(
          query,
          'resolver',
          `Unsupported identifier kind: ${query.identifier.kind}`,
        );
    }
  }

  async #resolveDoi(query: EvidenceQuery & { type: 'identifier' }): Promise<CitationEvidence> {
    const url = `https://api.crossref.org/works/${encodeURIComponent(query.identifier.value)}`;
    try {
      const payload = asRecord(await this.#crossrefJson(url));
      const message = asRecord(payload['message']);
      const metadata = crossrefMetadata(message);
      assertIdentifier(metadata, query.identifier, 'Crossref');
      return this.#resolved(query, 'crossref', metadata, url, metadata.identifiers[0]);
    } catch (error) {
      const crossref = this.#failure(query, 'crossref', url, error);
      if (crossref.state !== 'unresolved') return crossref;
      return this.#resolveDoiByContentNegotiation(query, crossref);
    }
  }

  /**
   * Crossref registers most scholarly DOIs but not all of them: DataCite covers deposited datasets
   * and software, and other agencies cover their own regions and disciplines. Treating a Crossref
   * miss as the final answer would report every such citation as unresolved, which is the same
   * verdict a fabricated DOI receives. Content negotiation resolves a DOI through whichever agency
   * registered it, so only a DOI no agency knows stays unresolved.
   */
  async #resolveDoiByContentNegotiation(
    query: EvidenceQuery & { type: 'identifier' },
    crossref: CitationEvidence,
  ): Promise<CitationEvidence> {
    const url = `https://doi.org/${encodeURI(query.identifier.value)}`;
    try {
      const response = await this.#request(url, CSL_JSON_MEDIA_TYPE);
      if (!response.ok) throw new HttpError(response.status, response.statusText);
      const metadata = cslMetadata(asRecord(await response.json()));
      assertIdentifier(metadata, query.identifier, 'DOI content negotiation');
      return this.#resolved(
        query,
        'doi-content-negotiation',
        metadata,
        url,
        metadata.identifiers[0],
      );
    } catch (error) {
      const negotiated = this.#failure(query, 'doi-content-negotiation', url, error);
      // Crossref not registering a DOI says nothing once no agency recognizes it either, so the
      // unresolved verdict is reported against the query rather than against either provider.
      return negotiated.state === 'unresolved' ? crossref : negotiated;
    }
  }

  async #resolveArxiv(query: EvidenceQuery & { type: 'identifier' }): Promise<CitationEvidence> {
    const arxivId = query.identifier.value;
    const doi = `10.48550/arxiv.${arxivId}`;
    const openAlexUrl =
      'https://api.openalex.org/works/' + encodeURIComponent(`https://doi.org/${doi}`);
    try {
      const work = asRecord(await this.#json(openAlexUrl));
      const metadata = openAlexMetadata(work);
      assertIdentifier(metadata, { kind: 'doi', value: doi }, 'OpenAlex');
      metadata.identifiers.push({ kind: 'arxiv', value: arxivId });
      return this.#resolved(query, 'openalex', metadata, openAlexUrl, {
        kind: 'arxiv',
        value: arxivId,
      });
    } catch (openAlexError) {
      const atomUrl =
        'https://export.arxiv.org/api/query?' + new URLSearchParams({ id_list: arxivId });
      try {
        const response = await this.#request(atomUrl, 'application/atom+xml');
        if (!response.ok) throw new HttpError(response.status, response.statusText);
        const metadata = arxivMetadata(await response.text(), arxivId);
        if (!metadata) return this.#unresolved(query, 'arxiv', atomUrl, 'No entry returned.');
        return this.#resolved(query, 'arxiv', metadata, atomUrl, { kind: 'arxiv', value: arxivId });
      } catch (arxivError) {
        const error = `OpenAlex: ${errorMessage(openAlexError)}; arXiv: ${errorMessage(arxivError)}`;
        return this.#unavailable(query, 'openalex+arxiv', error, atomUrl);
      }
    }
  }

  async #resolveEuropePmc(
    query: EvidenceQuery & { type: 'identifier' },
    field: 'EXT_ID' | 'PMCID',
  ): Promise<CitationEvidence> {
    const url =
      'https://www.ebi.ac.uk/europepmc/webservices/rest/search?' +
      new URLSearchParams({
        query: `${field}:${query.identifier.value}`,
        format: 'json',
        pageSize: '1',
      });
    try {
      const payload = asRecord(await this.#json(url));
      const resultList = asRecord(payload['resultList']);
      const results = asArray(resultList['result']);
      const result = results[0];
      if (!result) return this.#unresolved(query, 'europe-pmc', url, 'No entry returned.');
      const item = asRecord(result);
      const identifiers = compactIdentifiers([
        stringIdentifier('pmid', item['pmid']),
        stringIdentifier('pmcid', item['pmcid'], 'upper'),
        stringIdentifier('doi', item['doi'], 'lower'),
      ]);
      const metadata: ScholarlyMetadata = {
        title: stringValue(item['title']),
        authors: stringValue(item['authorString'])
          .split(',')
          .map((author) => author.trim())
          .filter(Boolean),
        ...numberField('year', item['pubYear']),
        identifiers,
      };
      assertIdentifier(metadata, query.identifier, 'Europe PMC');
      return this.#resolved(query, 'europe-pmc', metadata, url, query.identifier);
    } catch (error) {
      return this.#failure(query, 'europe-pmc', url, error);
    }
  }

  async #resolveScholarlyPage(
    query: EvidenceQuery & { type: 'identifier' },
  ): Promise<CitationEvidence> {
    const url = query.identifier.value;
    try {
      const parsed = new URL(url);
      if (!this.#allowedHost(parsed)) {
        return this.#unavailable(
          query,
          'citation-metadata-page',
          `Host is not allowed: ${parsed.hostname}`,
          url,
        );
      }
      const response = await this.#request(url, 'text/html');
      if (!response.ok) throw new HttpError(response.status, response.statusText);
      // The allowlist is a trust boundary, so a redirect off it does not inherit the trust the
      // requested host was granted.
      const finalHost = finalHostname(response, url);
      if (finalHost && !this.#allowedHost(finalHost)) {
        return this.#unavailable(
          query,
          'citation-metadata-page',
          `Redirected to a host that is not allowed: ${finalHost.hostname}`,
          url,
        );
      }
      const values = citationMeta(await response.text());
      const title = values.get('citation_title')?.[0];
      if (!title) {
        return this.#unavailable(
          query,
          'citation-metadata-page',
          'Page exposed no citation_title metadata.',
          url,
        );
      }
      const doi = values.get('citation_doi')?.[0]?.toLocaleLowerCase();
      const year = scholarlyPageYear(url, values.get('citation_publication_date')?.[0]);
      const metadata: ScholarlyMetadata = {
        title,
        authors: values.get('citation_author') ?? [],
        ...(year !== undefined ? { year } : {}),
        identifiers: doi ? [{ kind: 'doi', value: doi }] : [query.identifier],
      };
      return this.#resolved(
        query,
        'citation-metadata-page',
        metadata,
        url,
        doi ? { kind: 'doi', value: doi } : query.identifier,
      );
    } catch (error) {
      return this.#failure(query, 'citation-metadata-page', url, error);
    }
  }

  /**
   * Bibliographic lookup is a search rather than a registry read, and search coverage varies by
   * venue, year, and publication type, so a title absent from one index is weak evidence that the
   * work does not exist. Providers are tried in turn until one resolves.
   *
   * A search that could not run is not a search that found nothing. If any provider was unavailable
   * and none resolved, the citation is `unavailable`: the index that would have recognized the
   * title may be exactly the one that failed.
   */
  async #resolveBibliographic(
    query: EvidenceQuery & { type: 'bibliographic' },
  ): Promise<CitationEvidence> {
    const attempts: CitationEvidence[] = [];
    for (const lookup of [
      this.#resolveBibliographicCrossref,
      this.#resolveBibliographicOpenAlex,
      this.#resolveBibliographicSemanticScholar,
      this.#resolveBibliographicDblp,
    ]) {
      const evidence = await lookup.call(this, query);
      if (evidence.state === 'resolved') return evidence;
      attempts.push(evidence);
    }
    const searched = attempts.map((attempt) => attempt.provider).join('+');
    const unavailable = attempts.filter((attempt) => attempt.state === 'unavailable');
    if (unavailable.length > 0) {
      return this.#unavailable(
        query,
        searched,
        unavailable
          .map((attempt) => `${attempt.provider}: ${attempt.error ?? 'unavailable'}`)
          .join('; '),
      );
    }
    return this.#unresolved(
      query,
      searched,
      attempts.at(-1)?.locator?.url ?? '',
      'No title candidate passed threshold in any index.',
    );
  }

  async #resolveBibliographicCrossref(
    query: EvidenceQuery & { type: 'bibliographic' },
  ): Promise<CitationEvidence> {
    const parameters = new URLSearchParams({
      'query.bibliographic': [query.title, query.year].filter(Boolean).join(' '),
      'query.author': firstAuthorFamily(query.firstAuthor) ?? '',
      rows: '3',
    });
    const url = `https://api.crossref.org/works?${parameters}`;
    try {
      const payload = asRecord(await this.#crossrefJson(url));
      const items = asArray(asRecord(payload['message'])['items']).map(asRecord);
      const best = bestTitleMatch(query.title, items, (item) => firstString(item['title']));
      if (!best || titleSimilarity(query.title, firstString(best['title'])) < 0.75) {
        return this.#unresolved(query, 'crossref', url, 'No title candidate passed threshold.');
      }
      const metadata = crossrefMetadata(best);
      return this.#resolved(query, 'crossref', metadata, url, metadata.identifiers[0]);
    } catch (error) {
      return this.#failure(query, 'crossref', url, error);
    }
  }

  async #resolveBibliographicOpenAlex(
    query: EvidenceQuery & { type: 'bibliographic' },
  ): Promise<CitationEvidence> {
    const parameters = new URLSearchParams({ search: query.title, 'per-page': '3' });
    if (query.year !== undefined) {
      parameters.set(
        'filter',
        `from_publication_date:${query.year}-01-01,to_publication_date:${query.year}-12-31`,
      );
    }
    const url = `https://api.openalex.org/works?${parameters}`;
    try {
      const payload = asRecord(await this.#json(url));
      const items = asArray(payload['results']).map(asRecord);
      const best = bestTitleMatch(query.title, items, (item) =>
        stringValue(item['display_name'] ?? item['title']),
      );
      const title = best ? stringValue(best['display_name'] ?? best['title']) : '';
      if (!best || titleSimilarity(query.title, title) < 0.75) {
        return this.#unresolved(query, 'openalex', url, 'No title candidate passed threshold.');
      }
      const metadata = openAlexMetadata(best);
      return this.#resolved(query, 'openalex', metadata, url, metadata.identifiers[0]);
    } catch (error) {
      return this.#failure(query, 'openalex', url, error);
    }
  }

  async #resolveBibliographicSemanticScholar(
    query: EvidenceQuery & { type: 'bibliographic' },
  ): Promise<CitationEvidence> {
    const parameters = new URLSearchParams({
      query: query.title,
      limit: '3',
      fields: 'title,authors,year,externalIds',
    });
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?${parameters}`;
    try {
      const payload = asRecord(await this.#retryingJson(url));
      const items = asArray(payload['data']).map(asRecord);
      const best = bestTitleMatch(query.title, items, (item) => stringValue(item['title']));
      if (!best || titleSimilarity(query.title, stringValue(best['title'])) < 0.75) {
        return this.#unresolved(
          query,
          'semantic-scholar',
          url,
          'No title candidate passed threshold.',
        );
      }
      const metadata = semanticScholarMetadata(best);
      return this.#resolved(query, 'semantic-scholar', metadata, url, metadata.identifiers[0]);
    } catch (error) {
      return this.#failure(query, 'semantic-scholar', url, error);
    }
  }

  async #resolveBibliographicDblp(
    query: EvidenceQuery & { type: 'bibliographic' },
  ): Promise<CitationEvidence> {
    const parameters = new URLSearchParams({ q: query.title, format: 'json', h: '3' });
    const url = `https://dblp.org/search/publ/api?${parameters}`;
    try {
      const payload = asRecord(await this.#retryingJson(url));
      const hits = asRecord(asRecord(asRecord(payload['result'])['hits']));
      const items = asArray(hits['hit']).map((hit) => asRecord(asRecord(hit)['info']));
      const best = bestTitleMatch(query.title, items, (item) => stringValue(item['title']));
      if (!best || titleSimilarity(query.title, stringValue(best['title'])) < 0.75) {
        return this.#unresolved(query, 'dblp', url, 'No title candidate passed threshold.');
      }
      const metadata = dblpMetadata(best);
      return this.#resolved(query, 'dblp', metadata, url, metadata.identifiers[0]);
    } catch (error) {
      return this.#failure(query, 'dblp', url, error);
    }
  }

  async #retryingJson(url: string): Promise<unknown> {
    try {
      return await this.#json(url);
    } catch (error) {
      if (!(error instanceof HttpError) || error.status !== 429) throw error;
      await delay(1000);
      return await this.#json(url);
    }
  }

  async #crossrefJson(url: string): Promise<unknown> {
    const elapsed = Date.now() - this.#lastCrossrefRequest;
    if (elapsed < this.#crossrefDelayMs) await delay(this.#crossrefDelayMs - elapsed);
    try {
      return await this.#retryingJson(url);
    } finally {
      this.#lastCrossrefRequest = Date.now();
    }
  }

  async #json(url: string): Promise<unknown> {
    const response = await this.#request(url, 'application/json, application/atom+xml');
    if (!response.ok) throw new HttpError(response.status, response.statusText);
    return response.json();
  }

  #request(url: string, accept: string): Promise<FetchResponse> {
    return this.#fetch(url, { headers: { 'User-Agent': this.#userAgent, Accept: accept } });
  }

  #allowedHost(url: URL): boolean {
    return this.#scholarlyPageHosts.includes(url.hostname);
  }

  #resolved(
    query: EvidenceQuery,
    provider: string,
    metadata: ScholarlyMetadata,
    url: string,
    matchedIdentifier?: CitationIdentifier,
  ): CitationEvidence {
    const parsed = scholarlyMetadataSchema.safeParse(metadata);
    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => issue.message).join('; ');
      return this.#unavailable(query, provider, `Invalid provider metadata: ${details}`, url);
    }
    return {
      id: evidenceId(query),
      query,
      provider,
      state: 'resolved',
      observedAt: this.#now(),
      ...(matchedIdentifier ? { matchedIdentifier } : {}),
      metadata: parsed.data,
      locator: { url },
    };
  }

  #unresolved(
    query: EvidenceQuery,
    provider: string,
    url: string,
    error: string,
  ): CitationEvidence {
    return {
      id: evidenceId(query),
      query,
      provider,
      state: 'unresolved',
      observedAt: this.#now(),
      locator: { url },
      error,
    };
  }

  #unavailable(
    query: EvidenceQuery,
    provider: string,
    error: string,
    url?: string,
  ): CitationEvidence {
    return {
      id: evidenceId(query),
      query,
      provider,
      state: 'unavailable',
      observedAt: this.#now(),
      ...(url ? { locator: { url } } : {}),
      error,
    };
  }

  #failure(query: EvidenceQuery, provider: string, url: string, error: unknown): CitationEvidence {
    if (error instanceof HttpError && (error.status === 400 || error.status === 404)) {
      return this.#unresolved(query, provider, url, `HTTP ${error.status}`);
    }
    return this.#unavailable(query, provider, errorMessage(error), url);
  }
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    statusText: string,
  ) {
    super(`HTTP ${status}: ${statusText}`);
  }
}

function crossrefMetadata(message: Record<string, unknown>): ScholarlyMetadata {
  const doi = stringValue(message['DOI']).toLocaleLowerCase();
  return {
    title: firstString(message['title']),
    authors: asArray(message['author'])
      .map(asRecord)
      .map((author) =>
        [stringValue(author['given']), stringValue(author['family'])].filter(Boolean).join(' '),
      )
      .filter(Boolean),
    ...numberField('year', crossrefYear(message)),
    identifiers: doi ? [{ kind: 'doi', value: doi }] : [],
  };
}

/**
 * Normalizes a CSL JSON record, the format every DOI registration agency serves through content
 * negotiation. Organisational authors carry `literal` where people carry `given`/`family`.
 */
function cslMetadata(record: Record<string, unknown>): ScholarlyMetadata {
  const doi = stringValue(record['DOI']).toLocaleLowerCase();
  return {
    title: firstString(record['title']),
    authors: asArray(record['author'])
      .map(asRecord)
      .map((author) => {
        const literal = stringValue(author['literal']);
        if (literal) return literal;
        return [stringValue(author['given']), stringValue(author['family'])]
          .filter(Boolean)
          .join(' ');
      })
      .filter(Boolean),
    ...numberField('year', cslYear(record)),
    identifiers: doi ? [{ kind: 'doi', value: doi }] : [],
  };
}

function semanticScholarMetadata(item: Record<string, unknown>): ScholarlyMetadata {
  const external = asRecord(item['externalIds']);
  const identifiers: ScholarlyMetadata['identifiers'] = [];
  const doi = stringValue(external['DOI']).toLocaleLowerCase();
  if (doi) identifiers.push({ kind: 'doi', value: doi });
  const arxiv = stringValue(external['ArXiv']).toLocaleLowerCase();
  if (arxiv) identifiers.push({ kind: 'arxiv', value: arxiv });
  const pubmed = stringValue(external['PubMed']);
  if (pubmed) identifiers.push({ kind: 'pmid', value: pubmed });
  return {
    title: stringValue(item['title']),
    authors: asArray(item['authors'])
      .map((author) => stringValue(asRecord(author)['name']))
      .filter(Boolean),
    ...numberField('year', item['year']),
    identifiers,
  };
}

/** DBLP collapses a single-author list to one object and reports the year as a string. */
function dblpMetadata(info: Record<string, unknown>): ScholarlyMetadata {
  const authors = asRecord(info['authors'])['author'];
  const doi = stringValue(info['doi']).toLocaleLowerCase();
  return {
    title: stringValue(info['title']).replace(/\.$/u, ''),
    authors: (Array.isArray(authors) ? authors : [authors])
      .map((author) => stringValue(asRecord(author)['text']))
      .filter(Boolean),
    ...numberField('year', Number(stringValue(info['year'])) || undefined),
    identifiers: doi ? [{ kind: 'doi', value: doi }] : [],
  };
}

function cslYear(record: Record<string, unknown>): unknown {
  const issued = asRecord(record['issued']);
  return asArray(asArray(issued['date-parts'])[0])[0];
}

function crossrefYear(message: Record<string, unknown>): unknown {
  for (const field of ['published-print', 'published-online', 'published', 'issued', 'created']) {
    const dateParts = asArray(asRecord(message[field])['date-parts']);
    const first = asArray(dateParts[0])[0];
    if (first !== undefined) return first;
  }
  return undefined;
}

function openAlexMetadata(work: Record<string, unknown>): ScholarlyMetadata {
  const doi = stringValue(work['doi'])
    .replace(/^https:\/\/doi\.org\//iu, '')
    .toLocaleLowerCase();
  const identifiers = compactIdentifiers([doi ? { kind: 'doi', value: doi } : undefined]);
  return {
    title: stringValue(work['display_name'] ?? work['title']),
    authors: asArray(work['authorships'])
      .map(asRecord)
      .map((entry) => stringValue(asRecord(entry['author'])['display_name']))
      .filter(Boolean),
    ...numberField('year', work['publication_year']),
    identifiers,
  };
}

function arxivMetadata(xml: string, arxivId: string): ScholarlyMetadata | undefined {
  const entry = /<entry>([\s\S]*?)<\/entry>/iu.exec(xml)?.[1];
  if (!entry) return undefined;
  const title = xmlText(entry, 'title').replace(/\s+/gu, ' ').trim();
  if (!title) return undefined;
  const authors = [
    ...entry.matchAll(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/giu),
  ]
    .map((match) => decodeXml(match[1] ?? '').trim())
    .filter(Boolean);
  const published = xmlText(entry, 'published');
  const year = /^\d{4}/u.test(published) ? Number(published.slice(0, 4)) : undefined;
  return {
    title: decodeXml(title),
    authors,
    ...(year !== undefined ? { year } : {}),
    identifiers: [{ kind: 'arxiv', value: arxivId }],
  };
}

function citationMeta(html: string): Map<string, string[]> {
  const values = new Map<string, string[]>();
  for (const tag of html.match(/<meta\b[^>]*>/giu) ?? []) {
    const attributes = new Map<string, string>();
    for (const match of tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/gu)) {
      if (match[1] && match[2] !== undefined) {
        attributes.set(match[1].toLocaleLowerCase(), decodeXml(match[2]));
      }
    }
    const name = (attributes.get('name') ?? attributes.get('property'))?.toLocaleLowerCase();
    const content = attributes.get('content');
    if (name?.startsWith('citation_') && content) {
      values.set(name, [...(values.get(name) ?? []), content]);
    }
  }
  return values;
}

function finalHostname(response: FetchResponse, requestedUrl: string): URL | undefined {
  if (!response.url || response.url === requestedUrl) return undefined;
  try {
    return new URL(response.url);
  } catch {
    return undefined;
  }
}

function scholarlyPageYear(url: string, citationDate: string | undefined): number | undefined {
  if (new URL(url).hostname === 'proceedings.neurips.cc') {
    const year = /\/paper(?:_files)?\/paper\/((?:19|20)\d{2})\//u.exec(url)?.[1];
    if (year) return Number(year);
  }
  const year = citationDate?.slice(0, 4);
  return year && /^\d{4}$/u.test(year) ? Number(year) : undefined;
}

function bestTitleMatch<T>(
  target: string,
  candidates: readonly T[],
  title: (candidate: T) => string,
): T | undefined {
  return [...candidates].sort(
    (left, right) => titleSimilarity(target, title(right)) - titleSimilarity(target, title(left)),
  )[0];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function firstString(value: unknown): string {
  return Array.isArray(value) ? stringValue(value[0]) : stringValue(value);
}

function numberField<Key extends string>(key: Key, value: unknown): { [K in Key]?: number } {
  if (value === null || value === undefined || value === '') return {};
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? ({ [key]: number } as { [K in Key]: number }) : {};
}

function stringIdentifier(
  kind: string,
  value: unknown,
  casing?: 'lower' | 'upper',
): CitationIdentifier | undefined {
  const text = stringValue(value);
  if (!text) return undefined;
  const normalized =
    casing === 'lower'
      ? text.toLocaleLowerCase()
      : casing === 'upper'
        ? text.toLocaleUpperCase()
        : text;
  return { kind, value: normalized };
}

function assertIdentifier(
  metadata: ScholarlyMetadata,
  expected: CitationIdentifier,
  provider: string,
): void {
  if (!metadata.identifiers.some((identifier) => sameIdentifier(identifier, expected))) {
    throw new Error(
      `${provider} response did not identify requested ${expected.kind}:${expected.value}`,
    );
  }
}

function sameIdentifier(left: CitationIdentifier, right: CitationIdentifier): boolean {
  if (left.kind !== right.kind) return false;
  const normalize = (identifier: CitationIdentifier): string => {
    if (identifier.kind === 'doi' || identifier.kind === 'arxiv') {
      return identifier.value.toLocaleLowerCase();
    }
    if (identifier.kind === 'pmcid') return identifier.value.toLocaleUpperCase();
    return identifier.value;
  };
  return normalize(left) === normalize(right);
}

function compactIdentifiers(
  values: readonly (CitationIdentifier | undefined)[],
): CitationIdentifier[] {
  return values.filter((value): value is CitationIdentifier => value !== undefined);
}

function xmlText(xml: string, tag: string): string {
  return new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'iu').exec(xml)?.[1] ?? '';
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/gu, '&')
    .replace(/&lt;/gu, '<')
    .replace(/&gt;/gu, '>')
    .replace(/&quot;/gu, '"')
    .replace(/&#39;|&apos;/gu, "'");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
