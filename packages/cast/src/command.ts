// The command shell around a cast: flags in, a bundle and a verdict out.
//
// This is the one module in the package that knows about a terminal, which is why it is behind
// its own entry point (`@galaxy-foundry/cast/command`) rather than in the barrel. The barrel
// promises that nothing in it prints — a cast reports what it found as VALUES so a CLI, a test
// and an editor can each render it their own way — and that promise is worth keeping literally.
//
// What is shared here is the shape every casting CLI has anyway: one Mold as a positional, a
// target, `--check`, `--note`, `--root`, and a report that distinguishes "nothing to do" from
// "the bundle on disk disagrees" from "this could not be built". What is NOT here is anything
// about a corpus — where notes live, how a slug becomes a path, what a Foundry contributes —
// because that is what a Foundry IS, and it arrives through `CastCommandSpec`.
//
// Casting one Mold and sweeping every Mold are the same shell over the same three loads, which
// is why `prepareCast` and `castOne` sit between them rather than each command owning a copy.
// The sweep exists here because both Foundries had written it themselves out of N invocations of
// the single-Mold command, and inherited its per-run reporting N times over as a result.

import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import {
  castMold,
  type CastDrift,
  type CastKindLayout,
  type CastOutcome,
  type CastRequest,
} from './caster/cast-mold.js';
import type { CastHooks } from './caster/hooks.js';
import { loadTargetConfig } from './caster/target-config.js';
import {
  loadCastReferenceContract,
  type LoadCastReferenceContractOptions,
} from './cast-contract.js';
import { readMarkdown, type Frontmatter } from './frontmatter.js';
import { sha256File } from './reconcile.js';
import { bundleDir, castsTargetDir } from './target-layout.js';

/** What the flags on one invocation resolved to. */
export interface CastCommandArgs {
  moldName: string;
  target: string;
  check: boolean;
  note: string | null;
  root: string | null;
}

/** The corpus a cast reads, as the instance that owns it sees it. */
export interface Corpus {
  /** Wiki-link slug to repo-relative path. */
  readonly slugMap: ReadonlyMap<string, string>;
  /** Every note's frontmatter, by repo-relative path. */
  readonly metaByPath: ReadonlyMap<string, Frontmatter>;
}

/**
 * Everything a Foundry has to say to turn `castMold` into a command.
 *
 * The required inputs are the ones nothing can guess: what to call itself in a usage line, what
 * it contributes to a cast, where its notes are, and the layouts its note Kinds declare. The rest
 * have defaults that hold for a Foundry laid out the conventional way, and exist so one that
 * isn't can still use this.
 */
export interface CastCommandSpec<Ext extends object = Record<string, never>> {
  /** How this binary is invoked, e.g. `statgen-foundry-build cast`. Shown on a usage error. */
  readonly usage: string;
  /** This Foundry's contribution to a cast. */
  readonly hooks: CastHooks;
  /** Reads the corpus once per run. Given the repo root, since `--root` may have moved it. */
  readonly corpus: (repoRoot: string) => Corpus;
  /** Note `type` to the Kind-owned layout that casting consumes. */
  readonly kindLayouts: Readonly<Record<string, CastKindLayout>>;
  /** Target when `--target` is not given. */
  readonly defaultTarget?: string;
  /** Repo-relative path of a Mold's source. Defaults to `content/molds/<name>/index.md`. */
  readonly moldPath?: (moldName: string) => string;
  /** Repo-relative path of the reference contract. Defaults to `reference_contract.yml`. */
  readonly contractPath?: string;
  /** Restrict inherited contract groups to what this instance supports. */
  readonly narrow?: LoadCastReferenceContractOptions['narrow'];
  /** This Foundry's own block in the slot the provenance record reserves beside `refs`. */
  readonly extensions?: (input: { meta: Frontmatter; corpus: Corpus }) => Ext | undefined;
}

const FLAGS_WITH_VALUES = ['--target', '--note', '--root'] as const;

/**
 * Read one invocation's flags.
 *
 * An unknown flag is refused rather than ignored, because the flags that get typo'd are the
 * ones that make a run safe: a dropped `--check` writes the bundle it was asked to inspect.
 */
