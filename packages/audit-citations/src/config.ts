import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import fg from 'fast-glob';
import { z } from 'zod';

import { compareCodePoints } from './digest.js';
import { normalizeArtifactPath } from './extract.js';
import type { CitationExtractionOptions, SourceDocument } from './extract.js';
import type { ScholarlyResolverOptions } from './resolve.js';

const execFileAsync = promisify(execFile);
const GIT_LS_FILES_MAX_BUFFER = 64 * 1024 * 1024;

export const citationAuditConfigSchema = z
  .object({
    schemaVersion: z.literal(1),
    sources: z
      .array(
        z
          .object({
            include: z.array(z.string().min(1)).min(1),
            exclude: z.array(z.string().min(1)).optional(),
            artifactKind: z.string().min(1),
          })
          .strict(),
      )
      .min(1),
    trackedOnly: z.boolean().optional(),
    referenceHeadingTerms: z.array(z.string().min(1)).optional(),
    /**
     * Where a note's typed frontmatter keeps the two halves of a citation. Declaring it turns one
     * frontmatter block into one checkable citation instead of a description that resolves nothing
     * and identifiers that describe nothing. Omit it and frontmatter stays ordinary text.
     */
    noteFrontmatter: z
      .object({
        descriptionField: z.string().min(1),
        // Each name is the identifier kind it holds — the extractor never guesses a kind from the
        // shape of a bare value, because an arXiv id and a PMID are both just digits.
        identifierFields: z.array(z.enum(['doi', 'arxiv', 'pmid', 'pmcid'])).min(1),
      })
      .strict()
      .optional(),
    scholarlyPageHosts: z.array(z.string().min(1)).optional(),
    userAgent: z.string().min(1).optional(),
    requestTimeoutMs: z.number().int().positive().optional(),
  })
  .strict();

export type CitationAuditConfig = z.infer<typeof citationAuditConfigSchema>;

export async function loadCitationAuditConfig(configPath: string): Promise<CitationAuditConfig> {
  const contents = await readFile(configPath, 'utf8');
  return citationAuditConfigSchema.parse(JSON.parse(contents) as unknown);
}

export async function loadConfiguredDocuments(
  root: string,
  config: CitationAuditConfig,
): Promise<SourceDocument[]> {
  const documentKinds = new Map<string, string>();
  const tracked = config.trackedOnly ? await trackedPaths(root) : undefined;
  for (const source of config.sources) {
    const matched = await fg(source.include, {
      cwd: root,
      ignore: source.exclude ?? [],
      onlyFiles: true,
      unique: true,
    });
    for (const artifactPath of matched) {
      const normalized = normalizeArtifactPath(artifactPath);
      if (tracked && !tracked.has(normalized)) continue;
      const priorKind = documentKinds.get(normalized);
      if (priorKind && priorKind !== source.artifactKind) {
        throw new Error(
          `${normalized} matches source rules for both ${priorKind} and ${source.artifactKind}`,
        );
      }
      documentKinds.set(normalized, source.artifactKind);
    }
  }
  return Promise.all(
    [...documentKinds]
      .sort(([left], [right]) => compareCodePoints(left, right))
      .map(async ([artifactPath, artifactKind]) => ({
        path: artifactPath,
        artifactKind,
        text: await readFile(path.join(root, artifactPath), 'utf8'),
      })),
  );
}

export function referenceHeadingPattern(config: CitationAuditConfig): RegExp | undefined {
  const terms = config.referenceHeadingTerms;
  return terms && terms.length > 0
    ? new RegExp(terms.map(escapeRegExp).join('|'), 'iu')
    : undefined;
}

/**
 * How a configuration says a document should be read.
 *
 * This mapping belongs to the package rather than to each caller because there is always more than
 * one caller. A consumer that verifies a committed report replays the audit itself, so it holds a
 * second copy of whatever the CLI does here; when the copies disagree the report was produced by
 * reading the corpus one way and checked by reading it another, and both runs pass. Declaring a
 * field in the schema now reaches every caller by construction.
 */
export function citationExtractionOptions(config: CitationAuditConfig): CitationExtractionOptions {
  const headingPattern = referenceHeadingPattern(config);
  return {
    ...(headingPattern ? { referenceHeadingPattern: headingPattern } : {}),
    scholarlyPageHosts: config.scholarlyPageHosts ?? [],
    ...(config.noteFrontmatter ? { noteFrontmatter: config.noteFrontmatter } : {}),
  };
}

/**
 * How a configuration says a provider should be asked.
 *
 * The lesser half of the same duplication: a refresh runs with network access and a person
 * watching, so a dropped `userAgent` is noticed. It is mapped here anyway so that neither half of
 * a configuration is the one callers are expected to translate themselves. Fields the config does
 * not carry — a test `fetch`, a fixed clock — stay the caller's to supply.
 */
export function scholarlyResolverOptions(config: CitationAuditConfig): ScholarlyResolverOptions {
  return {
    scholarlyPageHosts: config.scholarlyPageHosts ?? [],
    ...(config.userAgent ? { userAgent: config.userAgent } : {}),
    ...(config.requestTimeoutMs !== undefined ? { requestTimeoutMs: config.requestTimeoutMs } : {}),
  };
}

/**
 * The tracked set is only ever intersected with the glob match, never substituted for it. Git
 * pathspecs and glob patterns do not agree — a pathspec `*` crosses directory separators while a
 * glob `*` does not — so matching stays with one matcher and `trackedOnly` only narrows.
 */
async function trackedPaths(root: string): Promise<Set<string>> {
  const { stdout } = await execFileAsync('git', ['-C', root, 'ls-files', '-z', '--cached'], {
    maxBuffer: GIT_LS_FILES_MAX_BUFFER,
  });
  return new Set(
    stdout
      .split('\0')
      .filter(Boolean)
      .map((entry) => normalizeArtifactPath(entry)),
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}
