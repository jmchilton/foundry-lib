# API reference

The generated reference documents the public exports of every package directly from its
TypeScript entry point and package README.

[Open the TypeDoc reference](api/typedoc/index.html ':ignore')

## `@galaxy-foundry/license-policy`

The public surface includes:

- policy types: `LicensePolicy`, `LicenseRow`, and `RedistributionPolicy`;
- bundled data access: `bundledPolicy`, `bundledPolicyText`, and `bundledPolicyPath`;
- parsing and discovery: `parseLicensePolicy`, `loadLicensePolicy`, and
  `findLicensePolicyPath`;
- resolution helpers: `licenseIds`, `isValidLicenseId`, `resolveLicenseRow`, and
  `declaresVerbatimCarry`; and
- constants: `LICENSE_POLICY_FILE` and `LICENSE_REF_RE`.

Start with [Adopt the license policy](guides/adopting-license-policy.md) for an integration
sequence.

## `@galaxy-foundry/kind-manifest`

The public surface includes:

- builders: `buildKindManifest` and `withRevision`;
- field derivation: `describeFields` and `describeType`;
- validation: `parseKindManifest` and the exported Zod schemas;
- the format constant: `KIND_MANIFEST_VERSION`; and
- manifest, source, field, layer, and builder input types.

Start with [Produce a kind manifest](guides/producing-kind-manifests.md) or
[Consume a kind manifest](guides/consuming-kind-manifests.md).

## `@galaxy-foundry/reference-contract`

The public surface includes:

- composition: `buildReferenceContract` and the `Narrowing` option type;
- the instance's half: `loadInstanceKinds` and `findReferenceContractPath`;
- the inherited half: `bundledVocabularies`, `bundledContractText`, `bundledContractPath`,
  and `parseInheritedVocabularies`;
- reading a composed contract: `contractKeys`; and
- constants and types: `CONTRACT_GROUPS`, `INHERITED_GROUPS`, `REFERENCE_CONTRACT_FILE`,
  `ReferenceContract`, `InheritedVocabularies`, `ContractTerm`, `KindTerm`, and `RefShape`.

Start with [Compose a reference contract](guides/composing-reference-contracts.md).

## `@galaxy-foundry/tag-registry`

The public surface includes:

- loading: `loadTagRegistry`, `findTagRegistryPath`, and `parseTagRegistry`;
- accessors: `tagRegistry` and `buildTagIndex`;
- the format constant: `TAG_REGISTRY_FILE`; and
- registry, file, facet, and entry types.

Start with [Adopt the tag registry](guides/adopting-tag-registry.md).

## `@galaxy-foundry/wiki-links`

The public surface includes:

- the grammar: `slugify`, `stripBrackets`, `parseWikiLink`, `WIKI_LINK_RE`, and
  `WIKI_LINK_SCAN_RE`;
- resolution: `resolveWikiLink`, generic in the instance's target type; and
- the `./remark` subpath: the default-exported transform plus `MdNode`,
  `WikiLinkDestination`, and `RemarkWikiLinksOptions`.

Start with [Adopt wiki links](guides/adopting-wiki-links.md).

## `@galaxy-foundry/cast`

The public surface includes:

- placement: `bundleDir`, `bundlePathTemplate`, `resolveBundlePath`, `bundlePathOf`,
  `castsTargetDir`, `DEFAULT_BUNDLE_PATH`, and `CASTS_DIR`;
- reconciliation: `reconcile`, `reconcileText`, `driftOf`, `recordedHash`, and the `Drift`
  type;
- hashing: `sha256Text` and `sha256File`;
- bundle hygiene: `copyVerbatim`, `pruneEmptyDirs`, and `gitHead`; and
- the provenance record: `PROVENANCE_SCHEMA_VERSION`, `readProvenanceCarryOver`, and the
  `Provenance`, `ProvenanceRefEntry`, `ProvenanceArtifacts`, and `ValidationResult` types.

The package renders nothing and resolves no references. What a bundle contains is the
instance's; what a bundle _is_ — where it sits, whether it is current, what it records — is
here.

## Source and package documentation

TypeDoc links symbols back to the GitHub source and presents each package README at its
package entry point. Those READMEs remain the canonical npm-facing usage reference; the
hand-written site explains workflows that cross multiple exports or repositories.

Generated files are not committed. Run `pnpm docs:api` locally or use the version generated
from `main` on GitHub Pages.