export function parseCastArgs(
  argv: readonly string[],
  opts: { usage: string; defaultTarget?: string },
): CastCommandArgs {
  const positional: string[] = [];
  const values = new Map<(typeof FLAGS_WITH_VALUES)[number], string>();
  let check = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '--check') {
      check = true;
      continue;
    }
    const joined = FLAGS_WITH_VALUES.find((f) => a.startsWith(`${f}=`));
    if (joined) {
      values.set(joined, a.slice(joined.length + 1));
      continue;
    }
    const separated = FLAGS_WITH_VALUES.find((f) => f === a);
    if (separated) {
      // A flag that takes a value and was given none must not quietly eat the next flag.
      // `--target --check` read `--check` as the target name, which left `check` false and
      // wrote the bundle the run was asked to inspect — the exact accident this parser refuses
      // unknown flags to avoid.
      const next = argv[++i];
      if (next === undefined || next.startsWith('--')) {
        throw new Error(`${separated} needs a value`);
      }
      values.set(separated, next);
      continue;
    }
    if (a.startsWith('--')) throw new Error(`unknown flag: ${a}`);
    positional.push(a);
  }

  if (positional.length !== 1) {
    throw new Error(`usage: ${opts.usage} <mold-name> [--target=<name>] [--check] [--note="..."]`);
  }
  return {
    moldName: positional[0]!,
    target: values.get('--target') ?? opts.defaultTarget ?? 'claude',
    check,
    note: values.get('--note') ?? null,
    root: values.get('--root') ?? null,
  };
}

/** What a finished run should say, and what it should exit with. */
export interface CastVerdict {
  readonly out: string[];
  readonly err: string[];
  readonly exitCode: number;
}

/**
 * Turn an outcome into lines and an exit code, without touching a stream.
 *
 * Kept separate from `castCommand` so the interesting decision — which of four endings this run
 * had — is a value a test can read, rather than something only observable by capturing stdout.
 */
export function castReport(
  outcome: Pick<CastOutcome, 'errors' | 'drift' | 'wrote'>,
  check: boolean,
  repoRoot: string,
): CastVerdict {
  const err = [
    ...outcome.errors.map((e) => `error: ${e}`),
    ...outcome.drift.map((d) => `drift: ${d.file} — ${d.reason}`),
  ];
  const out: string[] = [];

  if (check) {
    if (outcome.errors.length || outcome.drift.length) {
      err.push(`check failed: ${outcome.errors.length} error(s), ${outcome.drift.length} drift(s)`);
      return { out, err, exitCode: 1 };
    }
    out.push('clean: no drift, no errors');
    return { out, err, exitCode: 0 };
  }

  // A record describing a bundle that was never assembled is worse than no record, so the
  // write path refuses rather than reporting a partial success.
  if (!outcome.wrote) {
    err.push(`refusing to update provenance: ${outcome.errors.length} error(s)`);
    return { out, err, exitCode: 1 };
  }

  out.push(`wrote ${path.relative(repoRoot, outcome.wrote)}`);
  if (outcome.drift.length) out.push(`reconciled ${outcome.drift.length} drifted file(s)`);
  return { out, err, exitCode: 0 };
}

const defaultMoldPath = (name: string): string =>
  path.posix.join('content', 'molds', name, 'index.md');

/**
 * A named Mold that has no usable source.
 *
 * Distinguished from every other failure because the two callers disagree about what it means.
 * To `castCommand` it is a usage error — the run named a Mold that is not there. To `castSweep`
 * it is one bad entry in a list the caller built, which the other entries should survive.
 */
export class MoldSourceError extends Error {}

/**
 * Everything a run loads once, however many Molds it goes on to cast.
 *
 * The target, the contract and the corpus are properties of the REPOSITORY, not of any one
 * Mold, and reading them per Mold is how a sweep ends up forty-seven times slower than the work
 * it does. Splitting them out is also what lets a sweep exist at all without shelling out to the
 * single-Mold command in a loop.
 */
export interface PreparedCast<Ext extends object = Record<string, never>> {
  readonly spec: CastCommandSpec<Ext>;
  readonly repoRoot: string;
  readonly targetDir: string;
  readonly targetName: string;
  readonly target: ReturnType<typeof loadTargetConfig>;
  readonly contract: ReturnType<typeof loadCastReferenceContract>;
  readonly corpus: Corpus;
}

/**
 * Read the target, the contract and the corpus.
 *
 * Throws on a malformed `_target.yml` or `reference_contract.yml`. Both are authoring errors in
 * a YAML file rather than bugs in the caster, so both carry a named message a caller can print
 * instead of a stack trace.
 */
