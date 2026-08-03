import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import fg from 'fast-glob';
import { z } from 'zod';

import { compareCodePoints } from './digest.js';
import { normalizeArtifactPath } from './extract.js';
import type { SourceDocument } from './extract.js';

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
    scholarlyPageHosts: z.array(z.string().min(1)).optional(),
    userAgent: z.string().min(1).optional(),
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
