import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import yaml from 'js-yaml';

export type CastMode = 'verbatim' | 'condense' | 'sidecar';

export type RedistributionPolicy = 'verbatim-ok' | 'own-words-only';

export interface LicenseRow {
  name: string;
  policy: RedistributionPolicy;
  allowed_modes: CastMode[];
  license_file: boolean;
  copyleft: boolean;
  defect?: boolean;
  obligations: string;
}

export interface LicensePolicy {
  version: number;
  global_rules: Record<string, string>;
  licenses: Record<string, LicenseRow>;
  /** Unknown and missing ids resolve here to keep policy deny-by-default. */
  default: LicenseRow;
}

export const LICENSE_POLICY_FILE = 'license-policy.yml';

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

export function bundledPolicyPath(): string {
  return BUNDLED_PATH;
}

export function bundledPolicyText(): string {
  if (bundledText === undefined) bundledText = readFileSync(BUNDLED_PATH, 'utf8');
  return bundledText;
}

export function bundledPolicy(): LicensePolicy {
  if (bundled === undefined) bundled = parseLicensePolicy(bundledPolicyText(), BUNDLED_PATH);
  return bundled;
}

export function loadLicensePolicy(repoRoot: string): LicensePolicy {
  const file = path.join(repoRoot, LICENSE_POLICY_FILE);
  if (!existsSync(file)) throw new Error(`missing license policy table: ${file}`);
  return parseLicensePolicy(readFileSync(file, 'utf8'), file);
}

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

export function licenseIds(policy: LicensePolicy): string[] {
  return Object.keys(policy.licenses);
}

export function isValidLicenseId(policy: LicensePolicy, id: string): boolean {
  return policy.licenses[id] !== undefined || LICENSE_REF_RE.test(id);
}

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

export function allowsMode(row: LicenseRow, mode: CastMode): boolean {
  return row.allowed_modes.includes(mode);
}
