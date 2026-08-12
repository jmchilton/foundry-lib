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

const DOI_RE = /10\.\d{4,9}\/[-._;()/:A-Z0-9%]+/giu;
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

/**
 * Where a note's typed frontmatter keeps the two halves of a citation.
 *
 * A source note records the work it summarizes in fields, not sentences: one prose field carries
 * the bibliographic record and separate typed fields carry the identifiers. Read line by line the
 * halves never meet — the identifier lines describe nothing, so they resolve and can report only
 * that the identifier exists, while the description line names no identifier the grammar can find
 * in it. Declaring the fields is what lets one frontmatter block become one checkable citation.
 *
 * A field's NAME is the identifier's kind. That is deliberate: a bare `1912.04135` has no prefix
 * for a prose grammar to recognize, and guessing from shape is how an arXiv id becomes a PMID.
 */
export interface NoteFrontmatterFields {
  /** The field holding the bibliographic record, parsed with the bibliography-entry grammar. */
  descriptionField: string;
  /** Field names that carry a bare identifier, each named for the kind it holds. */
  identifierFields: readonly string[];
}

export interface CitationExtractionOptions {
  referenceHeadingPattern?: RegExp;
  scholarlyPageHosts?: readonly string[];
  /** Opt-in. Unset, frontmatter is just text and the line grammar reads it as it always has. */
  noteFrontmatter?: NoteFrontmatterFields;
}

interface ResolvedOptions {
  referenceHeadingPattern: RegExp;
  scholarlyPageHosts: readonly string[];
  noteFrontmatter?: NoteFrontmatterFields;
}

interface ExtractionContext {
  diagnostics: ExtractionDiagnostics;
  occurrenceCounts: Map<string, number>;
  options: ResolvedOptions;
}

const DEFAULT_OPTIONS = {
  referenceHeadingPattern: /reference|source note/iu,
  scholarlyPageHosts: [] as readonly string[],
};

