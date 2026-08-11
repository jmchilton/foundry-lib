# @galaxy-foundry/source-note

The frontmatter contract for a note that summarizes an external work — its bibliographic identity,
the licence it was read under, and how much of it was actually read.

```sh
npm install @galaxy-foundry/source-note zod@^4
```

## Why it exists

Two instances wrote this field set independently:

- [`jmchilton/statistical-genomics-foundry`](https://github.com/jmchilton/statistical-genomics-foundry) —
  `sourceNoteFields` in `site/src/types/context.ts`, shared by its `paper`, `tutorial`, and `book` kinds;
- [`jmchilton/bio-topo-foundry`](https://github.com/jmchilton/bio-topo-foundry) — the same fields
  inline in its `paper` kind.

Four copies of the licence-coherence rule existed between them. Nothing here is a generalization
invented for a hypothetical caller.

The divergence had already cost something upstream. `declaresVerbatimCarry` in
`@galaxy-foundry/license-policy` was a regular expression over free text, because one instance
spelled a posture `license-aware-summary`, the other `license-aware-with-quotes`, and the docs a
third way. A closed vocabulary makes the disagreement unspellable, which is what the pattern was
standing in for.

## Four questions, four fields

The instances fused these, and the fusion is why the checkable parts could not be checked:

| Field         | Answers                                            | Verifiable against        | Required      |
| ------------- | -------------------------------------------------- | ------------------------- | ------------- |
| `citation`    | which work is this                                 | a metadata registry       | always        |
| `attribution` | what notice the licence obliges                    | the licence's own terms   | only on carry |
| `source_read` | how much of it was read                            | nothing — it is testimony | always        |
| `source_ids`  | what the work is addressable by, or that it is not | a resolver                | always        |

A single `attribution` string carrying all four means the bibliographic half can only be checked by
parsing it back out of the legal half. Separating them is what lets
[`@galaxy-foundry/audit-citations`](https://github.com/jmchilton/foundry-lib/tree/main/packages/audit-citations)
read `source_ids` by name rather than scraping prose.

`source_read` is the one field neither instance had as a field. Both had the answer — one encoded it
by inventing a compound posture, `abstract-only-own-words-summary` — and both left it unstated on
most notes. A summary built from an abstract cannot support a claim about methods or results detail,
and that is worth being able to find.

Its levels are `full-text`, `partial`, `abstract-only`, and `not-read`. The last is a real answer,
not a gap: a citation-accuracy note checks a work's record without reading the work, and a note
assembled from open surrogates may never reach a paywalled primary. Both are source notes about a
source nobody read.

## Absence is a value, not a gap

Two fields are discriminated unions rather than optional fields, because "nobody looked" and "we
looked and there is none" are different claims and only one of them should validate:

```yaml
source_ids:
  status: none
  reason: unpublished working paper, no DOI assigned

source_license:
  status: missing
```

`LicenseRef-all-rights-reserved` remains a _declared_ licence — a determination that no grant
exists. `{ status: missing }` is the absence of a determination. Both deny verbatim carry, and
collapsing them loses which one a reader is looking at.

## The ownership boundary

| Concern                                       | Package                       | Consuming repository |
| --------------------------------------------- | ----------------------------- | -------------------- |
| Source-note field names and types             | owns                          | spreads              |
| Identifier grammars (DOI, PMID, PMCID, arXiv) | owns                          | —                    |
| Summary-posture vocabulary                    | owns (via `license-policy`)   | declares per note    |
| Cross-field licence coherence                 | owns                          | invokes              |
| Licence table itself                          | delegates to `license-policy` | selects ids          |
| `title`, `summary`, `tags`                    | does not own                  | declares             |
| Which kinds are source notes                  | does not own                  | declares             |
| Whether an identifier is _resolvable_         | does not own                  | `audit-citations`    |

`title`, `summary`, and `tags` describe the note, not the source, and belong to whatever an instance
shares across all of its kinds.

## Usage

```ts
import { sourceNoteCoherence, sourceNoteFields } from '@galaxy-foundry/source-note';
import { z } from 'zod';

const paper = z
  .object({
    type: z.literal('paper'),
    title: z.string(),
    ...sourceNoteFields(),
    ...base,
  })
  .strict()
  .superRefine(sourceNoteCoherence());
```

Both default to the licence table `@galaxy-foundry/license-policy` bundles. Pass `licensePolicy`
when the instance has loaded a table of its own, so both halves of the schema read the same rows,
and `licenseId` to narrow the vocabulary or supply your own message.

## Failure posture

Nothing throws. Every rule is a zod issue on the field that has to change, so a consumer's existing
frontmatter reporting surfaces them unmodified. `sourceNoteCoherence` returns a refinement for
`superRefine`; it never inspects the filesystem or the network.

The rules, all deny-by-default:

1. `status: declared` with no identifier given.
2. A declared licence id that resolves to the policy's default row.
3. Verbatim carry under a licence that is not `verbatim-ok`.
4. Verbatim carry under an undeclared licence.
5. Verbatim carry with no `attribution`.
6. Verbatim carry with no `license_file`, where the row obliges one.

An own-words note is left alone under any licence: it redistributes the Foundry's prose, so the
source's row has nothing to say about it.

## Compatibility

The field set is consumer-compiled source, not a persisted wire document — a change is a
typecheck failure in the instance, never a corrupt file on disk. Field additions are minor;
renaming or retyping a field, or adding a coherence rule that existing frontmatter can fail, is
major and ships with a migration note.

The identifier grammars accept both arXiv schemes (`2507.19504v2` and `math.GT/0211159`) and
require bare identifiers rather than URLs. `source_url` and `oa_url` carry locations; `source_ids`
carries identity.

## License

MIT
