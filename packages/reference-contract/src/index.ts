import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import yaml from 'js-yaml';

export type RefShape = 'wiki-link' | 'path';

export interface ContractTerm {
  label: string;
  description: string;
  /** Falls back to the table's `spec_url`. */
  href?: string;
}

export interface KindTerm extends ContractTerm {
  ref_shape?: RefShape;
}

export interface InheritedVocabularies {
  used_at: Record<string, ContractTerm>;
  load: Record<string, ContractTerm>;
  modes: Record<string, ContractTerm>;
  evidence: Record<string, ContractTerm>;
}

export interface ReferenceContract extends InheritedVocabularies {
  kinds: Record<string, KindTerm>;
}

export const CONTRACT_GROUPS = ['kinds', 'used_at', 'load', 'modes', 'evidence'] as const;
export type ContractGroup = (typeof CONTRACT_GROUPS)[number];

export const INHERITED_GROUPS = ['used_at', 'load', 'modes', 'evidence'] as const;

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
  if (entries.length === 0) fail(source, `\`${group}\` is empty`);
  return Object.fromEntries(
    entries.map(([k, v]) => [k, parseTerm(`${group}.${k}`, v, source, href)]),
  );
}

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

export function bundledContractPath(): string {
  return BUNDLED_PATH;
}

export function bundledContractText(): string {
  if (bundledText === undefined) bundledText = readFileSync(BUNDLED_PATH, 'utf8');
  return bundledText;
}

export function bundledVocabularies(): InheritedVocabularies {
  if (bundled === undefined) {
    bundled = parseInheritedVocabularies(bundledContractText(), BUNDLED_PATH);
  }
  return bundled;
}

export type Narrowing = Partial<Record<InheritedGroup, readonly string[]>>;

export type InheritedGroup = (typeof INHERITED_GROUPS)[number];

export interface BuildReferenceContractOptions {
  kinds: Record<string, KindTerm>;
  /** Restrict inherited groups to capabilities this instance supports. */
  narrow?: Narrowing;
  /** Override the shipped inherited vocabularies. */
  inherited?: InheritedVocabularies;
}

function narrowGroup(
  group: InheritedGroup,
  terms: Record<string, ContractTerm>,
  keep: readonly string[],
): Record<string, ContractTerm> {
  if (keep.length === 0) {
    throw new Error(`reference contract: narrowing \`${group}\` to nothing leaves no valid value`);
  }
  const unknown = keep.filter((k) => terms[k] === undefined);
  if (unknown.length > 0) {
    throw new Error(
      `reference contract: cannot narrow \`${group}\` to unknown term(s) ${unknown.join(', ')} ` +
        `(available: ${Object.keys(terms).join(', ')})`,
    );
  }
  // Preserve the source vocabulary order for stable output.
  return Object.fromEntries(Object.entries(terms).filter(([k]) => keep.includes(k)));
}

export function buildReferenceContract({
  kinds,
  narrow,
  inherited = bundledVocabularies(),
}: BuildReferenceContractOptions): ReferenceContract {
  if (Object.keys(kinds).length === 0) {
    throw new Error('reference contract: `kinds` is empty — an instance must declare at least one');
  }
  if (narrow) {
    const bad = Object.keys(narrow).filter(
      (g) => !(INHERITED_GROUPS as readonly string[]).includes(g),
    );
    if (bad.length > 0) {
      throw new Error(
        `reference contract: cannot narrow \`${bad.join(', ')}\` ` +
          `(narrowable: ${INHERITED_GROUPS.join(', ')})`,
      );
    }
  }
  const pick = (group: InheritedGroup): Record<string, ContractTerm> => {
    const keep = narrow?.[group];
    return keep === undefined ? inherited[group] : narrowGroup(group, inherited[group], keep);
  };
  return {
    kinds,
    used_at: pick('used_at'),
    load: pick('load'),
    modes: pick('modes'),
    evidence: pick('evidence'),
  };
}

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

export function contractKeys(contract: ReferenceContract, group: ContractGroup): string[] {
  return Object.keys(contract[group]);
}
