---
'@galaxy-foundry/audit-citations': minor
---

Consume `@galaxy-foundry/audit-base` for the audit lifecycle, and rename the adjudication fields it
now shares.

**Breaking, in a `0.x` minor.** An adjudication file written for 0.3 needs three renames:

| Before                    | After                    |
| ------------------------- | ------------------------ |
| `candidateId`             | `claimId`                |
| `adjudicatedVerdict`      | `assertedVerdict`        |
| `resolver-false-positive` | `checker-false-positive` |

The shape is now `audit-base`'s, and `candidate` and `resolver` are this package's nouns — a shared
schema carrying them would put citation vocabulary in the base package. What stays local is the
verdict a reviewer may assert, which is supplied to `adjudicationSchema` as a parameter and is now
validated against the citation verdicts rather than merely typed as one.

`finding.candidateId` is unchanged: a finding is citation-shaped and is not shared.

One validation is stricter. `assertedVerdict` is now rejected on `confirmed-finding` and
`extractor-false-positive`, where it could never mean anything — an extractor false positive
withdraws the claim and a confirmed finding keeps the machine's verdict, so a verdict recorded
beside either was a decision nothing would read.

`digest.ts` and `files.ts` moved to `audit-base` unchanged. `sourceTextDigest`, `artifactSpanSchema`,
and `corpusIdentitySchema` are re-exported, so a consumer still reaches one package for the citation
contract.
