// Resolving `[[Target]]` in RAW MARKDOWN — the string-layer twin of the remark transform.
//
// The remark transform rewrites text nodes only, so a backticked link is safe by construction:
// it arrives as `inlineCode` and is never visited. A renderer that resolves links BEFORE the
// markdown is parsed has no such structure to lean on, and both Foundry instances filled that
// gap the same way, with a bare `/\[\[([^[\]]+)\]\]/g` over the whole document. That rewrites
// inside code spans, and the entry it corrupted first was the glossary's own definition of the
// syntax — `` `[[Target]]` `` rendering as `<code>**Target**</code>`, because the token
// resolved to nothing and took the bold fallback. Invisible to both surfaces at once: a
// validator strips code spans before scanning, so nothing reported it.
//
// So the rule is held here instead, by masking the regions a parser would have called code and
// scanning only what is left.
//
// WHAT THIS DOES NOT MASK: indented (four-space) code blocks and raw HTML blocks. Both need
// real block parsing to tell from a list continuation line, and a glossary of `**Term** — …`
// paragraphs has neither. Reach for a markdown parser before teaching this function to guess.

import { WIKI_LINK_SCAN_RE, parseWikiLink } from './index.js';
import type { WikiLink, WikiLinkDestination } from './index.js';

export interface ResolveWikiLinksOptions {
  /** Called for each link found outside a code region; return null to leave it unresolved. */
  resolve(link: WikiLink): WikiLinkDestination | null;
}

/** A half-open `[start, end)` span of the source that must not be rewritten. */
type Region = [number, number];

const FENCE_OPEN_RE = /^ {0,3}(`{3,}|~{3,})(.*)$/;

/**
 * Fenced code blocks, as source offsets.
 *
 * A fence closes on a line of the same character at least as long as the opener and nothing
 * else; an unclosed fence runs to the end of the document, which is what a parser does too. A
 * backtick fence whose info string contains a backtick is not a fence at all (CommonMark),
 * which is what keeps `` `x` `` on its own line from opening one.
 */
function fencedRegions(markdown: string): Region[] {
  const regions: Region[] = [];
  let offset = 0;
  let openedAt: number | null = null;
  let fenceChar = '';
  let fenceLength = 0;

  for (const line of markdown.split('\n')) {
    if (openedAt === null) {
      const opener = FENCE_OPEN_RE.exec(line);
      if (opener?.[1] && !(opener[1][0] === '`' && opener[2]?.includes('`'))) {
        openedAt = offset;
        fenceChar = opener[1][0]!;
        fenceLength = opener[1].length;
      }
    } else {
      const closer = new RegExp(`^ {0,3}${fenceChar === '`' ? '`' : '~'}{${fenceLength},}\\s*$`);
      if (closer.test(line)) {
        regions.push([openedAt, offset + line.length]);
        openedAt = null;
      }
    }
    offset += line.length + 1;
  }
  if (openedAt !== null) regions.push([openedAt, markdown.length]);
  return regions;
}

/**
 * Inline code spans outside the fenced regions, as source offsets.
 *
 * A run of N backticks opens a span that the next run of EXACTLY N closes — so a run of two
 * does not close a run of one, and a run with no match is literal text rather than a span that
 * swallows the rest of the document.
 */
function inlineCodeRegions(markdown: string, fenced: Region[]): Region[] {
  const runs: Array<{ start: number; length: number }> = [];
  const runPattern = /`+/g;
  let match: RegExpExecArray | null;
  while ((match = runPattern.exec(markdown)) !== null) {
    if (overlaps(match.index, match.index + match[0].length, fenced)) continue;
    runs.push({ start: match.index, length: match[0].length });
  }

  const regions: Region[] = [];
  for (let i = 0; i < runs.length; i += 1) {
    const opener = runs[i]!;
    const closerIndex = runs.findIndex((run, j) => j > i && run.length === opener.length);
    if (closerIndex < 0) continue;
    const closer = runs[closerIndex]!;
    regions.push([opener.start, closer.start + closer.length]);
    i = closerIndex;
  }
  return regions;
}

function overlaps(start: number, end: number, regions: readonly Region[]): boolean {
  return regions.some(([regionStart, regionEnd]) => start < regionEnd && end > regionStart);
}

/**
 * Rewrite every `[[Target]]` outside a code region into a markdown link.
 *
 * A resolved link becomes `[display](href#anchor)`; an unresolved one becomes `**display**`,
 * the same visibly-unresolved fallback the remark transform renders, so a reader can see the
 * stub and an author can find it.
 */
export function resolveWikiLinksInMarkdown(
  markdown: string,
  options: ResolveWikiLinksOptions,
): string {
  const fenced = fencedRegions(markdown);
  const code = [...fenced, ...inlineCodeRegions(markdown, fenced)];

  const wikiLinkPattern = new RegExp(WIKI_LINK_SCAN_RE.source, 'g');
  let out = '';
  let copiedTo = 0;
  let match: RegExpExecArray | null;
  while ((match = wikiLinkPattern.exec(markdown)) !== null) {
    const inner = match[1];
    if (inner === undefined) continue;
    const end = match.index + match[0].length;
    if (overlaps(match.index, end, code)) continue;
    const link = parseWikiLink(inner);
    if (!link) continue;
    const destination = options.resolve(link);
    out += markdown.slice(copiedTo, match.index);
    out += destination
      ? `[${link.display}](${destination.href}${link.anchor})`
      : `**${link.display}**`;
    copiedTo = end;
  }
  return copiedTo === 0 ? markdown : out + markdown.slice(copiedTo);
}
