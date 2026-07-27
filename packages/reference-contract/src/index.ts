// The typed-reference vocabulary a Mold's `references[]` entries draw from, and the loader
// for it.
//
// The split this package draws is the whole point. A reference entry names five things:
// its `kind`, when it is `used_at`, how it is `load`ed, which cast `mode` applies, and what
// `evidence` backs it. Four of those five vocabularies are the same in every Foundry — they
// describe the compilation machinery, which does not vary by domain. The fifth, `kinds`, is
// exactly what does vary: one instance authors `cli-tool` and `schema` refs, another authors
// neither and would be declaring dead vocabulary by inheriting them.
//
// So: the four inherited vocabularies ship here as data. `kinds` is supplied by the
// instance, and `buildReferenceContract` puts the two halves together.
//
// Scope note: this package says what the vocabulary IS. It does not enforce the cross-field
// rules the terms describe — that an `on-demand` ref carries a `trigger`, that a `verbatim`
// mode is permitted by the ref's license. Those live in each instance's validator, against
// its own note schema, and the licence half needs @galaxy-foundry/license-policy besides.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import yaml from 'js-yaml';

/** How a reference resolves to its target: a `[[wiki-link]]` or a repo-relative path. */
export type RefShape = 'wiki-link' | 'path';

/** One entry in a controlled vocabulary. */
export interface ContractTerm {
  label: string;
  description: string;
  /** Where the vocabulary is specified. Filled from the table's `spec_url`. */
  href?: string;
}

/** A `kinds` entry additionally declares how its refs are written. */
export interface KindTerm extends ContractTerm {
  ref_shape?: RefShape;
}

/** The four vocabularies every Foundry inherits unchanged. */
export interface InheritedVocabularies {
  used_at: Record<string, ContractTerm>;
  load: Record<string, ContractTerm>;
  modes: Record<string, ContractTerm>;
  evidence: Record<string, ContractTerm>;
}

/** The inherited four plus the instance's own `kinds`. */
export interface ReferenceContract extends InheritedVocabularies {
  kinds: Record<string, KindTerm>;
}

/** The vocabulary groups, in the order a reference entry reads. */
export const CONTRACT_GROUPS = ['kinds', 'used_at', 'load', 'modes', 'evidence'] as const;
export type ContractGroup = (typeof CONTRACT_GROUPS)[number];

/** The four this package ships. `kinds` is the instance's. */
export const INHERITED_GROUPS = ['used_at', 'load', 'modes', 'evidence'] as const;

/** The conventional filename when an instance keeps its `kinds` at its repo root. */
export const REFERENCE_CONTRACT_FILE = 'reference_contract.yml';

function fail(source: string | undefined, message: string): never {
  throw new Error(source ? `${source}: ${message}` : message);
}

function parseTerm(
  where: string,
  raw: unknown,
  source: string | undefined,
  href?: string,
): KindTerm {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    fail(source, `${where} is not a mapping`);
  }
  const r = raw as Record<string, unknown>;
  for (const field of ['label', 'description'] as const) {
    if (typeof r[field] !== 'string' || !r[field]) {
      fail(source, `${where} missing required field \`${field}\``);
    }
  }
  const shape = r['ref_shape'];
  if (shape !== undefined && shape !== 'wiki-link' && shape !== 'path') {
    fail(source, `${where} has unknown ref_shape \`${String(shape)}\` (expected wiki-link | path)`);
  }

  const term: KindTerm = { label: r['label'] as string, description: r['description'] as string };
  // Two branches rather than a spread of possibly-undefined: `exactOptionalPropertyTypes`
  // distinguishes an absent key from one present and undefined, and a consumer serializing
  // a term back to YAML should not gain an `href: null` it never had.
  const link = typeof r['href'] === 'string' ? r['href'] : href;
  if (link !== undefined) term.href = link;
  if (shape !== undefined) term.ref_shape = shape;
  return term;
}

function parseGroup(
  group: string,
  raw: unknown,
  source: string | undefined,
  href?: string,
): Record<string, KindTerm> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    fail(source, `\`${group}\` is not a mapping`);
  }
  const entries = Object.entries(raw as Record<string, unknown>);
  // An empty vocabulary block accepts nothing, which makes every reference entry
  // unauthorable. It always means the block was started and not finished.
  if (entries.length === 0) fail(source, `\`${group}\` is empty`);
  return Object.fromEntries(
    entries.map(([k, v]) => [k, parseTerm(`${group}.${k}`, v, source, href)]),
  );
}

