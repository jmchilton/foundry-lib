// Where a target's cast bundles sit inside the target's own directory.
//
// This is placement, so it belongs to the target — the same split a per-kind `dst_dir` /
// `dst_extension` row already follows. One module reads it, so a caster, a verifier, a pipeline
// assembler and a site cannot hold four copies of the fact and disagree.
//
// Every function here takes the TARGET DIRECTORY, not a repo root and a target name. Where a
// Foundry keeps its targets is that Foundry's layout: `castsDir` below is the convention the
// one casting instance uses and a new instance can adopt, but the resolution above does not
// depend on it, so an instance that arranges its tree differently loses nothing.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import yaml from 'js-yaml';

/**
 * Substituted with the bundle's name (a Mold slug, or a pipeline harness name).
 *
 * Not exported. A target author meets this token in `_target.yml`, not in code, and the two
 * error messages below name it for them — an exported constant equal to the default template
 * is one more thing that can be imported and then compared against the wrong one.
 */
const BUNDLE_NAME_TOKEN = '{mold}';

/**
 * The layout of a target that declares none: one directory per bundle, named for it.
 *
 * A target that wants more says so. The Claude target in the flagship instance declares
 * `skills/{mold}` so that its target directory doubles as a Claude Code plugin root
 * (`.claude-plugin/plugin.json` beside `skills/<name>/SKILL.md`).
 */
export const DEFAULT_BUNDLE_PATH = BUNDLE_NAME_TOKEN;

/** The directory name a Foundry conventionally keeps its cast targets under. */
export const CASTS_DIR = 'casts';

/** The conventional directory of one target, for an instance that adopts `casts/<target>/`. */
export function castsTargetDir(repoRoot: string, target: string): string {
  return path.join(repoRoot, CASTS_DIR, target);
}

/**
 * Resolve a declared `bundle_path` template against one bundle name.
 *
 * Rejects a template that cannot place a bundle (no name token) or that would place it outside
 * the target directory — a `_target.yml` is repo data, but a path template that escapes its own
 * target is a mistake worth failing on rather than a layout worth honouring.
 */
export function resolveBundlePath(template: string, name: string): string {
  if (!template.includes(BUNDLE_NAME_TOKEN)) {
    throw new Error(`bundle_path must contain ${BUNDLE_NAME_TOKEN}: got ${template}`);
  }
  const rel = template.split(BUNDLE_NAME_TOKEN).join(name);
  if (path.isAbsolute(rel) || rel.split(/[/\\]/).includes('..')) {
    throw new Error(`bundle_path must stay inside the target directory: got ${template}`);
  }
  return rel;
}

/**
 * Validate a declared `bundle_path`, defaulting when a target declares none.
 *
 * The type check earns its message: `bundle_path: {mold}` is not the string it looks like —
 * unquoted braces are YAML *flow-mapping* syntax, so it loads as `{ mold: null }` and every
 * downstream string operation fails somewhere far away. Say so here instead.
 */
export function bundlePathOf(declared: unknown, source: string): string {
  if (declared === undefined || declared === null) return DEFAULT_BUNDLE_PATH;
  if (typeof declared !== 'string') {
    throw new Error(
      `${source}: bundle_path must be a string — an unquoted ${BUNDLE_NAME_TOKEN} is a YAML mapping, so quote it`,
    );
  }
  return declared;
}

/** The `bundle_path` a target declares in `<targetDir>/_target.yml`, or the default. */
export function bundlePathTemplate(targetDir: string): string {
  const declaration = path.join(targetDir, '_target.yml');
  if (!existsSync(declaration)) return DEFAULT_BUNDLE_PATH;
  const data = yaml.load(readFileSync(declaration, 'utf8')) as { bundle_path?: unknown } | null;
  return bundlePathOf(data && typeof data === 'object' ? data.bundle_path : undefined, declaration);
}

/** Absolute directory of one bundle, reading the target's declaration from disk. */
export function bundleDir(targetDir: string, name: string): string {
  return path.join(targetDir, resolveBundlePath(bundlePathTemplate(targetDir), name));
}
