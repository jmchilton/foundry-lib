import {
  licenseFileIdFromPath,
  resolveLicenseRow,
  type LicenseFile,
  type LicenseFileId,
  type LicenseId,
  type LicensePolicy,
  type LicenseRow,
} from '@galaxy-foundry/license-policy';
import type { Reference, ReferenceContract } from '@galaxy-foundry/reference-contract';

/**
 * A destination in the shell's chrome.
 *
 * `path` is site-absolute and carries no base — the base is applied where the link is rendered.
 * That keeps these plain data: no closures, nothing an environment variable has to resolve, so a
 * list of them can be serialized, read from a file, or handed to a component as a prop.
 *
 * Every entry used to carry its own `match` closure in both instances that arrived at this shape,
 * and fifteen of the sixteen closures were the same single line. The sixteenth excluded a route
 * pair that had never existed. The rule below is that single line, written once.
 */
export interface ShellLink {
  path: string;
  label: string;
}

/** A {@link ShellLink} with the base applied and the reader's position resolved against it. */
export interface ResolvedShellLink extends ShellLink {
  /** The href to emit: the base, then the site-absolute path. */
  href: string;
  /** Whether the reader is on this destination's page or somewhere beneath it. */
  active: boolean;
}

/**
 * What makes a site itself, in the shape this shell consumes it.
 *
 * The kit ships the FORMAT; the instance supplies every value. Nothing here is a default, because
 * a default for `name` or `repoUrl` would be a wrong answer rather than a missing one.
 *
 * What is NOT here matters as much: see {@link CONTAINER}. A value belongs in this interface when
 * two instances have a reason to disagree about it, not merely because they once did.
 */
export interface SiteIdentity {
  /** Short name: the header wordmark and the `<title>` suffix. */
  name: string;
  /** Full name: the footer's copyright mark. */
  fullName: string;
  /** Default `<meta name="description">`, and the og/twitter pair built from it. */
  description: string;
  /** Where the footer's repository link points. */
  repoUrl: string;
  /** The primary navigation, in order. Active state is DERIVED — see {@link resolveNav}. */
  navLinks: ShellLink[];
  /**
   * How many of `navLinks` stay on the bar. Everything after goes under "More".
   *
   * A count set by what FITS, not a claim about which sections matter — and what fits differs
   * between instances because the wordmark does. Measure it against a built page rather than
   * copying a sibling's number.
   */
  navVisible: number;
  /** Destinations the footer offers beside the repository, which it always links. */
  footerLinks: ShellLink[];
}

/**
 * The measure of the reading column, as a Tailwind class.
 *
 * Deliberately NOT part of {@link SiteIdentity}. The two instances this shell came from disagreed
 * here once, and the disagreement was never decided — one shell was copied from the other two
 * months later and the width changed in the same edit as the name and the description. Neither
 * corpus defends a value either: the prose measure is set by narrowing LOCALLY on the pages that
 * want it, so this is only the outer bound for tables and grids. They converged before the shell
 * moved, and making it a prop now would hand that settled accident back out as a policy.
 *
 * A page that wants a narrower measure narrows its own content. An instance that genuinely needs a
 * different outer bound is asking for a different shell.
 *
 * Written out in full, never assembled: Tailwind finds utilities by scanning source TEXT, so from
 * pieces (`max-w-${size}`) it finds nothing, emits no rule, and the page builds clean and renders
 * full-bleed.
 */
export const CONTAINER = 'max-w-6xl';

/**
 * What {@link SiteShell} takes.
 *
 * Declared here rather than in the component's own frontmatter so that a caller building props —
 * a page, a test, a specimen — types them against the SAME declaration the component reads them
 * from. A shape written twice is a shape nothing compares: the second copy stays valid while the
 * component's own moves, and the mismatch surfaces as a prop the page passes and the shell has
 * stopped consuming.
 */
