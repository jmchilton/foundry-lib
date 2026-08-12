import { bundledPolicy } from '@galaxy-foundry/license-policy';
import {
  buildReferenceContract,
  type KindTerm,
  type Reference,
} from '@galaxy-foundry/reference-contract';

import type {
  LicenseBadgeProps,
  LicenseFileBodyProps,
  ReferenceContractProps,
  ContentNoteProps,
  ResolvedReference,
  SiteFooterProps,
  SiteHeaderProps,
  SiteShellProps,
  TagChipsProps,
} from './index.js';

/**
 * Where a specimen may be rendered, which is a property of the COMPONENT and not of the gallery.
 *
 * A gallery that gets this wrong does not fail. It renders, and the page is quietly broken in a
 * way that looks like a component bug: two headers on one page means two `#nav-more-trigger` and
 * two `#theme-toggle`, `getElementById` binds the first of each, and the second header's menu and
 * theme button do nothing at all. Nothing throws, nothing warns, and the specimen that proves the
 * overflow menu opens is the one that appears not to.
 *
 * So the constraint ships as data beside the props rather than as a paragraph in a README that
 * each instance's gallery has to have read.
 *
 * - `inline` — many to a page, safely. The component emits a fragment and owns no global names.
 * - `isolated` — one to a page, or one per frame. Valid inline markup carrying document-unique
 *   `id`s, global styles, or scripts that bind by id.
 * - `document` — its own `<html>`. Cannot be nested in a page at all; needs its own route, and an
 *   `<iframe>` if the gallery is to show it beside anything else.
 */
export type SpecimenSurface = 'inline' | 'isolated' | 'document';

/**
 * One case a component is meant to handle, as the props that produce it.
 *
 * `why` is the field that makes this a specimen rather than a screenshot. A gallery entry showing
 * a card with no accent bar is indistinguishable from a broken one, and an entry that renders
 * nothing at all looks exactly like a gallery bug — until something says which it is. Every case
 * below exists because a component makes a decision there, and `why` is that decision written
 * down where a reader of the gallery sees it.
 */
export interface Specimen<P = unknown> {
  /** Stable within its group: a route segment and an anchor, so a case can be linked to. */
  id: string;
  /** What to call it in the gallery. */
  name: string;
  /** What this case is evidence of — the decision the component makes here. */
  why: string;
  props: P;
}

/** Every case for one component, and how a page is allowed to render them. */
export interface SpecimenGroup<P = unknown> {
  /**
   * Stable and unique across every group a gallery renders: a route prefix and an anchor.
   *
   * Separate from {@link component} because the component name is not an address. The first
   * consumer added a second group of `ReferenceContract` cases — its own kinds, which the package
   * cannot know — and a name-derived anchor gave both sections the same one.
   */
  id: string;
  /** The component's name, as it is imported. */
  component: string;
  /** The subpath a consumer imports it from. */
  importPath: string;
  summary: string;
  surface: SpecimenSurface;
  specimens: readonly Specimen<P>[];
}

/** Two kinds, chosen for the one way they differ: whether the term has anywhere to point. */
const SPECIMEN_KINDS: Record<string, KindTerm> = {
  mold: {
    label: 'Mold',
    description: 'The authored note a skill is cast from.',
    href: 'https://galaxyproject.github.io/foundry-pattern/pattern/anatomy-of-an-instance/',
    ref_shape: 'wiki-link',
  },
  // No `href`, and that is the case. An instance's kinds are ITS vocabulary, and it need not have
  // a page to point a reader at — the parent Foundry gives all seven of its kinds one, so it never
  // rendered this; a sibling gives its three none, and rendered 104 of them across eleven pages.
  research: {
    label: 'Research',
    description: 'Background synthesis an instance holds but does not publish.',
    ref_shape: 'wiki-link',
  },
};

/**
 * The contract {@link REFERENCE_SPECIMENS} is authored against.
 *
 * Self-contained rather than instance-supplied, which is the opposite of how the component is used
 * on a real page — and deliberate. Half of these cases are about terms an instance's own contract
 * does not contain: a kind with no destination, a value outside the vocabulary. Fed a real
 * contract they would collapse into the same happy-path card, and the cases worth having a gallery
 * for would be the ones no gallery could show.
 *
 * What an instance specializes is the THEME these render in, plus whatever specimens it adds for
 * its own kinds. Not this.
 *
 * Exported so a gallery can say out loud whose vocabulary is on screen.
 */
