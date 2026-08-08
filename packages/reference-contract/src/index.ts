import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import yaml from 'js-yaml';

import { WIKI_LINK_RE } from '@galaxy-foundry/wiki-links';

export type RefShape = 'wiki-link' | 'path';

/**
 * Whether an `evidence` term claims a reference works, or records that something checked.
 *
 * Every renderer of this vocabulary draws the same line — `hypothesis` is marked as unproven and
 * the other two are not — and every one of them drew it by NAME, in a class selector or a switch.
 * That is a copy of this table kept somewhere the table cannot see, and it is silently wrong the
 * moment a term is added: a fourth `evidence` value renders in whichever style the `else` branch
 * happened to be, and nothing anywhere reports that no one decided.
 *
 * Declared here, the split is one fact with one home, and a new term cannot be added without
 * answering the question.
 */
export const STANDINGS = ['provisional', 'grounded'] as const;
export type Standing = (typeof STANDINGS)[number];

export interface ContractTerm {
  label: string;
  description: string;
  /** Falls back to the table's `spec_url`. */
  href?: string;
}

export interface KindTerm extends ContractTerm {
  ref_shape?: RefShape;
}

/** An `evidence` term, which must say where it stands. See {@link Standing}. */
export interface EvidenceTerm extends ContractTerm {
  standing: Standing;
}

export interface InheritedVocabularies {
  used_at: Record<string, ContractTerm>;
  load: Record<string, ContractTerm>;
  modes: Record<string, ContractTerm>;
  evidence: Record<string, EvidenceTerm>;
}

export interface ReferenceContract extends InheritedVocabularies {
  kinds: Record<string, KindTerm>;
}

export const CONTRACT_GROUPS = ['kinds', 'used_at', 'load', 'modes', 'evidence'] as const;
export type ContractGroup = (typeof CONTRACT_GROUPS)[number];

export const INHERITED_GROUPS = ['used_at', 'load', 'modes', 'evidence'] as const;

/**
 * The typed fields of one reference, each naming the group its value is drawn from.
 *
 * This mapping existed three times and was checked nowhere: the groups above, a schema that spelled
 * out `kind: enumOf("kinds")` … `mode: enumOf("modes")` by hand, and a view that spelled the same
 * five pairs back the other way to look each label up. The irregular pairs are the whole problem —
 * the field is `mode` and the group is `modes`, the field is `kind` and the group is `kinds` — so
 * the copies could not be compared by eye and were never compared by anything else.
 *
 * A schema derives its shape from this; a renderer derives its chips. Neither restates it.
 */
export const REFERENCE_FIELDS = {
  kind: 'kinds',
  used_at: 'used_at',
  load: 'load',
  mode: 'modes',
  evidence: 'evidence',
} as const satisfies Record<string, ContractGroup>;

export type ReferenceField = keyof typeof REFERENCE_FIELDS;

/**
 * The reference fields that carry an author's prose rather than a vocabulary value.
 *
 * All optional, which is why they belong in a list. Two descriptions of an object whose fields are
 * mostly optional do not fail against each other: drop `trigger` from one and everything still
 * compiles against the other, and the row simply stops rendering.
 */
export const REFERENCE_PROSE_FIELDS = ['purpose', 'trigger', 'verification'] as const;
export type ReferenceProseField = (typeof REFERENCE_PROSE_FIELDS)[number];

/**
 * One entry of a note's typed reference manifest, as {@link REFERENCE_FIELDS} defines it.
 *
 * The vocabulary fields are `string` rather than the contract's own enums, deliberately: the terms
 * come from a YAML table read at runtime, and a compile-time union would be a second, staler copy
 * of a registry that is already the authority. Validation is the schema's job; this is the shape.
 */
export type Reference = Record<ReferenceField, string> &
  Partial<Record<ReferenceProseField, string>> & { ref: string };

/**
 * Explain why a reference target does not have the shape its kind declares.
 *
 * The contract owns whether a kind is addressed as a wiki link or a path, while wiki-links owns
 * the exact bracket grammar. Keeping the dispatch here lets instance schemas enforce the same
 * declaration the caster reads without restating either rule.
 */
export function referenceShapeIssue(
  contract: ReferenceContract,
  reference: Pick<Reference, 'kind' | 'ref'>,
): string | null {
  const term = contract.kinds[reference.kind];
  if (!term) return `unknown reference kind=${reference.kind}`;

  if (term.ref_shape === 'wiki-link' && !WIKI_LINK_RE.test(reference.ref)) {
    return `kind=${reference.kind} ref must be a [[wiki-link]] (got ${reference.ref})`;
  }
  if (term.ref_shape === 'path' && WIKI_LINK_RE.test(reference.ref)) {
    return `kind=${reference.kind} ref must be a path, not a [[wiki-link]] (got ${reference.ref})`;
  }
  return null;
}

