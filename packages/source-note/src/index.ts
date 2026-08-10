/**
 * The frontmatter a Foundry source note carries about the work it summarizes.
 *
 * Two instances wrote this field set independently and fused different things into one string
 * along the way. The contract here keeps four questions apart, because each has a different
 * audience and a different way of being wrong:
 *
 * - `citation` — the bibliographic record. Checkable against a registry.
 * - `attribution` — the licence notice. Checkable against the licence's own terms.
 * - `source_read` — how much of the source was actually read. Testimony, but answerable.
 * - `source_ids` — the identifiers the work is addressable by, or an explicit statement of none.
 *
 * Fusing the first two means the checkable half can only be checked by parsing it back out of the
 * unverifiable half, which is where this started.
 */

import {
  SUMMARY_POSTURES,
  bundledPolicy,
  isValidLicenseId,
  postureCarriesVerbatim,
  resolveLicenseRow,
  type LicensePolicy,
  type SummaryPosture,
} from '@galaxy-foundry/license-policy';
import { z } from 'zod';

export { SUMMARY_POSTURES, type SummaryPosture };

/**
 * How much of the source the summary was made from.
 *
 * A summary built from an abstract cannot support a claim about methods or results detail, and
 * nothing else in the frontmatter says so. Instances used to record this by inventing a compound
 * posture — `abstract-only-own-words-summary` — which put the answer somewhere no schema could
 * read and left it unstated on every note whose author did not think to mention it.
 *
 * `not-read` is a real answer rather than a gap: a citation-accuracy note checks a work's record
 * without reading the work, and a note assembled from open surrogates may never reach a paywalled
 * primary. Both are source notes about a source nobody read, and folding them into `abstract-only`
 * would assert a read that never happened.
 *
 * Required, so that silence is not read as `full-text`.
 */
export const SOURCE_READ_LEVELS = ['full-text', 'partial', 'abstract-only', 'not-read'] as const;

export type SourceReadLevel = (typeof SOURCE_READ_LEVELS)[number];

/**
 * Identifier grammars, applied so that a field named for an identifier holds one.
 *
 * A URL is not an identifier: it addresses one copy of a work through one host, and the host is
 * the part that rots. `source_url` and `oa_url` carry locations; these carry identity.
 */
const DOI_RE = /^10\.\d{4,9}\/\S+$/u;
const PMID_RE = /^\d+$/u;
const PMCID_RE = /^PMC\d+$/u;
/** Both arXiv schemes: `2507.19504v2` since 2007, and `math.GT/0211159` before it. */
const ARXIV_RE = /^(?:\d{4}\.\d{4,5}|[a-z-]+(?:\.[A-Z]{2})?\/\d{7})(?:v\d+)?$/u;

/** `YYYY-MM-DD`. A bare date is a `Date` to YAML, and an unquoted one must fail rather than coerce. */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/u;

export interface SourceNoteOptions {
  /**
   * The redistribution table the note's licence id is read against.
   *
   * Defaults to the table `@galaxy-foundry/license-policy` bundles, which is the one an instance
   * without a local override is already using. Pass it explicitly when the instance has loaded a
   * table of its own, so that both halves of the schema read the same rows.
   */
  licensePolicy?: LicensePolicy;
  /**
   * Replaces the default licence-id validator, for an instance that narrows the vocabulary or
   * wants its own message. The default accepts any id the policy resolves.
   */
  licenseId?: z.ZodType<string>;
}

function policyOf(options: SourceNoteOptions | undefined): LicensePolicy {
  return options?.licensePolicy ?? bundledPolicy();
}

/**
 * The identifiers a source note declares, or an explicit statement that the work has none.
 *
 * Modelled as a union rather than four optional fields so that omission is not an answer. An
 * unpublished working paper genuinely has no DOI; a note whose author did not look also has no
 * DOI, and only one of those should validate. `reason` is what makes the difference reviewable.
 */
const sourceIds = z.discriminatedUnion('status', [
  z
    .object({
      status: z.literal('declared'),
      doi: z.string().regex(DOI_RE, 'doi must be a bare DOI beginning `10.`, not a URL').optional(),
      pmid: z
        .string()
        .regex(PMID_RE, 'pmid must be digits, quoted so YAML keeps it a string')
        .optional(),
      pmcid: z.string().regex(PMCID_RE, 'pmcid must look like `PMC7498332`').optional(),
      arxiv: z
        .string()
        .regex(ARXIV_RE, 'arxiv must be an id such as `2507.19504`, not a URL')
        .optional(),
    })
    .strict(),
  z
    .object({
      status: z.literal('none'),
      reason: z.string().min(1, 'say why the work has no identifier — it is a reviewable claim'),
    })
    .strict(),
]);

/**
 * The licence the SOURCE is under, which is a different question from whether one was found.
 *
 * `LicenseRef-all-rights-reserved` is a determination: someone looked, and no grant exists.
 * `{ status: 'missing' }` is the absence of one. Both deny verbatim carry, and collapsing them
 * loses which of the two a reader is looking at.
 */