export function prepareCast<Ext extends object = Record<string, never>>(
  spec: CastCommandSpec<Ext>,
  opts: { target: string; root?: string | null },
): PreparedCast<Ext> {
  if (opts.root) process.chdir(opts.root);
  const repoRoot = process.cwd();
  const targetDir = castsTargetDir(repoRoot, opts.target);
  return {
    spec,
    repoRoot,
    targetDir,
    targetName: opts.target,
    target: loadTargetConfig(targetDir),
    contract: loadCastReferenceContract(
      path.join(repoRoot, spec.contractPath ?? 'reference_contract.yml'),
      spec.narrow === undefined ? {} : { narrow: spec.narrow },
    ),
    corpus: spec.corpus(repoRoot),
  };
}

/**
 * Cast one Mold against an already-prepared repository.
 *
 * Throws {@link MoldSourceError} when the Mold has no source or the source is not a Mold; every
 * other failure is reported inside the returned outcome, because a cast that could not resolve a
 * reference still ran.
 */
export async function castOne<Ext extends object = Record<string, never>>(
  prepared: PreparedCast<Ext>,
  moldName: string,
  opts: { check: boolean; note?: string | null },
): Promise<CastOutcome> {
  const { spec, repoRoot } = prepared;
  const moldRel = (spec.moldPath ?? defaultMoldPath)(moldName);
  const moldAbs = path.join(repoRoot, moldRel);
  if (!existsSync(moldAbs)) throw new MoldSourceError(`mold source missing: ${moldRel}`);

  const parsed = readMarkdown(moldAbs);
  if (parsed.meta.type !== 'mold') {
    throw new MoldSourceError(`${moldRel}: type is not 'mold' (got ${String(parsed.meta.type)})`);
  }

  const request: CastRequest<Ext> = {
    repoRoot,
    bundleRoot: bundleDir(prepared.targetDir, moldName),
    targetName: prepared.targetName,
    target: prepared.target,
    mold: {
      name: moldName,
      path: moldRel,
      meta: parsed.meta,
      body: parsed.body,
      contentHash: sha256File(moldAbs),
    },
    castContract: prepared.contract.cast,
    refKinds: prepared.contract.contract.kinds,
    slugMap: prepared.corpus.slugMap,
    metaByPath: prepared.corpus.metaByPath,
    kindLayouts: spec.kindLayouts,
    hooks: spec.hooks,
    check: opts.check,
    note: opts.note ?? null,
    ...(spec.extensions === undefined
      ? {}
      : { extensions: spec.extensions({ meta: parsed.meta, corpus: prepared.corpus }) }),
  } as CastRequest<Ext>;

  return castMold<Ext>(request);
}

/** What one Mold in a sweep did. */
export interface SweepEntry {
  readonly mold: string;
  readonly errors: readonly string[];
  readonly drift: readonly CastDrift[];
  /** Absolute path of the record this Mold published, or null. Always null under `check`. */
  readonly wrote: string | null;
}

/**
 * What a whole sweep found, as a value.
 *
 * `entries` is every Mold in the order it was given; the three buckets are views over it, so a
 * caller that wants a count reads a bucket and one that wants the run in order reads `entries`.
 * A Mold with both errors and drift is `errored` — an error means the cast could not be built,
 * which is the larger claim.
 */
export interface SweepResult {
  readonly entries: readonly SweepEntry[];
  readonly clean: readonly SweepEntry[];
  readonly drifted: readonly SweepEntry[];
  readonly errored: readonly SweepEntry[];
}

/**
 * Cast every named Mold and collect what happened. Prints nothing.
 *
 * Both Foundries had written this loop, in a Makefile and in TypeScript, and disagreed on all of
 * output, enumeration and what an uncast Mold means — because both built it by invoking the
 * single-Mold command N times and inherited its per-run reporting N times over. The loop is
 * casting's; only the LIST is the instance's, which is why `molds` is an argument. A Foundry that
 * requires every Mold to be cast passes its Mold slugs; one that checks only what it has already
 * cast passes its bundle names. Neither policy is assumed here.
 *
 * `check` defaults to true: a sweep is a gate before it is anything else, and one that wrote
 * forty-seven bundles because a caller forgot a flag is a worse accident than one that reports.
 */
