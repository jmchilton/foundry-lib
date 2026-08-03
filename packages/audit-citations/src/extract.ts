import path from 'node:path';

import { sha256 } from './digest.js';
import { sourceTextDigest } from './identity.js';
import type {
  CitationCandidate,
  CitationIdentifier,
  CitationScan,
  DescribedCitation,
  ExtractionDiagnostics,
} from './schema.js';
import { CITATION_AUDIT_SCHEMA_VERSION } from './schema.js';

const DOI_RE = /10\.\d{4,9}\/[-._;()/:A-Z0-9]+/giu;
const ARXIV_RE = /(?:arxiv\s*[:./]|arxiv\.org\/(?:abs|pdf)\/)(\d{4}\.\d{4,5}(?:v\d+)?)/giu;
const PMID_RE = /(?:PMID\s*[: ]\s*|pubmed\.ncbi\.nlm\.nih\.gov\/)(\d{5,9})/giu;
const PMCID_RE = /\b(PMC\d{5,9})\b/giu;
const URL_RE = /https?:\/\/[^\s)>]+/giu;
const HEADING_RE = /^(#{1,6})\s+(.+?)\s*$/u;
const BIBLIOGRAPHY_ENTRY_RE = /^\s*\d+\.\s+/u;
const QUOTED_TITLE_RE = /["“]([^"”]{8,})["”]/u;
const YEAR_RE = /(?<!\d)((?:19|20)\d{2})(?!\d)/gu;
const INITIALS_ONLY_RE = /^(?:[A-Z]\.?\s*){1,3}$/u;
const AUTHOR_YEAR_RE =
  /\b[A-Z][A-Za-zÀ-ÖØ-öø-ÿ'’-]+(?:\s+(?:et\s+al\.|and\s+[A-Z][A-Za-z'’-]+))?\s*\((?:19|20)\d{2}\)/gu;

export interface SourceDocument {
  path: string;
  text: string;
  artifactKind: string;
}

export interface CitationExtractionOptions {
  referenceHeadingPattern?: RegExp;
  scholarlyPageHosts?: readonly string[];
}

interface ExtractionContext {
  diagnostics: ExtractionDiagnostics;
  occurrenceCounts: Map<string, number>;
  options: Required<CitationExtractionOptions>;
}

const DEFAULT_OPTIONS: Required<CitationExtractionOptions> = {
  referenceHeadingPattern: /reference|source note/iu,
  scholarlyPageHosts: [],
};

export function extractCitations(
  documents: readonly SourceDocument[],
  options: CitationExtractionOptions = {},
): CitationScan {
  const resolvedOptions: Required<CitationExtractionOptions> = {
    ...DEFAULT_OPTIONS,
    ...options,
    scholarlyPageHosts: options.scholarlyPageHosts ?? DEFAULT_OPTIONS.scholarlyPageHosts,
  };
  const diagnostics: ExtractionDiagnostics = {
    excludedUrls: [],
    authorYearPatternCount: 0,
    unextractedReferenceLines: [],
  };
  const context: ExtractionContext = {
    diagnostics,
    occurrenceCounts: new Map(),
    options: resolvedOptions,
  };
  const candidates = documents.flatMap((document) => extractDocument(document, context));
  return { schemaVersion: CITATION_AUDIT_SCHEMA_VERSION, candidates, diagnostics };
}

function extractDocument(
  document: SourceDocument,
  context: ExtractionContext,
): CitationCandidate[] {
  const artifactPath = normalizeArtifactPath(document.path);
  const candidates: CitationCandidate[] = [];
  let referenceHeadingLevel: number | undefined;

  for (const [index, sourceText] of document.text.split(/\r?\n/u).entries()) {
    const line = index + 1;
    const authorYearMatches = sourceText.match(AUTHOR_YEAR_RE)?.length ?? 0;
    context.diagnostics.authorYearPatternCount += authorYearMatches;

    const heading = HEADING_RE.exec(sourceText);
    if (heading) {
      const level = heading[1]?.length ?? 0;
      if (referenceHeadingLevel !== undefined && level <= referenceHeadingLevel) {
        referenceHeadingLevel = undefined;
      }
      context.options.referenceHeadingPattern.lastIndex = 0;
      if (context.options.referenceHeadingPattern.test(heading[2] ?? '')) {
        referenceHeadingLevel = level;
      }
      continue;
    }

    const identifiers = extractIdentifiers(sourceText, context.options.scholarlyPageHosts);
    const bibliographyEntry =
      referenceHeadingLevel !== undefined && BIBLIOGRAPHY_ENTRY_RE.test(sourceText);
    const described = extractDescription(sourceText, bibliographyEntry);
    const shouldInclude =
      identifiers.length > 0 ||
      (bibliographyEntry && described?.title !== undefined && described.year !== undefined);

    if (shouldInclude) {
      const sourceDigest = sourceTextDigest(sourceText);
      const occurrenceKey = `${artifactPath}\0${sourceDigest}`;
      const occurrence = context.occurrenceCounts.get(occurrenceKey) ?? 0;
      context.occurrenceCounts.set(occurrenceKey, occurrence + 1);
      const id = sha256(`${occurrenceKey}\0${occurrence}`).slice(0, 16);
      candidates.push({
        id,
        span: {
          artifactKind: document.artifactKind,
          artifactPath,
          startLine: line,
          endLine: line,
          sourceText,
          sourceDigest,
        },
        identifiers,
        ...(described && Object.keys(described).length > 0 ? { described } : {}),
      });
    } else if (referenceHeadingLevel !== undefined && sourceText.trim() !== '') {
      context.diagnostics.unextractedReferenceLines.push({ artifactPath, line });
    }

    for (const url of sourceText.match(URL_RE) ?? []) {
      const cleanUrl = url.replace(/[.,]+$/u, '');
      if (extractIdentifiers(cleanUrl, context.options.scholarlyPageHosts).length === 0) {
        context.diagnostics.excludedUrls.push({ artifactPath, line, url: cleanUrl });
      }
    }
  }
  return candidates;
}

