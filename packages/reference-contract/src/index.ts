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

function throwValidationError(sourcePath: string | undefined, message: string): never {
  throw new Error(sourcePath ? `${sourcePath}: ${message}` : message);
}

function parseTerm(
  termPath: string,
  rawTerm: unknown,
  sourcePath: string | undefined,
  href?: string,
): KindTerm {
  if (typeof rawTerm !== 'object' || rawTerm === null || Array.isArray(rawTerm)) {
    throwValidationError(sourcePath, `${termPath} is not a mapping`);
  }
  const fields = rawTerm as Record<string, unknown>;
  for (const field of ['label', 'description'] as const) {
    if (typeof fields[field] !== 'string' || !fields[field]) {
      throwValidationError(sourcePath, `${termPath} missing required field \`${field}\``);
    }
  }
  const shape = fields['ref_shape'];
  if (shape !== undefined && shape !== 'wiki-link' && shape !== 'path') {
    throwValidationError(
      sourcePath,
      `${termPath} has unknown ref_shape \`${String(shape)}\` (expected wiki-link | path)`,
    );
  }

  const term: KindTerm = {
    label: fields['label'] as string,
    description: fields['description'] as string,
  };
  const link = typeof fields['href'] === 'string' ? fields['href'] : href;
  if (link !== undefined) term.href = link;
  if (shape !== undefined) term.ref_shape = shape;
  return term;
}

function parseGroup(
  group: string,
  rawGroup: unknown,
  sourcePath: string | undefined,
  href?: string,
): Record<string, KindTerm> {
  if (typeof rawGroup !== 'object' || rawGroup === null || Array.isArray(rawGroup)) {
    throwValidationError(sourcePath, `\`${group}\` is not a mapping`);
  }
  const entries = Object.entries(rawGroup as Record<string, unknown>);
  if (entries.length === 0) throwValidationError(sourcePath, `\`${group}\` is empty`);
  return Object.fromEntries(
    entries.map(([termKey, termValue]) => [
      termKey,
      parseTerm(`${group}.${termKey}`, termValue, sourcePath, href),
    ]),
  );
}

export function parseInheritedVocabularies(
  text: string,
  sourcePath?: string,
): InheritedVocabularies {
  const parsedValue: unknown = yaml.load(text);
  if (typeof parsedValue !== 'object' || parsedValue === null || Array.isArray(parsedValue)) {
    throwValidationError(sourcePath, 'reference contract is not a mapping');
  }
  const contractData = parsedValue as Record<string, unknown>;
  const specUrl =
    typeof contractData['spec_url'] === 'string' ? contractData['spec_url'] : undefined;

  if (contractData['kinds'] !== undefined) {
    throwValidationError(
      sourcePath,
      "`kinds` is the instance's to declare, not the shared table's — pass it to buildReferenceContract()",
    );
  }

  return {
    used_at: parseGroup('used_at', contractData['used_at'], sourcePath, specUrl),
    load: parseGroup('load', contractData['load'], sourcePath, specUrl),
    modes: parseGroup('modes', contractData['modes'], sourcePath, specUrl),
    evidence: parseGroup('evidence', contractData['evidence'], sourcePath, specUrl),
  };
}

const BUNDLED_PATH = fileURLToPath(new URL('../data/reference-contract.yml', import.meta.url));

let cachedBundledText: string | undefined;
let cachedVocabularies: InheritedVocabularies | undefined;

export function bundledContractPath(): string {
  return BUNDLED_PATH;
}

export function bundledContractText(): string {
  if (cachedBundledText === undefined) cachedBundledText = readFileSync(BUNDLED_PATH, 'utf8');
  return cachedBundledText;
}

export function bundledVocabularies(): InheritedVocabularies {
  if (cachedVocabularies === undefined) {
    cachedVocabularies = parseInheritedVocabularies(bundledContractText(), BUNDLED_PATH);
  }
  return cachedVocabularies;
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
  const unknownTerms = keep.filter((termKey) => terms[termKey] === undefined);
  if (unknownTerms.length > 0) {
    throw new Error(
      `reference contract: cannot narrow \`${group}\` to unknown term(s) ${unknownTerms.join(', ')} ` +
        `(available: ${Object.keys(terms).join(', ')})`,
    );
  }
  // Preserve the source vocabulary order for stable output.
  return Object.fromEntries(Object.entries(terms).filter(([termKey]) => keep.includes(termKey)));
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
    const invalidGroups = Object.keys(narrow).filter(
      (groupName) => !(INHERITED_GROUPS as readonly string[]).includes(groupName),
    );
    if (invalidGroups.length > 0) {
      throw new Error(
        `reference contract: cannot narrow \`${invalidGroups.join(', ')}\` ` +
          `(narrowable: ${INHERITED_GROUPS.join(', ')})`,
      );
    }
  }
  const selectGroupTerms = (group: InheritedGroup): Record<string, ContractTerm> => {
    const keep = narrow?.[group];
    return keep === undefined ? inherited[group] : narrowGroup(group, inherited[group], keep);
  };
  return {
    kinds,
    used_at: selectGroupTerms('used_at'),
    load: selectGroupTerms('load'),
    modes: selectGroupTerms('modes'),
    evidence: selectGroupTerms('evidence'),
  };
}

export function loadInstanceKinds(contractPath: string): Record<string, KindTerm> {
  if (!existsSync(contractPath)) throw new Error(`missing reference contract: ${contractPath}`);
  const parsedValue: unknown = yaml.load(readFileSync(contractPath, 'utf8'));
  if (typeof parsedValue !== 'object' || parsedValue === null || Array.isArray(parsedValue)) {
    throwValidationError(contractPath, 'reference contract is not a mapping');
  }
  const contractData = parsedValue as Record<string, unknown>;
  if (contractData['kinds'] === undefined) {
    throwValidationError(contractPath, 'has no `kinds` block');
  }
  for (const group of INHERITED_GROUPS) {
    if (contractData[group] !== undefined) {
      throwValidationError(
        contractPath,
        `declares \`${group}\`, which is inherited from @galaxy-foundry/reference-contract — delete it`,
      );
    }
  }
  return parseGroup('kinds', contractData['kinds'], contractPath);
}

export function findReferenceContractPath(startDirectory: string = process.cwd()): string {
  let currentDirectory = path.resolve(startDirectory);
  for (;;) {
    const candidatePath = path.join(currentDirectory, REFERENCE_CONTRACT_FILE);
    if (existsSync(candidatePath)) return candidatePath;
    const parentDirectory = path.dirname(currentDirectory);
    if (parentDirectory === currentDirectory) {
      throw new Error(`${REFERENCE_CONTRACT_FILE} not found above ${startDirectory}`);
    }
    currentDirectory = parentDirectory;
  }
}

export function contractKeys(contract: ReferenceContract, group: ContractGroup): string[] {
  return Object.keys(contract[group]);
}