export interface SiteShellProps {
  /** The page title, before the site name is appended. */
  title: string;
  /** Overrides the identity's description for this page. */
  description?: string;
  /** `import.meta.env.BASE_URL` from the consumer — the kit never reads the environment. */
  base: string;
  /** `Astro.url.pathname` from the consumer, for the active-section rule. */
  pathname: string;
  identity: SiteIdentity;
  /**
   * Whether this page's main content goes in the search index. Defaults to yes.
   *
   * Defaulted rather than required, and defaulted TRUE, because Pagefind's rule is all-or-nothing
   * and runs backwards: the moment one page marks itself, every unmarked page leaves the index. A
   * shell that made this opt-in would put each new route one forgotten prop away from being
   * unfindable, with no warning and no visible symptom. See {@link searchIndexGaps}.
   *
   * Marking `<main>` rather than letting Pagefind fall back to `<body>` also keeps the header, nav
   * and footer out of every result's excerpt.
   */
  searchable?: boolean;
}

/** Controlled vocabulary shown on a reader page; links appear only when the instance has a route. */
export interface TagChipsProps {
  tags: string[];
  /** Fully based route prefix, e.g. `/my-foundry/tags`. */
  tagBase?: string;
}

/** The invariant frame around a typed note; domain-specific furniture enters through slots. */
export interface ContentNoteProps {
  title: string;
  summary?: string;
  tags?: string[];
  tagBase?: string;
  back?: { href: string; label: string };
  /** Bodies that already open with their own H1 leave this false. */
  showHeading?: boolean;
  /** The instance owns prose typography; the reader owns the article boundary. */
  articleClass?: string;
}

/**
 * What the header takes: the identity's navigation half, plus where the reader is.
 *
 * Not `SiteIdentity` itself. The header renders four of its seven fields, and a component that
 * accepts the whole record can read a field the shell never meant it to own — which is how a
 * footer link ends up in a nav.
 */
export interface SiteHeaderProps {
  base: string;
  pathname: string;
  /** The wordmark. */
  name: string;
  navLinks: ShellLink[];
  /** See {@link SiteIdentity.navVisible} — a count set by what FITS. */
  navVisible: number;
}

/** What the footer takes: the identity's footer half. See {@link SiteHeaderProps} on the split. */
export interface SiteFooterProps {
  base: string;
  fullName: string;
  repoUrl: string;
  footerLinks: ShellLink[];
}

/**
 * What the reference card takes.
 *
 * `contract` is the instance's BUILT contract — the shipped vocabularies plus its own `kinds` —
 * so the card never reaches for a registry of its own.
 */
export interface ReferenceContractProps {
  references: Reference[];
  contract: ReferenceContract;
  /** How a `ref` becomes a link here. See {@link ResolvedReference}. */
  resolveRef?: (ref: string) => ResolvedReference | null;
}

/** What the licence badge takes: the id a note declares, and the table to resolve it against. */
export interface LicenseBadgeProps {
  /** The note's `license` frontmatter: an SPDX id, or a `LicenseRef-` custom ref. */
  license: string;
  /**
   * The instance's loaded table. Passed rather than bundled, because an instance validates its
   * corpus against one specific version of the policy and a component reaching for its own copy
   * could disagree with the schema that admitted the note.
   */
  policy: LicensePolicy;
}

/** What the licence-file body takes. See {@link licensesUnderFile} for what it derives. */
export interface LicenseFileBodyProps {
  licenseFile: LicenseFile;
  /** The instance's loaded table — see {@link LicenseBadgeProps.policy} for why this is a prop. */
  policy: LicensePolicy;
  /**
   * The notes redistributing under this copy, already resolved to hrefs.
   *
   * Passed in rather than discovered, because finding them is the one genuinely per-instance step:
   * one site walks a single note collection and links `/{id}/`, the other walks three and links
   * `/{collection}/{id}/`. Filter with `redistributesUnder`.
   */
  uses: LicenseFileUse[];
}

