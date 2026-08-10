# Choose a package

## Experimental: `@galaxy-foundry/audit-citations`

Choose `audit-citations` to extract scholarly citations from explicit text artifacts, resolve them
through normalized provider evidence, replay an audit offline, and record exact-span manual review.
The consuming repository supplies source rules, artifact kinds, trusted citation-page hosts, and
acceptance policy.

This package is an intentional N=1 design extraction and remains `0.x`. It does not define generic
audit candidates or verdicts for future tool and threshold checks. Read
[Citation audit architecture and schemas](architecture/audit-citations.md).

## Package map

The packages solve adjacent but separate problems. Install only the contracts the consumer needs;
the status column distinguishes converged substrate from the two explicitly documented N=1 cases.

| Package              | Status             | Question answered                                             | Ships                                        | Key dependency                     |
| -------------------- | ------------------ | ------------------------------------------------------------- | -------------------------------------------- | ---------------------------------- |
| `audit-citations`    | experimental N=1   | Does a scholarly citation match replayable provider evidence? | citation schemas and audit behavior          | peer `zod@^4`, plus `fast-glob`    |
| `cast`               | early-adoption N=1 | Is this cast bundle placed, licensed, and current?            | deterministic casting mechanics              | `license-policy` and `js-yaml`     |
| `kind-manifest`      | admitted           | What kinds does this instance publish?                        | manifest format, validation, and derivation  | peer `zod@^4`                      |
| `kind-schema`        | admitted           | How are local kind definitions assembled and routed?          | schema machinery, not kind definitions       | peer `zod@^4` and `kind-manifest`  |
| `license-policy`     | admitted           | What redistribution posture applies to this license?          | the complete policy table                    | `js-yaml`                          |
| `content-reader`     | admitted           | Which local notes and addresses feed readers and casters?     | collection-backed content mechanics          | `kind-schema` and `wiki-links`     |
| `reference-contract` | admitted           | What may a Mold's `references[]` entry say?                   | four of five reference vocabularies          | `js-yaml`                          |
| `source-note`        | admitted           | What does a note say about the work it summarizes?            | field set and licence-coherence rules        | peer `zod@^4`, `license-policy`    |
| `site-kit`           | admitted           | How does a Foundry render common reading surfaces?            | Astro components and navigation rules        | peers `astro` and `astro-pagefind` |
| `tag-registry`       | admitted           | What may a note's `tags:` say?                                | registry format and accessors, no vocabulary | `js-yaml`                          |
| `wiki-links`         | admitted           | Where does this `[[Target]]` point?                           | grammar and transforms, no link map          | none                               |

The distinction between data and format matters. A package that ships data makes instances agree
on content; a package that ships only a format makes them agree on rules while their content stays
their own. `reference-contract` does both: four vocabularies describe shared casting machinery,
while the instance supplies the fifth, `kinds`.

## Early adoption: `@galaxy-foundry/cast`

Choose `cast` for deterministic bundle placement, write-or-check reconciliation, pruning a bundle
tree to its declared files, license-policy enforcement, hashing, and provenance carry-over. The
instance still owns its kinds, slug map, validation, reference resolution, and renderers.

Only one Foundry casts today. The package was extracted early because that Foundry's committed
bundles provide a byte-identity oracle; adoption by a second caster is the test of the boundary.