export const SPECIMEN_CONTRACT = buildReferenceContract({ kinds: SPECIMEN_KINDS });

/**
 * Where the specimen refs point, as data.
 *
 * The component takes a resolver because how a `ref` becomes an href is the instance's question.
 * A specimen is not an instance, so it answers with a table and the resolver reads it — which
 * keeps the interesting value, `null`, expressible: a ref that resolves to a target with no page
 * is a dangling link, and it renders differently from one that resolved to nothing at all.
 */
const SPECIMEN_TARGETS: Record<string, ResolvedReference> = {
  '[[trimming-reads]]': {
    href: '#',
    label: 'Trimming reads',
    summary: 'A mold covering adapter trimming.',
  },
  '[[a-note-that-moved]]': { href: null, label: 'a-note-that-moved' },
};

const resolveSpecimenRef = (ref: string): ResolvedReference | null => SPECIMEN_TARGETS[ref] ?? null;

/** Every reference specimen differs only in its references, so only those are written out. */
const card = (references: Reference[]): ReferenceContractProps => ({
  references,
  contract: SPECIMEN_CONTRACT,
  resolveRef: resolveSpecimenRef,
});

export const REFERENCE_SPECIMENS: SpecimenGroup<ReferenceContractProps> = {
  id: 'reference-contract',
  component: 'ReferenceContract',
  importPath: '@galaxy-foundry/site-kit/ReferenceContract.astro',
  summary:
    "A note's typed reference manifest, rendered against the contract it was authored under.",
  surface: 'inline',
  specimens: [
    {
      id: 'one-reference',
      name: 'A single reference',
      why: 'The baseline: a kind with a destination, four inherited chips, no authored prose.',
      props: card([
        {
          kind: 'mold',
          ref: '[[trimming-reads]]',
          used_at: 'runtime',
          load: 'upfront',
          mode: 'verbatim',
          evidence: 'cast-validated',
        },
      ]),
    },
    {
      id: 'authored-detail',
      name: 'With authored detail',
      why: "Purpose, trigger and verification are the author's prose, not vocabulary. They open the detail list under the chips.",
      props: card([
        {
          kind: 'mold',
          ref: '[[trimming-reads]]',
          used_at: 'both',
          load: 'on-demand',
          mode: 'sidecar',
          evidence: 'corpus-observed',
          purpose: 'Supplies the parameter table the generated skill fills in.',
          // `on-demand` is the term that requires one. A reference loaded only sometimes and
          // never saying when is a rule the validator enforces, so no specimen models one.
          trigger: 'The user asks to trim reads.',
        },
      ]),
    },
    {
      id: 'kind-without-destination',
      name: 'A kind with nowhere to go',
      why: 'The kind pill is a link only when its term carries an href. Without one it is a span — because an anchor with no href is not focusable, not clickable, and announced as plain text, while wearing the same pill styling as the real links beside it.',
      props: card([
        {
          kind: 'research',
          ref: '[[trimming-reads]]',
          used_at: 'cast-time',
          load: 'upfront',
          mode: 'verbatim',
          evidence: 'corpus-observed',
        },
      ]),
    },
    {
      id: 'provisional-evidence',
      name: 'Provisional evidence',
      why: "The chip is coloured by the standing its term DECLARES, not by a list of term names in a selector. `hypothesis` also requires a verification, and the detail row wears the same standing's colour.",
      props: card([
        {
          kind: 'mold',
          ref: '[[trimming-reads]]',
          used_at: 'runtime',
          load: 'upfront',
          mode: 'verbatim',
          evidence: 'hypothesis',
          verification: 'Cast the skill and check the parameter table survives the round trip.',
        },
      ]),
    },
    {
      id: 'dangling-ref',
      name: 'A ref that resolves to nothing',
      why: 'A resolver returning a target with no href means the note is named and not there. It renders as marked text rather than as a link to nowhere.',
      props: card([
        {
          kind: 'mold',
          ref: '[[a-note-that-moved]]',
          used_at: 'runtime',
          load: 'upfront',
          mode: 'verbatim',
          evidence: 'corpus-observed',
        },
      ]),
    },
    {
      id: 'unregistered-term',
      name: 'A term outside the vocabulary',
      why: 'Should never reach a page — the schema refuses it at build. If one does, it renders as itself with the reason attached, rather than throwing on a reader or rendering as a blank chip that looks like a term with a short label.',
      props: card([
        {
          kind: 'mold',
          ref: '[[trimming-reads]]',
          used_at: 'runtime',
          load: 'upfront',
          mode: 'verbatim',
          evidence: 'vibes',
        },
      ]),
    },
    {
      id: 'several-references',
      name: 'Several references',
      why: 'The grid is auto-fit at a 17rem minimum, so how many columns appear is decided by the width the gallery gives it and not by the count. Narrow the window here.',
      props: card([
        {
          kind: 'mold',
          ref: '[[trimming-reads]]',
          used_at: 'runtime',
          load: 'upfront',
          mode: 'verbatim',
          evidence: 'cast-validated',
        },
        {
          kind: 'research',
          ref: '[[a-note-that-moved]]',
          used_at: 'cast-time',
          load: 'upfront',
          mode: 'sidecar',
          evidence: 'corpus-observed',
        },
        {
          kind: 'mold',
          ref: '[[trimming-reads]]',
          used_at: 'both',
          load: 'on-demand',
          mode: 'verbatim',
          evidence: 'hypothesis',
          trigger: 'A workflow declares a trimming step.',
          verification: 'Confirm the step appears in a cast run.',
        },
        {
          kind: 'research',
          ref: '[[trimming-reads]]',
          used_at: 'runtime',
          load: 'upfront',
          mode: 'sidecar',
          evidence: 'cast-validated',
        },
      ]),
    },
    {
      id: 'no-references',
      name: 'No references',
      why: 'The component renders NOTHING — not an empty card, not a heading with an empty grid. A note with no typed references gets no section, so this specimen is deliberately blank and the gallery should say so rather than look broken.',
      props: card([]),
    },
  ],
};

