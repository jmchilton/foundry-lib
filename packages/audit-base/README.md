# @galaxy-foundry/audit-base

The audit lifecycle shapes two independent Foundry checkers arrived at separately — a span bound to
the digest of the text it covers, a corpus identity, and a reviewed decision that retires itself
when its subject changes — with no checker's vocabulary in them.

```sh
npm install @galaxy-foundry/audit-base zod@^4
```

## Why this package exists

The shared substrate's admission test asks for two independent implementations before a common
package. This one has them, and the evidence is unusually direct:

| Shape                | Evidence                                                                             |
| -------------------- | ------------------------------------------------------------------------------------ |
| `digest.ts`          | byte-identical in both implementations before extraction                             |
| `files.ts`           | byte-identical in both implementations before extraction                             |
| `artifactSpanSchema` | the same six fields and the same two refinements, written independently              |
| corpus identity      | the same digest-plus-provenance record, differing only in what each counts           |
| adjudication         | the same three classifications, digest binding, and "one class needs a verdict" rule |

The two implementations are `@galaxy-foundry/audit-citations` (S1 of the Skill Integrity Audit) and
the Bio Topology Foundry's environment runtime-claim audit (S2). The second was written to make this
extraction decidable rather than to pre-empt it, and it kept the converged half in a directory that
named no runtime — so the extraction is a file move plus an argument, not a redesign.

## The boundary

This package owns the lifecycle. It does not own what any checker checks.

Deliberately **not** here, because the two implementations disagree and forcing agreement would lose
information:

- **Verdict vocabularies.** Citations resolve; claims hold or are contradicted. The two share
  exactly one verdict, `unavailable`. A common union would be either a lowest common denominator or
  an untagged mixture, so the vocabulary is a parameter to `adjudicationSchema` instead.
- **Evidence-state vocabularies.** Also one value in common, for the same reason.
- **Extraction.** A DOI has a grammar. "This fixture installs one Bioconda package" does not. Every
  pre-filter in a prose checker is prose-shaped and none of it generalizes.
- **Report rendering**, **evidence acquisition**, and **claim-id minting** — the last because a
  citation candidate has no kind, so the two ids carry different information and unifying them would
  be a guess rather than a convergence.

## Detection is shared; fatality is not

`adjudicationProblems` reports three problems and ranks none of them. A decision naming no live
claim, two decisions naming one claim, and a decision whose reviewed text has since changed all come
back as data.

That last one is where the two checkers actively disagree. The citation audit refuses to build a run
from a review file that no longer describes the corpus. The runtime-claim audit reports a retired
decision as expected and benign, on the grounds that stepping aside when its text changed is exactly
what digest-binding is for. Both are defensible, and neither is this package's call — so it detects,
and the consumer decides what stops a run.

That split is also what keeps the extraction inside admission condition 4: nothing here required
inventing a common policy.

## Usage

```ts
import {
  adjudicationProblems,
  adjudicationSchema,
  artifactSpanSchema,
  sourceTextDigest,
} from '@galaxy-foundry/audit-base';

const verdicts = ['exists', 'absent', 'wrong-value', 'unpinned', 'unavailable'] as const;
const reviewSchema = adjudicationSchema(verdicts);

const sourceText = 'gudhi comes from conda-forge';
const span = artifactSpanSchema.parse({
  artifactKind: 'environment-manifest',
  artifactPath: 'content/environments/example/pixi.toml',
  startLine: 4,
  endLine: 4,
  sourceText,
  sourceDigest: sourceTextDigest(sourceText),
});

for (const problem of adjudicationProblems(claims, reviews)) {
  // `retired` may be benign here and fatal there. That decision is yours.
}
```

Add the count your own denominator needs by spreading the corpus fields rather than restating them:

```ts
const corpus = z
  .object({ ...corpusIdentityFields, claimCount: z.number().int().nonnegative() })
  .strict();
```

## Failure posture

Nothing here reads a corpus, fetches, or exits a process. Schemas reject, `adjudicationProblems`
returns findings, and `writeJsonAtomic` / `writeTextAtomic` throw on an unwritable path and leave no
partial file behind. Which failures stop a run belongs to the caller.

## Compatibility

These schemas describe persisted documents: a review file written against one version is read by the
next. Field renames are therefore breaking, and a `0.x` minor bump is how this package says so. The
`artifactKind` string and the verdict vocabulary are opaque — a checker changes either without a
version of this package changing.

## Licence

MIT.
