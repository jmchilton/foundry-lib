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

export { addBoldTermAnchors, slugifyTerm } from './anchors.js';