/** A nav long enough that where it is cut is a visible decision. */
const FULL_NAV = [
  { path: '/pattern/', label: 'Pattern' },
  { path: '/molds/', label: 'Molds' },
  { path: '/skills/', label: 'Skills' },
  { path: '/pipelines/', label: 'Pipelines' },
  { path: '/tags/', label: 'Tags' },
  { path: '/dashboard/', label: 'Dashboard' },
  { path: '/about/', label: 'About' },
];

export const HEADER_SPECIMENS: SpecimenGroup<SiteHeaderProps> = {
  id: 'site-header',
  component: 'SiteHeader',
  importPath: '@galaxy-foundry/site-kit/SiteHeader.astro',
  summary: 'The dark bar: wordmark, derived navigation, search box, theme toggle.',
  // Two headers on a page is two `#nav-more-trigger` and two `#theme-toggle`. See SpecimenSurface.
  surface: 'isolated',
  specimens: [
    {
      id: 'everything-fits',
      name: 'Everything fits',
      why: 'No "More" button, and the overflow script is not shipped at all — an instance whose destinations all fit is the intended state, not a stub.',
      props: {
        base: '/',
        pathname: '/molds/',
        name: 'Foundry',
        navLinks: FULL_NAV.slice(0, 4),
        navVisible: 4,
      },
    },
    {
      id: 'overflows',
      name: 'More than fits',
      why: "One list and a cut point, not two lists: which destinations exist and which of them fit are different questions, and only the second is about the header's width.",
      props: { base: '/', pathname: '/molds/', name: 'Foundry', navLinks: FULL_NAV, navVisible: 4 },
    },
    {
      id: 'active-under-more',
      name: 'Reading a section that overflowed',
      why: 'The "More" button itself lights up when the reader is inside a destination it holds — otherwise the section they are in has no marker anywhere on the bar.',
      props: {
        base: '/',
        pathname: '/dashboard/',
        name: 'Foundry',
        navLinks: FULL_NAV,
        navVisible: 4,
      },
    },
    {
      id: 'active-below-a-section',
      name: 'Reading beneath a destination',
      why: 'A destination is active on its own page and on everything beneath it, so a note page keeps its section marked.',
      props: {
        base: '/',
        pathname: '/molds/trimming-reads/',
        name: 'Foundry',
        navLinks: FULL_NAV,
        navVisible: 4,
      },
    },
    {
      id: 'sibling-prefix',
      name: 'A path that merely starts the same',
      why: 'Compared on whole path segments: on `/tags/`, a `/tag/` destination stays dark. String-prefix matching lights up both, and the bug is invisible until an instance happens to own both routes.',
      props: {
        base: '/',
        pathname: '/tags/',
        name: 'Foundry',
        navLinks: [{ path: '/tag/', label: 'Tag' }, ...FULL_NAV.slice(0, 3)],
        navVisible: 4,
      },
    },
    {
      id: 'long-wordmark',
      name: 'A long wordmark',
      why: 'Why `navVisible` is not a number to copy from a sibling instance: the same count that fits beside "Foundry" wraps beside a longer name. Measure it against a built page.',
      props: {
        base: '/',
        pathname: '/molds/',
        name: 'Statistical Genomics Foundry',
        navLinks: FULL_NAV,
        navVisible: 4,
      },
    },
  ],
};

