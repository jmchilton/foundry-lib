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

function linkNode(link: WikiLink, destination: WikiLinkDestination | null): MdNode {
  const label: MdNode = { type: 'text', value: link.display };
  if (!destination) return { type: 'strong', children: [label] };
  return {
    type: 'link',
    url: `${destination.href}${link.anchor}`,
    title: destination.title ?? null,
    children: [label],
  };
}

function splitText(text: string, resolve: RemarkWikiLinksOptions['resolve']): MdNode[] | null {
  const wikiLinkPattern = new RegExp(WIKI_LINK_SCAN_RE.source, 'g');
  const replacementNodes: MdNode[] = [];
  let textStartIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = wikiLinkPattern.exec(text)) !== null) {
    const inner = match[1];
    if (inner === undefined) continue;
    const link = parseWikiLink(inner);
    if (!link) continue;
    if (match.index > textStartIndex) {
      replacementNodes.push({ type: 'text', value: text.slice(textStartIndex, match.index) });
    }
    replacementNodes.push(linkNode(link, resolve(link)));
    textStartIndex = match.index + match[0].length;
  }
  if (replacementNodes.length === 0) return null;
  if (textStartIndex < text.length) {
    replacementNodes.push({ type: 'text', value: text.slice(textStartIndex) });
  }
  return replacementNodes;
}

export default function remarkWikiLinks(options: RemarkWikiLinksOptions) {
  const visit = (node: MdNode): void => {
    const children = node.children;
    if (!children) return;

    const rewrittenChildren: MdNode[] = [];
    for (const child of children) {
      if (child.type === 'text' && child.value !== undefined && child.value.includes('[[')) {
        const splitNodes = splitText(child.value, options.resolve);
        if (splitNodes) rewrittenChildren.push(...splitNodes);
        else rewrittenChildren.push(child);
        continue;
      }
      if (!LINK_TYPES.has(child.type)) visit(child);
      rewrittenChildren.push(child);
    }
    node.children = rewrittenChildren;
  };

  return (tree: MdNode): void => visit(tree);
}