/**
 * The reference fields whose vocabulary this package ships, in render order.
 *
 * Derived, not listed. A renderer may style these because every instance gets the same terms —
 * and `kind` falls out on its own, because `kinds` is the one group an instance declares. That is
 * the same line {@link loadInstanceKinds} enforces, read from the same place, so a group that
 * changed sides would move here too rather than leaving a hand-written list behind.
 */
export const REFERENCE_CHIP_FIELDS: ReferenceField[] = (
  Object.keys(REFERENCE_FIELDS) as ReferenceField[]
).filter((field) =>
  (INHERITED_GROUPS as readonly ContractGroup[]).includes(REFERENCE_FIELDS[field]),
);

export const REFERENCE_CONTRACT_FILE = 'reference_contract.yml';

function throwValidationError(sourcePath: string | undefined, message: string): never {
  throw new Error(sourcePath ? `${sourcePath}: ${message}` : message);
}

/** Every group's terms carry these three. */
const COMMON_TERM_FIELDS = ['label', 'description', 'href'] as const;

/**
 * What each group's terms may carry beyond {@link COMMON_TERM_FIELDS}.
 *
 * Per group rather than a single union, because a union is not a check: `standing` on a `kind`
 * or `ref_shape` on a `mode` would pass one, and both are the author believing something about
 * a term that nothing will ever read.
 */
const GROUP_TERM_FIELDS: Record<ContractGroup, readonly string[]> = {
  kinds: ['ref_shape'],
  used_at: [],
  load: [],
  modes: [],
  evidence: ['standing'],
};

interface ParseTermOptions {
  /** Falls back for a term that names no `href` of its own. */
  href?: string;
  /** Fields this term may carry, beyond {@link COMMON_TERM_FIELDS}. */
  extra: readonly string[];
}

function parseTerm(
  termPath: string,
  rawTerm: unknown,
  sourcePath: string | undefined,
  { href, extra }: ParseTermOptions,
): KindTerm {
  if (typeof rawTerm !== 'object' || rawTerm === null || Array.isArray(rawTerm)) {
    throwValidationError(sourcePath, `${termPath} is not a mapping`);
  }
  const fields = rawTerm as Record<string, unknown>;

  // Reject rather than drop. A key this parser does not recognise is a declaration its author
  // expected something to act on, and dropping it silently is the one outcome that looks like
  // success: the term parses, the page renders, and the field does nothing forever. A field
  // another parser owns is legitimate, but the instance has to SAY so — see `delegatedFields`.
  const known = [...COMMON_TERM_FIELDS, ...extra];
  const unknownFields = Object.keys(fields).filter((field) => !known.includes(field));
  if (unknownFields.length > 0) {
    throwValidationError(
      sourcePath,
      `${termPath} has unknown field(s) ${unknownFields.join(', ')} (known: ${known.join(', ')}) — ` +
        'a field another parser owns must be named in `delegatedFields`',
    );
  }

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
  const standing = fields['standing'];
  if (standing !== undefined && !(STANDINGS as readonly unknown[]).includes(standing)) {
    throwValidationError(
      sourcePath,
      `${termPath} has unknown standing \`${String(standing)}\` (expected ${STANDINGS.join(' | ')})`,
    );
  }

  const term: KindTerm & { standing?: Standing } = {
    label: fields['label'] as string,
    description: fields['description'] as string,
  };
  const link = typeof fields['href'] === 'string' ? fields['href'] : href;
  if (link !== undefined) term.href = link;
  if (shape !== undefined) term.ref_shape = shape;
  if (standing !== undefined) term.standing = standing as Standing;
  return term;
}

/**
 * The `evidence` group, with every term's {@link Standing} confirmed present.
 *
 * Checked here rather than left to the renderer, because the renderer's fallback for a term with
 * no standing is a style — and a style is not an error. The vocabulary is small and shipped; a
 * term that reaches a page having never been placed is the failure this catches at load.
 */
function requireStandings(
  terms: Record<string, KindTerm & { standing?: Standing }>,
  sourcePath: string | undefined,
): Record<string, EvidenceTerm> {
  for (const [termKey, term] of Object.entries(terms)) {
    if (term.standing === undefined) {
      throwValidationError(
        sourcePath,
        `evidence.${termKey} missing required field \`standing\` (${STANDINGS.join(' | ')})`,
      );
    }
  }
  return terms as Record<string, EvidenceTerm>;
}