export const FOOTER_SPECIMENS: SpecimenGroup<SiteFooterProps> = {
  id: 'site-footer',
  component: 'SiteFooter',
  importPath: '@galaxy-foundry/site-kit/SiteFooter.astro',
  summary:
    'The closing bar: the copyright mark, the repository, and whatever else an instance links.',
  surface: 'inline',
  specimens: [
    {
      id: 'repository-only',
      name: 'Repository only',
      why: 'The repository is the one link the footer always has, so an empty `footerLinks` is a complete footer rather than a missing one.',
      props: {
        base: '/',
        fullName: 'Galaxy Workflow Foundry',
        repoUrl: 'https://github.com/galaxyproject/foundry',
        footerLinks: [],
      },
    },
    {
      id: 'with-links',
      name: 'With instance links',
      why: 'Footer links render before GitHub, in the order the identity lists them.',
      props: {
        base: '/',
        fullName: 'Galaxy Workflow Foundry',
        repoUrl: 'https://github.com/galaxyproject/foundry',
        footerLinks: [
          { path: '#about', label: 'About' },
          { path: '#licenses', label: 'Licenses' },
        ],
      },
    },
  ],
};

export const SHELL_SPECIMENS: SpecimenGroup<SiteShellProps> = {
  id: 'site-shell',
  component: 'SiteShell',
  importPath: '@galaxy-foundry/site-kit/SiteShell.astro',
  summary: 'The whole document: head, header, the reading column, footer.',
  // Emits `<!doctype html>`. There is no nesting this in a page. See SpecimenSurface.
  surface: 'document',
  specimens: [
    {
      id: 'searchable',
      name: 'A page in the index',
      why: 'The default, and defaulted TRUE on purpose: `<main>` carries the Pagefind attribute. Marking one page is what removes every unmarked page from the index, so a route one forgotten prop away from unfindable is the failure this default exists to refuse.',
      props: {
        title: 'Trimming reads',
        base: '/',
        pathname: '/molds/trimming-reads/',
        identity: {
          name: 'Foundry',
          fullName: 'Galaxy Workflow Foundry',
          description: 'A knowledge base and casting pipeline for Galaxy workflows.',
          repoUrl: 'https://github.com/galaxyproject/foundry',
          navLinks: FULL_NAV,
          navVisible: 4,
          footerLinks: [{ path: '/about/', label: 'About' }],
        },
      },
    },
    {
      id: 'unsearchable',
      name: 'A page kept out of the index',
      why: 'Opting out is per page and is the only thing that makes an absence a decision. A gallery route is itself a fair candidate — its text is component names and prop values, which nobody is searching the corpus for.',
      props: {
        title: 'Gallery',
        base: '/',
        pathname: '/gallery/',
        searchable: false,
        identity: {
          name: 'Foundry',
          fullName: 'Galaxy Workflow Foundry',
          description: 'A knowledge base and casting pipeline for Galaxy workflows.',
          repoUrl: 'https://github.com/galaxyproject/foundry',
          navLinks: FULL_NAV,
          navVisible: 4,
          footerLinks: [{ path: '/about/', label: 'About' }],
        },
      },
    },
  ],
};

/**
 * The table these licence specimens are read against: the one the package bundles.
 *
 * Unlike {@link SPECIMEN_CONTRACT} this is not invented, and for the opposite reason. Which
 * reference KINDS exist is the instance's own declaration, so specimens for that component have to
 * bring a vocabulary of their own. What a licence permits is not: it is the shared table, the same
 * twenty-three rows in every instance, and a made-up one here would render a row no reader will
 * ever meet while the real rows went unshown. A row edited in `license-policy` changes these cards.
 */
const SPECIMEN_POLICY = bundledPolicy();

