import fs from 'node:fs';

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
  collections: Collections;
  /** Resolve a content-relative path to the filesystem frame used by this process. */
  contentPath: (relativePath: string) => string;
  /** Map a typed note to its content route. Route policy stays with the instance. */
  targetOf: (collection: keyof Collections & string, id: string) => Target;
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
  const { collections, contentPath, targetOf } = options;
  type Name = keyof Collections & string;

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
    for (const name of Object.keys(collections) as Name[]) {
      for (const id of noteIds(name)) {
        map.set(slugify(id.replace(/\//g, '-')), targetOf(name, id));
      }
    }
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
