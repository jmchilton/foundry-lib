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
| Reference casting vocabularies    | owns four shared ones | consumes         |
| Reference kinds                   | does not own          | declares         |
| Reference-entry coherence         | documents terms only  | validates        |
| Tag-registry format               | owns                  | consumes         |
| Tag facets and values             | does not own          | declares         |
| Corpus-to-registry drift checks   | cannot observe        | owns             |
| Registry and schema construction  | does not own          | owns             |
| Producer repository identity      | validates and carries | declares         |
| Vendored snapshot revision        | carries               | consumer records |
| Citation-audit wire formats       | owns experimentally   | consumes         |
| Citation source paths/kinds       | carries opaquely      | declares         |
| Citation-page host trust          | enforces allowlist    | declares hosts   |
| Audit release/acceptance policy   | does not own          | owns             |

## Explicit inputs over ambient context

Shared functions do not discover an instance's application container. The caller passes the
resolved policy, schema shape, reference kinds, tag-registry contents, source identity, revision,
or explicit citation source documents.

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
than being interpreted as the current version. Reference-contract loaders reject vocabulary
on the wrong side of the shared/instance boundary. Tag registries reject undocumented or
multiply declared tags. All prefer a visible defect to silent authorization or drift.

## Derived metadata over parallel tables

The kind manifest's field table is derived from the Zod object shape that performs
validation. A hand-written metadata table would create a second encoding and eventually
drift.

Derivation does not eliminate the need for focused renderer tests. A regeneration check can
prove that an artifact matches today's generator, but it cannot prove that the generator has
always described every Zod construct correctly.

## Data packages remain code packages

`license-policy` ships the policy YAML and a parser together.
`reference-contract` likewise ships the inherited YAML while accepting instance kinds as an
input. Their parsers enforce invariants that well-formed YAML alone cannot express, including
relationships among policy fields and the ownership boundary between shared and local
vocabulary.

Keeping data and validation in one versioned package makes a vocabulary or policy release an
auditable contract change. `kind-manifest` and `tag-registry` intentionally ship no domain
data; their product is the format.

## Dependency posture

Dependencies stay narrow:

- `license-policy` owns YAML parsing through `js-yaml`.
- `kind-manifest` uses a Zod peer so it reflects the caller's schema instance.
- `reference-contract` and `tag-registry` own YAML parsing through `js-yaml`.
- `audit-citations` owns Zod validation for its JSON wire documents and `fast-glob` only in its CLI
  filesystem adapter.
- packages do not depend on each other merely because they share a repository.

The monorepo coordinates testing and publication, not runtime coupling.
