import fs from 'node:fs';

import yaml from 'js-yaml';

import { matchesCollection, type CollectionTable } from '@galaxy-foundry/kind-schema/collections';
import {
  parseWikiLink,
  resolveWikiLink,
  resolveWikiLinksInMarkdown,
  slugify,
} from '@galaxy-foundry/wiki-links';
import remarkWikiLinks from '@galaxy-foundry/wiki-links/remark';

export interface ContentTarget {
  /** Site-relative path without the deployment base or trailing slash. */
  path: string;
  /** Optional tooltip carried by rendered wiki links. */
  title?: string;
}

/** A note's YAML frontmatter before an instance schema has parsed it. */
export type Frontmatter = Record<string, unknown>;

/** Extra wiki-link addresses derived from an instance's own note vocabulary. */
export type ContentAliases<Collections extends CollectionTable> = (
  meta: Frontmatter,
  id: string,
  collection: keyof Collections & string,
) => readonly string[];

export interface ExtraContentTarget<Target extends ContentTarget = ContentTarget> {
  /** Author-facing key before wiki-link slugification. */
  key: string;
  target: Target;
}

export interface ContentLink {
  href: string | null;
  label: string;
}

export interface ContentLinkOptions<Target extends ContentTarget> {
  base?: string;
  extraTargets?: readonly ExtraContentTarget<Target>[];
}

export interface ContentReaderOptions<
  Collections extends CollectionTable,
  Target extends ContentTarget,
> {
  /**
   * Routed collections in primary-address precedence order. When two notes have the same
   * primary slug, the later collection wins.
   */
  collections: Collections;
  /** Resolve a content-relative path to the filesystem frame used by this process. */
  contentPath: (relativePath: string) => string;
  /**
   * Read YAML frontmatter even when no aliases are configured. Supplying aliases already opts
   * into frontmatter reads.
   */
  readFrontmatter?: boolean;
  /** Instance-owned second addresses for a note. Aliases never overwrite a primary address. */
  aliases?: ContentAliases<Collections>;
  /** Map a typed note to its content route. Route policy stays with the instance. */
  targetOf: (
    collection: keyof Collections & string,
    id: string,
    meta: Frontmatter | undefined,
  ) => Target;
}

export interface ContentReader<Collections extends CollectionTable, Target extends ContentTarget> {
  markdownFiles(): string[];
  noteFiles<Name extends keyof Collections & string>(name: Name): string[];
  noteIds<Name extends keyof Collections & string>(name: Name): string[];
  wikiLinkMap(extraTargets?: readonly ExtraContentTarget<Target>[]): Map<string, Target>;
  resolveLink(value: string, options?: ContentLinkOptions<Target>): ContentLink;
  remarkWikiLinks(options?: ContentLinkOptions<Target>): ReturnType<typeof remarkWikiLinks>;
  resolveMarkdown(source: string, options?: ContentLinkOptions<Target>): string;
}

/** Remove the two note layouts from a collection-relative path. */
export function noteIdFromPath(relativePath: string): string {
  return relativePath.replace(/(?:\/index)?\.md$/, '');
}

const FRONTMATTER_RE = /^(?:\uFEFF)?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

const normalizeFrontmatterValue = (value: unknown): unknown => {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (Array.isArray(value)) return value.map(normalizeFrontmatterValue);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, normalizeFrontmatterValue(nested)]),
    );
  }
  return value;
};

const readNoteFrontmatter = (filePath: string): Frontmatter => {
  const source = fs.readFileSync(filePath, 'utf8');
  const document = FRONTMATTER_RE.exec(source)?.[1];
  if (document === undefined) return {};
  const parsed: unknown = yaml.load(document);
  if (parsed === undefined || parsed === null) return {};
  if (typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new TypeError(`${filePath}: YAML frontmatter must be a mapping`);
  }
  return normalizeFrontmatterValue(parsed) as Frontmatter;
};