export const LICENSE_BADGE_SPECIMENS: SpecimenGroup<LicenseBadgeProps> = {
  id: 'license-badge',
  component: 'LicenseBadge',
  importPath: '@galaxy-foundry/site-kit/LicenseBadge.astro',
  summary: 'What a licence permits, as chips, from the id a note declares.',
  surface: 'inline',
  specimens: [
    {
      id: 'verbatim-ok',
      name: 'Redistributable',
      why: 'The baseline. `MIT` is also 1 of the 23 rows whose name equals its id, which is why rendering the id instead of the name looked right for sixteen notes.',
      props: { license: 'MIT', policy: SPECIMEN_POLICY },
    },
    {
      id: 'copyleft',
      name: 'Redistributable, and copyleft',
      why: 'The third chip appears only when the row calls for it. Copyleft is a property of the licence and not of the policy — a reader has to be able to see both at once.',
      props: { license: 'GPL-3.0-only', policy: SPECIMEN_POLICY },
    },
    {
      id: 'own-words-only',
      name: 'Not redistributable',
      why: 'The chip that has to be distinguishable from `verbatim OK` at a glance, because it means the opposite thing. Its colour is a token: as a raw hex in two repositories nothing could change it and nothing could break it either.',
      props: { license: 'CC-BY-NC-4.0', policy: SPECIMEN_POLICY },
    },
    {
      id: 'custom-ref',
      name: 'A LicenseRef, not an SPDX id',
      why: "Why the badge renders `name` rather than the id: `LicenseRef-arXiv-nonexclusive-distrib-1.0` is a pill that teaches a reader nothing. The id stays reachable as the chip's title.",
      props: {
        license: 'LicenseRef-arXiv-nonexclusive-distrib-1.0',
        policy: SPECIMEN_POLICY,
      },
    },
    {
      id: 'uncurated-ref',
      name: 'A LicenseRef nobody has curated',
      why: 'The same deny-by-default policy as the specimen below, and deliberately not the same name. This licence IS resolved — an author identified it and used the escape hatch — so labelling it `unresolved / missing` reports a real licence as an absent one, and reproaches the note that did the right thing. Its terms are still unknown, which is why the policy chip does not soften.',
      props: { license: 'LicenseRef-yale-non-commercial', policy: SPECIMEN_POLICY },
    },
    {
      id: 'unresolved',
      name: 'An id the table does not have',
      why: 'Deny-by-default, rendered. An unknown id resolves to the default row — own-words-only, flagged a defect — rather than to a gap, because a conservative chip beats a blank where a licence should be.',
      props: { license: 'NOT-A-REAL-ID', policy: SPECIMEN_POLICY },
    },
  ],
};

/** Short stand-in text. A real licence is pages long, and none of these cases is about its length. */
const COPY_TEXT = `Permission is granted to redistribute this text verbatim.
The canonical terms are at https://creativecommons.org/licenses/by/4.0/ and
questions go to https://example.org/contact — this copy is a courtesy.`;

export const LICENSE_FILE_SPECIMENS: SpecimenGroup<LicenseFileBodyProps> = {
  id: 'license-file-body',
  component: 'LicenseFileBody',
  importPath: '@galaxy-foundry/site-kit/LicenseFileBody.astro',
  summary: 'What one vendored licence copy governs, who redistributes under it, and its text.',
  surface: 'inline',
  specimens: [
    {
      id: 'one-license',
      name: 'One copy, one licence',
      why: 'The baseline, and the URLs in the text are the case worth looking at: a licence is the one document a reader most plausibly wants to leave, and the canonical terms are what they are leaving for.',
      props: {
        licenseFile: { id: 'cc-by-4.0', filename: 'cc-by-4.0.LICENSE', text: COPY_TEXT },
        policy: SPECIMEN_POLICY,
        uses: [
          { href: '#', label: 'trimming-reads', licenseId: 'CC-BY-4.0' },
          { href: '#', label: 'aligning-reads', licenseId: 'CC-BY-4.0' },
        ],
      },
    },
    {
      id: 'several-licenses',
      name: 'One copy, several licences',
      why: "A copy is keyed by SOURCE, so what it governs has more than one answer: the users' own ids, deduped and resolved. Both instances derived this the same way, which is why the derivation ships rather than the list.",
      props: {
        licenseFile: { id: 'upstream', filename: 'upstream.LICENSE', text: COPY_TEXT },
        policy: SPECIMEN_POLICY,
        uses: [
          { href: '#', label: 'a-note', licenseId: 'MIT' },
          { href: '#', label: 'another-note', licenseId: 'Apache-2.0' },
          { href: '#', label: 'a-third-note', licenseId: 'MIT' },
        ],
      },
    },
    {
      id: 'no-declared-license',
      name: 'Users that declare no id',
      why: 'The policy section disappears entirely rather than rendering empty. Nothing was resolved because nothing was declared, and a row of chips derived from no ids would be an answer the notes never gave.',
      props: {
        licenseFile: { id: 'vendored', filename: 'vendored.LICENSE', text: COPY_TEXT },
        policy: SPECIMEN_POLICY,
        uses: [{ href: '#', label: 'a-note-with-no-license' }],
      },
    },
    {
      id: 'no-links-in-the-text',
      name: 'Text with nothing to leave for',
      why: 'The other half of the URL cut. Everything outside a match is emitted verbatim, whitespace included — reflowing a redistributed licence is exactly what the obligation forbids.',
      props: {
        licenseFile: {
          id: 'terse',
          filename: 'terse.LICENSE',
          text: 'All rights reserved.\n\n    Reproduced here by permission.',
        },
        policy: SPECIMEN_POLICY,
        uses: [{ href: '#', label: 'a-manuscript', licenseId: 'LicenseRef-all-rights-reserved' }],
      },
    },
  ],
};

