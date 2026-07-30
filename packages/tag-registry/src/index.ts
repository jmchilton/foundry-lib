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

function throwValidationError(sourcePath: string | undefined, message: string): never {
  throw new Error(sourcePath ? `${sourcePath}: ${message}` : message);
}

function requireText(
  sourcePath: string | undefined,
  fieldPath: string,
  value: unknown,
  field: string,
): string {
  if (typeof value !== 'string' || value.length === 0) {
    throwValidationError(sourcePath, `${fieldPath} missing required field \`${field}\``);
  }
  return value;
}

function parseFacet(sourcePath: string | undefined, facetKey: string, rawFacet: unknown): Facet {
  if (typeof rawFacet !== 'object' || rawFacet === null || Array.isArray(rawFacet)) {
    throwValidationError(sourcePath, `facet \`${facetKey}\` is not a mapping`);
  }
  const fields = rawFacet as Record<string, unknown>;
  const facet: Facet = {
    label: requireText(sourcePath, `facet \`${facetKey}\``, fields['label'], 'label'),
    description: requireText(
      sourcePath,
      `facet \`${facetKey}\``,
      fields['description'],
      'description',
    ),
  };

  const values = fields['values'];
  if (values === undefined || values === null) return facet;
  if (typeof values !== 'object' || Array.isArray(values)) {
    throwValidationError(
      sourcePath,
      `facet \`${facetKey}\` has a \`values\` that is not a mapping`,
    );
  }
  const parsedValues: Record<string, string> = {};
  for (const [tag, gloss] of Object.entries(values as Record<string, unknown>)) {
    if (typeof gloss !== 'string' || gloss.length === 0) {
      throwValidationError(sourcePath, `tag \`${tag}\` in facet \`${facetKey}\` has no gloss`);
    }
    parsedValues[tag] = gloss;
  }
  facet.values = parsedValues;
  return facet;
}

export function parseTagRegistry(text: string, sourcePath?: string): TagRegistryFile {
  const parsedValue: unknown = yaml.load(text);
  if (typeof parsedValue !== 'object' || parsedValue === null || Array.isArray(parsedValue)) {
    throwValidationError(sourcePath, 'tag registry is not a mapping');
  }
  const registryData = parsedValue as Record<string, unknown>;

  const facetsRaw = registryData['facets'];
  if (facetsRaw === undefined) throwValidationError(sourcePath, 'has no `facets` block');
  if (typeof facetsRaw !== 'object' || facetsRaw === null || Array.isArray(facetsRaw)) {
    throwValidationError(sourcePath, '`facets` is not a mapping');
  }
  const entries = Object.entries(facetsRaw as Record<string, unknown>);
  if (entries.length === 0) throwValidationError(sourcePath, '`facets` is empty');

  const facets: Record<string, Facet> = {};
  const declaringFacetByTag = new Map<string, string>();
  for (const [facetKey, rawFacet] of entries) {
    const facet = parseFacet(sourcePath, facetKey, rawFacet);
    for (const tag of Object.keys(facet.values ?? {})) {
      const firstDeclaringFacet = declaringFacetByTag.get(tag);
      if (firstDeclaringFacet !== undefined) {
        throwValidationError(
          sourcePath,
          `tag \`${tag}\` is declared by both \`${firstDeclaringFacet}\` and \`${facetKey}\``,
        );
      }
      declaringFacetByTag.set(tag, facetKey);
    }
    facets[facetKey] = facet;
  }

  const version = registryData['version'];
  return version === undefined ? { facets } : { version: version as number, facets };
}

export function buildTagIndex(registryFile: TagRegistryFile): Map<string, TagEntry> {
  const index = new Map<string, TagEntry>();
  for (const [facetKey, facet] of Object.entries(registryFile?.facets ?? {})) {
    for (const [tag, gloss] of Object.entries(facet.values ?? {})) {
      index.set(tag, { facet: facetKey, gloss });
    }
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

export function tagRegistry(registryFile: TagRegistryFile): TagRegistry {
  const index = buildTagIndex(registryFile);
  const facetMap = registryFile?.facets ?? {};
  return {
    isValidTag: (tag) => index.has(tag),
    facets: () =>
      Object.entries(facetMap).map(([facetKey, facet]) => ({
        key: facetKey,
        label: facet.label,
        description: facet.description,
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

export function findTagRegistryPath(startDirectory: string = process.cwd()): string {
  let currentDirectory = path.resolve(startDirectory);
  for (;;) {
    const candidatePath = path.join(currentDirectory, TAG_REGISTRY_FILE);
    if (existsSync(candidatePath)) return candidatePath;
    const parentDirectory = path.dirname(currentDirectory);
    if (parentDirectory === currentDirectory) {
      throw new Error(`${TAG_REGISTRY_FILE} not found above ${startDirectory}`);
    }
    currentDirectory = parentDirectory;
  }
}