/**
 * The custom properties this shell NAMES and does not define.
 *
 * The kit brings no stylesheet: every colour above is `bg-(--color-chrome)` or the like, an
 * arbitrary-value utility that compiles to `var(--color-chrome)` whether or not anything ever
 * declares it. Miss one and Tailwind still emits the rule, the browser resolves the property to
 * nothing, and that region of the shell renders with no background — a green build and a page
 * that looks like a styling opinion rather than a fault.
 *
 * A list is exported rather than stated, because an instance satisfies a prose list by reading it
 * carefully — which is the same guarantee as none. Assert against a built stylesheet with
 * {@link shellStyleGaps}.
 *
 * Every name here is a ROLE: `--color-chrome` is the dark bar behind the header, the "More" menu
 * and the footer, and says nothing about whose bar it is. A brand name in this list would be a cost
 * charged to every instance that is not that brand — it has to declare someone else's identity to
 * get a header. An instance maps its own palette on in one line, which also leaves its brand token
 * free to go on meaning the brand.
 */
export const SHELL_TOKENS = [
  '--color-chrome',
  '--color-accent',
  '--color-surface',
  '--color-text-primary',
  '--color-text-on-dark',
  '--font-sans',
] as const;

/**
 * The classes this shell WEARS and does not define, as selectors.
 *
 * Same failure as {@link SHELL_TOKENS} and a different mechanism: these are not utilities, so
 * Tailwind never had an opinion about them. The markup carries the class, no rule matches it, and
 * the skip link is invisible to exactly the readers it exists for.
 */
export const SHELL_CLASSES = ['.skip-link', '.bg-grid', '.nav-link-active'] as const;

/**
 * What the shell names that a built stylesheet does not supply. Empty is the passing state.
 *
 * Hand the CSS a build emitted — every emitted sheet concatenated, not the source. A token counts
 * as supplied only when its DECLARATION is present, which is why this looks for `--color-chrome:`
 * with the colon rather than the bare name. Without it the search matches `var(--color-chrome)`,
 * the shell's own usage, and the check passes on precisely the sites it exists to fail.
 *
 * Tailwind 4 tree-shakes theme variables it finds no reference to, so a declaration reaching the
 * output is evidence of both halves at once: the instance defined the token, AND something asked
 * for it. A token defined in `@theme` and used nowhere emits nothing and is reported here.
 *
 * Unlike the `min-h-dvh` canary in the instances' shell tests, this is not sensitive to where the
 * caller lives. Those assert on a UTILITY, which Tailwind creates by scanning source text — a test
 * naming one inside the scanned root keeps it alive by asserting on it. Nothing here is created by
 * being mentioned: declarations come from CSS, which is never scanned for candidates.
 */
export function shellStyleGaps(css: string): string[] {
  return styleGaps(css, SHELL_TOKENS, SHELL_CLASSES);
}

/**
 * What a component names that a built stylesheet does not supply. Empty is the passing state.
 *
 * The rule {@link shellStyleGaps} documents, lifted one level so a second component does not
 * arrive carrying a second copy of the colon.
 */
export function styleGaps(
  css: string,
  tokens: readonly string[],
  classes: readonly string[] = [],
): string[] {
  return [
    ...tokens.filter((token) => !css.includes(`${token}:`)),
    ...classes.filter((selector) => !css.includes(selector)),
  ];
}

/**
 * Theme roles used by ContentNote and TagChips, supplied by the instance.
 *
 * These components' styles are SCOPED, so this list is the entire surface an instance can steer
 * them through — a colour missing here is not a colour the instance can override elsewhere.
 *
 * `--color-link` and `--color-accent` are the load-bearing pair: they are what makes a tag chip
 * read as a way into the corpus rather than as one more pill of frontmatter. Resolving to nothing,
 * they leave a chip that is still legible and no longer distinguishable from the metadata beside
 * it — the failure {@link LICENSE_BADGE_TOKENS} names for the policy hues, in a second place.
 */
