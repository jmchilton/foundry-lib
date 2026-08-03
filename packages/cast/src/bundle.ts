// Writing into, and cleaning up after, a bundle directory.
//
// A cast is not only the files it writes. A ref that stops being declared leaves its
// destination behind, and a bundle that still carries it is a bundle whose contents no longer
// match its provenance — so pruning is part of producing a byte-stable cast, not tidying done
// afterwards.

import { copyFileSync, existsSync, mkdirSync, readdirSync, rmdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

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
