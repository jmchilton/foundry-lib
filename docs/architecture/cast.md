# Deterministic casting architecture

`@galaxy-foundry/cast` supplies the deterministic mechanics around a cast bundle. It does not
implement a caster: the consuming Foundry still resolves a Mold, renders target-specific bytes,
and decides whether the aggregate result passes.

The package is an early N=1 extraction. Its first consumer has a committed bundle corpus that can
act as a byte-identity oracle, but an independent second caster has not yet tested every boundary.
That status is why the package owns mechanics rather than promoting its first consumer's renderer,
kind catalog, or process policy into shared abstractions.

This page is canonical for the shared mechanics. For the stack-neutral sequence that decides what
to cast, see [Plan Your Foundry](https://galaxyproject.github.io/foundry-pattern/pattern/setting-up-a-foundry/);
for the consumer-owned resolver, renderer, and target in one repository composition, see
[Build with the Astro Stack](https://galaxyproject.github.io/foundry-pattern/pattern/standing-up-a-foundry/).

## Ownership boundary

| Concern                                   | Package                     | Consuming Foundry                   |
| ----------------------------------------- | --------------------------- | ----------------------------------- |
| Target-relative bundle placement          | resolves and validates      | declares `_target.yml`              |
| Conventional `casts/<target>/` root       | offers a helper             | may adopt or replace                |
| Mold and reference resolution             | does not own                | owns                                |
| Target-specific rendering                 | does not own                | owns                                |
| File and tree reconciliation              | owns                        | supplies expected paths and bytes   |
| Write versus inert check behavior         | owns at helper level        | selects the mode                    |
| Redistribution-policy application         | owns                        | supplies resolved reference entries |
| Note/license coherence                    | does not own                | validates before casting            |
| Provenance record shape and carry-over    | owns                        | assembles and persists the record   |
| Error aggregation and process exit status | returns values; never exits | owns                                |

The library cannot truthfully choose what to render, where source notes live, which references a
Mold resolves, or whether one failed artifact should fail a release. Those decisions require the
instance's corpus and policy.

## Composition flow

There is deliberately no top-level `cast()` function. A consuming command composes the helpers
around its local resolver and renderer:

![Casting composition flow from consumer-owned renderers, target declarations, and existing provenance through placement, reconciliation, licensing, and aggregated verdicts.](assets/diagrams/cast-flow.svg)

The arrows describe information ownership, not a mandatory call order. For example, a consumer may
resolve every reference before rendering anything so it can report all unresolved inputs together.
The package requires only that the provenance written at the end describes the bytes and findings
the command actually observed.

## Placement stays target-relative

`bundlePathTemplate` reads `<targetDir>/_target.yml`; `resolveBundlePath` substitutes `{mold}` and
refuses absolute paths, `..` traversal, or a template that cannot name a bundle. A target with no
declaration gets `{mold}`, while `castsTargetDir` offers `casts/<target>/` as a convention above the
target directory.

Every placement helper above the convention accepts a target directory. A Foundry with another
repository layout can use the same bundle contract without pretending its root layout converged.

## Reconciliation is observable and check mode is inert

`driftOf` compares current and expected hashes. `reconcile` and `reconcileText` additionally write
the expected artifact only when `check` is false. A check against a bundle that has never existed
does not even create its parent directory.

Drift is returned as data rather than thrown:

- `reason` describes missing or changed content;
- `currentHash` records what was on disk, or `null` when absent; and
- `expectedHash` records what the renderer produced.

`recordedHash` selects the provenance truth. A drifted check records the stale hash it observed;
an artifact already correct or brought into line records the expected hash.

Absence is a separate result because a file that should not exist has no expected hash.
`reconcileAbsent` and `reconcileTreeTo` remove undeclared files only on the write path. Tree
reconciliation must be scoped to a subtree the caster exclusively owns: sweeping a whole bundle
could delete run output or material a person added outside the cast contract.

## Licensing follows expression, not cast mode

`applyLicensePolicy` evaluates reference entries that declare a license. The decisive input is the
entry's `derived` posture:

- an own-words note is Foundry-authored expression and is outside the upstream source's
  redistribution policy;
- a posture that retains quotes or other upstream expression remains governed by the policy row;
- an absent posture is treated as pass-through, which preserves the deny-by-default behavior for
  vendored schemas and upstream documents; and
- an unknown license resolves to the policy's conservative default.

The reference's `mode` is not consulted. A copy and a rendered sidecar are assembly choices; neither
can turn restricted source expression into Foundry-authored prose.

The helper mutates each entry only to attach `license_file_hash`, avoiding separate check and record
passes that could disagree. It reports every policy or missing-file violation as a string. Whether a
note was required to declare `license_file` in the first place remains an instance schema rule.

## Provenance has generated and hand-recorded halves

The `Provenance` TypeScript contract records the target, Mold identity, resolved references and
hashes, validation results, and optional open questions. Anything else a domain needs a cast to
remember — what a Mold produces and consumes, say — is the instance's, and `provenanceRecord`
places it between `refs` and `validation_results`. That function owns the record's key order,
because a record is compared by its bytes and `JSON.stringify` writes keys in insertion order;
leaving order to each caller's object literal makes byte-identity a coincidence. The package
exports a schema-version constant, the builder, and types; it does not currently export a strict
runtime parser for a complete provenance document.

`readProvenanceCarryOver` reads the fields that cannot be regenerated—casting method and agent,
dates and revisions, history, validation results, and open questions—from an existing JSON record.
A first cast may pass no prior record. `gitHead` likewise returns `null` outside a Git checkout so
provenance records missing source control honestly rather than making casting impossible.

`PROVENANCE_SCHEMA_VERSION` changes when the accepted record shape narrows. Adding an optional
field leaves older documents valid; removing a field or enum value requires a new version.

## Failure posture

The package throws for malformed direct inputs that make an operation impossible, such as an unsafe
bundle template or invalid JSON passed to the carry-over reader. Expected cast findings—drift,
orphaned files, policy violations, and missing declared licence files—are returned so the consumer
can present them together with its own unresolved-reference and validation failures.

That distinction is the architectural contract: helpers may refuse an invalid operation, but they
never own `process.exit` or a repository's release threshold.

Continue with the
[`cast` package README](https://github.com/jmchilton/foundry-lib/tree/main/packages/cast) for API
examples or the [generated reference](api/typedoc/index.html ':ignore') for individual exports.
