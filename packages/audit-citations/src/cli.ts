#!/usr/bin/env node

import { execFile } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { buildCitationAuditRun } from './audit.js';
import {
  loadCitationAuditConfig,
  loadConfiguredDocuments,
  referenceHeadingPattern,
} from './config.js';
import { collectEvidence } from './evidence.js';
import { extractCitations } from './extract.js';
import { isMissingFile, writeJsonAtomic, writeTextAtomic } from './files.js';
import { renderCitationAuditMarkdown } from './report.js';
import { ScholarlyResolver } from './resolve.js';
import {
  CITATION_AUDIT_SCHEMA_VERSION,
  parseCitationAdjudications,
  parseCitationEvidenceSnapshot,
  parseCitationScan,
} from './schema.js';
import type { CitationEvidenceSnapshot } from './schema.js';

const execFileAsync = promisify(execFile);

interface ParsedArguments {
  command: 'scan' | 'audit';
  config: string;
  root: string;
  output: string;
  evidence?: string;
  markdown?: string;
  adjudications?: string;
  candidateSource?: string;
  refresh: boolean;
}

export async function runCitationCli(arguments_: readonly string[]): Promise<void> {
  const argumentsParsed = parseArguments(arguments_);
  const root = path.resolve(argumentsParsed.root);
  const configPath = path.resolve(root, argumentsParsed.config);
  const config = await loadCitationAuditConfig(configPath);
  const headingPattern = referenceHeadingPattern(config);
  const scan = argumentsParsed.candidateSource
    ? parseCitationScan(await readJson(path.resolve(root, argumentsParsed.candidateSource)))
    : extractCitations(await loadConfiguredDocuments(root, config), {
        ...(headingPattern ? { referenceHeadingPattern: headingPattern } : {}),
        scholarlyPageHosts: config.scholarlyPageHosts ?? [],
      });

  if (argumentsParsed.command === 'scan') {
    await writeJsonAtomic(path.resolve(root, argumentsParsed.output), scan);
    process.stdout.write(`Extracted ${scan.candidates.length} citation candidates.\n`);
    return;
  }

  if (!argumentsParsed.evidence || !argumentsParsed.markdown) {
    throw new Error('audit requires --evidence and --markdown');
  }
  const evidencePath = path.resolve(root, argumentsParsed.evidence);
  const existing = await readEvidence(evidencePath);
  const resolver = argumentsParsed.refresh
    ? new ScholarlyResolver({
        scholarlyPageHosts: config.scholarlyPageHosts ?? [],
        ...(config.userAgent ? { userAgent: config.userAgent } : {}),
        ...(config.requestTimeoutMs !== undefined
          ? { requestTimeoutMs: config.requestTimeoutMs }
          : {}),
      })
    : undefined;
  const collected = await collectEvidence(scan.candidates, existing, {
    refresh: argumentsParsed.refresh,
    ...(resolver ? { resolver } : {}),
    ...(argumentsParsed.refresh
      ? {
          onEvidence: (cache: CitationEvidenceSnapshot) => writeJsonAtomic(evidencePath, cache),
        }
      : {}),
  });
  if (argumentsParsed.refresh) await writeJsonAtomic(evidencePath, collected.cache);
  const adjudications = argumentsParsed.adjudications
    ? parseCitationAdjudications(await readJson(path.resolve(root, argumentsParsed.adjudications)))
    : undefined;
  const run = buildCitationAuditRun(scan, collected.snapshot, {
    ...(adjudications ? { adjudications } : {}),
    provenance: await gitProvenance(root),
  });
  await Promise.all([
    writeJsonAtomic(path.resolve(root, argumentsParsed.output), run),
    writeTextAtomic(
      path.resolve(root, argumentsParsed.markdown),
      renderCitationAuditMarkdown(run, collected.snapshot),
    ),
  ]);
  process.stdout.write(
    `Audited ${run.summary.total} citations: ${run.summary.resolved} resolved, ` +
      `${run.summary['resolved-mismatched']} mismatched, ${run.summary.unresolved} unresolved, ` +
      `${run.summary.unavailable} unavailable.\n`,
  );
}

function parseArguments(arguments_: readonly string[]): ParsedArguments {
  const [rawCommand, ...rest] = arguments_;
  if (rawCommand !== 'scan' && rawCommand !== 'audit') usage();
  const values = new Map<string, string>();
  const allowed = new Set([
    '--config',
    '--root',
    '--output',
    '--evidence',
    '--markdown',
    '--adjudications',
    '--candidate-source',
  ]);
  let refresh = false;
  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index];
    if (argument === '--refresh') {
      refresh = true;
      continue;
    }
    if (!argument?.startsWith('--')) usage();
    if (!allowed.has(argument)) throw new Error(`unknown option: ${argument}`);
    const value = rest[index + 1];
    if (!value || value.startsWith('--')) usage();
    values.set(argument, value);
    index += 1;
  }
  const config = values.get('--config');
  const output = values.get('--output');
  if (!config || !output) usage();
  const evidence = values.get('--evidence');
  const markdown = values.get('--markdown');
  const adjudications = values.get('--adjudications');
  const candidateSource = values.get('--candidate-source');
  return {
    command: rawCommand,
    config,
    root: values.get('--root') ?? process.cwd(),
    output,
    ...(evidence ? { evidence } : {}),
    ...(markdown ? { markdown } : {}),
    ...(adjudications ? { adjudications } : {}),
    ...(candidateSource ? { candidateSource } : {}),
    refresh,
  };
}

function usage(): never {
  throw new Error(
    'usage: foundry-audit-citations <scan|audit> --config FILE --output FILE ' +
      '[--root DIR] [--evidence FILE --markdown FILE] [--refresh] ' +
      '[--candidate-source FILE] [--adjudications FILE]',
  );
}

async function readEvidence(pathname: string): Promise<CitationEvidenceSnapshot> {
  try {
    return parseCitationEvidenceSnapshot(await readJson(pathname));
  } catch (error) {
    if (isMissingFile(error)) {
      return { schemaVersion: CITATION_AUDIT_SCHEMA_VERSION, evidence: [] };
    }
    throw error;
  }
}

async function readJson(pathname: string): Promise<unknown> {
  return JSON.parse(await readFile(pathname, 'utf8')) as unknown;
}

async function gitProvenance(
  root: string,
): Promise<{ headRevision?: string; workingTreeDirty?: boolean }> {
  try {
    const [{ stdout: revision }, { stdout: status }] = await Promise.all([
      execFileAsync('git', ['-C', root, 'rev-parse', 'HEAD']),
      execFileAsync('git', ['-C', root, 'status', '--porcelain=v1']),
    ]);
    return { headRevision: revision.trim(), workingTreeDirty: status.trim().length > 0 };
  } catch {
    return {};
  }
}

if (isDirectExecution()) {
  void runCitationCli(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

function isDirectExecution(): boolean {
  const entrypoint = process.argv[1];
  if (entrypoint === undefined) return false;
  try {
    return realpathSync(entrypoint) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}
