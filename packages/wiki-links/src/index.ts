// The `[[Target]]` wiki-link grammar every Foundry instance writes in, and the resolver
// both its renderers and its validator run on.
//
// Like tag-registry, this package ships NO data. The link MAP is the instance's — one
// Foundry keys notes by basename plus a Mold's `name` field, another by a dashed collection
// id, the pattern site by a de-prefixed filename — and none of that transfers. What
// transfers is the grammar and the lookup rule, which three repos had independently
// arrived at and written four byte-identical copies of `slugify` for.
//
// Two rules are worth stating because they were the source of every divergence found when
// this was extracted:
//
//   - RESOLUTION IS EXACT. There is no prefix fallback. A survey of ~4,200 links across two
//     Foundries found exactly two that resolved by prefix alone, and both were bugs: an
//     ellipsis (`[[...]]`, which slugifies to the empty string and therefore prefixes
//     everything) and a deliberate glob (`[[murrell-*]]`, meaning two papers, which prefix
//     matching would have silently narrowed to one). A rule that has never once done its
//     intended job is not a rule worth keeping.
//   - A BACKTICK MEANS THE SYNTAX, NOT A LINK. `` `[[Target]]` `` is how the docs name the
//     token, and how a note names a template slot it cannot link (`[[summary-<source>]]`).
//     The remark transform in ./remark therefore rewrites text nodes only, never code.

/** A whole string that is nothing but one wiki link — the frontmatter-field form. */
export const WIKI_LINK_RE = /^\[\[(.+)\]\]$/;

/**
 * Wiki links embedded in prose. Excludes `]` and newlines so an unclosed `[[` cannot run
 * to the end of the document.
 *
 * Stateful (`g`): reset `lastIndex` or build a fresh copy per scan.
 */
export const WIKI_LINK_SCAN_RE = /\[\[([^\]\n]+)\]\]/g;

/**
 * The slug a name is addressed by. Both sides of a lookup run through this — the map is
 * built with it and the typed link is resolved with it — which is what lets `[[Summarize
 * Nextflow]]` in prose find a note whose frontmatter says `name: Summarize Nextflow`.
 *
 * The spaced-hyphen pass comes first on purpose: `A - B` is one separator, not three.
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+-\s+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-');
}

/** The parts of a `[[target#anchor|display]]` payload. */
export interface WikiLink {
  /** What to resolve, anchor and alias removed. */
  target: string;
  /** `#section`, including the `#`, or `''`. Carried through to the href untouched. */
  anchor: string;
  /** What the reader sees. The alias when one is given, else the whole payload. */
  display: string;
}

/** The inner text of a whole-string wiki link, trimmed. `null` if it is not one. */
export function stripBrackets(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const m = WIKI_LINK_RE.exec(value);
  return m?.[1] ? m[1].trim() : null;
}

/**
 * Split a link payload into its parts. Accepts either the bracketed form (`[[a#b|c]]`) or
 * the bare inner text (`a#b|c`), so a caller scanning prose can hand over a capture group
 * without re-wrapping it.
 *
 * The alias splits before the anchor: `[[a|b#c]]` displays `b#c` and targets `a`, because
 * everything left of the pipe is the address and everything right of it is prose.
 */
export function parseWikiLink(value: unknown): WikiLink | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  // Not `stripBrackets`: that refuses an empty payload, and falling back to the raw string
  // on refusal would parse `[[]]` as a note literally named `[[]]`.
  const m = /^\[\[([\s\S]*)\]\]$/.exec(trimmed);
  const inner = (m?.[1] ?? trimmed).trim();
  if (inner.length === 0) return null;

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

/**
 * Look a link up in an instance's map. Exact match on the slugified target; nothing else.
 *
 * Generic in the target so each instance keeps its own — one stores a route id, another a
 * path plus a summary for the tooltip.
 *
 * An empty slug never resolves. That is not a degenerate case to tidy away: `[[...]]` and
 * `[[***]]` slugify to `''`, and under any prefix rule an empty string matches every key
 * in the map.
 */
export function resolveWikiLink<T>(value: unknown, map: ReadonlyMap<string, T>): T | undefined {
  const parsed = parseWikiLink(value);
  if (!parsed) return undefined;
  const slug = slugify(parsed.target);
  if (slug.length === 0) return undefined;
  return map.get(slug);
}
