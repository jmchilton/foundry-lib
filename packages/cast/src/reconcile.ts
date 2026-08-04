// One answer to "does this file on disk match what we would write?", for every command that
// renders a deterministic artifact and offers a `--check` gate over it.
//
// Drift is a VALUE here, never an exit. A caster reconciles many artifacts in one run and has
// to report them together, so the decision of what stale MEANS — exit 1, a warning, a partial
// write — belongs to the command. A caster also fails for reasons that are not file
// comparisons at all, and those verdicts have to combine with these.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export function sha256Text(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

export function sha256File(filePath: string): string {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

export interface Drift {
  /** Why the file is out of sync, or undefined when it already matches. */
  reason?: string;
  /**
   * The hash on disk BEFORE reconciling — null when the file was absent.
   *
   * Returned rather than discarded because provenance records what a `--check` run actually
   * found, not what it wanted to find: a drifted entry keeps the stale hash so the record says
   * which bytes were on disk when the check failed.
   */
  currentHash: string | null;
  /**
   * The hash the file is supposed to have — carried back so a caller that renders the content
   * does not hash it a second time to record it.
   */
  expectedHash: string;
}

/**
 * Compare without touching the file.
 *
 * The read-only half, for an artifact whose write happens elsewhere in the command and under
 * different conditions than "not checking" — a verify manifest is written with the provenance
 * record, after an error gate that can abort the whole cast.
 */
export function driftOf(filePath: string, expectedHash: string, label: string): Drift {
  const exists = existsSync(filePath);
  const currentHash = exists ? sha256File(filePath) : null;
  if (currentHash === expectedHash) return { currentHash, expectedHash };
  return {
    reason: exists ? `${label} content drifted` : `${label} missing`,
    currentHash,
    expectedHash,
  };
}

export interface ReconcileOptions {
  path: string;
  expectedHash: string;
  label: string;
  check: boolean;
  /**
   * How to produce the file. A callback rather than the content itself because not every
   * artifact is a string we hold — a verbatim ref is a file COPY, compared against the source's
   * hash and written with `copyFileSync`. Only the write differs; the decision above it does not.
   */
  write: () => void;
}

/** Compare, and bring the file into line unless this is a check run. */
export function reconcile(options: ReconcileOptions): Drift {
  const drift = driftOf(options.path, options.expectedHash, options.label);
  if (drift.reason && !options.check) options.write();
  return drift;
}

/**
 * The common case: the expected content is a string already in hand.
 *
 * Creates the parent directory, because a first cast writes into a bundle that does not exist
 * yet — and does so only on the write path, so `--check` on a never-cast bundle leaves no
 * directory behind to make the next check pass for the wrong reason.
 */
export function reconcileText(options: {
  path: string;
  expected: string;
  label: string;
  check: boolean;
}): Drift {
  return reconcile({
    path: options.path,
    expectedHash: sha256Text(options.expected),
    label: options.label,
    check: options.check,
    write: () => {
      mkdirSync(path.dirname(options.path), { recursive: true });
      writeFileSync(options.path, options.expected);
    },
  });
}

/**
 * The absence of a file, as a reconciliation outcome.
 *
 * Deliberately not a `Drift`: that type carries an `expectedHash`, and a file that should not
 * exist has no expected content to hash. Widening that hash to null would push an impossible
 * case onto every caller that reads it, in order to describe a state none of them produce.
 */
export interface Absence {
  /** Why the file should not be there, or undefined when it already isn't. */
  reason?: string;
}

/**
 * Reconcile a file to ABSENT — the one desired state `reconcile` cannot express.
 *
 * A cast writes what its manifest declares, and a bundle still carrying what the manifest has
 * dropped is a bundle that disagrees with its own provenance. Nothing else catches it: hash
 * comparison only ever visits files something still claims, so an undeclared file is invisible
 * to every check while being the first thing an agent listing the directory finds.
 *
 * Same `check` contract as `reconcile` — report the reason, change nothing — and the reason is
 * returned rather than thrown for the same purpose: one run reconciles many files, and the
 * verdicts have to combine.
 */
export function reconcileAbsent(options: {
  path: string;
  reason: string;
  check: boolean;
}): Absence {
  if (!existsSync(options.path)) return {};
  if (!options.check) unlinkSync(options.path);
  return { reason: options.reason };
}

/**
 * What provenance records for a reconciled destination.
 *
 * A `--check` run writes nothing, so a drifted artifact keeps the hash that was actually on
 * disk — the record reports what the check FOUND, not what it wanted. Every other path has just
 * put the expected bytes there, or found them already there, so the expected hash is the truth.
 */
export function recordedHash(drift: Drift, check: boolean): string | null {
  return drift.reason && check ? drift.currentHash : drift.expectedHash;
}
