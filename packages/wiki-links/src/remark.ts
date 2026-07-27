// The remark half: rewrite `[[Target]]` in a markdown tree into real links.
//
// Kept dependency-free on purpose. The walk is short, and taking `unist-util-visit` would
// couple three sites on different unified versions to whichever one this package pinned.
// The node types below are structural for the same reason — an mdast `Root` satisfies them
// without anyone importing `@types/mdast` through us.
//
// What this rewrites, and what it deliberately does not:
//
//   - TEXT nodes only. `inlineCode` and `code` are left exactly as written, because a
//     backtick means "this is the syntax" — how the docs name the token, and how a note
//     names a slot it cannot link (`[[summary-<source>]]`). Resolving those would erase the
//     one thing the mark is good for.
//   - Never inside an existing link. A wiki link in a markdown link's label would otherwise
//     produce a nested anchor, which is invalid HTML and renders unpredictably.
//   - An unresolved link renders BOLD rather than as a dead anchor or raw `[[...]]`. It
//     stays visible to a reader and obvious to an author, and it never lies about leading
//     somewhere.

import { WIKI_LINK_SCAN_RE, parseWikiLink, type WikiLink } from './index.js';

/** The subset of an mdast node this transform reads or builds. */
export interface MdNode {
  type: string;
  value?: string;
  url?: string;
  title?: string | null;
  children?: MdNode[];
}

/** Where a resolved link points, and what a reader sees on hover. */
export interface WikiLinkDestination {
  href: string;
  /** Rendered as the anchor's `title`. A summary or page title, if the instance has one. */
  title?: string | null;
}

export interface RemarkWikiLinksOptions {
  /**
   * The instance's half: turn a parsed link into a destination, or `null` to leave it
   * unresolved. Called once per occurrence.
   *
   * Callers that key a map by slug will want `resolveWikiLink` from the package root, which
   * applies `slugify` and refuses an empty slug.
   */
  resolve(link: WikiLink): WikiLinkDestination | null;
}

/** Containers whose text is already a link target; descending would nest anchors. */
const LINK_TYPES = new Set(['link', 'linkReference']);

function linkNode(link: WikiLink, dest: WikiLinkDestination | null): MdNode {
  const label: MdNode = { type: 'text', value: link.display };
  if (!dest) return { type: 'strong', children: [label] };
  return {
    type: 'link',
    url: `${dest.href}${link.anchor}`,
    title: dest.title ?? null,
    children: [label],
  };
}

function splitText(value: string, resolve: RemarkWikiLinksOptions['resolve']): MdNode[] | null {
  const scan = new RegExp(WIKI_LINK_SCAN_RE.source, 'g');
  const out: MdNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = scan.exec(value)) !== null) {
    const inner = m[1];
    if (inner === undefined) continue;
    const link = parseWikiLink(inner);
    // A payload that parses to nothing (`[[ ]]`) is left as written rather than turned
    // into an empty bold run that reads as a rendering glitch.
    if (!link) continue;
    if (m.index > last) out.push({ type: 'text', value: value.slice(last, m.index) });
    out.push(linkNode(link, resolve(link)));
    last = m.index + m[0].length;
  }
  if (out.length === 0) return null;
  if (last < value.length) out.push({ type: 'text', value: value.slice(last) });
  return out;
}

/**
 * Build the transformer. Call it with the instance's resolver:
 *
 * ```ts
 * remarkWikiLinks({ resolve: (l) => {
 *   const t = resolveWikiLink(l.target, myMap);
 *   return t ? { href: `${base}/${t.id}/`, title: t.summary } : null;
 * }})
 * ```
 */
export default function remarkWikiLinks(opts: RemarkWikiLinksOptions) {
  const visit = (node: MdNode): void => {
    const children = node.children;
    if (!children) return;

    const out: MdNode[] = [];
    for (const child of children) {
      if (child.type === 'text' && child.value !== undefined && child.value.includes('[[')) {
        const split = splitText(child.value, opts.resolve);
        if (split) out.push(...split);
        else out.push(child);
        continue;
      }
      // Code is safe by construction rather than by a blocklist: `inlineCode`, `code` and
      // `html` are leaf nodes carrying a `value` and no children, and the branch above
      // rewrites `text` and nothing else. So a backtick keeps its payload verbatim without
      // anything here having to name it.
      //
      // Links are not safe by construction — they DO have children — so they are skipped
      // explicitly. Rewriting a wiki link inside a markdown link's label would nest anchors.
      if (!LINK_TYPES.has(child.type)) visit(child);
      out.push(child);
    }
    node.children = out;
  };

  return (tree: MdNode): void => visit(tree);
}
