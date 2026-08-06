// What a cast target declares about itself: where each kind's files land, which modes it will
// take, and what a finished bundle must contain.
//
// The loader takes the target DIRECTORY rather than a repo root and a target name, matching
// @galaxy-foundry/cast's placement functions. Where a Foundry keeps its targets is that
// Foundry's layout; what a target says about itself is not.
//
// Everything here is validated on the way in. A `_target.yml` is the one input to a cast that
// nothing upstream has checked — no note schema covers it, and it is edited by hand — so a
// missing `kinds:` or a `modes: verbatim` that should have been a list would otherwise reach
// the caster as `undefined` and fail hundreds of lines away, with nothing naming the file.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import yaml from 'js-yaml';

import { PROVENANCE_FILE } from '../provenance.js';
import { bundlePathOf } from '../target-layout.js';

export interface TargetKindConfig {
  dst_dir: string;
  dst_extension: string;
  modes: string[];
}

/**
 * The document a cast writes, and what a cast of a Mold is called here.
 *
 * Both are the TARGET's, and both were the caster's until a second target had to be imagined to
 * see it. `SKILL.md` is what one agent harness looks for; the noun "skill" is what that harness
 * calls the thing it finds. A target producing something else — a page, a card, a prompt file —
 * got the first Foundry's filename and the first Foundry's word for its own output.
 *
 * The byte-identity oracle cannot catch this class of mistake. It re-casts the one instance
 * whose vocabulary the hardcoded value already is, so the wrong answer and the right answer are
 * the same bytes. That is why these are declared rather than defaulted: a default would put the
 * assumption back, spelled as a fallback and no longer visible in any target file.
 */
export interface TargetDocument {
  /** Bundle-root-relative filename, e.g. `SKILL.md`. */
  path: string;
  /** The noun a cast goes by, e.g. `skill`. Substituted for `Mold` in the cast body. */
  noun: string;
}

/**
 * What a `_target.yml` declares.
 *
 * Deliberately no `name`. A target is addressed by the directory holding this file — that is
 * what `--target=` names and what the site discovers — so a `name:` inside it could only be a
 * second answer to a question the directory already settled.
 *
 * Deliberately no `provenance_schema_version`. The record's shape is the CASTER's, not the
 * target's, so the version travels with the code that emits it — `PROVENANCE_SCHEMA_VERSION`
 * in @galaxy-foundry/cast. A target that declared its own could name a shape the caster does
 * not write, and an instance's provenance JSON Schema stays the contract of record, so the two
 * are cross-checked rather than merely restated.
 */
export interface TargetConfig {
  /**
   * Where bundles sit under the target directory.
   *
   * Parsed by `bundlePathOf`, which is also what the placement functions use — a second reader
   * here would be a second answer to `bundle_path: {mold}`, where unquoted braces make a YAML
   * mapping rather than the template it resembles.
   */
  bundle_path?: string;
  document: TargetDocument;
  /**
   * What a finished bundle must contain, for the verifier that checks one.
   *
   * Defaults to what casting always writes — the document and the provenance record — because a
   * target spelling those out by hand restates the caster, and a restatement is only ever a
   * chance for the two to disagree. Declared explicitly, it means the target requires something
   * else instead.
   */
  required_outputs: string[];
  kinds: Record<string, TargetKindConfig>;
  skill_constraints: {
    frontmatter_required: string[];
    forbidden_runtime_paths: string[];
  };
}

function stringList(value: unknown, where: string): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw new Error(`${where} must be a list of strings`);
  }
  return value as string[];
}

