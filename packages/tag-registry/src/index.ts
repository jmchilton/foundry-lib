import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import yaml from 'js-yaml';

export interface Facet {
  label: string;
  description: string;
  /** Full tag keys mapped to their one-line glosses. */
  values?: Record<string, string>;
}

export interface TagRegistryFile {
  version?: number;
  facets: Record<string, Facet>;
}

export interface FacetInfo {
  key: string;
  label: string;
  description: string;
}

export interface TagEntry {
  facet: string;
  gloss: string;
}

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

  const values = r['values'];
  if (values === undefined || values === null) return facet;
  if (typeof values !== 'object' || Array.isArray(values)) {
    fail(source, `facet \`${key}\` has a \`values\` that is not a mapping`);
  }
  const out: Record<string, string> = {};
  for (const [tag, gloss] of Object.entries(values as Record<string, unknown>)) {
    if (typeof gloss !== 'string' || gloss.length === 0) {
      fail(source, `tag \`${tag}\` in facet \`${key}\` has no gloss`);
    }
    out[tag] = gloss;
  }
  facet.values = out;
  return facet;
}

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
  if (entries.length === 0) fail(source, '`facets` is empty');

  const facets: Record<string, Facet> = {};
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

export function buildTagIndex(file: TagRegistryFile): Map<string, TagEntry> {
  const index = new Map<string, TagEntry>();
  for (const [facet, f] of Object.entries(file?.facets ?? {})) {
    for (const [tag, gloss] of Object.entries(f.values ?? {})) index.set(tag, { facet, gloss });
  }
  return index;
}

export interface TagRegistry {
  isValidTag(tag: string): boolean;
  facets(): FacetInfo[];
  facetOf(tag: string): string | undefined;
  facetLabel(key: string | undefined): string;
  tagDescription(tag: string): string | undefined;
  allTags(): string[];
}

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

export function loadTagRegistry(tagsPath: string): TagRegistry {
  if (!existsSync(tagsPath)) throw new Error(`missing tag registry: ${tagsPath}`);
  return tagRegistry(parseTagRegistry(readFileSync(tagsPath, 'utf8'), tagsPath));
}

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
