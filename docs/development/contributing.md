# Contributing

Contributions should preserve the repository's narrow purpose: versioning contracts already
shared by multiple Foundry instances.

## Set up the workspace

```sh
git clone git@github.com:jmchilton/foundry-lib.git
cd foundry-lib
pnpm install
pnpm test
```

The workspace uses Node.js 20 or later, ES modules, TypeScript strict mode, pnpm, Vitest, and
Changesets.

## Before changing a contract

For a new package or major expansion, document:

1. Which independent instances already carry the behavior.
2. How their current behavior was compared.
3. What remains intentionally instance-owned.
4. Which runtime input replaces instance-specific ambient state.
5. How existing consumers will migrate.

This evidence is more important than repository-level code reuse.

## Work in the owning package

Each package owns:

- `src/` for runtime code;
- `test/` for focused behavior and invariant tests;
- `README.md` for npm-facing usage;
- `CHANGELOG.md` maintained through Changesets;
- `LICENSE`; and
- package-specific TypeScript configuration.

Avoid reaching across package directories except through declared workspace dependencies.

## Run the full gate

```sh
pnpm format
pnpm typecheck
pnpm build
pnpm test
pnpm smoke
pnpm docs:check
```

See [Testing and smoke checks](development/testing-and-smoke.md) for what each command proves.

## Add a Changeset

A pull request that changes a published package needs a Changeset:

```sh
pnpm changeset
```

Choose the smallest semantic version bump that accurately describes the public impact.
Documentation-only changes outside package source and package metadata do not require a
package release.

## Documentation

Run the site locally while editing:

```sh
pnpm docs:dev
```

Keep package-specific installation and API examples in the package README. Put conceptual,
cross-package, and end-to-end workflows in this site.

Generated TypeDoc output under `docs/api/typedoc` is ignored. Never commit it.
