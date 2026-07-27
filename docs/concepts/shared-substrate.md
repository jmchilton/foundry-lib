# The shared substrate

A Foundry is an instance of a pattern, not a deployment of one centrally owned application.
Each instance can define different kinds, frontmatter, registries, and coherence rules. The
shared substrate is the much smaller layer where independent instances have already reached
the same decision.

## The admission test

A proposed package belongs in `foundry-lib` only when all of these are true:

1. At least two independent instances already carry equivalent behavior.
2. The behavior is a contract rather than instance content or presentation.
3. Consumers benefit from one versioned source of truth.
4. Extraction does not require inventing a new common policy.
5. The package can expose explicit inputs instead of importing an instance's registries.

Byte-identical copied files are strong evidence. Similar names, parallel folder structures,
or a belief that projects _should_ converge are not.

## What is shared today

### Redistribution policy

Both existing instances need the same mapping from a license identifier to permitted casting
modes and obligations. Shipping the table with a parser makes drift a dependency update
instead of a cross-repository manual edit.

### Kind-manifest format

Both instances publish their kinds for cross-instance comparison. They share the manifest
format, validation, and Zod-shape-to-field derivation. They do not share their actual kind
schemas.

## What stays with an instance

- The base note envelope and its required metadata
- Kind schemas and registries
- License coherence rules
- Site rendering and navigation
- Corpus-specific migrations

These areas differ in behavior today. Moving them into a common package would disguise that
difference rather than remove duplication.

## How the boundary shapes the API

Library functions accept the information only the instance can know:

- `buildKindManifest` accepts already-resolved Zod shapes.
- Policy helpers accept a policy value instead of reading module state.
- The producer supplies repository identity.
- The consumer supplies the fetched revision.

This keeps the package useful to multiple instances without teaching it how any one instance
is wired.

Read [Package boundaries](architecture/package-boundaries.md) for the architectural rules
that follow from this test.
