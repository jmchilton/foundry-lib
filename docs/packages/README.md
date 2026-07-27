# Choose a package

The packages solve adjacent but separate cross-instance problems. Install one without
bringing in the other.

|                        | `license-policy`                                | `kind-manifest`                              |
| ---------------------- | ----------------------------------------------- | -------------------------------------------- |
| **Question answered**  | What may this license allow us to redistribute? | What kinds does this instance publish?       |
| **Primary input**      | License ID or policy YAML                       | Resolved Zod object shapes or untrusted JSON |
| **Primary output**     | Policy row and allowed modes                    | Validated, deterministic manifest            |
| **Runtime dependency** | `js-yaml`                                       | Peer dependency on `zod@^3.25`               |
| **Default posture**    | Unknown license is a defect                     | Unsupported manifest version is rejected     |

## `@galaxy-foundry/license-policy`

Choose this package for:

- loading the bundled redistribution-policy table;
- validating a repository-local policy file during migration;
- checking curated SPDX IDs and `LicenseRef-<slug>` values;
- resolving a license to obligations and allowed modes; or
- testing a retained local policy copy against the published source of truth.

The package does not decide whether a specific note is coherent with its declared license.
That rule belongs to the instance.

[Follow the adoption guide](guides/adopting-license-policy.md) or inspect the
[generated API](api/typedoc/index.html ':ignore').

## `@galaxy-foundry/kind-manifest`

Choose this package for:

- deriving field descriptions from Zod 3 shapes;
- building a deterministic manifest for an instance;
- validating a manifest fetched from another repository;
- rejecting versions the consumer does not understand; or
- recording the revision of a vendored snapshot.

The package does not resolve an instance's registries or construct its schemas. The instance
does that first and passes the shape in.

[Follow the producer guide](guides/producing-kind-manifests.md), read the
[consumer guide](guides/consuming-kind-manifests.md), or inspect the
[generated API](api/typedoc/index.html ':ignore').

## Versioning

Both packages use Changesets and semantic versioning. A package release indicates a change to
that package's public contract; packages do not advance in lockstep.

Package READMEs remain the canonical npm-facing reference. This documentation focuses on the
cross-package concepts and end-to-end integration work.
