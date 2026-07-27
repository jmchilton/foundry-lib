# Choose a package

The packages solve adjacent but separate cross-instance problems. Install one without
bringing in the other.

|                        | `license-policy`                                | `kind-manifest`                              | `reference-contract`                        | `tag-registry`                      |
| ---------------------- | ----------------------------------------------- | -------------------------------------------- | ------------------------------------------- | ----------------------------------- |
| **Question answered**  | What may this license allow us to redistribute? | What kinds does this instance publish?       | What may a Mold's `references[]` entry say? | What may a note's `tags:` say?      |
| **Primary input**      | License ID or policy YAML                       | Resolved Zod object shapes or untrusted JSON | The instance's `kinds`                      | The instance's `meta_tags.yml`      |
| **Primary output**     | Policy row and allowed modes                    | Validated, deterministic manifest            | The composed five-vocabulary contract       | Accessors over a validated registry |
| **Ships vocabulary?**  | Yes — the whole table                           | No — format only                             | Four of the five vocabularies               | No — format only                    |
| **Runtime dependency** | `js-yaml`                                       | Peer dependency on `zod@^3.25`               | `js-yaml`                                   | `js-yaml`                           |
| **Default posture**    | Unknown license is a defect                     | Unsupported manifest version is rejected     | An unknown term is refused, never ignored   | An undeclared tag is not a tag      |

**Ships vocabulary?** is the row that matters most. A package that ships data makes two
instances agree on content; a package that ships only a format makes them agree on rules
while their content stays their own. `reference-contract` is the interesting case: it does
both, because four of its five vocabularies describe compilation machinery that does not vary
by domain, and the fifth is exactly what does.

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

## `@galaxy-foundry/reference-contract`

Choose this package for:

- inheriting `used_at`, `load`, `modes` and `evidence` instead of copying them;
- composing those with the `kinds` your instance actually authors;
- declining an inherited term your caster does not implement, via `narrow`; or
- driving your note schema's enums from the composed contract.

The package does not enforce the cross-field rules its terms describe — that an `on-demand`
reference carries a `trigger`, or that a `verbatim` mode is permitted by the reference's
license. Those live in the instance's validator.

[Follow the composition guide](guides/composing-reference-contracts.md) or inspect the
[generated API](api/typedoc/index.html ':ignore').

## `@galaxy-foundry/tag-registry`

Choose this package for:

- parsing and validating a `meta_tags.yml`;
- resolving a tag to its declaring facet and its gloss; or
- rendering browse surfaces grouped by facet.

The package ships no facets. It does not decide the schema rules around tags — that `tags` is
required, or that note-kind is never copied into one — and it cannot check the registry
against a corpus, because only an instance can see its own notes.

[Follow the adoption guide](guides/adopting-tag-registry.md) or inspect the
[generated API](api/typedoc/index.html ':ignore').

## Versioning

Every package uses Changesets and semantic versioning. A package release indicates a change to
that package's public contract; packages do not advance in lockstep.

Package READMEs remain the canonical npm-facing reference. This documentation focuses on the
cross-package concepts and end-to-end integration work.
