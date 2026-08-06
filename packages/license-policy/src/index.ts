import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import yaml from 'js-yaml';

export type RedistributionPolicy = 'verbatim-ok' | 'own-words-only';

/**
 * A licence, as a note names one: an SPDX id or a `LicenseRef-` custom ref.
 *
 * This is what `license:` frontmatter carries, what `licenses:` below is keyed by, and what
 * {@link resolveLicenseRow} takes. `MIT`, `CC-BY-4.0`, `LicenseRef-all-rights-reserved`.
 *
 * Distinct from {@link LicenseFileId}, which identifies a vendored COPY rather than a licence.
 * The two were both spelled `licenseId` until they met on one line of a route.
 */
export type LicenseId = string;

export interface LicenseRow {
  name: string;
  policy: RedistributionPolicy;
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

const POLICIES: readonly string[] = ['verbatim-ok', 'own-words-only'];

function throwValidationError(sourcePath: string | undefined, message: string): never {
  throw new Error(sourcePath ? `${sourcePath}: ${message}` : message);
}

function validateRow(rowPath: string, rawRow: unknown, sourcePath: string | undefined): void {
  if (typeof rawRow !== 'object' || rawRow === null || Array.isArray(rawRow)) {
    throwValidationError(sourcePath, `${rowPath} is not a mapping`);
  }
  const fields = rawRow as Record<string, unknown>;

  for (const field of ['name', 'obligations'] as const) {
    if (typeof fields[field] !== 'string') {
      throwValidationError(sourcePath, `${rowPath} missing required field \`${field}\``);
    }
  }
  for (const field of ['license_file', 'copyleft'] as const) {
    if (typeof fields[field] !== 'boolean') {
      throwValidationError(sourcePath, `${rowPath} missing required field \`${field}\``);
    }
  }
  if (fields['defect'] !== undefined && typeof fields['defect'] !== 'boolean') {
    throwValidationError(sourcePath, `${rowPath} field \`defect\` must be a boolean`);
  }

  if (typeof fields['policy'] !== 'string' || !POLICIES.includes(fields['policy'])) {
    throwValidationError(
      sourcePath,
      `${rowPath} has unknown policy \`${String(fields['policy'])}\` (expected ${POLICIES.join(' | ')})`,
    );
  }
}

export function parseLicensePolicy(text: string, sourcePath?: string): LicensePolicy {
  const parsedValue: unknown = yaml.load(text);
  if (typeof parsedValue !== 'object' || parsedValue === null || Array.isArray(parsedValue)) {
    throwValidationError(sourcePath, 'license policy table is not a mapping');
  }
  const policyData = parsedValue as Record<string, unknown>;

  const licenses = policyData['licenses'];
  if (typeof licenses !== 'object' || licenses === null || Array.isArray(licenses)) {
    throwValidationError(sourcePath, 'license policy table has no `licenses` block');
  }
  if (policyData['default'] === undefined) {
    throwValidationError(sourcePath, 'license policy table has no `default` row');
  }

  for (const [licenseId, rawRow] of Object.entries(licenses as Record<string, unknown>)) {
    validateRow(`licenses.${licenseId}`, rawRow, sourcePath);
  }
  validateRow('default', policyData['default'], sourcePath);

  return {
    version: typeof policyData['version'] === 'number' ? policyData['version'] : 0,
    global_rules: (policyData['global_rules'] ?? {}) as Record<string, string>,
    licenses: licenses as Record<string, LicenseRow>,
    default: policyData['default'] as LicenseRow,
  };
}

const BUNDLED_PATH = fileURLToPath(new URL(`../data/${LICENSE_POLICY_FILE}`, import.meta.url));

let cachedBundledText: string | undefined;
let cachedBundledPolicy: LicensePolicy | undefined;

export function bundledPolicyPath(): string {
  return BUNDLED_PATH;
}

export function bundledPolicyText(): string {
  if (cachedBundledText === undefined) cachedBundledText = readFileSync(BUNDLED_PATH, 'utf8');
  return cachedBundledText;
}

export function bundledPolicy(): LicensePolicy {
  if (cachedBundledPolicy === undefined) {
    cachedBundledPolicy = parseLicensePolicy(bundledPolicyText(), BUNDLED_PATH);
  }
  return cachedBundledPolicy;
}

export function loadLicensePolicy(repositoryRoot: string): LicensePolicy {
  const policyPath = path.join(repositoryRoot, LICENSE_POLICY_FILE);
  if (!existsSync(policyPath)) throw new Error(`missing license policy table: ${policyPath}`);
  return parseLicensePolicy(readFileSync(policyPath, 'utf8'), policyPath);
}

export function findLicensePolicyPath(startDirectory: string = process.cwd()): string {
  let currentDirectory = path.resolve(startDirectory);
  for (;;) {
    const candidatePath = path.join(currentDirectory, LICENSE_POLICY_FILE);
    if (existsSync(candidatePath)) return candidatePath;
    const parentDirectory = path.dirname(currentDirectory);
    if (parentDirectory === currentDirectory) {
      throw new Error(`${LICENSE_POLICY_FILE} not found above ${startDirectory}`);
    }
    currentDirectory = parentDirectory;
  }
}

export function licenseIds(policy: LicensePolicy): LicenseId[] {
  return Object.keys(policy.licenses);
}

export function isValidLicenseId(policy: LicensePolicy, licenseId: LicenseId): boolean {
  return policy.licenses[licenseId] !== undefined || LICENSE_REF_RE.test(licenseId);
}

export function resolveLicenseRow(
  policy: LicensePolicy,
  licenseId: LicenseId | undefined | null,
): LicenseRow {
  if (typeof licenseId === 'string') {
    const licenseRow = policy.licenses[licenseId];
    if (licenseRow) return licenseRow;
  }
  return policy.default;
}

/**
 * Whether a note's `derived` posture means it reproduces upstream expression.
 *
 * This implements `global_rules.foundry_content_out_of_scope` — "this table governs third-party
 * pass-through content only." A note that summarizes a paper in its own words is the Foundry's
 * prose; redistributing it redistributes the Foundry's work, not the paper's, and the row for the
 * paper's license has nothing to say about it. A note that keeps load-bearing quotes does carry
 * protected expression, and the row governs it.
 *
 * The question is about the SOURCE and is settled when the note is written, which is why it keys
 * off `derived` rather than off a cast's `mode`. A cast cannot judge whether a quotation was fair;
 * that editorial call was already made, and `derived` plus `attribution` record it.
 *
 * `own-words` beats a verbatim signal rather than losing to it, so a posture like "own-words
 * paraphrase; functional strings kept verbatim as facts" reads as own-words. That is
 * `global_rules.functional_strings_verbatim`: facts and short identifiers are not copyrightable
 * expression, and own-words-only constrains prose, never facts.
 *
 * Absent `derived` means the ref is not an authored note at all — a vendored schema, an upstream
 * doc — so it is pass-through, and the caller applies the row. Deny-by-default, per
 * `global_rules.default_deny`.
 */
export function declaresVerbatimCarry(derived: string | undefined | null): boolean {
  if (typeof derived !== 'string') return true;
  return /license-aware|with-quotes|verbatim/i.test(derived) && !/own-words/i.test(derived);
}

export {
  LICENSE_FILE_EXTENSION,
  findLicenseFileById,
  licenseFileIdFromPath,
  loadLicenseFiles,
  redistributesUnder,
  type LicenseFile,
  type LicenseFileId,
} from './license-files.js';
