// The controlled tag vocabulary a note's `tags:` draws from, and the loader for it.
//
// Unlike the reference contract, this package ships NO vocabulary. Facets are the browse
// axes of one domain — one Foundry groups by `target`/`tool`/`cli`, another by
// `family`/`role`/`domain` — and there is no subset the two have in common worth
// inheriting. What is shared is the FORMAT and the rules that make it work, which both
// instances had independently arrived at and written down in near-identical prose.
//
// The rules, from the Foundry Pattern spec (galaxyproject/foundry-pattern,
// `content/pattern/standing-up-a-foundry.instructions.txt`):
//
//   - Membership is DECLARED, never parsed off the `/` prefix. A tag is valid because some
//     facet lists it under `values`. The slash in `target/galaxy` is a naming convention,
//     and a bare key like `meta` is an ordinary member — no flat-flag special case anywhere.
//   - Every facet is a CLOSED enum. No open, free-form, or prefix-wildcard escape hatch,
//     ever. A tag with no gloss is a tag the browse surface cannot document.
//   - Browse pages group by the DECLARING facet, which is what makes an "other" bucket
//     impossible rather than merely empty.
//
// Those are why the parser below refuses what it refuses.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import yaml from 'js-yaml';

/** One declared grouping of tags: a browse axis with its members and their glosses. */
export interface Facet {
  label: string;
  description: string;
  /** tag -> one-line gloss. The keys are the tags themselves, not leaf names. */
  values?: Record<string, string>;
}

/** The parsed shape of a `meta_tags.yml` file. */
export interface TagRegistryFile {
  /** Declared by the format, read by nothing. Accepted and ignored. */
  version?: number;
  facets: Record<string, Facet>;
}

export interface FacetInfo {
  key: string;
  label: string;
  description: string;
}

export interface TagEntry {
  /** The facet that DECLARED this tag — not whatever precedes its slash. */
  facet: string;
  gloss: string;
}

/** The conventional filename when an instance keeps its registry at its repo root. */
export const TAG_REGISTRY_FILE = 'meta_tags.yml';

function fail(source: string | undefined, message: string): never {
  throw new Error(source ? `${source}: ${message}` : message);
}

function requireText(
  source: string | undefined,
  where: string,
  raw: unknown,
  field: string,
): string {
  if (typeof raw !== 'string' || raw.length === 0) {
    fail(source, `${where} missing required field \`${field}\``);
  }
  return raw;
}

function parseFacet(source: string | undefined, key: string, raw: unknown): Facet {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    fail(source, `facet \`${key}\` is not a mapping`);
  }
  const r = raw as Record<string, unknown>;
  const facet: Facet = {
    label: requireText(source, `facet \`${key}\``, r['label'], 'label'),
    description: requireText(source, `facet \`${key}\``, r['description'], 'description'),
  };

  // A facet may legitimately have no `values` yet — the spec allows one to be declared
  // while still empty. It may not have a malformed one.
  const values = r['values'];
  if (values === undefined || values === null) return facet;
  if (typeof values !== 'object' || Array.isArray(values)) {
    fail(source, `facet \`${key}\` has a \`values\` that is not a mapping`);
  }
  const out: Record<string, string> = {};
  for (const [tag, gloss] of Object.entries(values as Record<string, unknown>)) {
    // The closed-enum rule in one check: a tag with no gloss is a tag the browse surface
    // cannot document and a reader cannot learn from, which is the whole reason the
    // registry is the complete catalog of what the corpus may carry.
    if (typeof gloss !== 'string' || gloss.length === 0) {
      fail(source, `tag \`${tag}\` in facet \`${key}\` has no gloss`);
    }
    out[tag] = gloss;
  }
  facet.values = out;
  return facet;
}

/**
 * Parse and validate a registry.
 *
 * Neither instance validated before this: both did `yaml.load(...) as TagRegistryFile` and
 * discovered a malformed registry as an undefined somewhere downstream.
 */