export function extractCitations(
  documents: readonly SourceDocument[],
  options: CitationExtractionOptions = {},
): CitationScan {
  const resolvedOptions: ResolvedOptions = {
    referenceHeadingPattern:
      options.referenceHeadingPattern ?? DEFAULT_OPTIONS.referenceHeadingPattern,
    scholarlyPageHosts: options.scholarlyPageHosts ?? DEFAULT_OPTIONS.scholarlyPageHosts,
    ...(options.noteFrontmatter ? { noteFrontmatter: options.noteFrontmatter } : {}),
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

  const lines = document.text.split(/\r?\n/u);
  const frontmatter = context.options.noteFrontmatter
    ? frontmatterBlock(lines, context.options.noteFrontmatter, context.options.scholarlyPageHosts)
    : undefined;
  if (frontmatter) {
    const candidate = buildCandidate(frontmatter, document, artifactPath, context);
    if (candidate) candidates.push(candidate);
  }

  for (const [index, sourceText] of lines.entries()) {
    const line = index + 1;
    // The block is one citation, already emitted. Reading its lines again would add an undescribed
    // duplicate of an identifier the block just had a description for.
    if (frontmatter && line >= frontmatter.startLine && line <= frontmatter.endLine) continue;
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
      const candidate = buildCandidate(
        {
          startLine: line,
          endLine: line,
          sourceText,
          identifiers,
          ...(described && Object.keys(described).length > 0 ? { described } : {}),
        },
        document,
        artifactPath,
        context,
      );
      if (candidate) candidates.push(candidate);
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

interface CandidateDraft {
  startLine: number;
  endLine: number;
  sourceText: string;
  identifiers: CitationIdentifier[];
  described?: DescribedCitation;
}

/**
 * Mints the candidate's identity from its text rather than its position, so that moving a citation
 * within a file keeps its ID and its adjudication. The occurrence counter is what keeps two
 * byte-identical lines in one file from collapsing into one ID.
 */
function buildCandidate(
  draft: CandidateDraft,
  document: SourceDocument,
  artifactPath: string,
  context: ExtractionContext,
): CitationCandidate | undefined {
  if (draft.identifiers.length === 0 && draft.described?.title === undefined) return undefined;
  const sourceDigest = sourceTextDigest(draft.sourceText);
  const occurrenceKey = `${artifactPath}\0${sourceDigest}`;
  const occurrence = context.occurrenceCounts.get(occurrenceKey) ?? 0;
  context.occurrenceCounts.set(occurrenceKey, occurrence + 1);
  return {
    id: sha256(`${occurrenceKey}\0${occurrence}`).slice(0, 16),
    span: {
      artifactKind: document.artifactKind,
      artifactPath,
      startLine: draft.startLine,
      endLine: draft.endLine,
      sourceText: draft.sourceText,
      sourceDigest,
    },
    identifiers: draft.identifiers,
    ...(draft.described ? { described: draft.described } : {}),
  };
}

const FRONTMATTER_FENCE = /^---\s*$/u;
/**
 * A typed scalar field, unwrapped from the quoting YAML needs and the schema tolerates. The values
 * these fields hold are validated identifiers upstream — bare, with no spaces and no comments — so
 * reading them does not need a YAML parser, and taking on one to read four keys would be a
 * dependency the rest of this package never uses.
 */
const SCALAR_FIELD_RE = /^\s*([A-Za-z_][\w-]*)\s*:\s*(?:"([^"]*)"|'([^']*)'|([^#\s][^#]*?))\s*$/u;

/** The frontmatter block as one citation: the description field describes, the typed fields name. */
function frontmatterBlock(
  lines: readonly string[],
  fields: NoteFrontmatterFields,
  scholarlyPageHosts: readonly string[],
): CandidateDraft | undefined {
  if (lines[0] === undefined || !FRONTMATTER_FENCE.test(lines[0])) return undefined;
  const closing = lines.findIndex((line, index) => index > 0 && FRONTMATTER_FENCE.test(line));
  if (closing < 1) return undefined;

  const body = lines.slice(1, closing);
  const kinds = new Set(fields.identifierFields);
  const typed: CitationIdentifier[] = [];
  let description: string | undefined;

  for (const line of body) {
    const match = SCALAR_FIELD_RE.exec(line);
    if (!match) continue;
    const key = match[1] ?? '';
    const value = match[2] ?? match[3] ?? match[4] ?? '';
    if (value === '') continue;
    if (key === fields.descriptionField) description ??= value;
    // The field name IS the kind, so `normalizeIdentifier` only has to canonicalize the value —
    // it never has to decide what sort of identifier it is looking at.
    else if (kinds.has(key)) typed.push(normalizeIdentifier(key, value));
  }

  // Identifiers written as prose or as URLs anywhere in the block count too: an `oa_url` pointing
  // at a PMC record names the same work, and every identifier for one work resolving to one work
  // is a check the cross-evidence comparison already knows how to make.
  const sourceText = body.join('\n');
  const identifiers = uniqueIdentifiers([
    ...typed,
    ...extractIdentifiers(sourceText, scholarlyPageHosts),
  ]);
  // A block that names no identifier is a source the note has declared unidentified — a web
  // chapter, a package manual, an unpublished draft. Falling back to a title query would ask a
  // provider to guess at a work the note already said has no record, and the guess is reported as
  // an unresolved or mismatched citation in a note that is correct. A bibliography entry keeps
  // that fallback: there, a title with no DOI is a citation whose identifier is merely absent.
  if (identifiers.length === 0) return undefined;
  const described = description ? extractDescription(description, true) : undefined;
  return {
    startLine: 2,
    endLine: closing,
    sourceText,
    identifiers,
    ...(described && Object.keys(described).length > 0 ? { described } : {}),
  };
}

function normalizeIdentifier(kind: string, value: string): CitationIdentifier {
  if (kind === 'doi') return { kind, value: cleanDoi(value) };
  if (kind === 'arxiv') return { kind, value: stripArxivVersion(value) };
  if (kind === 'pmcid') return { kind, value: value.toUpperCase() };
  return { kind, value };
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
  // Decoding precedes the trailing-parenthesis trim rather than following it, so that a DOI whose
  // own parentheses arrive encoded is balanced by the time the trim counts them. A DOI is only
  // ever percent-encoded because it sits in a URL, and the encoded form addresses nothing.
  let cleaned = decodePercentEncoding(value).replace(/[.,;\]]+$/u, '');
  while (cleaned.endsWith(')') && count(cleaned, ')') > count(cleaned, '(')) {
    cleaned = cleaned.slice(0, -1);
  }
  return cleaned.toLocaleLowerCase();
}

/**
 * A DOI may contain a literal `%`, which `decodeURIComponent` rejects rather than passes through.
 * An identifier that cannot be decoded is kept as written instead of being dropped.
 */
function decodePercentEncoding(value: string): string {
  if (!value.includes('%')) return value;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
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
