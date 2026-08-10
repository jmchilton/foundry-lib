# foundry-lib

<p class="doc-lede">
The shared TypeScript substrate for Foundry-pattern instances: small contracts that have
earned a common home through use in more than one independent Foundry, plus explicitly marked
experimental design extractions that are still earning that status.
</p>

`foundry-lib` packages the pieces that genuinely transfer between Foundry instances without
making either instance depend on the other. Two packages state their N=1 status explicitly:
`audit-citations` is an experimental design extraction, while `cast` was extracted early so an
existing byte-stable bundle corpus can test the boundary before a second caster adopts it.

<div class="doc-index">
  <div>
    <strong>@galaxy-foundry/audit-citations</strong>
    <p>Extract and resolve scholarly citations, replay normalized evidence, and review exact-span findings.</p>
  </div>
  <div>
    <strong>@galaxy-foundry/cast</strong>
    <p>Place bundles, reconcile drift, apply license policy, and record reproducible provenance.</p>
  </div>
  <div>
    <strong>@galaxy-foundry/kind-manifest</strong>
    <p>Derive, publish, validate, and compare the kinds an instance exposes.</p>
  </div>
  <div>
    <strong>@galaxy-foundry/kind-schema</strong>
    <p>Define and assemble kind schemas while keeping each instance's kinds local.</p>
  </div>
  <div>
    <strong>@galaxy-foundry/license-policy</strong>
    <p>Resolve a declared license into its redistribution posture and obligations.</p>
  </div>
  <div>
    <strong>@galaxy-foundry/content-reader</strong>
    <p>Bind local collections and routes into one reusable content pipeline.</p>
  </div>
  <div>
    <strong>@galaxy-foundry/reference-contract</strong>
    <p>Compose shared casting vocabularies with the reference kinds an instance owns.</p>
  </div>
  <div>
    <strong>@galaxy-foundry/site-kit</strong>
    <p>Render the reading shell from a site's identity, instead of copying a header.</p>
  </div>
  <div>
    <strong>@galaxy-foundry/tag-registry</strong>
    <p>Validate an instance's tag catalog and drive schemas and browse pages from it.</p>
  </div>
  <div>
    <strong>@galaxy-foundry/wiki-links</strong>
    <p>Resolve <code>[[Target]]</code> the same way in the renderer and the validator.</p>
  </div>
</div>

## Choose your path

- **Integrating a package?** Start with [Getting started](getting-started.md) and
  [Choose a package](packages/README.md), then follow the guide for
  [license policy](guides/adopting-license-policy.md),
  [kind manifests](guides/producing-kind-manifests.md),
  [reference contracts](guides/composing-reference-contracts.md),
  [tag registries](guides/adopting-tag-registry.md),
  [wiki links](guides/adopting-wiki-links.md), or the
  [citation-audit architecture](architecture/audit-citations.md).
- **Deciding whether code belongs here?** Read
  [The shared substrate](concepts/shared-substrate.md) and
  [Package boundaries](architecture/package-boundaries.md).
- **Understanding a package boundary?** Read the architecture notes for
  [citation audits](architecture/audit-citations.md),
  [deterministic casting](architecture/cast.md),
  [site-kit runtime behavior](architecture/site-kit-runtime.md), or
  [manifest provenance](architecture/manifest-provenance.md).
- **Contributing or releasing?** See [Contributing](development/contributing.md),
  [Testing and smoke checks](development/testing-and-smoke.md), and
  [Publication](development/publication.md).
- **Looking up an export?** Open the [API overview](api/README.md) or the generated
  [TypeDoc reference](api/typedoc/index.html ':ignore').

## Where this fits

[The Foundry Pattern](https://galaxyproject.github.io/foundry-pattern/) defines an inspectable
knowledge base of Molds that can be deterministically cast into frozen, provenance-bearing
artifacts. Each Foundry instance owns its corpus, registries, kind definitions, validation policy,
site identity, styles, and renderers. This repository normally owns only the contracts that two or
more instances have independently converged on.

That boundary is deliberate. Similar-looking code is not automatically shared code. A
contract moves here only when the instances already agree in behavior and the extraction
removes duplicated maintenance without erasing a real local decision.

> The governing test is evidence, not aspiration: two instances must already be maintaining
> the same contract before `foundry-lib` becomes its home.

An experimental package is not represented as having passed that test. It remains `0.x`, names its
first implementation, and exists to expose a design to falsification. Read the
[citation-audit architecture](architecture/audit-citations.md) for that model, and the
[deterministic casting architecture](architecture/cast.md) for `cast`'s separately justified early
extraction.

## Packages

| Package                                                                                                  | Use it when you need to…                                            |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| [`@galaxy-foundry/audit-citations`](https://www.npmjs.com/package/@galaxy-foundry/audit-citations)       | verify scholarly citation identity with replayable evidence         |
| [`@galaxy-foundry/cast`](https://www.npmjs.com/package/@galaxy-foundry/cast)                             | place and reconcile reproducible cast bundles                       |
| [`@galaxy-foundry/kind-manifest`](https://www.npmjs.com/package/@galaxy-foundry/kind-manifest)           | publish or consume a validated description of an instance's kinds   |
| [`@galaxy-foundry/kind-schema`](https://www.npmjs.com/package/@galaxy-foundry/kind-schema)               | assemble kind schemas and route collections without sharing kinds   |
| [`@galaxy-foundry/license-policy`](https://www.npmjs.com/package/@galaxy-foundry/license-policy)         | interpret a note's license as an allowed redistribution posture     |
| [`@galaxy-foundry/content-reader`](https://www.npmjs.com/package/@galaxy-foundry/content-reader)         | bind collection files into shared reader and cast projections       |
| [`@galaxy-foundry/reference-contract`](https://www.npmjs.com/package/@galaxy-foundry/reference-contract) | inherit the typed-reference vocabularies instead of copying them    |
| [`@galaxy-foundry/source-note`](https://www.npmjs.com/package/@galaxy-foundry/source-note)               | describe a summarized work without fusing citation into attribution |
| [`@galaxy-foundry/site-kit`](https://www.npmjs.com/package/@galaxy-foundry/site-kit)                     | render shared reading surfaces instead of hand-rolling them         |
| [`@galaxy-foundry/tag-registry`](https://www.npmjs.com/package/@galaxy-foundry/tag-registry)             | parse a `meta_tags.yml` and resolve tags to their declaring facet   |
| [`@galaxy-foundry/wiki-links`](https://www.npmjs.com/package/@galaxy-foundry/wiki-links)                 | resolve `[[Target]]` links in prose and frontmatter, exactly        |

Every package is an ES module, supports Node.js 20 and later, and publishes from CI with npm
provenance. `site-kit` additionally ships unbuilt `.astro` source, which its consumer's Astro build
compiles — and which its consumer's Tailwind has to be pointed at explicitly.

## Design rule

The library prefers explicit inputs over hidden state, strict parsing over casts, generated
metadata over duplicated tables, and conservative defaults over optimistic guesses. Those
choices make cross-repository contracts inspectable and make drift fail loudly.

Continue with [Getting started](getting-started.md).
