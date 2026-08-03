// Enforcing the license → redistribution-policy table over an assembled cast.
//
// A cast copies other people's bytes into a frozen artifact, which is redistribution. The
// table in @galaxy-foundry/license-policy says what each license permits; this applies it to
// what a cast actually did, and stamps the hash of the license file each redistributed ref
// travels under.
//
// The check keys off the ref's `mode`, because that is the thing being permitted: carrying a
// note verbatim under an own-words-only license is the violation, and paraphrasing the same
// note is not. Presence rules for `license_file` — which notes must declare one at all — stay
// with the instance's validator, which is the only place that can tell a Foundry-authored
// annotation from genuine third-party redistribution.

import { existsSync } from 'node:fs';
import path from 'node:path';

import {
  bundledPolicy,
  resolveLicenseRow,
  type LicensePolicy,
} from '@galaxy-foundry/license-policy';

import type { ProvenanceRefEntry } from './provenance.js';
import { sha256File } from './reconcile.js';

/**
 * Check every redistributed ref against the policy table, stamping `license_file_hash`.
 *
 * Mutates the entries, because the hash belongs in the record being assembled and computing it
 * twice is how the record and the check disagree. Returns one message per violation rather than
 * throwing: a cast reports all its problems together, and a licence failure has to combine with
 * the unresolved refs and drifted artifacts found in the same run.
 *
 * `repoRoot` is still needed with the table in hand: the table says what a licence permits, but
 * `license_file` points into the tree being cast, and only that tree can be hashed.
 */
export function applyLicensePolicy(
  entries: ProvenanceRefEntry[],
  repoRoot: string,
  policy: LicensePolicy = bundledPolicy(),
): string[] {
  // A ref with no `license` is Foundry-authored — it falls under the repository's own LICENSE
  // and outside redistribution policy. When no ref carries one, the table is never consulted.
  if (!entries.some((e) => e.license)) return [];
  const errors: string[] = [];
  for (const entry of entries) {
    if (!entry.license) continue;
    const row = resolveLicenseRow(policy, entry.license);
    if (!row.allowed_modes.includes(entry.mode as (typeof row.allowed_modes)[number])) {
      errors.push(
        `${entry.src}: license ${entry.license} (${row.policy}) forbids mode=${entry.mode} (allowed: ${row.allowed_modes.join(', ')})`,
      );
    }
    if (entry.license_file) {
      const abs = path.join(repoRoot, entry.license_file);
      if (existsSync(abs)) {
        entry.license_file_hash = sha256File(abs);
      } else {
        errors.push(`${entry.src}: license_file missing: ${entry.license_file}`);
      }
    }
  }
  return errors;
}
