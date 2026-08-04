// Writing into, and cleaning up after, a bundle directory.
//
// A cast is not only the files it writes. A ref that stops being declared leaves its
// destination behind, and a bundle that still carries it is a bundle whose contents no longer
// match its provenance — so pruning is part of producing a byte-stable cast, not tidying done
// afterwards.

import { copyFileSync, existsSync, mkdirSync, readdirSync, rmdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

import { reconcileAbsent } from './reconcile.js';

/** Copy a source file to its destination, creating the destination's directory. */
export function copyVerbatim(srcAbs: string, dstAbs: string): void {
  mkdirSync(path.dirname(dstAbs), { recursive: true });
  copyFileSync(srcAbs, dstAbs);
}

/**
 * Remove directories left empty by pruning, deepest first. Keeps `dir` itself.
 *
 * Deepest first because emptying a leaf is what makes its parent empty; a single top-down pass
 * would leave the parent behind and the next cast would report a bundle that differs from the
 * one it just wrote.
 */
export function pruneEmptyDirs(dir: string): void {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const full = path.join(dir, entry.name);
    pruneEmptyDirs(full);
    if (readdirSync(full).length === 0) rmdirSync(full);
  }
}

/**
 * Every file under `dir`, as paths relative to `relativeTo`, sorted and slash-separated.
 *
 * Sorted so a sweep over the listing reports in the same order on every platform — an unordered
 * readdir turns one stale file into a diff that moves between runs.
 */
export function listFilesUnder(dir: string, relativeTo: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFilesUnder(full, relativeTo));
    else out.push(path.relative(relativeTo, full).split(path.sep).join('/'));
  }
  return out;
}

/**
 * Reduce a subtree to exactly the files `declared` names, reporting whatever else was there.
 *
 * The bundle holds what the manifest says and nothing else. Casting writes each declared file
 * and, without this, never looks at what was already there — so a file that stops being declared
 * stays forever, invisible to every hash comparison because comparison only visits what is still
 * claimed.
 *
 * Scope this to the subtree the caster OWNS. A bundle can also hold things a cast did not put
 * there — harvested run output, notes a human added — and sweeping those is data loss, not
 * reconciliation. The caller names the subtree precisely for that reason.
 *
 * Empty directories left behind are pruned on the write path only; a `check` run must leave the
 * tree exactly as it found it.
 */
export function reconcileTreeTo(options: {
  root: string;
  declared: ReadonlySet<string>;
  relativeTo: string;
  reason?: (rel: string) => string;
  check: boolean;
}): Array<{ file: string; reason: string }> {
  const stale: Array<{ file: string; reason: string }> = [];
  const describe = options.reason ?? (() => 'orphan (nothing declares it)');
  for (const rel of listFilesUnder(options.root, options.relativeTo)) {
    if (options.declared.has(rel)) continue;
    const absence = reconcileAbsent({
      path: path.join(options.relativeTo, rel),
      reason: describe(rel),
      check: options.check,
    });
    if (absence.reason) stale.push({ file: rel, reason: absence.reason });
  }
  if (!options.check) pruneEmptyDirs(options.root);
  return stale;
}

/**
 * The commit a cast was produced from, or null outside a git checkout.
 *
 * Null rather than a throw: a cast produced from an export or a fresh copy is still a valid
 * cast, and provenance records the absence honestly instead of refusing to record anything.
 */
export function gitHead(repoRoot: string): string | null {
  try {
    return execSync('git rev-parse HEAD', { cwd: repoRoot, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}
