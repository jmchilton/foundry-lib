// The skill document a cast writes, and the pieces every instance builds one out of.
//
// What is here is the document's SHAPE — its frontmatter, its title, the `## Title` convention,
// and the row layouts a section is usually a list of. What a skill should SAY is a fact about
// the corpus it was cast from, so the sections themselves arrive from `skillSections` and the
// vocabulary inside a reference row arrives as `describe`.

import type { ProvenanceRefEntry } from '../provenance.js';

import type { Frontmatter } from '../frontmatter.js';
import { parseWikiLink, WIKI_LINK_SCAN_RE } from '@galaxy-foundry/wiki-links';
import type { SkillSection } from './hooks.js';

/** A frontmatter field read as a non-empty trimmed string, or nothing. */
export function scalar(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

// A cast bundle is read outside the site, where `[[a#b|c]]` addresses nothing — so the
// SKILL.md body carries the human text and drops the syntax.
//
// The grammar is the package's, not another regex here. This function used to hand-roll a
// fifth copy of `[[target#anchor|display]]`, which is exactly the drift the shared package
// exists to stop.
export function stripWikiLinks(text: string): string {
  return text.replace(WIKI_LINK_SCAN_RE, (whole) => {
    const link = parseWikiLink(whole);
    if (!link) return whole;
    // An explicit alias wins. Without one, `display` is the whole address, so fall back to
    // the bare target and drop the anchor.
    const label = link.display === `${link.target}${link.anchor}` ? link.target : link.display;
    return label.trim() || whole;
  });
}

/**
 * A Mold's body as the cast document's procedure reads it.
 *
 * THAT a substitution happens is casting's: a Mold becomes something else at the moment it is
 * cast, so a bundle still calling itself a Mold would name the thing it was made from rather
 * than the thing it is. WHICH word it becomes is the target's — `skill` is what one agent
 * harness calls its artifacts, and until this took an argument, a target shipping pages or
 * cards was told by its own documents that it shipped skills.
 *
 * Heading levels shift down by one because the document already spent `#` on its title and
 * `##` on its sections.
 */
export function runtimeProcedureBody(body: string, moldName: string, noun: string): string {
  return stripWikiLinks(body.trim())
    .replace(new RegExp(`^#\\s+${moldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\n+`), '')
    .replace(/^(#{2,5})\s/gm, '$1# ')
    .replace(new RegExp(`\\bcast ${noun}\\b`, 'g'), noun)
    .replace(/\bThis Mold\b/g, `This ${noun}`)
    .replace(/\bThe Mold\b/g, `The ${noun}`)
    .replace(/\bthis Mold\b/g, `this ${noun}`)
    .replace(/\bthe Mold\b/g, `the ${noun}`)
    .replace(/\bMolds\b/g, `${noun}s`)
    .replace(/\bMold\b/g, noun);
}

function escapeFrontmatterString(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, ' ');
}

/** Wiki-links stripped, trailing periods normalized to exactly one. */
export function sentence(text: string): string {
  const cleaned = stripWikiLinks(text).trim().replace(/[.]+$/, '');
  return cleaned ? `${cleaned}.` : '';
}

function lowerFirst(text: string): string {
  return text ? text[0]!.toLowerCase() + text.slice(1) : text;
}

/** A ref's `trigger` as a sentence, with the "when" the field already implies said once. */
export function triggerSentence(text: string): string {
  const cleaned = stripWikiLinks(text)
    .trim()
    .replace(/[.]+$/, '')
    .replace(/^when\s+/i, '');
  return cleaned ? `Use when: ${lowerFirst(cleaned)}.` : '';
}

/**
 * One line per reference: where it landed, what it is, and when to read it.
 *
 * The row's shape is casting's; the nouns in it are the instance's, which is why `describe`
 * is an argument. A second Foundry gets the same layout under its own vocabulary instead of
 * re-deriving how a reference should read.
 */
export function refRows(
  refs: readonly ProvenanceRefEntry[],
  describe: {
    kindLabel: (ref: ProvenanceRefEntry) => string;
    modePhrase: (ref: ProvenanceRefEntry) => string;
  },
): string[] {
  return refs.map((r) => {
    const details = [`- \`${r.dst}\`: ${describe.kindLabel(r)} ${describe.modePhrase(r)}.`];
    if (r.companion_of) {
      // The parent note row already carries purpose/trigger; just point to it.
      details.push(`Sibling of \`${r.companion_of}\`; read it where that note directs.`);
      return details.join(' ');
    }
    if (r.purpose) details.push(sentence(r.purpose));
    if (r.trigger) details.push(triggerSentence(r.trigger));
    return details.join(' ');
  });
}

/**
 * A section whose content is a list, with something to say when the list is empty.
 *
 * The empty case is not omission: a skill that declares no required tools has said something,
 * and a reader who finds no heading cannot tell that from a caster that forgot to ask.
 */
export function bulletSection(
  title: string,
  lines: string[],
  empty = '- None declared.',
): SkillSection {
  return { title, body: (lines.length ? lines : [empty]).join('\n') };
}

/**
 * The document's one-line description, falling back to naming what it is when none was written.
 *
 * The fallback is the one path the body substitution never reaches, so it used to describe every
 * summary-less bundle as a Mold — the thing it was cast from rather than the thing it is.
 */
export function skillSummary(meta: Frontmatter, moldName: string, noun: string): string {
  return scalar(meta.summary) ?? `Run the ${moldName} ${noun}.`;
}

/**
 * The cast document: frontmatter, title, lede, then the sections the instance contributed.
 *
 * Which sections exist and what they say came from `skillSections`, because a document's
 * contents are a fact about the corpus it describes. What stays here is the `## Title`
 * convention and the two frontmatter keys a harness reads to find the document.
 *
 * Those two keys are the one piece of target vocabulary still written into this function.
 * `name:`/`description:` is what one harness looks for, and `skill_constraints.frontmatter_required`
 * declares exactly that pair — so the target already says it and the package still hardcodes it.
 * Closing that needs a rule for which value fills a declared key, which needs a second target to
 * design against; naming it here rather than generalising on one example.
 */
export function renderSkillMarkdown(args: {
  moldName: string;
  meta: Frontmatter;
  lede: string;
  sections: readonly SkillSection[];
  noun: string;
}): string {
  const summary = skillSummary(args.meta, args.moldName, args.noun);
  return [
    '---',
    `name: ${args.moldName}`,
    `description: "${escapeFrontmatterString(stripWikiLinks(summary))}"`,
    '---',
    '',
    `# ${args.moldName}`,
    '',
    args.lede,
    '',
    ...args.sections.map((s) => [`## ${s.title}`, '', s.body, ''].join('\n')),
  ].join('\n');
}