export const CONTENT_READER_TOKENS = [
  '--color-surface-hover',
  '--color-link',
  '--color-accent',
  '--color-chrome',
  '--color-text-secondary',
  '--color-text-muted',
] as const;

export function contentReaderStyleGaps(css: string): string[] {
  return styleGaps(css, CONTENT_READER_TOKENS);
}

/**
 * The custom properties the reference-contract component NAMES and does not define.
 *
 * Unlike the shell, that component ships its own stylesheet — so nothing here is about a rule that
 * might be missing. It is about the values inside the rules it ships: a scoped `var(--color-brand)`
 * resolves to nothing exactly as silently as an unscoped one, and the card renders with no tint, no
 * accent bar and no evidence colour while every test still passes.
 *
 * `--color-brand` is a ROLE, not a brand — whatever colour this site is. An instance reading its
 * own name here would be the cost {@link SHELL_TOKENS} exists to refuse. The `--color-evidence-*`
 * pairs are named for the shared vocabulary's two standings, which the contract declares as data
 * rather than each renderer splitting the terms by name in a selector.
 *
 * NOT here: the per-kind accent. `kinds` is the one group an instance declares for itself, so the
 * component reads `--color-kind-accent` with `--color-brand` behind it and an instance tints its
 * own kinds through `[data-kind]`. A kind nothing styles gets the brand, which is a plain answer
 * rather than a missing one — a fallback, not a gap.
 */
export const REFERENCE_TOKENS = [
  '--color-brand',
  '--color-chrome',
  '--color-accent',
  '--color-surface',
  '--color-surface-raised',
  '--color-surface-hover',
  '--color-border-subtle',
  '--color-link',
  '--color-link-hover',
  '--color-text-primary',
  '--color-text-secondary',
  '--color-text-muted',
  '--color-evidence-provisional-bg',
  '--color-evidence-provisional-text',
  '--color-evidence-grounded-bg',
  '--color-evidence-grounded-text',
  '--font-mono',
] as const;

/** What {@link REFERENCE_TOKENS} names that a built stylesheet does not supply. */
export function referenceStyleGaps(css: string): string[] {
  return styleGaps(css, REFERENCE_TOKENS);
}

/**
 * The custom properties the licence badge NAMES and does not define.
 *
 * The three `--color-license-*` entries are why this list is worth having. They arrived in both
 * instances as raw hexes — the same three, to the byte — so nothing could go wrong with them and
 * nothing could change them either. As tokens they can do both, and the failure they can now have
 * is the quiet one: a chip whose background resolves to nothing is still legible, still plausible,
 * and no longer distinguishable from the chip beside it that means the opposite thing.
 *
 * Named for the POLICY, not the palette. `--color-license-own-words` is whatever an instance uses
 * to mean "this text may not be redistributed", and a site with a caution colour already maps it
 * on in one line. A name like `--color-amber` would pin a decision that belongs to whoever reads.
 */
export const LICENSE_BADGE_TOKENS = [
  '--color-license-verbatim',
  '--color-license-own-words',
  '--color-license-copyleft',
  '--color-accent',
  '--color-text-secondary',
  '--font-mono',
] as const;

/** What {@link LICENSE_BADGE_TOKENS} names that a built stylesheet does not supply. */
export function licenseBadgeStyleGaps(css: string): string[] {
  return styleGaps(css, LICENSE_BADGE_TOKENS);
}

/**
 * Where a site puts its vendored licence copies, site-absolute and without the base.
 *
 * A constant rather than a string in four places. Both instances that grew this route spelled
 * `${base}/licenses/${id}/` inline — once in the page that BUILDS the route and once in each
 * component that links to it — so the route and its links agreed only because two repositories
 * happened to type the same thing. Nothing compared them, and a page whose path drifted from its
 * links would build clean and 404 for readers.
 */