const hrefFor = (base: string, target: ContentTarget): string => {
  const normalizedBase = base.replace(/\/$/, '');
  const normalizedPath = target.path.replace(/^\//, '').replace(/\/$/, '');
  return `${normalizedBase}/${normalizedPath}/`;
};

const destinationFor = (base: string, target: ContentTarget) => {
  const href = hrefFor(base, target);
  return target.title === undefined ? { href } : { href, title: target.title };
};

export function resolveContentLink<Target extends ContentTarget>(
  value: string,
  map: ReadonlyMap<string, Target>,
  base = '',
): ContentLink {
  const parsed = parseWikiLink(value);
  const target = resolveWikiLink(value, map);
  const label = parsed?.display ?? parsed?.target ?? value;
  return {
    href: target ? `${hrefFor(base, target)}${parsed?.anchor ?? ''}` : null,
    label,
  };
}

export function remarkContentWikiLinks<Target extends ContentTarget>(
  map: ReadonlyMap<string, Target>,
  base = '',
): ReturnType<typeof remarkWikiLinks> {
  return remarkWikiLinks({
    resolve: (link) => {
      const target = resolveWikiLink(link.target, map);
      return target ? destinationFor(base, target) : null;
    },
  });
}

export function resolveContentMarkdown<Target extends ContentTarget>(
  source: string,
  map: ReadonlyMap<string, Target>,
  base = '',
): string {
  return resolveWikiLinksInMarkdown(source, {
    resolve: (link) => {
      const target = resolveWikiLink(link.target, map);
      return target ? destinationFor(base, target) : null;
    },
  });
}

export function createContentReader<
  Collections extends CollectionTable,
  Target extends ContentTarget = ContentTarget,
>(options: ContentReaderOptions<Collections, Target>): ContentReader<Collections, Target> {
  const { aliases, collections, contentPath, readFrontmatter = false, targetOf } = options;
  type Name = keyof Collections & string;

  interface Note {
    collection: Name;
    id: string;
    meta: Frontmatter | undefined;
    target: Target;
  }

  const walk = (directory: string): string[] => {
    const absoluteDirectory = contentPath(directory);
    if (!fs.existsSync(absoluteDirectory)) return [];
    const files: string[] = [];
    for (const entry of fs.readdirSync(absoluteDirectory, { withFileTypes: true })) {
      const relativePath = directory ? `${directory}/${entry.name}` : entry.name;
      if (entry.isDirectory()) files.push(...walk(relativePath));
      else if (entry.isFile()) files.push(relativePath);
    }
    return files;
  };

  const noteFiles = <CollectionName extends Name>(name: CollectionName): string[] => {
    const row = collections[name]!;
    return walk(row.base)
      .filter((relativePath) => matchesCollection(relativePath, row))
      .sort();
  };

  const noteIds = <CollectionName extends Name>(name: CollectionName): string[] => {
    const prefix = `${collections[name]!.base}/`;
    return noteFiles(name).map((relativePath) => noteIdFromPath(relativePath.slice(prefix.length)));
  };

  const wikiLinkMap = (
    extraTargets: readonly ExtraContentTarget<Target>[] = [],
  ): Map<string, Target> => {
    const map = new Map<string, Target>();

    // Object property order is the collection-precedence contract. Keep primary registration in
    // this first pass so no alias can take an address that belongs to a routed note. Within a
    // collection noteFiles is sorted, making the full precedence deterministic.
    const notes: Note[] = [];
    for (const name of Object.keys(collections) as Name[]) {
      const prefix = `${collections[name]!.base}/`;
      for (const relativePath of noteFiles(name)) {
        const id = noteIdFromPath(relativePath.slice(prefix.length));
        const meta =
          aliases || readFrontmatter ? readNoteFrontmatter(contentPath(relativePath)) : undefined;
        const target = targetOf(name, id, meta);
        notes.push({ collection: name, id, meta, target });
        map.set(slugify(id.replace(/\//g, '-')), target);
      }
    }

    // Aliases fill empty addresses only. In an alias/alias collision, the first routed note wins;
    // in an alias/primary collision, the primary wins regardless of collection order.
    if (aliases) {
      for (const note of notes) {
        for (const alias of aliases(note.meta!, note.id, note.collection)) {
          const key = slugify(alias);
          if (!map.has(key)) map.set(key, note.target);
        }
      }
    }

    // Explicit extra targets are the caller's escape hatch and retain their existing final-write
    // behavior, including the ability to override a routed target deliberately.
    for (const { key, target } of extraTargets) map.set(slugify(key), target);
    return map;
  };

  return {
    markdownFiles: () =>
      walk('')
        .filter((file) => file.endsWith('.md'))
        .sort(),
    noteFiles,
    noteIds,
    wikiLinkMap,
    resolveLink: (value, linkOptions = {}) =>
      resolveContentLink(value, wikiLinkMap(linkOptions.extraTargets), linkOptions.base),
    remarkWikiLinks: (linkOptions = {}) =>
      remarkContentWikiLinks(wikiLinkMap(linkOptions.extraTargets), linkOptions.base),
    resolveMarkdown: (source, linkOptions = {}) =>
      resolveContentMarkdown(source, wikiLinkMap(linkOptions.extraTargets), linkOptions.base),
  };
}
