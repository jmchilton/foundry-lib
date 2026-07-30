import { WIKI_LINK_SCAN_RE, parseWikiLink, type WikiLink } from './index.js';

export interface MdNode {
  type: string;
  value?: string;
  url?: string;
  title?: string | null;
  children?: MdNode[];
}

export interface WikiLinkDestination {
  href: string;
  title?: string | null;
}

export interface RemarkWikiLinksOptions {
  resolve(link: WikiLink): WikiLinkDestination | null;
}

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
    if (!link) continue;
    if (m.index > last) out.push({ type: 'text', value: value.slice(last, m.index) });
    out.push(linkNode(link, resolve(link)));
    last = m.index + m[0].length;
  }
  if (out.length === 0) return null;
  if (last < value.length) out.push({ type: 'text', value: value.slice(last) });
  return out;
}

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
      if (!LINK_TYPES.has(child.type)) visit(child);
      out.push(child);
    }
    node.children = out;
  };

  return (tree: MdNode): void => visit(tree);
}
