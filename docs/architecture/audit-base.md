# The audit lifecycle

`@galaxy-foundry/audit-base` carries the part of an audit that is not about what is being audited:
where a claim lives, whether the text under it has changed, what the corpus was, and what a human
decided when the machine got it wrong.

It is the first package admitted on evidence from two audits rather than one, and the second of them
was written partly to produce that evidence.

## How it was admitted

`audit-citations` entered as an explicit experimental design extraction — an N=1 packaging whose
own admission note said its citation types were **not** evidence that a tool check or a threshold
check shared a base schema, and that any `audit-base` must still pass the normal test after another
checker existed.

That checker now exists: the Bio Topology Foundry's environment runtime-claim audit, which reads
what a fixture asserts about its own runtime and checks it against the manifest and lock committed
beside it. It was written independently, and it kept everything that looked shared in a directory
that named no runtime, so that the comparison could be made from files rather than intentions.

| Shape                   | Strength of evidence                                                                   |
| ----------------------- | -------------------------------------------------------------------------------------- |
| `digest.ts`, `files.ts` | byte-identical, verified by hash, neither edited to fit                                |
| `artifactSpanSchema`    | same six fields, same two refinements, same messages, written independently            |
| corpus identity         | same digest-plus-provenance record; only the count beside it differs                   |
| adjudication            | same three classifications, same digest binding, same "one class needs a verdict" rule |
| `adjudicationProblems`  | same three problems detected; the two disagree on which are fatal                      |

The admission test is explicit that byte-identical files are strong evidence and that parallel
folder structures and a belief that projects should converge are not. Two of these are the former.
The rest are re-typed rather than copied, which is weaker, and the package documents that rather
than flattening it.

## Ownership boundary

| Concern                                        | Package                     | Consuming checker                 |
| ---------------------------------------------- | --------------------------- | --------------------------------- |
| Span shape and digest binding                  | owns                        | populates                         |
| `artifactKind` vocabulary                      | carries as an opaque string | declares                          |
| Corpus identity record                         | owns                        | supplies the digest and any count |
| How the corpus digest is computed              | does not own                | decides                           |
| Claim id minting                               | does not own                | owns                              |
| Adjudication shape and its two refinements     | owns                        | writes reviews                    |
| Verdict vocabulary                             | accepts as a parameter      | declares                          |
| Evidence-state vocabulary                      | does not own                | declares                          |
| Detecting adjudications that name nothing live | owns                        | calls                             |
| Which detected problem stops a run             | does not own                | decides                           |
| Extraction, evaluation, reporting              | does not own                | owns entirely                     |

## What deliberately did not converge

Four things looked shared and are not. Each is a real difference, and shipping a common version of
any of them would have meant inventing a policy neither checker had taken.

**The verdict vocabularies.** Citations are `resolved` / `resolved-mismatched` / `unresolved` /
`unavailable`. Runtime claims are `exists` / `absent` / `wrong-value` / `unpinned` / `unavailable`.
Only `unavailable` is common, and `unpinned` has no citation analogue at all — it marks a claim that
cannot be falsified because the fixture declares less than the prose discusses, and it must never
score as a failure or the audit would punish a fixture for being modest. So `adjudicationSchema`
takes the vocabulary as a parameter and validates against it, which also means one checker's verdict
cannot be recorded against another's claim.

**The evidence-state vocabularies.** Same situation, same resolution: not shipped.

**Extraction.** A DOI has a grammar; "this fixture installs one Bioconda package" does not. Every
pre-filter in a prose checker is prose-shaped, and the runtime-claim audit's nine extractor defects
were all found by reading prose someone actually wrote. None of that generalizes, and a base package
that owned any of it would be guessing.

**Whether a retired decision is fatal.** The citation audit throws: it will not build a run from a
review file that no longer describes the corpus. The runtime-claim audit reports the retirement and
carries on, on the grounds that stepping aside when its text changed is precisely what digest
binding is for. The package therefore detects and does not rank, and each checker keeps the posture
it had. This is the clearest case in the extraction of a shared mechanism with an unshared policy.

## Failure posture

Nothing in the package reads a corpus, fetches, or exits a process:

- schemas reject through Zod, and every object is `.strict()`;
- `adjudicationProblems` returns findings and throws nothing;
- `writeJsonAtomic` and `writeTextAtomic` throw on an unwritable path and leave no partial file; and
- `stableJson` throws on a value JSON cannot represent, rather than returning quietly.

That last one is a deliberate exception to "returns findings". The function feeds identity — two
values that digest alike are treated as the same claim, the same corpus, the same review target — so
a `Map` enumerating as `{}` would hand distinct values one identity, and `JSON.stringify(undefined)`
would make a `string` return type a lie. A `Date` goes through `toJSON`, as `JSON.stringify` does.

Process exit belongs to the consumer's CLI, as it already did in both checkers.

## Compatibility

These schemas describe **persisted documents**. A review file written by one version is read by the
next, so a field rename is a breaking change and a `0.x` minor bump is how the package says so.

Two things are explicitly not covered by that rule, because the package holds them opaquely: the
`artifactKind` string and the verdict vocabulary. A checker adds an artifact kind or a verdict
without any version of this package changing.

## What a third checker should challenge

The extraction is honest about being N=2. The places a structurally different checker is most likely
to falsify:

- **Claim id minting**, which stayed local because a citation candidate has no kind and a runtime
  claim does, so the two ids carry different information. A third checker agreeing with either would
  settle it.
- **The corpus digest input** — full records in one checker, ordered ids in the other. They answer
  different questions about what counts as the same corpus.
- **`assertedVerdict` being forbidden outside `checker-false-positive`**, which is the stricter of
  the two implementations and was adopted rather than averaged.
- **Whether the classification set is three**, which both happen to have and neither argued for
  against alternatives.