function sourceLicense(licenseId: z.ZodType<string>) {
  return z.discriminatedUnion('status', [
    z.object({ status: z.literal('declared'), id: licenseId }).strict(),
    z.object({ status: z.literal('missing') }).strict(),
  ]);
}

/**
 * The source-note field set, as a zod raw shape to spread into a kind.
 *
 * It deliberately omits `title`, `summary`, and `tags`: those describe the note, not the source,
 * and belong to whatever an instance shares across all of its kinds.
 */
export function sourceNoteFields(options?: SourceNoteOptions) {
  const licensePolicy = policyOf(options);
  const licenseId =
    options?.licenseId ??
    z.string().refine((id: string) => isValidLicenseId(licensePolicy, id), {
      message: 'must be an SPDX id in @galaxy-foundry/license-policy or a LicenseRef-<slug>',
    });

  return {
    /** Where the work lives — the canonical publisher or repository record. */
    source_url: z.url(),
    /** A free mirror of a paywalled record: PMC, an institutional repository, a preprint server. */
    oa_url: z.url().optional(),
    source_ids: sourceIds,

    /** The edition summarized, where a source has editions: a preprint version, a package release. */
    version: z.string().optional(),
    access_date: z.string().regex(ISO_DATE_RE, 'access_date must be a quoted `YYYY-MM-DD` string'),
    source_read: z.enum(SOURCE_READ_LEVELS),

    /** The bibliographic record: who wrote it, what it is called, where it appeared, when. */
    citation: z.string().min(20),
    /**
     * The notice the licence obliges, required only when the note carries upstream expression.
     * An own-words summary redistributes the Foundry's prose and owes no notice for the source's.
     */
    attribution: z.string().min(1).optional(),

    source_license: sourceLicense(licenseId),
    /** The upstream licence copy vendored into `LICENSES/`, where carrying one is an obligation. */
    license_file: z.string().optional(),
    /**
     * The source's own licence wording, verbatim, where the posture is not obvious from the id —
     * an "Author's Choice" notice on an otherwise subscription journal. Evidence for the id above,
     * never a substitute for it.
     */
    license_statement: z.string().optional(),

    derived: z.enum(SUMMARY_POSTURES),
  };
}

export type SourceNoteFields = ReturnType<typeof sourceNoteFields>;

/** The subset of a note {@link sourceNoteCoherence} reads. */
export interface CoherentSourceNote {
  source_ids: z.infer<typeof sourceIds>;
  source_license: { status: 'declared'; id: string } | { status: 'missing' };
  license_file?: string | undefined;
  attribution?: string | undefined;
  derived: SummaryPosture;
}

/**
 * The cross-field rules the fields alone cannot state, as a refinement to call from a kind.
 *
 * Every rule is one instance or another's, and each was written at least twice before it moved
 * here. They are deny-by-default throughout: an unresolved licence, an undeclared one, and a
 * missing notice each block verbatim carry rather than being read as permission.
 */
export function sourceNoteCoherence(options?: SourceNoteOptions) {
  const licensePolicy = policyOf(options);
  return (note: CoherentSourceNote, ctx: z.RefinementCtx): void => {
    if (note.source_ids.status === 'declared') {
      const { doi, pmid, pmcid, arxiv } = note.source_ids;
      if (!doi && !pmid && !pmcid && !arxiv)
        ctx.addIssue({
          code: 'custom',
          path: ['source_ids'],
          message:
            'declared identifiers, but none given — add one, or say `status: none` with a reason',
        });
    }

    const carries = postureCarriesVerbatim(note.derived);

    if (note.source_license.status === 'missing') {
      if (carries)
        ctx.addIssue({
          code: 'custom',
          path: ['derived'],
          message: `${note.derived} carries upstream expression, which an undeclared source licence cannot permit`,
        });
      return;
    }

    const row = resolveLicenseRow(licensePolicy, note.source_license.id);
    if (row.defect)
      ctx.addIssue({
        code: 'custom',
        path: ['source_license', 'id'],
        message: `licence "${note.source_license.id}" resolves to the default row — fix the id, or add a row upstream in @galaxy-foundry/license-policy and bump it`,
      });
    if (!carries) return;

    if (row.policy !== 'verbatim-ok')
      ctx.addIssue({
        code: 'custom',
        path: ['derived'],
        message: `${note.derived} carries upstream expression but ${note.source_license.id} is own-words-only (paraphrase, or fix the licence)`,
      });
    if (row.license_file && !note.license_file)
      ctx.addIssue({
        code: 'custom',
        path: ['license_file'],
        message: `verbatim carry under ${note.source_license.id} requires a license_file vendored in LICENSES/`,
      });
    if (!note.attribution)
      ctx.addIssue({
        code: 'custom',
        path: ['attribution'],
        message: 'verbatim carry requires the attribution notice the licence obliges',
      });
  };
}
