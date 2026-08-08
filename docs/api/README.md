# API reference

The generated reference documents the public exports of every package directly from its
TypeScript entry point and package README.

[Open the TypeDoc reference](api/typedoc/index.html ':ignore')

## `@galaxy-foundry/audit-citations`

The public surface includes:

- strict Zod schemas and parsers for scans, evidence snapshots, adjudications, and runs;
- extraction: `extractCitations` and `extractIdentifiers`;
- evidence: `collectEvidence`, `evidenceQueries`, `evidenceId`, and the `CitationResolver`
  interface;
- provider resolution: `ScholarlyResolver`;
- evaluation and reporting: `evaluateCitation`, `buildCitationAuditRun`, and
  `renderCitationAuditMarkdown`; and
- CLI configuration parsing and explicit source-document loading.

Start with [Citation audit architecture and schemas](architecture/audit-citations.md).

## `@galaxy-foundry/license-policy`

The public surface includes:

- policy types: `LicensePolicy`, `LicenseRow`, `RedistributionPolicy`, and `LicenseId`;
- bundled data access: `bundledPolicy`, `bundledPolicyText`, and `bundledPolicyPath`;
- parsing and discovery: `parseLicensePolicy`, `loadLicensePolicy`, and
  `findLicensePolicyPath`;
- resolution helpers: `licenseIds`, `isValidLicenseId`, `resolveLicenseRow`, and
  `declaresVerbatimCarry`; and
- license files: `loadLicenseFiles`, `findLicenseFileById`, `licenseFileIdFromPath`, `redistributesUnder`, and the
  `LicenseFile` and `LicenseFileId` types — a `LicenseFileId` names a vendored COPY (`msmb`) and
  is not a `LicenseId` (`CC-BY-NC-SA-2.0`); and
- constants: `LICENSE_POLICY_FILE`, `LICENSE_REF_RE`, and `LICENSE_FILE_EXTENSION`.

Start with [Adopt the license policy](guides/adopting-license-policy.md) for an integration
sequence.

## `@galaxy-foundry/kind-manifest`

The public surface includes:

- builders: `buildKindManifest` and `withRevision`;
- field derivation: `describeFields` and `describeType`;
- validation: `parseKindManifest` and the exported Zod schemas;
- the format constant: `KIND_MANIFEST_VERSION`; and
- manifest, source, field, layer, note-shape, companion, and builder input types.

Start with [Produce a kind manifest](guides/producing-kind-manifests.md) or
[Consume a kind manifest](guides/consuming-kind-manifests.md).

## `@galaxy-foundry/kind-schema`

The public surface includes:

- definition and assembly: `kindDefiner`, `assemble`, `buildKindUnion`, `KindDefinition`,
  `Assembled`, and `AssembledUnion`;
- manifest bridging: `manifestKinds` and `ManifestKindExtras`;
- companion declarations and checks: `companionsOf`, `checkCompanions`, `NOTE_FILE`, and their
  related types;
- the `./collections` subpath: `matchesCollection`, `collectionOf`, `collectionsClaiming`,
  `kindOf`, `CollectionRoute`, and `CollectionTable`; and
- the `./docs` subpath: `loadKindDocs`.

