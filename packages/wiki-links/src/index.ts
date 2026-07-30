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

export function stripBrackets(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const m = WIKI_LINK_RE.exec(value);
  return m?.[1] ? m[1].trim() : null;
}

export function parseWikiLink(value: unknown): WikiLink | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const m = /^\[\[([\s\S]*)\]\]$/.exec(trimmed);
  const inner = (m?.[1] ?? trimmed).trim();
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

export function resolveWikiLink<T>(value: unknown, map: ReadonlyMap<string, T>): T | undefined {
  const parsed = parseWikiLink(value);
  if (!parsed) return undefined;
  const slug = slugify(parsed.target);
  if (slug.length === 0) return undefined;
  return map.get(slug);
}
