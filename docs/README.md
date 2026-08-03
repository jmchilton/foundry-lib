# foundry-lib

<p class="doc-lede">
The shared TypeScript substrate for Foundry-pattern instances: small contracts that have
earned a common home through use in more than one independent Foundry.
</p>

`foundry-lib` packages the pieces that genuinely transfer between Foundry instances without
making either instance depend on the other. Today that means four focused contracts: two
ship shared vocabulary or policy, and two standardize a format while leaving domain content
with each instance.

<div class="doc-index">
  <div>
    <strong>@galaxy-foundry/license-policy</strong>
    <p>Resolve a declared license into the redistribution modes and obligations a Foundry permits.</p>
  </div>
  <div>
    <strong>@galaxy-foundry/kind-manifest</strong>
    <p>Derive, publish, validate, and compare the kinds an instance exposes.</p>
  </div>
  <div>
    <strong>@galaxy-foundry/reference-contract</strong>
    <p>Compose shared casting vocabularies with the reference kinds an instance owns.</p>
  </div>
  <div>
    <strong>@galaxy-foundry/tag-registry</strong>
    <p>Validate an instance's tag catalog and drive schemas and browse pages from it.</p>
  </div>
  <div>
    <strong>@galaxy-foundry/wiki-links</strong>
    <p>Resolve <code>[[Target]]</code> the same way in the renderer and the validator.</p>
  </div>
  <div>
    <strong>@galaxy-foundry/site-kit</strong>
    <p>Render the reading shell from a site's identity, instead of copying a header.</p>
  </div>
</div>

## Choose your path

- **Integrating a package?** Start with [Getting started](getting-started.md), then follow
  the guide for [license policy](guides/adopting-license-policy.md),
  [kind manifests](guides/producing-kind-manifests.md),
  [reference contracts](guides/composing-reference-contracts.md),
  [tag registries](guides/adopting-tag-registry.md), or
  [wiki links](guides/adopting-wiki-links.md).
- **Deciding whether code belongs here?** Read
  [The shared substrate](concepts/shared-substrate.md) and
  [Package boundaries](architecture/package-boundaries.md).
- **Contributing or releasing?** See [Contributing](development/contributing.md),
  [Testing and smoke checks](development/testing-and-smoke.md), and
  [Publication](development/publication.md).
- **Looking up an export?** Open the [API overview](api/README.md) or the generated
  [TypeDoc reference](api/typedoc/index.html ':ignore').

## Where this fits

[The Foundry Pattern](https://galaxyproject.github.io/foundry-pattern/) defines an inspectable
knowledge base of Molds that can be deterministically cast into frozen, provenance-bearing
artifacts. Each Foundry instance owns its corpus, registries, kind schemas, validator, and
static site. This repository owns only the contracts that two or more instances have
independently converged on.

That boundary is deliberate. Similar-looking code is not automatically shared code. A
contract moves here only when the instances already agree in behavior and the extraction
removes duplicated maintenance without erasing a real local decision.

> The governing test is evidence, not aspiration: two instances must already be maintaining
> the same contract before `foundry-lib` becomes its home.

## Packages

| Package                                                                                                  | Use it when you need to…                                          |
| -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| [`@galaxy-foundry/license-policy`](https://www.npmjs.com/package/@galaxy-foundry/license-policy)         | interpret a note's license as an allowed redistribution posture   |
| [`@galaxy-foundry/kind-manifest`](https://www.npmjs.com/package/@galaxy-foundry/kind-manifest)           | publish or consume a validated description of an instance's kinds |
| [`@galaxy-foundry/reference-contract`](https://www.npmjs.com/package/@galaxy-foundry/reference-contract) | inherit the typed-reference vocabularies instead of copying them  |
| [`@galaxy-foundry/tag-registry`](https://www.npmjs.com/package/@galaxy-foundry/tag-registry)             | parse a `meta_tags.yml` and resolve tags to their declaring facet |
| [`@galaxy-foundry/site-kit`](https://www.npmjs.com/package/@galaxy-foundry/site-kit)                     | stand up the reading shell instead of hand-rolling one            |
| [`@galaxy-foundry/wiki-links`](https://www.npmjs.com/package/@galaxy-foundry/wiki-links)                 | resolve `[[Target]]` links in prose and frontmatter, exactly      |

Every package is an ES module, supports Node.js 20 and later, and publishes from CI with npm
provenance. `site-kit` additionally ships unbuilt `.astro` source, which its consumer's Astro build
compiles — and which its consumer's Tailwind has to be pointed at explicitly.

## Design rule

The library prefers explicit inputs over hidden state, strict parsing over casts, generated
metadata over duplicated tables, and conservative defaults over optimistic guesses. Those
choices make cross-repository contracts inspectable and make drift fail loudly.

Continue with [Getting started](getting-started.md).
