# The shared substrate

A Foundry is an instance of
[the Foundry Pattern](https://galaxyproject.github.io/foundry-pattern/), not a deployment of
one centrally owned application. Each instance can define different kinds, frontmatter,
registries, and coherence rules. The shared substrate is the much smaller layer where
independent instances have already reached the same decision.

The Pattern's [What a Foundry Needs](https://galaxyproject.github.io/foundry-pattern/pattern/anatomy-of-an-instance/)
page owns the pattern-level substrate and extension boundary. This page owns the narrower
admission question: which converged mechanics belong in a shared, versioned package.

## The admission test

A proposed package belongs in `foundry-lib` only when all of these are true:

1. At least two independent instances already carry equivalent behavior.
2. The behavior is a contract rather than instance content or presentation.
3. Consumers benefit from one versioned source of truth.
4. Extraction does not require inventing a new common policy.
5. The package can expose explicit inputs instead of importing an instance's registries.

Byte-identical copied files are strong evidence. Similar names, parallel folder structures,
or a belief that projects _should_ converge are not.

### Experimental design extractions

An explicitly experimental `0.x` package may enter before the first condition when packaging is
itself the instrument used to understand a prospective contract. That exception must:

- name the N=1 implementation it was extracted from;
- document which decisions remain provisional;
- avoid becoming a dependency of packages that have passed the admission test;
- keep instance paths, vocabularies, and acceptance policy outside its API; and
- treat the first structurally different adopter as a falsification exercise, not a migration to a
  settled design.

`audit-citations` is the first such exception. Its citation-specific types are not evidence that
S2 tool checks or S3 threshold checks share a base schema. Any `audit-base` or `audit-schemas`
package must still pass the normal admission test after another checker exists.

## What is shared today

### Redistribution policy

Both existing instances need the same mapping from a license identifier to a redistribution
posture and its obligations. The table deliberately does not name casting modes: a licence
constrains whose expression a note carries, not how a bundle is assembled from that note.
Shipping the table with a parser makes drift a dependency update instead of a cross-repository
manual edit.

### Kind-manifest format

Both instances publish their kinds for cross-instance comparison. They share the manifest
format, validation, and Zod-shape-to-field derivation. They do not share their actual kind
schemas.

### Kind-schema machinery

Both instances define a kind as metadata plus a strict Zod builder, assemble those definitions
against local context, and route corpus paths through local collection tables. The definition and
assembly machinery is shared; the kinds, field primitives, context, and collection routes are not.

### Typed-reference contract

Every Mold reference names five controlled values. Four describe casting machinery and are
shared: `used_at`, `load`, `modes`, and `evidence`. The package ships those vocabularies.
`kinds` describes the domain's reference material, so each instance supplies it when composing
the complete contract.

This is a split contract rather than an all-or-nothing extraction. It lets instances inherit
the shared vocabulary without pretending their reference kinds are the same.

### Tag-registry format

Both instances use a `meta_tags.yml` to declare closed, documented facets for validation and
browsing. They share the format rules and access patterns, but not the vocabulary: their
facets are different domain axes, and even an identically named facet can mean something
different.

The package therefore ships a parser and accessors, not a registry. Each instance keeps its
own YAML and corpus-level drift checks.

### Wiki-link grammar

Renderers and validators share exact `[[Target]]` parsing, slugging, and resolution, plus transforms
for parsed and raw Markdown. The package ships no link map because only an instance knows which
notes exist and what names address them.

### Reading shell

The Astro document shell, header, footer, and navigation rules converged across two instances. The
package ships that markup and behavior as source. Each instance supplies its identity, navigation,
stylesheet, and corpus, and asserts that its emitted CSS satisfies the shell's style contract.

### Deterministic casting mechanics

Bundle placement, drift reconciliation, license-policy application, and provenance recording do
not name a domain. `cast` owns those mechanics while renderers, validators, kinds, and the slug map
stay local. Only one instance casts today, so this package is explicitly an early extraction whose
existing byte-stable bundle corpus provides the first oracle; a second adopter remains the boundary
test.

## What stays with an instance

- The base note envelope and its required metadata
- Kind definitions, field vocabularies, and schema context
- Reference kinds and cross-field reference coherence
- Tag facets, tag vocabulary, and corpus drift checks
- License coherence rules
- Site identity, navigation values, styles, pages, and domain renderers
- Cast renderers, target policy, reference resolution, and process-level verdicts
- Corpus-specific migrations

These areas differ in behavior today. Moving them into a common package would disguise that
difference rather than remove duplication.

## How the boundary shapes the API

Library functions accept the information only the instance can know:

- `buildKindManifest` accepts already-resolved Zod shapes.
- `assemble` accepts the instance's kind context, while collection helpers accept its routing table.
- Policy helpers accept a policy value instead of reading module state.
- `buildReferenceContract` accepts the instance's `kinds`.
- `tagRegistry` accepts an already-parsed instance registry.
- Wiki-link resolvers accept the instance's link map or resolution callback.
- `SiteShell` accepts site identity, base, and pathname; `shellStyleGaps` accepts emitted CSS.
- Cast reconciliation accepts paths and expected bytes but does not choose what to render or when to
  exit.
- `extractCitations` accepts explicit source documents and carries artifact kinds opaquely.
- The producer supplies repository identity.
- The consumer supplies the fetched revision.

This keeps the package useful to multiple instances without teaching it how any one instance
is wired.

Read [Package boundaries](architecture/package-boundaries.md) for the architectural rules
that follow from this test.