export function parseTagRegistry(text: string, source?: string): TagRegistryFile {
  const data: unknown = yaml.load(text);
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    fail(source, 'tag registry is not a mapping');
  }
  const table = data as Record<string, unknown>;

  const facetsRaw = table['facets'];
  if (facetsRaw === undefined) fail(source, 'has no `facets` block');
  if (typeof facetsRaw !== 'object' || facetsRaw === null || Array.isArray(facetsRaw)) {
    fail(source, '`facets` is not a mapping');
  }
  const entries = Object.entries(facetsRaw as Record<string, unknown>);
  // A registry with no facets validates no tag, which makes every note carrying one
  // unauthorable. It always means the block was started and not finished.
  if (entries.length === 0) fail(source, '`facets` is empty');

  const facets: Record<string, Facet> = {};
  // Membership is decided by declaration, so a tag declared under two facets has no single
  // declaring facet — `facetOf` would answer with whichever won the iteration, and the
  // browse pages would file the tag under one facet while the other silently listed it too.
  const declaredBy = new Map<string, string>();
  for (const [key, raw] of entries) {
    const facet = parseFacet(source, key, raw);
    for (const tag of Object.keys(facet.values ?? {})) {
      const first = declaredBy.get(tag);
      if (first !== undefined) {
        fail(source, `tag \`${tag}\` is declared by both \`${first}\` and \`${key}\``);
      }
      declaredBy.set(tag, key);
    }
    facets[key] = facet;
  }

  const version = table['version'];
  return version === undefined ? { facets } : { version: version as number, facets };
}

/**
 * Flatten a registry to `tag -> { facet, gloss }`.
 *
 * This is the one place membership is decided, and it is decided by DECLARATION.
 *
 * Exported because a bare key must resolve exactly like a slashed one, and that cannot be
 * proven against a real registry whose vocabulary happens to be entirely slashed.
 */
export function buildTagIndex(file: TagRegistryFile): Map<string, TagEntry> {
  const index = new Map<string, TagEntry>();
  for (const [facet, f] of Object.entries(file?.facets ?? {})) {
    for (const [tag, gloss] of Object.entries(f.values ?? {})) index.set(tag, { facet, gloss });
  }
  return index;
}

/** The accessors a schema, a validator and a browse surface need. */
export interface TagRegistry {
  /** Valid iff the tag is an exact key under some facet's `values`. */
  isValidTag(tag: string): boolean;
  /** Facets in declared order; the tag index groups by these. */
  facets(): FacetInfo[];
  /**
   * The facet that declared this tag, or undefined if unregistered. Callers group by this
   * rather than by prefix, which is what makes an "other" bucket impossible.
   */
  facetOf(tag: string): string | undefined;
  facetLabel(key: string | undefined): string;
  /** A tag's registry gloss. Every valid tag has one. */
  tagDescription(tag: string): string | undefined;
  /** Every registered tag, in declaration order. */
  allTags(): string[];
}

/** Build the accessors over an already-parsed registry. */
export function tagRegistry(file: TagRegistryFile): TagRegistry {
  const index = buildTagIndex(file);
  const facetMap = file?.facets ?? {};
  return {
    isValidTag: (tag) => index.has(tag),
    facets: () =>
      Object.entries(facetMap).map(([key, f]) => ({
        key,
        label: f.label,
        description: f.description,
      })),
    facetOf: (tag) => index.get(tag)?.facet,
    facetLabel: (key) => (key && facetMap[key]?.label) || (key ?? ''),
    tagDescription: (tag) => index.get(tag)?.gloss,
    allTags: () => [...index.keys()],
  };
}

/** Read, validate, and wrap an instance's registry. */
export function loadTagRegistry(tagsPath: string): TagRegistry {
  if (!existsSync(tagsPath)) throw new Error(`missing tag registry: ${tagsPath}`);
  return tagRegistry(parseTagRegistry(readFileSync(tagsPath, 'utf8'), tagsPath));
}

/** Walk up from `startDir` until a `meta_tags.yml` is found. */
export function findTagRegistryPath(startDir: string = process.cwd()): string {
  let dir = path.resolve(startDir);
  for (;;) {
    const candidate = path.join(dir, TAG_REGISTRY_FILE);
    if (existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error(`${TAG_REGISTRY_FILE} not found above ${startDir}`);
    dir = parent;
  }
}