/** Every field any group's term may carry. One parser reads them all; each group keeps its own. */
type ParsedTerm = KindTerm & { standing?: Standing };

function parseGroup(
  group: ContractGroup,
  rawGroup: unknown,
  sourcePath: string | undefined,
  options: { href?: string; delegatedFields?: readonly string[] } = {},
): Record<string, ParsedTerm> {
  if (typeof rawGroup !== 'object' || rawGroup === null || Array.isArray(rawGroup)) {
    throwValidationError(sourcePath, `\`${group}\` is not a mapping`);
  }
  const entries = Object.entries(rawGroup as Record<string, unknown>);
  if (entries.length === 0) throwValidationError(sourcePath, `\`${group}\` is empty`);
  const extra = [...GROUP_TERM_FIELDS[group], ...(options.delegatedFields ?? [])];
  const termOptions: ParseTermOptions =
    options.href === undefined ? { extra } : { href: options.href, extra };
  return Object.fromEntries(
    entries.map(([termKey, termValue]) => [
      termKey,
      parseTerm(`${group}.${termKey}`, termValue, sourcePath, termOptions),
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

  const options = specUrl === undefined ? {} : { href: specUrl };
  return {
    used_at: parseGroup('used_at', contractData['used_at'], sourcePath, options),
    load: parseGroup('load', contractData['load'], sourcePath, options),
    modes: parseGroup('modes', contractData['modes'], sourcePath, options),
    evidence: requireStandings(
      parseGroup('evidence', contractData['evidence'], sourcePath, options),
      sourcePath,
    ),
  };
}

const moduleRelativeBundledPath = fileURLToPath(
  new URL('../data/reference-contract.yml', import.meta.url),
);

/**
 * Find the data file both as an ordinary Node package and after a server bundler moves this module.
 *
 * In the package, the file sits beside `dist/` and the relative URL is the shortest truthful path.
 * A bundler may inline this module into an application's temporary server chunk without copying the
 * YAML beside it, at which point `import.meta.url` names the chunk rather than this package. Resolve
 * the package's public data export from that application frame as the fallback; consumers which use
 * the contract at build time already have this package in their dependency graph.
 */
function resolveBundledContractPath(): string {
  if (existsSync(moduleRelativeBundledPath)) return moduleRelativeBundledPath;
  return createRequire(import.meta.url).resolve(
    '@galaxy-foundry/reference-contract/reference-contract.yml',
  );
}

const BUNDLED_PATH = resolveBundledContractPath();

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

function narrowGroup<T extends ContractTerm>(
  group: InheritedGroup,
  terms: Record<string, T>,
  keep: readonly string[],
): Record<string, T> {
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
  // Generic in the group so `evidence` keeps its EvidenceTerm through narrowing. Widened to
  // ContractTerm here, a narrowed contract would quietly lose the standings it was built with.
  const selectGroupTerms = <G extends InheritedGroup>(group: G): InheritedVocabularies[G] => {
    const keep = narrow?.[group];
    if (keep === undefined) return inherited[group];
    // narrowGroup only ever drops whole entries, so the term type it returns is the one it was
    // given — which TypeScript cannot see through a generic index into InheritedVocabularies.
    return narrowGroup(group, inherited[group], keep) as InheritedVocabularies[G];
  };
  return {
    kinds,
    used_at: selectGroupTerms('used_at'),
    load: selectGroupTerms('load'),
    modes: selectGroupTerms('modes'),
    evidence: selectGroupTerms('evidence'),
  };
}

export interface LoadInstanceKindsOptions {
  /**
   * Keys on a kind that a DIFFERENT parser reads — permitted here, and left unread.
   *
   * A reference kind is described in more than one register: this package keeps the fields a
   * site renders, and `@galaxy-foundry/cast` keeps the `cast:` block that says what the caster
   * does with the kind. One file, two readers, on purpose — that is what stops the two halves
   * of a kind from disagreeing.
   *
   * Naming a key here is the instance stating that the second reader exists. An instance whose
   * contract carries a `cast:` block and which never runs a caster names nothing, and finds out
   * at load: the block is refused, rather than parsed by no one.
   */
  delegatedFields?: readonly string[];
}

export function loadInstanceKinds(
  contractPath: string,
  { delegatedFields }: LoadInstanceKindsOptions = {},
): Record<string, KindTerm> {
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
  const options = delegatedFields === undefined ? {} : { delegatedFields };
  return parseGroup('kinds', contractData['kinds'], contractPath, options);
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
