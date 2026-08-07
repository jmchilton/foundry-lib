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

import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { castMold, type CastOutcome, type CastRequest } from './caster/cast-mold.js';
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
 * The required three are the ones nothing can guess: what to call itself in a usage line, what
 * it contributes to a cast, and where its notes are. The rest have defaults that hold for a
 * Foundry laid out the conventional way, and exist so one that isn't can still use this.
 */
export interface CastCommandSpec<Ext extends object = Record<string, never>> {
  /** How this binary is invoked, e.g. `statgen-foundry-build cast`. Shown on a usage error. */
  readonly usage: string;
  /** This Foundry's contribution to a cast. */
  readonly hooks: CastHooks;
  /** Reads the corpus once per run. Given the repo root, since `--root` may have moved it. */
  readonly corpus: (repoRoot: string) => Corpus;
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

  if (args.root) process.chdir(args.root);
  const repoRoot = process.cwd();

  // A malformed `_target.yml` or `reference_contract.yml` is an authoring error in a YAML file,
  // not a bug in the caster, so both report as a named message rather than a stack trace.
  const targetDir = castsTargetDir(repoRoot, args.target);
  let target;
  let contract;
  try {
    target = loadTargetConfig(targetDir);
    contract = loadCastReferenceContract(
      path.join(repoRoot, spec.contractPath ?? 'reference_contract.yml'),
      spec.narrow === undefined ? {} : { narrow: spec.narrow },
    );
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }

  const moldRel = (spec.moldPath ?? defaultMoldPath)(args.moldName);
  const moldAbs = path.join(repoRoot, moldRel);
  if (!existsSync(moldAbs)) return fail(`mold source missing: ${moldRel}`);

  const parsed = readMarkdown(moldAbs);
  if (parsed.meta.type !== 'mold') {
    return fail(`${moldRel}: type is not 'mold' (got ${String(parsed.meta.type)})`);
  }

  const corpus = spec.corpus(repoRoot);
  const request: CastRequest<Ext> = {
    repoRoot,
    bundleRoot: bundleDir(targetDir, args.moldName),
    targetName: args.target,
    target,
    mold: {
      name: args.moldName,
      path: moldRel,
      meta: parsed.meta,
      body: parsed.body,
      contentHash: sha256File(moldAbs),
    },
    castContract: contract.cast,
    refKinds: contract.contract.kinds,
    slugMap: corpus.slugMap,
    metaByPath: corpus.metaByPath,
    hooks: spec.hooks,
    check: args.check,
    note: args.note,
    ...(spec.extensions === undefined
      ? {}
      : { extensions: spec.extensions({ meta: parsed.meta, corpus }) }),
  } as CastRequest<Ext>;

  const verdict = castReport(await castMold<Ext>(request), args.check, repoRoot);
  for (const line of verdict.err) console.error(line);
  for (const line of verdict.out) console.log(line);
  if (verdict.exitCode !== 0) process.exitCode = verdict.exitCode;
}
