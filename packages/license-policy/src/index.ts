// The shared license → redistribution-policy table, and the loader for it.
//
// The table is the product. Two Foundry instances kept byte-identical hand-mirrored
// copies of it for months — differing only in a comment naming the other repo — under
// a file header instructing everyone to "edit both by hand". This package replaces
// that instruction with a dependency.
//
// Scope is deliberately narrow: this answers "what does this license permit",
// never "is this note coherent with its license". The coherence rules genuinely
// differ between the instances today (one keys off a recorded `derived` posture,
// the other off the row alone), so abstracting them here would be inventing a
// shared rule that no one has actually agreed to.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import yaml from 'js-yaml';

/** A casting transform mode — the `mode` field of a Mold's typed reference. */
export type CastMode = 'verbatim' | 'condense' | 'sidecar';

/** What a license permits when its content is redistributed. */
export type RedistributionPolicy = 'verbatim-ok' | 'own-words-only';

export interface LicenseRow {
  name: string;
  policy: RedistributionPolicy;
  allowed_modes: CastMode[];
  /** True when a verbatim copy of the license must accompany the carry. */
  license_file: boolean;
  /** True when the isolate-in-its-own-file obligation applies. */
  copyleft: boolean;
  /** Set only on the `default` row: this id did not resolve. */
  defect?: boolean;
  obligations: string;
}

export interface LicensePolicy {
  version: number;
  global_rules: Record<string, string>;
  licenses: Record<string, LicenseRow>;
  /** Where an unknown or missing id lands. Deny-by-default. */
  default: LicenseRow;
}

/** The table's conventional filename at an instance's repo root. */
export const LICENSE_POLICY_FILE = 'license-policy.yml';

/** `^LicenseRef-<slug>$` escape hatch for ids outside the curated SPDX set. */
export const LICENSE_REF_RE = /^LicenseRef-[A-Za-z0-9.-]+$/;

const CAST_MODES: readonly string[] = ['verbatim', 'condense', 'sidecar'];
const POLICIES: readonly string[] = ['verbatim-ok', 'own-words-only'];

function fail(source: string | undefined, message: string): never {
  throw new Error(source ? `${source}: ${message}` : message);
}

function validateRow(where: string, row: unknown, source: string | undefined): void {
  if (typeof row !== 'object' || row === null || Array.isArray(row)) {
    fail(source, `${where} is not a mapping`);
  }
  const r = row as Record<string, unknown>;

  for (const field of ['name', 'obligations'] as const) {
    if (typeof r[field] !== 'string') fail(source, `${where} missing required field \`${field}\``);
  }
  for (const field of ['license_file', 'copyleft'] as const) {
    if (typeof r[field] !== 'boolean') fail(source, `${where} missing required field \`${field}\``);
  }
  if (r['defect'] !== undefined && typeof r['defect'] !== 'boolean') {
    fail(source, `${where} field \`defect\` must be a boolean`);
  }

  if (typeof r['policy'] !== 'string' || !POLICIES.includes(r['policy'])) {
    fail(
      source,
      `${where} has unknown policy \`${String(r['policy'])}\` (expected ${POLICIES.join(' | ')})`,
    );
  }

  const modes = r['allowed_modes'];
  if (!Array.isArray(modes)) fail(source, `${where} missing required field \`allowed_modes\``);
  for (const mode of modes as unknown[]) {
    if (typeof mode !== 'string' || !CAST_MODES.includes(mode)) {
      fail(
        source,
        `${where} has unknown cast mode \`${String(mode)}\` (expected ${CAST_MODES.join(' | ')})`,
      );
    }
  }
}

/**
 * Parse and validate a policy table.
 *
 * Validation is stricter than "it parsed": every row is checked field by field,
 * and both enums are closed. A published table is a contract, and a row that is
 * merely well-formed YAML can still authorize a carry nobody intended.
 *
 * `source` is only for error messages — pass the path when you have one, so a
 * caller with several tables in play learns which one failed.
 */
