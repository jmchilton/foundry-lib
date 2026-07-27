# Migrate a vendored contract

Use this sequence when two Foundry repositories carry equivalent files and the contract has
earned a shared package.

## 1. Prove equivalence

Compare the copies mechanically and explain every difference. Check:

- field names and accepted values;
- fallback and error behavior;
- serialization order and formatting;
- tests and fixtures;
- comments that claim cross-repository ownership; and
- downstream file readers.

Do not normalize a behavioral difference merely to make extraction easier.

## 2. Draw the boundary

Separate the common contract from each instance's wiring. Shared code should accept explicit
inputs for registries, schemas, file roots, or policy values that only the instance can know.

Write down what intentionally remains local. That negative boundary is part of the package
design.

## 3. Publish the narrow package

The shared package should include:

- runtime validation at trust boundaries;
- types derived from or aligned with that validator;
- unit tests for the contract itself;
- package-facing installation and usage documentation; and
- any data file that is itself the source of truth.

Avoid pulling in either instance's application framework.

## 4. Migrate one consumer at a time

For each instance:

1. Add the package dependency.
2. Replace imports or file reads.
3. Keep a conformance assertion while both copies exist.
4. Run the instance's full validation and site build.
5. Remove the vendored copy only after no direct reader remains.

A compatibility phase is preferable to deleting the source before every consumer has a
replacement.

## 5. Release and pin intentionally

Add a Changeset for the package change. After publishing, update consumers through normal
dependency review so the adopted version is visible in each lockfile.

## 6. Remove stale instructions

Search every participating repository for the old filename, copied type names, and comments
such as “edit both copies.” Update contributor documentation and regeneration scripts along
with production imports.

## Completion criteria

The migration is complete when:

- only the package owns the common contract;
- each instance still owns its distinct policy and wiring;
- tests exercise both shared behavior and local coherence;
- no script reads the retired vendored path; and
- future contract changes flow through versioned package releases.

Read [The shared substrate](concepts/shared-substrate.md) before proposing the next
extraction.
