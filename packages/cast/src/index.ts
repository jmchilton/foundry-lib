// Public surface for @galaxy-foundry/cast — the deterministic half of casting.
//
// What is here is what does not vary by domain: how a bundle's placement is declared, how a
// rendered artifact is compared against the one on disk, and what a provenance record holds.
// What each Foundry keeps is everything that names its own world — its kinds, its slug map, its
// validators, its renderers — because those are what a Foundry IS.

export {
  driftOf,
  recordedHash,
  reconcile,
  reconcileText,
  sha256File,
  sha256Text,
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

export { copyVerbatim, gitHead, pruneEmptyDirs } from './bundle.js';

export { applyLicensePolicy } from './license.js';

export {
  PROVENANCE_SCHEMA_VERSION,
  readProvenanceCarryOver,
  type CastHistoryEntry,
  type Provenance,
  type ProvenanceArtifactInput,
  type ProvenanceArtifactOutput,
  type ProvenanceArtifacts,
  type ProvenanceCarryOver,
  type ProvenanceRefEntry,
  type ValidationResult,
} from './provenance.js';