[Read the architecture](architecture/cast.md), the
[package documentation](https://github.com/jmchilton/foundry-lib/tree/main/packages/cast), or the
[generated API](api/typedoc/index.html ':ignore').

## Admitted shared-substrate packages

## `@galaxy-foundry/license-policy`

Choose this package for:

- loading the bundled redistribution-policy table;
- validating a repository-local policy file during migration;
- checking curated SPDX IDs and `LicenseRef-<slug>` values;
- resolving a license to its redistribution posture and obligations; or
- testing a retained local policy copy against the published source of truth.

The package does not decide whether a specific note is coherent with its declared license.
That rule belongs to the instance.

[Follow the adoption guide](guides/adopting-license-policy.md) or inspect the
[generated API](api/typedoc/index.html ':ignore').

## `@galaxy-foundry/kind-manifest`

Choose this package for:

- deriving field descriptions from Zod 4 shapes;
- building a deterministic manifest for an instance;
- validating a manifest fetched from another repository;
- rejecting versions the consumer does not understand; or
- recording the revision of a vendored snapshot.

The package does not resolve an instance's registries or construct its schemas. The instance
does that first and passes the shape in.

[Follow the producer guide](guides/producing-kind-manifests.md), read the
[consumer guide](guides/consuming-kind-manifests.md), or inspect the
[generated API](api/typedoc/index.html ':ignore').

## `@galaxy-foundry/kind-schema`

Choose this package for:

- defining local kinds through a shared `KindDefinition` contract;
- assembling one strict schema or a type-preserving discriminated union;
- deriving manifest inputs from definitions, docs, examples, and collection routes;
- mapping paths to instance-owned collections; or
- declaring and checking companion files beside directory-shaped notes.

The package owns the machinery, not the kinds, field primitives, context, collection table, or
cross-field policy. Those remain with the instance.

[Read the package documentation](https://github.com/jmchilton/foundry-lib/tree/main/packages/kind-schema)
or inspect the [generated API](api/typedoc/index.html ':ignore').

## `@galaxy-foundry/content-reader`

Choose this package for:

- enumerating files selected by an instance-owned collection table;
- deriving stable note IDs;
- exposing routed note source records and their alias-aware address map for build-time consumers;
- constructing the content site's wiki-link map from its routed collections;
- registering instance-owned aliases from routed-note frontmatter;
- binding the same map into remark and raw-Markdown rendering; or
- adding explicit content targets that do not belong to a typed collection.

The instance supplies schemas, collections, content paths, routes, alias vocabulary, and any extra
targets. The package owns the single content-tree walk and frontmatter read from which routes, wiki links,
and cast inputs can be projected; it does not assemble Astro collection exports or render domain
fields.

[Read the content-reader boundary](architecture/content-reader-boundary.md), the
[package documentation](https://github.com/jmchilton/foundry-lib/tree/main/packages/content-reader), or the
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

## `@galaxy-foundry/source-note`

Choose this package for:

- describing an external work a note summarizes, without fusing its citation into its licence
  notice;
- declaring bibliographic identifiers a resolver can read by name rather than by scraping prose;
- recording how much of a source was actually read, so an abstract-only summary is findable; or
- enforcing licence coherence — that a note carrying upstream expression has a licence permitting
  it, the notice that licence obliges, and the licence file it requires.

The package does not decide which of your kinds are source notes, and does not own `title`,
`summary`, or `tags`, which describe the note rather than its source. Whether a declared identifier
actually resolves is [`audit-citations`](architecture/audit-citations.md), not this package.

Inspect the [generated API](api/typedoc/index.html ':ignore').

## `@galaxy-foundry/site-kit`

Choose this package for:

- rendering the shared Astro document shell, note frame, tags, header, and footer;
- deriving active navigation and the overflow menu from site-owned links; or
- checking the emitted stylesheet for every token and class the shell expects.

The instance supplies its identity, navigation values, styles, and corpus. Consumers must point
Tailwind at the package's shipped Astro source and define the documented style contract.

[Read the runtime architecture](architecture/site-kit-runtime.md), the
[package documentation](https://github.com/jmchilton/foundry-lib/tree/main/packages/site-kit), or
the [generated API](api/typedoc/index.html ':ignore').

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

## `@galaxy-foundry/wiki-links`

Choose this package for:

- resolving `[[Target]]` in note bodies or typed frontmatter fields;
- rewriting wiki links in a markdown pipeline; or
- checking links from a validator, using the same rule the renderer uses.

The package ships no link map. Which notes exist, and what each is addressable by, is the
instance's alone — one Foundry keys on a Mold's `name` field, another on a dashed collection
id. Two rules do transfer, and the package enforces both: resolution is exact, and a
backtick means the syntax rather than a link.

[Follow the adoption guide](guides/adopting-wiki-links.md) or inspect the
[generated API](api/typedoc/index.html ':ignore').

## Versioning

Every package uses Changesets and semantic versioning. A package release indicates a change to
that package's public contract; packages do not advance in lockstep.

Package READMEs remain the canonical npm-facing reference. This documentation focuses on the
cross-package concepts and end-to-end integration work.
