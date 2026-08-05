// Public surface for @galaxy-foundry/cast — the deterministic half of casting.
//
// What is here is what does not vary by domain: how a bundle's placement is declared, how a
// rendered artifact is compared against the one on disk, what a provenance record holds, and —
// since `castMold` — the assembly that turns a loaded Mold into a published bundle.
//
// What each Foundry keeps is everything that names its own world: its kinds, its slug map, its
// validators, its renderers. Those reach the caster through `CastHooks` and a `CastRequest`
// rather than through anything this package goes looking for, because they are what a Foundry IS.
//
// Nothing here prints. A cast reports what it found as VALUES, so how a caller renders four
// unresolved refs — a CLI's stderr, a test's assertion, an editor's squiggles — stays the
// caller's decision.

export {
  CAST_BLOCK_KEY,
  CAST_RESOLVE_VALUES,
  loadCastContract,
  loadCastReferenceContract,
  type CastContract,
  type CastDeclaration,
  type CastResolve,
  type LoadCastReferenceContractOptions,
} from './cast-contract.js';

export {
  driftOf,
  recordedHash,
  reconcile,
  reconcileAbsent,
  reconcileText,
  sha256File,
  sha256Text,
  type Absence,
  type Drift,
  type ReconcileOptions,
} from './reconcile.js';

export {
  CASTS_DIR,
  DEFAULT_BUNDLE_PATH,
  bundleDir,
  bundlePathOf,
  bundlePathTemplate,
  castsTargetDir,
  resolveBundlePath,
} from './target-layout.js';

export {
  copyVerbatim,
  gitHead,
  listFilesUnder,
  pruneEmptyDirs,
  reconcileTreeTo,
} from './bundle.js';

export { applyLicensePolicy } from './license.js';

export {
  PROVENANCE_SCHEMA_VERSION,
  provenanceRecord,
  readProvenanceCarryOver,
  type CastHistoryEntry,
  type Provenance,
  type ProvenanceCarryOver,
  type ProvenanceHead,
  type ProvenanceRefEntry,
  type ProvenanceTail,
  type ValidationResult,
} from './provenance.js';

export {
  castMold,
  type CastDrift,
  type CastOutcome,
  type CastRequest,
  type CastSubject,
} from './caster/cast-mold.js';

export {
  type BundleCheck,
  type BundleCheckContext,
  type BundleFile,
  type BundleFileContributor,
  type CastContext,
  type CastHooks,
  type PayloadCompanion,
  type RefRenderInput,
  type RefRenderer,
  type RefRenderers,
  type SkillContext,
  type SkillSection,
  type SkillSectionContributor,
  type SlugAliases,
} from './caster/hooks.js';

export {
  castOneRef,
  expandCompanions,
  resolveMoldRef,
  type RefResolution,
  type ResolvedRef,
} from './caster/refs.js';

// The skill document's own renderers. Exported below the level `castMold` uses them at, so an
// instance contributing a section can render a reference table the same way the caster does
// rather than approximating one.
export {
  bulletSection,
  refRows,
  renderSkillMarkdown,
  runtimeProcedureBody,
  scalar,
  sentence,
  skillSummary,
  stripWikiLinks,
  triggerSentence,
} from './caster/skill.js';

export {
  loadTargetConfig,
  type TargetConfig,
  type TargetKindConfig,
} from './caster/target-config.js';

export { normalizeDates, readMarkdown, type Frontmatter, type ParsedFile } from './frontmatter.js';