/**
 * Parse the four inherited vocabularies from a table.
 *
 * `spec_url`, when present, becomes the `href` of every term that does not carry its own —
 * the whole vocabulary is specified in one place, so repeating the link per term is noise.
 */
export function parseInheritedVocabularies(text: string, source?: string): InheritedVocabularies {
  const data: unknown = yaml.load(text);
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    fail(source, 'reference contract is not a mapping');
  }
  const table = data as Record<string, unknown>;
  const specUrl = typeof table['spec_url'] === 'string' ? table['spec_url'] : undefined;

  if (table['kinds'] !== undefined) {
    fail(
      source,
      "`kinds` is the instance's to declare, not the shared table's — pass it to buildReferenceContract()",
    );
  }

  return {
    used_at: parseGroup('used_at', table['used_at'], source, specUrl),
    load: parseGroup('load', table['load'], source, specUrl),
    modes: parseGroup('modes', table['modes'], source, specUrl),
    evidence: parseGroup('evidence', table['evidence'], source, specUrl),
  };
}

const BUNDLED_PATH = fileURLToPath(new URL('../data/reference-contract.yml', import.meta.url));

let bundledText: string | undefined;
let bundled: InheritedVocabularies | undefined;

/** Absolute path to the copy shipped inside this package. */
export function bundledContractPath(): string {
  return BUNDLED_PATH;
}

/** The shipped table's raw bytes. */
export function bundledContractText(): string {
  if (bundledText === undefined) bundledText = readFileSync(BUNDLED_PATH, 'utf8');
  return bundledText;
}

/** The four inherited vocabularies, parsed. The default source of truth for every instance. */
export function bundledVocabularies(): InheritedVocabularies {
  if (bundled === undefined) {
    bundled = parseInheritedVocabularies(bundledContractText(), BUNDLED_PATH);
  }
  return bundled;
}

export interface BuildReferenceContractOptions {
  /** The reference kinds this instance authors. Its own; never inherited. */
  kinds: Record<string, KindTerm>;
  /**
   * The inherited four. Defaults to the shipped table — pass this only to test against a
   * synthetic vocabulary.
   */
  inherited?: InheritedVocabularies;
}

/**
 * Compose an instance's `kinds` with the inherited vocabularies into a full contract.
 *
 * An empty `kinds` is refused: a Foundry that declares no reference kinds cannot author a
 * Mold with references at all, which is not a state anyone means to be in.
 */
export function buildReferenceContract({
  kinds,
  inherited = bundledVocabularies(),
}: BuildReferenceContractOptions): ReferenceContract {
  if (Object.keys(kinds).length === 0) {
    throw new Error('reference contract: `kinds` is empty — an instance must declare at least one');
  }
  return { kinds, ...inherited };
}

/** Read an instance's `kinds` from a YAML file holding a `kinds:` block. */
export function loadInstanceKinds(file: string): Record<string, KindTerm> {
  if (!existsSync(file)) throw new Error(`missing reference contract: ${file}`);
  const data: unknown = yaml.load(readFileSync(file, 'utf8'));
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    fail(file, 'reference contract is not a mapping');
  }
  const table = data as Record<string, unknown>;
  if (table['kinds'] === undefined) fail(file, 'has no `kinds` block');
  for (const group of INHERITED_GROUPS) {
    if (table[group] !== undefined) {
      fail(
        file,
        `declares \`${group}\`, which is inherited from @galaxy-foundry/reference-contract — delete it`,
      );
    }
  }
  return parseGroup('kinds', table['kinds'], file);
}

/** Walk up from `startDir` until a `reference_contract.yml` is found. */
export function findReferenceContractPath(startDir: string = process.cwd()): string {
  let dir = path.resolve(startDir);
  for (;;) {
    const candidate = path.join(dir, REFERENCE_CONTRACT_FILE);
    if (existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error(`${REFERENCE_CONTRACT_FILE} not found above ${startDir}`);
    dir = parent;
  }
}

/** The keys of one vocabulary group. Drives an instance's schema enums. */
export function contractKeys(contract: ReferenceContract, group: ContractGroup): string[] {
  return Object.keys(contract[group]);
}
