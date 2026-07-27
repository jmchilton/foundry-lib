# Package boundaries

The architecture is organized around who can truthfully know a fact and which decisions have
already converged across instances.

## Ownership map

| Concern                           | `foundry-lib`         | Foundry instance |
| --------------------------------- | --------------------- | ---------------- |
| Redistribution-policy table       | owns                  | consumes         |
| License-to-mode resolution        | owns                  | consumes         |
| License coherence with note shape | does not own          | owns             |
| Kind-manifest wire format         | owns                  | consumes         |
| Field derivation from a Zod shape | owns                  | supplies shape   |
| Registry and schema construction  | does not own          | owns             |
| Producer repository identity      | validates and carries | declares         |
| Vendored snapshot revision        | carries               | consumer records |

## Explicit inputs over ambient context

Shared functions do not discover an instance's application container or registry. The caller
passes the resolved policy, schema shape, source identity, or revision.

That makes the package:

- testable with synthetic inputs;
- usable by differently structured instances;
- independent of a current working directory except where a file-search helper explicitly
  requests one; and
- easier to version because its boundary is visible in function signatures.

## Strict readers at trust boundaries

YAML and JSON cross repository and package boundaries as `unknown` data. Parsers validate the
entire contract and report the offending location. A type assertion is not validation.

Unknown license IDs land on a deny-by-default row. Unsupported manifest versions fail rather
than being interpreted as the current version. Both behaviors prefer a visible defect to
silent authorization.

## Derived metadata over parallel tables

The kind manifest's field table is derived from the Zod object shape that performs
validation. A hand-written metadata table would create a second encoding and eventually
drift.

Derivation does not eliminate the need for focused renderer tests. A regeneration check can
prove that an artifact matches today's generator, but it cannot prove that the generator has
always described every Zod construct correctly.

## Data packages remain code packages

`license-policy` ships the policy YAML and a parser together. The parser enforces invariants
that well-formed YAML alone cannot express, including relationships among redistribution
policy, allowed modes, copyleft, and license-file obligations.

Keeping data and validation in one versioned package makes a policy release an auditable
contract change.

## Dependency posture

Dependencies stay narrow:

- `license-policy` owns YAML parsing through `js-yaml`.
- `kind-manifest` uses a Zod peer so it reflects the caller's schema instance.
- packages do not depend on each other merely because they share a repository.

The monorepo coordinates testing and publication, not runtime coupling.
