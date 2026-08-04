# Adding a package

A new package is an architectural decision, not only a workspace directory. Start by proving
that the contract already exists in more than one independent Foundry.

## Admission checklist

- Two or more instances implement equivalent behavior.
- Differences have been identified and remain outside the extraction.
- The package can expose a narrow contract with explicit inputs.
- At least one real migration path is understood.
- The package has an owner and a reason to version independently.

If only one instance needs the behavior, keep it there until another instance independently
arrives at the same contract.

The narrow exception is an **experimental design extraction**: packaging an N=1 implementation to
make its contract inspectable. Such a package stays `0.x`, names its source implementation, cannot
become a dependency of admitted substrate packages, and must document what a second adopter is
expected to challenge. Do not create speculative base packages around it. See
[The shared substrate](concepts/shared-substrate.md#experimental-design-extractions).

## Package shape

Use the existing packages as the baseline:

```text
packages/<name>/
├── data/              # optional runtime assets
├── src/
│   └── index.ts
├── test/
├── package.json
├── tsconfig.json
├── tsconfig.test.json
├── README.md
├── CHANGELOG.md
└── LICENSE
```

The package should:

- use the `@galaxy-foundry` npm scope;
- publish ES modules with declarations;
- export only documented entry points;
- list every runtime artifact, including `data/` when present, in `files`;
- include focused unit tests; and
- be exercised by `scripts/smoke-packages.mjs`.

## Dependencies

Use a runtime dependency when the package owns the dependency's behavior. Use a peer
dependency when the package must operate on values created by the consumer's copy, as
`kind-manifest` does with Zod.

Do not add a dependency on another workspace package without a genuine runtime relationship.

Decide explicitly whether the package ships vocabulary. `license-policy` ships a complete
table, `reference-contract` ships only the inherited half, and `tag-registry` ships only a
format. That decision determines the package's data files, migration plan, versioning impact,
and smoke-test strategy.

## Documentation

Add the package to:

- the root README package table;
- the documentation home and package-count badge;
- the package chooser in this site;
- the getting-started package selection and install commands;
- the TypeDoc entry points;
- the API overview;
- the relevant guides; and
- the documentation link checker expectations, if applicable.

The package README remains the canonical npm landing page. `pnpm docs:check` derives the workspace
package list and verifies all required indexes, the TypeDoc configuration, and the cover count, so a
new package cannot merge with one of those surfaces missing.

## Release setup

Add a Changeset for the first version and extend the smoke script before publishing. A new npm
package requires a one-time stub publish and trusted-publisher configuration.

Follow [Publication](development/publication.md) exactly; the repository does not use an npm
token.