export async function castSweep<Ext extends object = Record<string, never>>(
  spec: CastCommandSpec<Ext>,
  opts: {
    molds: readonly string[];
    target?: string;
    root?: string | null;
    check?: boolean;
    note?: string | null;
  },
): Promise<SweepResult> {
  const prepared = prepareCast(spec, {
    target: opts.target ?? spec.defaultTarget ?? 'claude',
    ...(opts.root === undefined ? {} : { root: opts.root }),
  });
  const check = opts.check ?? true;

  const entries: SweepEntry[] = [];
  for (const mold of opts.molds) {
    // One Mold's failure must not end the sweep: the value of running all of them is the list of
    // everything wrong, and a loop that stops at the first drift reports one file per run.
    try {
      const outcome = await castOne(prepared, mold, {
        check,
        ...(opts.note === undefined ? {} : { note: opts.note }),
      });
      entries.push({ mold, errors: outcome.errors, drift: outcome.drift, wrote: outcome.wrote });
    } catch (e) {
      if (!(e instanceof MoldSourceError)) throw e;
      entries.push({ mold, errors: [e.message], drift: [], wrote: null });
    }
  }

  return {
    entries,
    clean: entries.filter((s) => !s.errors.length && !s.drift.length),
    drifted: entries.filter((s) => !s.errors.length && s.drift.length > 0),
    errored: entries.filter((s) => s.errors.length > 0),
  };
}

/**
 * Turn a sweep into lines and an exit code, without touching a stream.
 *
 * SILENT ON SUCCESS under `check`. A gate that passes has said everything it has to say by
 * exiting zero, and one `clean` line per Mold buries the run that matters in the forty-six that
 * do not. The single-Mold `castReport` still says `clean: no drift, no errors`, because there
 * silence would be ambiguous — the difference is the number of runs, not the convention.
 *
 * A failing Mold names itself and indents its findings, and `remediation` follows them all once.
 * That last part is the piece worth sharing: it is where the reader learns that drift is fixed by
 * re-casting and committing while an error is fixed at the source, and only one of the two
 * sweeps this replaces ever told them.
 */
export function sweepReport(
  result: SweepResult,
  opts: { repoRoot: string; check: boolean; remediation?: readonly string[] },
): CastVerdict {
  const out: string[] = [];
  const err: string[] = [];

  // Drift is a failure only under `check`. A write run REPORTS drift while removing it — every
  // first cast of a Mold drifts against the bundle it does not have yet — so counting it as a
  // failure would fail every cast-all of a corpus that had never been cast.
  const failed = opts.check ? [...result.errored, ...result.drifted] : [...result.errored];

  for (const entry of failed) {
    err.push(`${entry.mold}:`);
    for (const e of entry.errors) err.push(`  error: ${e}`);
    for (const d of entry.drift) err.push(`  drift: ${d.file} — ${d.reason}`);
  }

  if (failed.length) {
    err.push(
      `${failed.length} of ${result.entries.length} cast(s) failed`,
      ...(opts.remediation ?? []),
    );
    return { out, err, exitCode: 1 };
  }

  // A write sweep reports what it did; a check sweep that found nothing says nothing.
  if (!opts.check) {
    const wrote = result.entries.filter((s) => s.wrote);
    out.push(`cast ${wrote.length} of ${result.entries.length} mold(s)`);
    if (result.drifted.length) out.push(`reconciled ${result.drifted.length} drifted mold(s)`);
  }
  return { out, err, exitCode: 0 };
}

/**
 * Cast one Mold, from argv to exit code.
 *
 * Sets `process.exitCode` rather than calling `process.exit`, so nothing is cut off mid-write
 * and a caller that wants to do something afterwards still can.
 */
export async function castCommand<Ext extends object = Record<string, never>>(
  argv: readonly string[],
  spec: CastCommandSpec<Ext>,
): Promise<void> {
  const fail = (message: string): void => {
    console.error(message);
    process.exitCode = 2;
  };

  let args: CastCommandArgs;
  try {
    args = parseCastArgs(argv, {
      usage: spec.usage,
      ...(spec.defaultTarget === undefined ? {} : { defaultTarget: spec.defaultTarget }),
    });
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }

  let prepared: PreparedCast<Ext>;
  try {
    prepared = prepareCast(spec, { target: args.target, root: args.root });
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }

  let outcome: CastOutcome;
  try {
    outcome = await castOne(prepared, args.moldName, { check: args.check, note: args.note });
  } catch (e) {
    if (!(e instanceof MoldSourceError)) throw e;
    return fail(e.message);
  }

  const verdict = castReport(outcome, args.check, prepared.repoRoot);
  for (const line of verdict.err) console.error(line);
  for (const line of verdict.out) console.log(line);
  if (verdict.exitCode !== 0) process.exitCode = verdict.exitCode;
}
