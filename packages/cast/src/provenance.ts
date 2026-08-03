// The provenance record a cast writes beside its bundle — what was compiled, from which
// sources, at which hashes.
//
// The record is the contract between a cast and everything that later asks whether the cast is
// still true: a drift gate re-derives the bundle and compares, a verifier re-validates the
// committed record against this shape, a site reads it to show what a skill was built from.

/**
 * The schema version this package emits.
 *
 * Bumped when the shape NARROWS. Widening — a new optional field — leaves older records valid
 * and needs no bump; removing a field, or removing a value from an enum, makes a document that
 * was valid yesterday invalid today, and a version that names two incompatible contracts is
 * worse than no version at all.
 */
export const PROVENANCE_SCHEMA_VERSION = 4;

/** One resolved reference, and what casting did with it. */
export interface ProvenanceRefEntry {
  kind: string;
  mode: string;
  ref: string;
  src: string;
  dst: string;
  used_at: string;
  load: string;
  evidence?: string;
  purpose?: string;
  trigger?: string;
  verification?: string;
  src_hash: string | null;
  dst_hash: string | null;
  /**
   * Always `deterministic`. Kept as a recorded field rather than dropped: it is the claim the
   * provenance makes about how the bytes were produced, and a reader should not have to infer
   * it from the absence of anything else.
   */
  source: 'deterministic';
  companion_of?: string;
  /**
   * License lineage of redistributed third-party content. Absent for Foundry-authored refs,
   * which fall under the repository's own LICENSE and outside redistribution policy.
   */
  license?: string;
  license_file?: string;
  license_file_hash?: string;
}

export interface ProvenanceArtifactOutput {
  id: string;
  kind: string;
  default_filename: string;
  schema?: string;
  description: string;
}

export interface ProvenanceArtifactInput {
  id: string;
  description: string;
  inherited_schema?: string;
  producers?: string[];
}

export interface ProvenanceArtifacts {
  produces: ProvenanceArtifactOutput[];
  consumes: ProvenanceArtifactInput[];
}

/** The outcome of running a declared validator over a produced artifact. */
export interface ValidationResult {
  artifact_id: string;
  path: string;
  status: 'passed' | 'failed' | 'error';
  validator_bin: string;
  artifact_hash?: string;
  stdout: string;
  stderr: string;
  stdout_hash?: string;
  stderr_hash?: string;
  exit_code?: number | null;
  error?: string;
}

export interface Provenance {
  provenance_schema_version: number;
  cast_target: string;
  mold: {
    name: string;
    path: string;
    revision?: number;
    content_hash: string;
    commit: string | null;
  };
  cast_method?: string;
  cast_agent?: string;
  cast_at: string;
  cast_date?: string;
  cast_revision?: number;
  cast_history?: CastHistoryEntry[];
  refs: ProvenanceRefEntry[];
  artifacts?: ProvenanceArtifacts;
  validation_results?: ValidationResult[];
  open_questions?: string[];
}

/**
 * Fields a re-cast preserves from the record already on disk.
 *
 * None of these are derivable from the sources, so a caster that rebuilt the record from
 * scratch would silently drop them. They are the hand-recorded half — who cast it, when, under
 * what note, what was left open — and losing them is not detectable by a drift gate, because
 * the gate compares against what the caster would write.
 */
export interface CastHistoryEntry {
  rev: number;
  date: string;
  note: string;
}

export interface ProvenanceCarryOver {
  cast_method?: string;
  cast_agent?: string;
  cast_date?: string;
  cast_revision?: number;
  cast_history?: CastHistoryEntry[];
  open_questions?: string[];
  validation_results?: ValidationResult[];
}

/**
 * Read the carry-forward fields out of an existing record.
 *
 * Type-checked field by field rather than cast wholesale: the record on disk is the output of
 * an older version of this package, and a field whose shape changed should be dropped rather
 * than carried into a record that claims to satisfy the current schema. A missing file is not
 * an error — the first cast of a Mold has nothing to carry.
 */
export function readProvenanceCarryOver(raw: string | null | undefined): ProvenanceCarryOver {
  if (raw === null || raw === undefined) return {};
  const data = JSON.parse(raw) as Record<string, unknown>;
  const carry: ProvenanceCarryOver = {};
  if (typeof data.cast_method === 'string') carry.cast_method = data.cast_method;
  if (typeof data.cast_agent === 'string') carry.cast_agent = data.cast_agent;
  if (typeof data.cast_date === 'string') carry.cast_date = data.cast_date;
  if (typeof data.cast_revision === 'number') carry.cast_revision = data.cast_revision;
  if (Array.isArray(data.cast_history)) {
    carry.cast_history = data.cast_history as CastHistoryEntry[];
  }
  if (Array.isArray(data.open_questions)) carry.open_questions = data.open_questions as string[];
  if (Array.isArray(data.validation_results)) {
    carry.validation_results = data.validation_results as ValidationResult[];
  }
  return carry;
}