export const LICENSE_FILE_ROUTE = '/licenses';

/**
 * The page for one vendored licence copy.
 *
 * Takes either a {@link LicenseFileId} or the `license_file` path a note declares, because the two
 * call sites hold different ones and {@link licenseFileIdFromPath} passes a bare id through
 * unchanged. Note that this addresses a COPY, not a licence: `/licenses/msmb/` is the page for
 * `msmb.LICENSE`, whose text happens to be CC-BY-NC-SA-2.0.
 */
export function licenseFileHref(base: string, licenseFile: LicenseFileId | string): string {
  return `${shellBase(base)}${LICENSE_FILE_ROUTE}/${licenseFileIdFromPath(licenseFile)}/`;
}

/** A note that redistributes text under a vendored licence copy. */
export interface LicenseFileUse {
  /** Where the note lives. Built by the instance: the two sites route notes differently. */
  href: string;
  /** What to show — usually the note's id. */
  label: string;
  /** The note's own `license`, which is what the copy's text actually governs it under. */
  licenseId?: LicenseId;
}

/**
 * The distinct licences carried under one vendored copy, each with its row.
 *
 * A copy is keyed by SOURCE, so what it governs is a question with more than one possible answer
 * and both instances computed it the same way: collect the users' `license` values, dedupe, and
 * resolve each. That this derivation is needed at all is the clearest sign that the route is
 * keyed on a {@link LicenseFileId} while its subject is a licence.
 *
 * Sorted, because a set built by walking a corpus is otherwise ordered by which note was read
 * first — which is stable until a note is added and then silently is not.
 */
export function licensesUnderFile(
  policy: LicensePolicy,
  uses: readonly LicenseFileUse[],
): { id: LicenseId; row: LicenseRow }[] {
  const ids = [...new Set(uses.map((use) => use.licenseId).filter((id): id is LicenseId => !!id))];
  return ids.sort().map((id) => ({ id, row: resolveLicenseRow(policy, id) }));
}

/**
 * The custom properties the licence-file body NAMES and does not define.
 *
 * It renders no chips of its own — the policy chips inside it are {@link LICENSE_BADGE_TOKENS}'
 * business — so this list is the surfaces and the text around them.
 */
export const LICENSE_FILE_TOKENS = [
  '--color-surface-raised',
  '--color-border-subtle',
  '--color-link',
  '--color-link-hover',
  '--color-text-primary',
  '--color-text-secondary',
  '--color-text-muted',
  '--font-mono',
] as const;

/** What {@link LICENSE_FILE_TOKENS} names that a built stylesheet does not supply. */
export function licenseFileStyleGaps(css: string): string[] {
  return styleGaps(css, LICENSE_FILE_TOKENS);
}

/**
 * A reference's target, once the instance has resolved it.
 *
 * The component takes a resolver rather than a link map, because how a `ref` becomes an href is
 * the instance's question and not the contract's: one spells wiki links, another spells paths, and
 * a kind term already records which through its `ref_shape`. A resolver returning `null` leaves
 * the ref on the page as the author wrote it.
 */
export interface ResolvedReference {
  /** Where the reference points, or `null` for a target that does not exist — a dangling link. */
  href: string | null;
  /** What to show. Usually the target's title, falling back to the raw ref. */
  label: string;
  /** Hover text, when the instance has a summary for the target. */
  summary?: string;
}

/**
 * The attribute Pagefind reads to decide what a page contributes to the index.
 *
 * Named here because the shell writes it and a consumer's test looks for it, and two spellings of
 * an attribute agree right up until one is a typo — at which point the test either finds it on no
 * page and reports the whole site missing, or finds it on every page and reports nothing at all.
 */
export const PAGEFIND_BODY_ATTR = 'data-pagefind-body';

