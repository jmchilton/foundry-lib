// Public surface for @galaxy-foundry/cast — the deterministic half of casting.
//
// What is here is what does not vary by domain: how a bundle's placement is declared, how a
// rendered artifact is compared against the one on disk, and what a provenance record holds.
// What each Foundry keeps is everything that names its own world — its kinds, its slug map, its
// validators, its renderers — because those are what a Foundry IS.

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
