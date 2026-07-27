# Testing and smoke checks

The repository uses several gates because no single one exercises both source behavior and
the package consumers actually install.

## Command map

| Command              | What it proves                                                              |
| -------------------- | --------------------------------------------------------------------------- |
| `pnpm format`        | committed text follows the repository's Prettier rules                      |
| `pnpm lint`          | TypeScript follows ESLint's correctness and async-safety rules              |
| `pnpm lint:unused`   | files, dependencies, binaries, and exports remain connected                 |
| `pnpm typecheck`     | package source and tests satisfy strict TypeScript checks                   |
| `pnpm build`         | every workspace package emits its distributable JavaScript and declarations |
| `pnpm test`          | unit behavior and contract invariants hold                                  |
| `pnpm lint:packages` | built package exports and declarations work for consumers                   |
| `pnpm smoke`         | packed npm tarballs contain and expose everything needed at runtime         |
| `pnpm docs:check`    | packages build, TypeDoc generates, and local documentation links resolve    |

## Unit tests

Package tests should focus on observable contract behavior and invariants.

For `license-policy`, that includes strict YAML parsing, fallback behavior, policy
relationships, and resolution helpers. For `kind-manifest`, that includes representative Zod
shapes, deterministic builds, parsing failures, supported versions, and provenance handling.
For `reference-contract`, test both sides of the inherited/kinds boundary, deterministic
narrowing, and invariants on the bundled vocabulary. For `tag-registry`, test structural
validation and declaration-based membership with synthetic registries as well as real
instance files.

```sh
pnpm test

# Run one package while iterating
pnpm --filter @galaxy-foundry/kind-manifest test
```

## Type checks

Each package has a build configuration and a test-inclusive configuration. `pnpm typecheck`
uses the latter so test fixtures and public call shapes receive the same strict checking as
runtime source.

## Static analysis

`pnpm lint` uses ESLint's flat configuration and the recommended TypeScript rules. Package
source additionally enables type-aware checks for floating promises, misused promises, and
type-only imports.

`pnpm lint:unused` runs Knip's complete local report. CI uses `pnpm lint:unused:ci`, which
focuses on disconnected files, dependencies, binaries, and unresolved imports while treating
the exported library surface as intentionally public.

## Build

```sh
pnpm build
```

The recursive workspace build emits `dist/` for every package. Build artifacts are ignored
and should not be committed.

## Tarball smoke tests

```sh
pnpm smoke
```

The smoke script packs each package, extracts it into a clean temporary project, imports the
public API, and exercises a representative call.

This catches failures source-based checks cannot see, especially an incorrect `files` field
that omits a runtime asset such as `license-policy.yml` or `reference-contract.yml`.

Every publishable package needs an entry in `SMOKE`, including format-only packages that ship
no data. In that case, exercise a defining invariant through the packed API; `tag-registry`
proves that declared membership survives packaging and prefix-shaped text does not grant
membership.

## Package-contract checks

```sh
pnpm build
pnpm lint:packages
```

Publint validates each package's manifest and export map. Are the Types Wrong packs the local
package and verifies that ESM consumers resolve its JavaScript and declarations consistently.
These checks sit between a successful TypeScript build and the runtime smoke test.

## Documentation checks

```sh
pnpm docs:check
```

This builds packages, generates TypeDoc, and checks Markdown, sidebar, navbar, cover, and
generated API links. The GitHub Pages workflow runs the same command before deployment.

For visual editing, use `pnpm docs:dev` in a second terminal.

## CI layout

CI runs lint/format/unused analysis, strict typechecking, tests, package-contract checks, and
tarball smoke tests as separately named jobs. Pull requests also receive Changesets and
dependency-review jobs. Publication repeats the type, build, package-contract, test, and
tarball gates before npm receives a package.
