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

/**
 * One resolved reference, and what casting did with it.
 *
 * The optional fields read `?: T | undefined` rather than `?: T`, and the record types below
 * follow the same rule. They are filled by copying frontmatter a note may not carry, so the
 * value a caster has in hand for an absent field IS `undefined` — and `JSON.stringify` drops an
 * explicitly-undefined key exactly as it drops an absent one, so the two are the same document.
 * Declared `?: T`, every such copy would have to be rewritten into a conditional assignment to
 * say something the emitted JSON cannot tell apart.
 */
export interface ProvenanceRefEntry {
  kind: string;
  mode: string;
  ref: string;
  src: string;
  dst: string;
  used_at: string;
  load: string;
  evidence?: string | undefined;
  purpose?: string | undefined;
  trigger?: string | undefined;
  verification?: string | undefined;
  src_hash: string | null;
  dst_hash: string | null;
  /**
   * Always `deterministic`. Kept as a recorded field rather than dropped: it is the claim the
   * provenance makes about how the bytes were produced, and a reader should not have to infer
   * it from the absence of anything else.
   */
  source: 'deterministic';
  companion_of?: string | undefined;
  /**
   * License lineage of the upstream work this ref draws on.
   *
   * Its presence does NOT by itself mean third-party content is being redistributed. An instance
   * whose corpus is written from published sources records the source's license on its own notes,
   * for attribution — `derived` is what says whether any of the source's expression survives into
   * the bytes. See `applyLicensePolicy`.
   */
  license?: string | undefined;
  /**
   * How this note relates to the work `license` names — the posture recorded when the note was
   * written. Absent for refs that are not authored notes (a vendored schema, an upstream doc),
   * which are pass-through by definition.
   */
  derived?: string | undefined;
  license_file?: string | undefined;
  license_file_hash?: string | undefined;
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

/**
 * The fields every instance's record carries.
 *
 * An instance records more than this — what a Mold produces and consumes, whatever else its
 * domain needs a cast to remember. Those are not declared here. A shared type that named one
 * Foundry's vocabulary would make every other Foundry's record wrong by construction, and this
 * package holds only what does not vary by domain. `provenanceRecord` is where the rest goes.
 */
export interface Provenance {
  provenance_schema_version: number;
  cast_target: string;
  mold: {
    name: string;
    path: string;
    revision?: number | undefined;
    content_hash: string;
    commit: string | null;
  };
  cast_method?: string | undefined;
  cast_agent?: string | undefined;
  cast_at: string;
  cast_date?: string | undefined;
  cast_revision?: number | undefined;
  cast_history?: CastHistoryEntry[] | undefined;
  refs: ProvenanceRefEntry[];
  validation_results?: ValidationResult[] | undefined;
  open_questions?: string[] | undefined;
}

/** Everything the record carries before `refs`. */
export type ProvenanceHead = Omit<Provenance, 'refs' | 'validation_results' | 'open_questions'>;

/** Everything it carries after the instance's own fields. */
export type ProvenanceTail = Pick<Provenance, 'validation_results' | 'open_questions'>;

/**
 * Assemble a record, with the instance's own fields in the one slot reserved for them.
 *
 * Key order is the point. A record is compared by its bytes — that is what makes a drift gate
 * possible — and `JSON.stringify` emits keys in insertion order, so where a field is written
 * decides whether a re-cast of an unchanged Mold produces an identical file. That made key
 * order a property of however a caster happened to write one object literal, which is not
 * something a second instance can read off a type. It is this function's now: head, `refs`,
 * the instance's fields, then the tail.
 *
 * Extensions land between `refs` and `validation_results` — after what was compiled, before
 * what checking it concluded. An instance that records nothing extra passes nothing and gets
 * the same bytes it would have written itself.
 */
export function provenanceRecord<Ext extends object = Record<string, never>>(parts: {
  head: ProvenanceHead;
  refs: ProvenanceRefEntry[];
  extensions?: Ext | undefined;
  tail?: ProvenanceTail | undefined;
}): Provenance & Ext {
  const { head, refs, extensions, tail } = parts;
  // Written out rather than spread so this function, not its caller's literal, fixes the order.
  // `undefined` values are omitted by JSON.stringify, so naming an absent field costs no bytes.
  return {
    provenance_schema_version: head.provenance_schema_version,
    cast_target: head.cast_target,
    mold: head.mold,
    cast_method: head.cast_method,
    cast_agent: head.cast_agent,
    cast_at: head.cast_at,
    cast_date: head.cast_date,
    cast_revision: head.cast_revision,
    cast_history: head.cast_history,
    refs,
    ...(extensions ?? ({} as Ext)),
    validation_results: tail?.validation_results,
    open_questions: tail?.open_questions,
  } as Provenance & Ext;
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
  cast_method?: string | undefined;
  cast_agent?: string | undefined;
  cast_date?: string | undefined;
  cast_revision?: number | undefined;
  cast_history?: CastHistoryEntry[] | undefined;
  open_questions?: string[] | undefined;
  validation_results?: ValidationResult[] | undefined;
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
