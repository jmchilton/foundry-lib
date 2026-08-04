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
  return [
    ...SHELL_TOKENS.filter((token) => !css.includes(`${token}:`)),
    ...SHELL_CLASSES.filter((selector) => !css.includes(selector)),
  ];
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
