import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import fg from 'fast-glob';
import { z } from 'zod';

import type { SourceDocument } from './extract.js';

const execFileAsync = promisify(execFile);

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
  for (const source of config.sources) {
    const paths = config.trackedOnly
      ? await trackedPaths(root, source.include, source.exclude ?? [])
      : await fg(source.include, {
          cwd: root,
          ignore: source.exclude ?? [],
          onlyFiles: true,
          unique: true,
        });
    for (const artifactPath of paths) {
      const normalized = artifactPath.split(path.sep).join('/');
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
      .sort(([left], [right]) => left.localeCompare(right))
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

async function trackedPaths(
  root: string,
  include: readonly string[],
  exclude: readonly string[],
): Promise<string[]> {
  const { stdout } = await execFileAsync('git', ['-C', root, 'ls-files', '--', ...include]);
  const candidates = stdout.split(/\r?\n/u).filter(Boolean);
  if (exclude.length === 0) return candidates;
  const excluded = new Set(await fg([...exclude], { cwd: root, onlyFiles: true, unique: true }));
  return candidates.filter((candidate) => !excluded.has(candidate));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}