The kinds and collection table are deliberately not exports. Read the
[`kind-schema` package documentation](https://github.com/jmchilton/foundry-lib/tree/main/packages/kind-schema)
for the instance-side assembly pattern.

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

## `@galaxy-foundry/content-reader`

The public surface includes:

- the collection binding: `createContentReader` and `ContentReader`;
- file and ID enumeration: `markdownFiles`, `noteFiles`, `noteIds`, and
  `noteIdFromPath`;
- the build-time content projection: `contentIndex`, `ContentIndex`, and `ContentNoteRecord`;
- link-map and rendering methods: `wikiLinkMap`, `resolveLink`, `remarkWikiLinks`, and
  `resolveMarkdown`;
- standalone map-bound helpers: `resolveContentLink`, `remarkContentWikiLinks`, and
  `resolveContentMarkdown`;
- alias/frontmatter seams: `ContentAliases`, `Frontmatter`, and `ContentReaderOptions`; and
- route target types: `ContentNoteTarget`, `ContentTarget`, `ExtraContentTarget`, and `ContentLink`.

Start with the [Content-reader boundary](architecture/content-reader-boundary.md).

## `@galaxy-foundry/site-kit`

The public surface includes:

- shell data types: `SiteIdentity`, `ShellLink`, `ResolvedShellLink`, and `ResolvedNav`;
- navigation helpers: `resolveNav`, `shellBase`, and `shellHref`;
- the fixed reading measure: `CONTAINER`;
- the style contract: `SHELL_TOKENS`, `SHELL_CLASSES`, `shellStyleGaps`, and the per-component
  `CONTENT_READER_TOKENS`, `REFERENCE_TOKENS`, `LICENSE_BADGE_TOKENS`, `LICENSE_FILE_TOKENS` lists
  with their `contentReaderStyleGaps`, `referenceStyleGaps`, `licenseBadgeStyleGaps`,
  `licenseFileStyleGaps` checks — all `styleGaps` with a different list;
- the vendored-licence route: `LICENSE_FILE_ROUTE`, `licenseFileHref`, `licensesUnderFile`, and
  the `LicenseFileUse` type;
- the search-index check: `PAGEFIND_BODY_ATTR` and `searchIndexGaps`; and
- the shipped `./SiteShell.astro`, `./ContentNote.astro`, `./TagChips.astro`,
  `./ReferenceContract.astro`, `./LicenseBadge.astro`, and `./LicenseFileBody.astro` component
  entry points.

Astro compiles the components from shipped source. Read the
[`site-kit` package documentation](https://github.com/jmchilton/foundry-lib/tree/main/packages/site-kit)
for the required Tailwind source directive and style tokens, and
[Site-kit runtime architecture](architecture/site-kit-runtime.md) for the build/browser boundary.

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
- raw-markdown and glossary helpers: `resolveWikiLinksInMarkdown`, `addBoldTermAnchors`, and
  `slugifyTerm`; and
- the `./remark` subpath: the default-exported transform plus `MdNode`,
  `WikiLinkDestination`, and `RemarkWikiLinksOptions`.

Start with [Adopt wiki links](guides/adopting-wiki-links.md).

## `@galaxy-foundry/cast`

The public surface includes:

- placement: `bundleDir`, `bundlePathTemplate`, `resolveBundlePath`, `bundlePathOf`,
  `castsTargetDir`, `DEFAULT_BUNDLE_PATH`, and `CASTS_DIR`;
- reconciliation: `reconcile`, `reconcileText`, `reconcileAbsent`, `driftOf`, `recordedHash`,
  and the `Drift` and `Absence` types;
- hashing: `sha256Text` and `sha256File`;
- bundle hygiene: `copyVerbatim`, `listFilesUnder`, `reconcileTreeTo`, `pruneEmptyDirs`, and
  `gitHead`;
- license enforcement: `applyLicensePolicy`; and
- the provenance record: `PROVENANCE_SCHEMA_VERSION`, `readProvenanceCarryOver`,
  `provenanceRecord` — which assembles a record and fixes its key order, including the slot an
  instance's own fields occupy — and the `Provenance`, `ProvenanceRefEntry`, `ProvenanceHead`,
  `ProvenanceTail`, and `ValidationResult` types.

The package renders nothing and resolves no references. What a bundle contains is the
instance's; what a bundle _is_ — where it sits, whether it is current, what it records — is
here. Read [Deterministic casting architecture](architecture/cast.md) for the ownership and
composition flow.

## Source and package documentation

TypeDoc links symbols back to the GitHub source and presents each package README at its
package entry point. Those READMEs remain the canonical npm-facing usage reference; the
hand-written site explains workflows that cross multiple exports or repositories.

Generated files are not committed. Run `pnpm docs:api` locally or use the version generated
from `main` on GitHub Pages.