/**
 * Built pages that will not be findable, and that nobody decided should not be.
 *
 * Pagefind's rule is all-or-nothing and runs BACKWARDS from what the attribute looks like. Mark no
 * page, and every page is indexed from its `<body>`. Mark one, and every unmarked page drops out of
 * the index entirely. So an annotation that reads as "index this page" means "index only pages like
 * this one", and adding it to a single route is strictly worse for the rest of the site than never
 * having added it.
 *
 * Measured on a real instance: one route carried the attribute and the index held 242 of 374 pages.
 * Deleting that one annotation put all 374 back. The 132 missing were every artifact page, every
 * tag page, the glossary, the dashboard, and 48 generated skill pages — the routes a reader is
 * likeliest to reach by searching rather than by following a link.
 *
 * **Nothing reports it.** The build log prints `Pagefind indexed 374 pages` in both states, because
 * it counts pages processed rather than pages indexed. No warning, no diff, no page that looks
 * wrong; the only symptom is a search answering "no results" for words plainly on the site.
 *
 * `unsearchable` is how a page opts out on purpose, and a list is what makes an absence a DECISION.
 * Without one, "this page is deliberately out of the index" and "nobody thought about this page"
 * are the same observation — which is how 132 of them accumulated unnoticed.
 *
 * Hand it every built page. Empty is the passing state.
 */
export function searchIndexGaps(
  pages: readonly { path: string; html: string }[],
  unsearchable: readonly string[] = [],
): string[] {
  const isMarked = (page: { html: string }): boolean => page.html.includes(PAGEFIND_BODY_ATTR);
  // No page marked: Pagefind falls back to indexing every `<body>`, so nothing is missing. A valid
  // state, and a healthier one than marking a single route — see above.
  if (!pages.some(isMarked)) return [];
  return pages
    .filter((page) => !isMarked(page) && !unsearchable.includes(page.path))
    .map((page) => page.path)
    .sort();
}

/** The nav, cut into what the bar shows and what "More" holds. */
export interface ResolvedNav {
  /** Destinations on the bar, in order. */
  bar: ResolvedShellLink[];
  /** Destinations under "More", in order. Empty when everything fits, which is a valid state. */
  more: ResolvedShellLink[];
  /** Whether the reader is inside a section that lives under "More". */
  moreActive: boolean;
}

/** Strip a trailing slash, so a path and a section can be compared as the same shape. */
const trimEnd = (value: string): string => value.replace(/\/$/, '');

/** The base an instance is deployed at, normalized: no trailing slash, `""` at the domain root. */
export const shellBase = (baseUrl: string): string => trimEnd(baseUrl);

/** Where a {@link ShellLink} points, once the base is applied. */
export const shellHref = (base: string, link: ShellLink): string => `${base}${link.path}`;

/**
 * Resolve the nav against where the reader is, and cut it at `navVisible`.
 *
 * A destination is active on its own page and on everything BENEATH it, and on nothing else: the
 * comparison is against whole path segments, so `/tag/` does not light up on `/tags/`. Both
 * arguments are normalized first, so a trailing slash on either side changes no answer.
 *
 * Which destinations exist and which of them fit on the bar are different questions, and only the
 * second is about the header's width — so this takes one list and a cut point rather than two
 * lists. An instance whose destinations all fit renders no "More"; that is the intended state and
 * not a stub, and `more` is empty rather than absent.
 */
export function resolveNav(
  navLinks: ShellLink[],
  navVisible: number,
  baseUrl: string,
  pathname: string,
): ResolvedNav {
  const base = shellBase(baseUrl);
  const here = trimEnd(pathname) || '/';

  const links: ResolvedShellLink[] = navLinks.map((link) => {
    const href = shellHref(base, link);
    const section = trimEnd(href);
    return { ...link, href, active: here === section || here.startsWith(`${section}/`) };
  });

  const more = links.slice(navVisible);
  return { bar: links.slice(0, navVisible), more, moreActive: more.some((link) => link.active) };
}
