import { bundledPolicy } from '@galaxy-foundry/license-policy';
import { contractKeys, INHERITED_GROUPS } from '@galaxy-foundry/reference-contract';
import { shellBase } from '@galaxy-foundry/site-kit';
import type { SiteIdentity } from '@galaxy-foundry/site-kit';
import {
  sharesPage,
  SPECIMEN_CONTRACT,
  specimenPath,
  SPECIMENS,
  type Specimen,
  type SpecimenGroup,
} from '@galaxy-foundry/site-kit/specimens';

/**
 * The two stylesheets the same specimens are rendered under.
 *
 * Not a light/dark pair and not a preference — the shell has its own theme toggle for that. These
 * are two different ANSWERS to "what does an instance have to supply": the documented minimum, and
 * an instance with opinions. Holding both makes the boundary visible, which no single gallery can
 * do: on one page alone, a colour is just a colour, and there is no way to tell whether it came
 * from the package or from whoever themed it.
 */
export const THEMES = ['minimum', 'designed'] as const;

export type ThemeId = (typeof THEMES)[number];

export interface Theme {
  id: ThemeId;
  label: string;
  /** What a reader is looking at, said before they scroll. */
  blurb: string;
}

export const THEME: Record<ThemeId, Theme> = {
  minimum: {
    id: 'minimum',
    label: 'Minimum',
    blurb:
      'Exactly the names the kit documents — the five token lists and the three classes, with plain values and nothing else. What renders here is what an instance gets for satisfying the contract and no more, which makes an unstyled element evidence that the documented list is short.',
  },
  designed: {
    id: 'designed',
    label: 'Designed',
    blurb:
      'The same specimens under a stylesheet with opinions: a dark palette, per-kind accents, type and shadow. Everything that differs from the minimum gallery is a decision the package did not make.',
  },
};

/** The base with no trailing slash, the shape the kit's own href helper wants. */
export const base = shellBase(import.meta.env.BASE_URL);

/** Where a specimen with a page of its own lives, under one theme. */
export const specimenHref = (theme: ThemeId, group: SpecimenGroup, specimen: Specimen): string =>
  `${base}/${theme}/${specimenPath(group, specimen)}/`;

/** The anchor an inline group's section carries on the index. */
export const groupAnchor = (group: SpecimenGroup): string => group.id;

/**
 * What the specimens are read against, said out loud on the page.
 *
 * A card is rendered against a contract and a badge against a policy table, and neither is visible
 * in the output — a chip reading `verbatim OK` looks the same whether the table said so or a
 * fallback did. The reference specimens bring a contract of their own (an instance's kinds are its
 * own business); the licence specimens use the table the package bundles, because what a licence
 * permits is the same everywhere.
 */
export const sources = (): { label: string; detail: string }[] => {
  const policy = bundledPolicy();
  return [
    {
      label: 'Reference contract',
      detail: `the specimens' own — ${Object.keys(SPECIMEN_CONTRACT.kinds).length} kinds, against the shipped vocabularies`,
    },
    {
      label: 'Inherited vocabularies',
      detail: INHERITED_GROUPS.map(
        (group) => `${group} (${contractKeys(SPECIMEN_CONTRACT, group).length})`,
      ).join(', '),
    },
    {
      label: 'Licence policy',
      detail: `the bundled table, version ${policy.version} — ${Object.keys(policy.licenses).length} rows`,
    },
  ];
};

/**
 * The gallery's own identity, which is also a specimen of a kind.
 *
 * These pages are built with `SiteShell`, so the chrome around every specimen is the component
 * being demonstrated. That is deliberate: a gallery whose own frame came from somewhere else would
 * be showing the shell in a page that had proven nothing about it.
 */
export const identity = (theme: ThemeId): SiteIdentity => ({
  name: 'site-kit',
  fullName: '@galaxy-foundry/site-kit',
  description: 'Every case the kit says its components handle, under two stylesheets.',
  repoUrl: 'https://github.com/jmchilton/foundry-lib',
  navLinks: THEMES.map((id) => ({ path: `/${id}/`, label: THEME[id].label })),
  // Both fit. The header's own overflow specimens are where "does not fit" is shown.
  navVisible: THEMES.length,
  footerLinks: [{ path: `/${theme}/`, label: 'This gallery' }],
});

/**
 * Groups that share the index page, in reading order, and groups that need routes of their own.
 *
 * Which is which is the KIT's answer — `sharesPage` — and this file only sorts by it. A group the
 * kit adds lands in neither list, and the page that consumes these throws rather than quietly
 * dropping it.
 */
export const inlineGroups = SPECIMENS.filter(sharesPage);
export const framedGroups = SPECIMENS.filter((group) => !sharesPage(group));
