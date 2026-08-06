// How each reference kind is CAST — the half of a kind's declaration that says what the caster
// does with it, as opposed to what the site calls it.
//
// A kind declares `label`, `description` and `ref_shape` to a reader, and those belong to
// @galaxy-foundry/reference-contract. What the caster needs — where the source bytes come from,
// what transform applies by default, whether the kind's notes may carry companions — is declared
// in the same file under `cast:`, and parsed here. One file, two readers: the site renders a pill
// and never asks how a kind resolves, the caster resolves and never renders. Both halves come
// from one declaration, which is what keeps them from disagreeing.
//
// This parser is deliberately separate from the shared one, which keeps a term to the fields a
// site renders. Composing the two halves is `loadCastReferenceContract` at the bottom of this
// file — the only place that knows both exist.

import { readFileSync } from 'node:fs';

import {
  buildReferenceContract,
  findReferenceContractPath,
  loadInstanceKinds,
  type Narrowing,
  type ReferenceContract,
} from '@galaxy-foundry/reference-contract';
import yaml from 'js-yaml';

/**
 * Where a ref's source bytes come from, and how its bundled filename is derived.
 *
 * Source and filename are one choice rather than two because they are not independent:
 * a `package-export` ref has no file to take a basename from, and a `payload-companion`
 * ref must be named for the note that frames it rather than for the payload beside it.
 */
export type CastResolve =
  /** The note file itself. */
  | 'note'
  /** An npm export named by the note's `package` + `package_export`. */
  | 'package-export'
  /** The kind's single `bundled` companion, sitting beside the note. */
  | 'payload-companion';

export const CAST_RESOLVE_VALUES: readonly CastResolve[] = [
  'note',
  'package-export',
  'payload-companion',
];

export interface CastDeclaration {
  resolve: CastResolve;
  /** Applied when a `references[]` entry names no `mode`. */
  default_mode: string;
  /**
   * Frontmatter field naming the bundled file, when the note's own slug is the wrong name.
   *
   * A `cli-tool` note lives at `content/cli/<dir>/index.md` and the directory is not always
   * the command — `tool:` is what a reader of the bundle expects to find.
   */
  slug_field?: string;
  /**
   * Whether this kind's notes may carry per-note `companions:` into a bundle.
   *
   * Layout stays the kind's and membership stays the note's: this says the kind's notes
   * are ALLOWED to declare companions, never which files they are. A note still lists its
   * own, and a file is never picked up for sitting in the directory.
   */
  companions: boolean;
}

/** A reference kind the caster can compile. Kinds with no `cast:` block are not castable. */
export type CastContract = Record<string, CastDeclaration>;

/**
 * The key a kind's cast declaration sits under.
 *
 * Named once and passed to the shared parser as a delegated field, so the two parsers agree on
 * where the block is without either restating the other's.
 */
export const CAST_BLOCK_KEY = 'cast';

const CAST_FIELDS = new Set(['resolve', 'default_mode', 'slug_field', 'companions']);

function fail(sourcePath: string, message: string): never {
  throw new Error(`${sourcePath}: ${message}`);
}

function parseCastDeclaration(
  kindName: string,
  raw: unknown,
  sourcePath: string,
  modes: readonly string[],
): CastDeclaration {
  const where = `kinds.${kindName}.${CAST_BLOCK_KEY}`;
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    fail(sourcePath, `${where} is not a mapping`);
  }
  const fields = raw as Record<string, unknown>;

  const unknownFields = Object.keys(fields).filter((key) => !CAST_FIELDS.has(key));
  if (unknownFields.length > 0) {
    fail(
      sourcePath,
      `${where} has unknown field(s) ${unknownFields.join(', ')} (known: ${[...CAST_FIELDS].join(', ')})`,
    );
  }

  const resolve = fields['resolve'];
  if (typeof resolve !== 'string' || !CAST_RESOLVE_VALUES.includes(resolve as CastResolve)) {
    fail(
      sourcePath,
      `${where}.resolve is \`${String(resolve)}\` (expected ${CAST_RESOLVE_VALUES.join(' | ')})`,
    );
  }

  const defaultMode = fields['default_mode'];
  if (typeof defaultMode !== 'string' || !defaultMode) {
    fail(sourcePath, `${where} missing required field \`default_mode\``);
  }
  // Checked against the composed vocabulary rather than a literal list, so an instance
  // that narrows `modes` (declining the LLM phase, say) cannot declare a default it has
  // just removed from its own contract.
  if (!modes.includes(defaultMode)) {
    fail(
      sourcePath,
      `${where}.default_mode is \`${defaultMode}\`, which is not in this instance's ` +
        `\`modes\` vocabulary (${modes.join(', ')})`,
    );
  }

  const slugField = fields['slug_field'];
  if (slugField !== undefined && (typeof slugField !== 'string' || !slugField)) {
    fail(sourcePath, `${where}.slug_field must be a non-empty string`);
  }

  const companions = fields['companions'];
  if (typeof companions !== 'boolean') {
    fail(sourcePath, `${where}.companions must be true or false`);
  }

  const declaration: CastDeclaration = {
    resolve: resolve as CastResolve,
    default_mode: defaultMode,
    companions,
  };
  if (typeof slugField === 'string') declaration.slug_field = slugField;
  return declaration;
}

/**
 * Read the `cast:` blocks from an instance's reference contract.
 *
 * A kind with no `cast:` block is absent from the result — that is how a kind declares it is
 * vocabulary the site renders but the caster cannot compile. Being absent here is the whole
 * reason the caster refuses it, rather than a second list of names agreeing with this one.
 */
export function loadCastContract(contractPath: string, modes: readonly string[]): CastContract {
  const parsed: unknown = yaml.load(readFileSync(contractPath, 'utf8'));
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    fail(contractPath, 'reference contract is not a mapping');
  }
  const kinds = (parsed as Record<string, unknown>)['kinds'];
  if (typeof kinds !== 'object' || kinds === null || Array.isArray(kinds)) {
    fail(contractPath, '`kinds` is not a mapping');
  }

  const contract: CastContract = {};
  for (const [kindName, rawKind] of Object.entries(kinds as Record<string, unknown>)) {
    if (typeof rawKind !== 'object' || rawKind === null || Array.isArray(rawKind)) continue;
    const rawCast = (rawKind as Record<string, unknown>)[CAST_BLOCK_KEY];
    if (rawCast === undefined) continue;
    contract[kindName] = parseCastDeclaration(kindName, rawCast, contractPath, modes);
  }
  return contract;
}

export interface LoadCastReferenceContractOptions {
  /** Restrict inherited groups to capabilities this instance supports. */
  narrow?: Narrowing;
}

/**
 * Both halves of an instance's reference contract, composed.
 *
 * The only function that knows a kind has two readers. It is here rather than in the shared
 * package because the shared package should not have to know that casting exists — an instance
 * with no caster reads only its half, and a `cast:` block in ITS contract is refused there for
 * being a declaration nothing acts on.
 *
 * `default_mode` is checked against the composed `modes`, which is why the two loads happen
 * together: an instance that narrows the vocabulary cannot default a kind to a mode it has
 * just declined.
 */
export function loadCastReferenceContract(
  contractPath: string = findReferenceContractPath(),
  { narrow }: LoadCastReferenceContractOptions = {},
): { contract: ReferenceContract; cast: CastContract } {
  const kinds = loadInstanceKinds(contractPath, { delegatedFields: [CAST_BLOCK_KEY] });
  const contract = buildReferenceContract(narrow ? { kinds, narrow } : { kinds });
  return { contract, cast: loadCastContract(contractPath, Object.keys(contract.modes)) };
}