export const TAG_CHIPS_SPECIMENS: SpecimenGroup<TagChipsProps> = {
  id: 'tag-chips',
  component: 'TagChips',
  importPath: '@galaxy-foundry/site-kit/TagChips.astro',
  summary: 'Controlled vocabulary shown as links only when an instance has a browse route.',
  surface: 'inline',
  specimens: [
    {
      id: 'linked',
      name: 'Browsable tags',
      why: 'An established content site links each chip through the one route prefix the instance supplies.',
      // A fragment, not a route prefix: what this case shows is that a chip becomes an anchor, and
      // any real prefix would be some instance's — this one was `/foundry/tags`, which is the
      // Galaxy Workflow Foundry's, so its gallery shipped a live 404 to a tag it does not declare.
      props: { tags: ['method/persistent-laplacian'], tagBase: '#' },
    },
    {
      id: 'unlinked',
      name: 'Tags before browse exists',
      why: 'A partial content site shows controlled metadata without claiming a destination it has not built.',
      props: { tags: ['method/persistent-laplacian'] },
    },
  ],
};

export const CONTENT_NOTE_SPECIMENS: SpecimenGroup<ContentNoteProps> = {
  id: 'content-note',
  component: 'ContentNote',
  importPath: '@galaxy-foundry/site-kit/ContentNote.astro',
  summary: 'The invariant page frame around an instance-specific typed note.',
  surface: 'inline',
  specimens: [
    {
      id: 'body-heading',
      name: 'Body owns its heading',
      why: 'Most corpus notes already begin with H1; the frame supplies navigation, summary, tags, and the article boundary without duplicating it.',
      props: {
        title: 'Package A',
        summary: 'A package profile whose Markdown body owns its title.',
        tags: ['method/persistent-laplacian'],
        back: { href: '#', label: 'Packages' },
      },
    },
    {
      id: 'frame-heading',
      name: 'Frame owns its heading',
      why: 'A design record whose body starts directly in prose asks the shared frame to render its title and summary.',
      props: {
        title: 'Content-reader architecture',
        summary: 'Why content mechanics are shared and the content model is local.',
        showHeading: true,
      },
    },
  ],
};

/**
 * Every group the kit ships, in reading order.
 *
 * Typed as `SpecimenGroup<unknown>`, which is what a list of groups for six different components
 * can be. A page rendering a group imports that group's own export and keeps its props typed; this
 * list is for the things that do not care — an index, a route manifest, a count.
 */
export const SPECIMENS: readonly SpecimenGroup[] = [
  CONTENT_NOTE_SPECIMENS,
  TAG_CHIPS_SPECIMENS,
  REFERENCE_SPECIMENS,
  LICENSE_BADGE_SPECIMENS,
  LICENSE_FILE_SPECIMENS,
  HEADER_SPECIMENS,
  FOOTER_SPECIMENS,
  SHELL_SPECIMENS,
];

/**
 * Whether a group can be rendered on a page shared with anything else.
 *
 * The question a gallery route actually asks. `isolated` and `document` differ in how they have to
 * be given a page of their own — a frame or a route — but not in whether they need one.
 */
export const sharesPage = (group: SpecimenGroup): boolean => group.surface === 'inline';

/**
 * A specimen's stable address: `site-header/overflows`.
 *
 * One spelling for the anchor on an index page and the segment of a standalone route, so a link
 * between them cannot drift.
 */
export const specimenPath = (group: SpecimenGroup, specimen: Specimen): string =>
  `${group.id}/${specimen.id}`;