export function extractIdentifiers(
  text: string,
  scholarlyPageHosts: readonly string[] = [],
): CitationIdentifier[] {
  const identifiers: CitationIdentifier[] = [];
  for (const match of text.matchAll(DOI_RE)) {
    identifiers.push({ kind: 'doi', value: cleanDoi(match[0]) });
  }
  for (const match of text.matchAll(ARXIV_RE)) {
    const value = match[1];
    if (value) identifiers.push({ kind: 'arxiv', value: stripArxivVersion(value) });
  }
  for (const match of text.matchAll(PMID_RE)) {
    const value = match[1];
    if (value) identifiers.push({ kind: 'pmid', value });
  }
  for (const match of text.matchAll(PMCID_RE)) {
    const value = match[1];
    if (value) identifiers.push({ kind: 'pmcid', value: value.toUpperCase() });
  }
  for (const rawUrl of text.match(URL_RE) ?? []) {
    const url = rawUrl.replace(/[.,]+$/u, '');
    if (isScholarlyPage(url, scholarlyPageHosts)) {
      identifiers.push({ kind: 'url', value: url });
    }
  }
  return uniqueIdentifiers(identifiers);
}

function extractDescription(
  sourceText: string,
  bibliographyEntry: boolean,
): DescribedCitation | undefined {
  const title = extractTitle(sourceText, bibliographyEntry);
  const authorText = title ? extractAuthorText(sourceText, title) : undefined;
  const authors = authorText ? splitAuthorList(authorText) : [];
  const year = title !== undefined || bibliographyEntry ? extractYear(sourceText) : undefined;
  if (!title && authors.length === 0 && year === undefined) return undefined;
  return {
    ...(title ? { title } : {}),
    ...(authors.length > 0 ? { authors } : {}),
    ...(year !== undefined ? { year } : {}),
  };
}

/**
 * Splits a bibliography author blob on separators the supported grammar uses. A trailing
 * initials-only fragment rejoins the name before it, so `Smith, J., Doe, A.` yields two authors
 * rather than four.
 */
function splitAuthorList(authorText: string): string[] {
  const parts = authorText
    .split(/\s*(?:[,;&]|\band\b)\s*/iu)
    .map((part) => part.trim())
    .filter((part) => part !== '' && !/^(?:et\s+al\.?|others)$/iu.test(part));
  const authors: string[] = [];
  for (const part of parts) {
    if (INITIALS_ONLY_RE.test(part) && authors.length > 0) {
      authors[authors.length - 1] = `${authors.at(-1)}, ${part}`;
      continue;
    }
    authors.push(part);
  }
  return authors;
}

function extractTitle(text: string, bibliographyEntry: boolean): string | undefined {
  const quoted = QUOTED_TITLE_RE.exec(text);
  if (quoted?.[1]) return plainText(quoted[1]).replace(/^[\s.,]+|[\s.,]+$/gu, '');
  if (!bibliographyEntry) return undefined;

  const plain = plainText(text.replace(BIBLIOGRAPHY_ENTRY_RE, ''));
  const parts = plain.split('. ', 3);
  const proposed = parts[1];
  return proposed && proposed.trim().split(/\s+/u).length >= 2
    ? proposed.trim().replace(/[ .]+$/u, '')
    : undefined;
}

function extractAuthorText(text: string, title: string): string | undefined {
  const plain = plainText(text.replace(BIBLIOGRAPHY_ENTRY_RE, ''));
  const titlePosition = plain.toLocaleLowerCase().indexOf(title.toLocaleLowerCase());
  if (titlePosition < 0) return undefined;
  const prefix = plain
    .slice(0, titlePosition)
    .replace(/^(?:Primary source|Primary publication):\s*/iu, '')
    .replace(/^[\s:."-]+|[\s:."-]+$/gu, '');
  return prefix || undefined;
}

function extractYear(text: string): number | undefined {
  const scrubbed = text.replace(URL_RE, '');
  const first = scrubbed.match(YEAR_RE)?.[0];
  return first ? Number(first) : undefined;
}

function plainText(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/gu, '$1')
    .replace(/[*`]/gu, '')
    .replace(/[“”]/gu, '"');
}

function cleanDoi(value: string): string {
  let cleaned = value.replace(/[.,;\]]+$/u, '');
  while (cleaned.endsWith(')') && count(cleaned, ')') > count(cleaned, '(')) {
    cleaned = cleaned.slice(0, -1);
  }
  return cleaned.toLocaleLowerCase();
}

function stripArxivVersion(value: string): string {
  return value.replace(/v\d+$/iu, '').toLocaleLowerCase();
}

function uniqueIdentifiers(identifiers: readonly CitationIdentifier[]): CitationIdentifier[] {
  const seen = new Set<string>();
  return identifiers.filter((identifier) => {
    const key = `${identifier.kind}:${identifier.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isScholarlyPage(url: string, hosts: readonly string[]): boolean {
  try {
    const parsed = new URL(url);
    return parsed.pathname.endsWith('.html') && hosts.includes(parsed.hostname);
  } catch {
    return false;
  }
}

/** Artifact paths are compared and digested as POSIX-separated strings on every platform. */
export function normalizeArtifactPath(value: string): string {
  return value.split(path.sep).join('/');
}

function count(value: string, character: string): number {
  return [...value].filter((item) => item === character).length;
}