function parseKind(value: unknown, where: string): TargetKindConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${where} must be a mapping`);
  }
  const kind = value as Record<string, unknown>;
  for (const field of ['dst_dir', 'dst_extension'] as const) {
    if (typeof kind[field] !== 'string') {
      throw new Error(`${where}.${field} must be a string`);
    }
  }
  return {
    dst_dir: kind.dst_dir as string,
    dst_extension: kind.dst_extension as string,
    modes: stringList(kind.modes, `${where}.modes`),
  };
}

function parseDocument(value: unknown, where: string): TargetDocument {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${where} must be a mapping declaring the file a cast writes and its noun`);
  }
  const doc = value as Record<string, unknown>;
  for (const field of ['path', 'noun'] as const) {
    if (typeof doc[field] !== 'string' || !(doc[field] as string).trim()) {
      throw new Error(`${where}.${field} must be a non-empty string`);
    }
  }
  const docPath = (doc.path as string).trim();
  // The document sits at the bundle root or nowhere. Casting writes it, the sweep never visits
  // it, and provenance does not list it — placed in a subdirectory it would land inside a
  // subtree the sweep owns and be deleted as an orphan on the next cast.
  if (/[\\/]/.test(docPath) || docPath === '.' || docPath === '..') {
    throw new Error(`${where}.path must be a filename at the bundle root, not a path: ${docPath}`);
  }
  return { path: docPath, noun: (doc.noun as string).trim() };
}

export function loadTargetConfig(targetDir: string): TargetConfig {
  const p = path.join(targetDir, '_target.yml');
  if (!existsSync(p)) throw new Error(`missing target config: ${p}`);
  const data: unknown = yaml.load(readFileSync(p, 'utf8'));
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`${p}: target config must be a mapping`);
  }
  const raw = data as Record<string, unknown>;

  const kinds = raw.kinds;
  if (!kinds || typeof kinds !== 'object' || Array.isArray(kinds)) {
    // A target that places no kinds can cast no reference. Nothing downstream asks again.
    throw new Error(`${p}: kinds must be a mapping of kind name to placement`);
  }

  const constraints = (raw.skill_constraints ?? {}) as Record<string, unknown>;
  if (typeof constraints !== 'object' || Array.isArray(constraints)) {
    throw new Error(`${p}: skill_constraints must be a mapping`);
  }

  const declaredBundlePath = bundlePathOf(raw.bundle_path, p);
  const document = parseDocument(raw.document, `${p}: document`);

  return {
    ...(raw.bundle_path === undefined ? {} : { bundle_path: declaredBundlePath }),
    document,
    required_outputs:
      raw.required_outputs === undefined
        ? [document.path, PROVENANCE_FILE]
        : stringList(raw.required_outputs, `${p}: required_outputs`),
    kinds: Object.fromEntries(
      Object.entries(kinds as Record<string, unknown>).map(([name, kind]) => [
        name,
        parseKind(kind, `${p}: kinds.${name}`),
      ]),
    ),
    skill_constraints: {
      frontmatter_required: stringList(
        constraints.frontmatter_required,
        `${p}: skill_constraints.frontmatter_required`,
      ),
      forbidden_runtime_paths: stringList(
        constraints.forbidden_runtime_paths,
        `${p}: skill_constraints.forbidden_runtime_paths`,
      ),
    },
  };
}

/**
 * The bundle subtrees a cast owns, and may therefore prune.
 *
 * Pruning is how a file that stops being a reference stops being in the bundle: nothing else in
 * a cast visits a file no ref claims, so an orphan left behind is invisible to every check and
 * still the first thing an agent listing the directory finds.
 *
 * Which subtrees those are is the TARGET's answer, derived from where it puts its kinds. Named
 * as a constant instead, the sweep would silently do nothing for any Foundry that spells its
 * destinations differently — the one failure mode that looks exactly like a clean cast. What is
 * NOT derived is anything else in the bundle: harvested output and instance contributions are
 * not placed by `dst_dir`, so a cast never claims the authority to delete them.
 */
export function ownedSubtrees(target: TargetConfig): string[] {
  const roots = new Set<string>();
  for (const [name, kind] of Object.entries(target.kinds)) {
    const segments = kind.dst_dir.split(/[/\\]/).filter((s) => s && s !== '.');
    if (segments.length === 0) {
      // Swept against the ref list, the bundle root would take SKILL.md and _provenance.json
      // with it: no ref claims either.
      throw new Error(
        `kinds.${name}.dst_dir places files at the bundle root, which a cast may not prune`,
      );
    }
    if (segments[0] === '..' || path.isAbsolute(kind.dst_dir)) {
      throw new Error(`kinds.${name}.dst_dir points outside the bundle: ${kind.dst_dir}`);
    }
    roots.add(segments[0]!);
  }
  return [...roots].sort();
}
