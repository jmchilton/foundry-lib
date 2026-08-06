export const WIKI_LINK_RE = /^\[\[(.+)\]\]$/;

/**
 * Match wiki links embedded in prose without crossing `]` or newline boundaries.
 * This global expression is stateful.
 */
export const WIKI_LINK_SCAN_RE = /\[\[([^\]\n]+)\]\]/g;

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+-\s+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-');
}

/**
 * The slug a note file answers to, from its path.
 *
 * The other half of {@link slugify}. A wiki-link's text becomes a slug one way and a note's
 * path becomes one the other way, and a lookup only works because the two agree — so they
 * belong in one place. Held apart, the pair drifts silently: the map is built from paths and
 * queried from prose, and a link that stops resolving looks like a missing note rather than
 * like two rules that no longer meet.
 *
 * A directory note is named for its directory, not for `index` — `patterns/subworkflow/index.md`
 * is `[[subworkflow]]`. Path separators only; this takes no `node:path` dependency, because the
 * package is consumed in browser bundles as well as in build scripts.
 */
export function fileSlug(filePath: string): string {
  const segments = filePath.split(/[/\\]/).filter(Boolean);
  const base = (segments.at(-1) ?? '').replace(/\.md$/, '');
  if (base === 'index') return segments.at(-2) ?? '';
  return base;
}

export interface WikiLink {
  target: string;
  anchor: string;
  display: string;
}

export function stripBrackets(wikiLinkValue: unknown): string | null {
  if (typeof wikiLinkValue !== 'string') return null;
  const match = WIKI_LINK_RE.exec(wikiLinkValue);
  return match?.[1] ? match[1].trim() : null;
}

export function parseWikiLink(wikiLinkValue: unknown): WikiLink | null {
  if (typeof wikiLinkValue !== 'string') return null;
  const trimmedValue = wikiLinkValue.trim();
  const bracketMatch = /^\[\[([\s\S]*)\]\]$/.exec(trimmedValue);
  const inner = (bracketMatch?.[1] ?? trimmedValue).trim();
  if (inner.length === 0) return null;

  // Split the alias first so `#` in display text remains prose.
  const pipe = inner.indexOf('|');
  const address = (pipe >= 0 ? inner.slice(0, pipe) : inner).trim();
  const display = (pipe >= 0 ? inner.slice(pipe + 1) : inner).trim();

  const hash = address.indexOf('#');
  return {
    target: (hash >= 0 ? address.slice(0, hash) : address).trim(),
    anchor: hash >= 0 ? address.slice(hash) : '',
    display,
  };
}

export function resolveWikiLink<Target>(
  wikiLinkValue: unknown,
  targetMap: ReadonlyMap<string, Target>,
): Target | undefined {
  const parsedLink = parseWikiLink(wikiLinkValue);
  if (!parsedLink) return undefined;
  const slug = slugify(parsedLink.target);
  if (slug.length === 0) return undefined;
  return targetMap.get(slug);
}

/**
 * Where a resolved link points. Shared by both rewriters — the remark transform over a parsed
 * tree and the string transform over raw markdown — so one `resolve` callback serves either and
 * the two cannot answer differently.
 */
export interface WikiLinkDestination {
  href: string;
  title?: string | null;
}

export { addBoldTermAnchors, slugifyTerm } from './anchors.js';
export { resolveWikiLinksInMarkdown, type ResolveWikiLinksOptions } from './markdown.js';
