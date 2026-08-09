import { bundledPolicy } from '@galaxy-foundry/license-policy';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  SOURCE_READ_LEVELS,
  SUMMARY_POSTURES,
  sourceNoteCoherence,
  sourceNoteFields,
} from '../src/index.js';

const licensePolicy = bundledPolicy();
const options = { licensePolicy };

const schema = z
  .object({ ...sourceNoteFields(options) })
  .strict()
  .superRefine(sourceNoteCoherence(options));

/** A CC-BY note that carries quotes — the shape every rule below is a departure from. */
const valid = {
  source_url: 'https://academic.oup.com/nar/article/48/16/e91/5867826',
  source_ids: { status: 'declared', doi: '10.1093/nar/gkaa550', pmid: '32614390' },
  access_date: '2026-07-03',
  source_read: 'full-text',
  citation:
    'Turakhia Y, Chen HI, Marcovitz A, Bejerano G. A fully-automated method discovers loss of mouse-lethal genes. Nucleic Acids Research 48(16):e91, 2020.',
  attribution: 'Turakhia et al. 2020, used under CC BY 4.0.',
  source_license: { status: 'declared', id: 'CC-BY-4.0' },
  license_file: 'LICENSES/CC-BY-4.0.txt',
  derived: 'verbatim-quotes-summary',
} as const;

const parse = (overrides: Record<string, unknown>) => schema.safeParse({ ...valid, ...overrides });

const messages = (result: z.ZodSafeParseResult<unknown>) =>
  result.success ? [] : result.error.issues.map((issue) => issue.message).join(' | ');

describe('sourceNoteFields', () => {
  it('accepts a complete note', () => {
    expect(schema.safeParse(valid).success).toBe(true);
  });

  // Called with no arguments, the field set reaches license-policy for the bundled table rather
  // than requiring every consumer to wire one.
  it('defaults to the bundled licence table', () => {
    const defaulted = z
      .object({ ...sourceNoteFields() })
      .strict()
      .superRefine(sourceNoteCoherence());
    expect(defaulted.safeParse(valid).success).toBe(true);
    expect(
      defaulted.safeParse({ ...valid, source_license: { status: 'declared', id: 'not-an-id' } })
        .success,
    ).toBe(false);
  });

  it('accepts an own-words note with no attribution and no licence', () => {
    const result = parse({
      derived: 'own-words-summary',
      attribution: undefined,
      license_file: undefined,
      source_license: { status: 'missing' },
    });
    expect(messages(result)).toEqual([]);
  });

  describe('identifiers are identifiers, not locations', () => {
    it.each([
      ['doi', 'https://doi.org/10.1093/nar/gkaa550'],
      ['arxiv', 'https://arxiv.org/abs/2507.19504'],
      ['pmcid', '7498332'],
      ['pmid', 'PMID 32614390'],
    ])('rejects %s given as %s', (field, value) => {
      expect(parse({ source_ids: { status: 'declared', [field]: value } }).success).toBe(false);
    });

    it.each(['2507.19504', '2507.19504v2', 'math.GT/0211159'])(
      'accepts the arXiv id %s',
      (arxiv) => {
        expect(parse({ source_ids: { status: 'declared', arxiv } }).success).toBe(true);
      },
    );

    // The gelman-loken case: an unpublished PDF genuinely has no identifier, and that is a claim
    // someone made rather than a field someone forgot.
    it('accepts an explicit statement of no identifier', () => {
      expect(
        parse({
          source_ids: { status: 'none', reason: 'unpublished working paper, no DOI assigned' },
        }).success,
      ).toBe(true);
    });

    it('rejects a bare status with no reason', () => {
      expect(parse({ source_ids: { status: 'none' } }).success).toBe(false);
    });

    it('rejects declaring identifiers and then giving none', () => {
      expect(messages(parse({ source_ids: { status: 'declared' } }))).toMatch(/none given/u);
    });
  });

  describe('YAML coercion footguns', () => {
    it('rejects an unquoted access_date, which YAML makes a Date', () => {
      expect(parse({ access_date: new Date('2026-07-03') }).success).toBe(false);
    });

    it('rejects an unquoted pmid, which YAML makes a number', () => {
      expect(parse({ source_ids: { status: 'declared', pmid: 32614390 } }).success).toBe(false);
    });
  });

  it('requires a read level rather than assuming full text', () => {
    expect(parse({ source_read: undefined }).success).toBe(false);
    for (const level of SOURCE_READ_LEVELS)
      expect(parse({ source_read: level }).success).toBe(true);
  });

  it('admits only the canonical postures', () => {
    for (const posture of SUMMARY_POSTURES)
      expect(parse({ derived: posture, attribution: valid.attribution }).success).toBe(true);
    expect(parse({ derived: 'license-aware-with-quotes' }).success).toBe(false);
  });
});

describe('sourceNoteCoherence', () => {
  it('refuses verbatim carry under an own-words-only licence', () => {
    expect(
      messages(parse({ source_license: { status: 'declared', id: 'CC-BY-NC-ND-4.0' } })),
    ).toMatch(/own-words-only/u);
  });

  it('refuses verbatim carry when no licence was declared at all', () => {
    expect(
      messages(parse({ source_license: { status: 'missing' }, license_file: undefined })),
    ).toMatch(/undeclared source licence/u);
  });

  it('refuses verbatim carry without the notice the licence obliges', () => {
    expect(messages(parse({ attribution: undefined }))).toMatch(/attribution notice/u);
  });

  it('refuses verbatim carry without the vendored licence file', () => {
    expect(messages(parse({ license_file: undefined }))).toMatch(/license_file/u);
  });

  it('reports a licence id that resolves to the default row', () => {
    expect(
      messages(parse({ source_license: { status: 'declared', id: 'LicenseRef-nonsense' } })),
    ).toMatch(/default row/u);
  });

  // An own-words summary redistributes the Foundry's prose, so the source's row has nothing to say
  // about it — including when the row forbids verbatim carry.
  it('leaves an own-words note alone under any licence', () => {
    const result = parse({
      derived: 'own-words-summary',
      attribution: undefined,
      license_file: undefined,
      source_license: { status: 'declared', id: 'CC-BY-NC-ND-4.0' },
    });
    expect(messages(result)).toEqual([]);
  });
});