export function parseLicensePolicy(text: string, source?: string): LicensePolicy {
  const data: unknown = yaml.load(text);
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    fail(source, 'license policy table is not a mapping');
  }
  const table = data as Record<string, unknown>;

  const licenses = table['licenses'];
  if (typeof licenses !== 'object' || licenses === null || Array.isArray(licenses)) {
    fail(source, 'license policy table has no `licenses` block');
  }
  if (table['default'] === undefined) {
    fail(source, 'license policy table has no `default` row');
  }

  for (const [id, row] of Object.entries(licenses as Record<string, unknown>)) {
    validateRow(`licenses.${id}`, row, source);
  }
  validateRow('default', table['default'], source);

  return {
    version: typeof table['version'] === 'number' ? table['version'] : 0,
    global_rules: (table['global_rules'] ?? {}) as Record<string, string>,
    licenses: licenses as Record<string, LicenseRow>,
    default: table['default'] as LicenseRow,
  };
}

const BUNDLED_PATH = fileURLToPath(new URL(`../data/${LICENSE_POLICY_FILE}`, import.meta.url));

let bundledText: string | undefined;
let bundled: LicensePolicy | undefined;

/** Absolute path to the copy shipped inside this package. */
export function bundledPolicyPath(): string {
  return BUNDLED_PATH;
}

/**
 * The shipped table's raw bytes.
 *
 * This is what an instance keeping its own copy string-compares against in a
 * conformance test — which is the whole mechanism that turns "mirror any change
 * by hand" into something that fails loudly when nobody did.
 */
export function bundledPolicyText(): string {
  if (bundledText === undefined) bundledText = readFileSync(BUNDLED_PATH, 'utf8');
  return bundledText;
}

/** The shipped table, parsed. The default source of truth for every instance. */
export function bundledPolicy(): LicensePolicy {
  if (bundled === undefined) bundled = parseLicensePolicy(bundledPolicyText(), BUNDLED_PATH);
  return bundled;
}

/** Read the table from a directory that holds one at its root. */
export function loadLicensePolicy(repoRoot: string): LicensePolicy {
  const file = path.join(repoRoot, LICENSE_POLICY_FILE);
  if (!existsSync(file)) throw new Error(`missing license policy table: ${file}`);
  return parseLicensePolicy(readFileSync(file, 'utf8'), file);
}

/** Walk up from `startDir` until a `license-policy.yml` is found. */
export function findLicensePolicyPath(startDir: string = process.cwd()): string {
  let dir = path.resolve(startDir);
  for (;;) {
    const candidate = path.join(dir, LICENSE_POLICY_FILE);
    if (existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error(`${LICENSE_POLICY_FILE} not found above ${startDir}`);
    dir = parent;
  }
}

/** The curated SPDX ids the table names explicitly. Drives an instance's schema grammar. */
export function licenseIds(policy: LicensePolicy): string[] {
  return Object.keys(policy.licenses);
}

/** Whether a `license` value is a valid id — curated SPDX id or `LicenseRef-<slug>`. */
export function isValidLicenseId(policy: LicensePolicy, id: string): boolean {
  return policy.licenses[id] !== undefined || LICENSE_REF_RE.test(id);
}

/**
 * Resolve a `license` id to its row.
 *
 * An unknown id and a missing one both land on `default` — own-words-only, marked
 * `defect`. Deny-by-default is the point: a typo must not silently widen what a
 * note is allowed to redistribute.
 */
export function resolveLicenseRow(
  policy: LicensePolicy,
  licenseId: string | undefined | null,
): LicenseRow {
  if (typeof licenseId === 'string') {
    const row = policy.licenses[licenseId];
    if (row) return row;
  }
  return policy.default;
}

/** Whether a row permits a given casting transform mode. */
export function allowsMode(row: LicenseRow, mode: CastMode): boolean {
  return row.allowed_modes.includes(mode);
}

// The verbatim texts the table's `license_file` obligation refers to.
export {
  LICENSE_FILE_EXT,
  findLicenseFile,
  licenseIdFromFile,
  loadLicenseFiles,
  type LicenseFile,
} from './license-files.js';
