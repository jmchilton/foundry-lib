# Package boundaries

The architecture is organized around who can truthfully know a fact and which decisions have
already converged across instances.

This page is canonical for library-versus-instance ownership. The Pattern's
[What a Foundry Needs](https://galaxyproject.github.io/foundry-pattern/pattern/anatomy-of-an-instance/)
defines the larger substrate and extension surface; [Build with the Astro Stack](https://galaxyproject.github.io/foundry-pattern/pattern/standing-up-a-foundry/)
shows these package boundaries composed inside one concrete repository.

## Ownership map

| Concern                            | `foundry-lib`         | Foundry instance       |
| ---------------------------------- | --------------------- | ---------------------- |
| Redistribution-policy table        | owns                  | consumes               |
| License-to-policy resolution       | owns                  | consumes               |
| License coherence with note shape  | does not own          | owns                   |
| Kind-manifest wire format          | owns                  | consumes               |
| Field derivation from a Zod shape  | owns                  | supplies shape         |
| Kind definition/assembly machinery | owns                  | supplies kinds/context |
| Kind definitions and field values  | does not own          | owns                   |
| Reference casting vocabularies     | owns four shared ones | consumes               |
| Reference kinds                    | does not own          | declares               |
| Reference-entry coherence          | documents terms only  | validates              |
| Tag-registry format                | owns                  | consumes               |
| Tag facets and values              | does not own          | declares               |
| Corpus-to-registry drift checks    | cannot observe        | owns                   |
| Wiki-link grammar and transforms   | owns                  | consumes               |
| Wiki-link targets and addresses    | cannot observe        | owns                   |
| Reading-shell markup and nav rule  | owns                  | consumes               |
| Site identity, styles, and pages   | does not own          | owns                   |
| Cast placement/drift/provenance    | owns                  | consumes               |
| Cast renderers and target policy   | does not own          | owns                   |
| Producer repository identity       | validates and carries | declares               |
| Vendored snapshot revision         | carries               | consumer records       |
| Citation-audit wire formats        | owns experimentally   | consumes               |
| Citation source paths/kinds        | carries opaquely      | declares               |
| Citation-page host trust           | enforces allowlist    | declares hosts         |
| Audit release/acceptance policy    | does not own          | owns                   |

## Explicit inputs over ambient context

Shared functions do not discover an instance's application container. The caller passes the
resolved policy, schema shape or context, collection table, reference kinds, tag-registry contents,
wiki-link map, site identity, cast paths and bytes, source identity, revision, or explicit citation
source documents.

That makes the package:

- testable with synthetic inputs;
- usable by differently structured instances;
- independent of a current working directory except where a file-search helper explicitly
  requests one; and
- easier to version because its boundary is visible in function signatures.

## Readers at trust boundaries

YAML and JSON cross repository and package boundaries as `unknown` data. Persisted JSON contracts
such as kind manifests and citation-audit documents use strict schemas that reject unknown fields.
YAML readers validate the required structure and the invariants their package owns, and report the
offending location. A type assertion is not validation, but neither should a reader claim policy
invariants that only the bundled table's focused tests establish.

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

`license-policy` ships the policy YAML and a structural parser together. Focused tests enforce
relationships among fields in the bundled table; parsing an arbitrary table checks its rows and
closed policy enum without claiming that every cross-row policy invariant is universal.
`reference-contract` likewise ships the inherited YAML while accepting instance kinds as an
input. Its parser enforces the ownership boundary between shared and local vocabulary, which
well-formed YAML alone cannot express.

Keeping data and validation in one versioned package makes a vocabulary or policy release an
auditable contract change. `kind-manifest`, `kind-schema`, `tag-registry`, `site-kit`, and
`wiki-links` intentionally ship no domain vocabulary; their product is a format, mechanism, or
shell contract.

## Dependency posture

Dependencies stay narrow:

- `license-policy` owns YAML parsing through `js-yaml`.
- `kind-manifest` and `kind-schema` use a Zod 4 peer so they operate on the caller's schema
  instance; `kind-schema` has a real runtime dependency on `kind-manifest` for the shared manifest
  vocabulary and bridge.
- `reference-contract` and `tag-registry` own YAML parsing through `js-yaml`.
- `cast` depends on `license-policy` because applying redistribution policy is part of a concrete
  cast, and owns YAML parsing for target layout.
- `site-kit` peers on Astro and `astro-pagefind` because the consumer compiles its shipped source.
- `wiki-links` remains dependency-free, including its Markdown transforms.
- `audit-citations` exports the Zod schemas for its JSON wire documents, so it uses a Zod peer for
  the same reason `kind-manifest` does: a caller composing those schemas must get its own instance.
  Its `fast-glob` and `git` filesystem adapter sits behind the `./config` subpath, so the main entry
  point stays a pure function of the documents the caller supplies.
- packages do not depend on each other merely because they share a repository.

The monorepo coordinates testing and publication, not runtime coupling.
