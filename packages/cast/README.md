# @galaxy-foundry/cast

Casting — turning a Mold into a frozen, target-specific skill artifact that can be re-derived
byte-for-byte and checked for drift.

A cast is only worth anything if it can be _reproduced_. This package holds the whole of that:
resolving each declared reference, placing its bytes, applying the redistribution policy,
rendering the skill document, sweeping what stopped being a reference, and writing the
provenance record. None of it varies by domain.

What is not here is everything that names a Foundry's own world — its kinds, its slug map, its
validators, its renderers. Those reach the caster through `CastHooks`, one value per extension
point, so a Foundry adds its knowledge without forking the assembly.

`cast` is an early extraction rather than an admitted shared-substrate package. Its first
consumer's committed bundles provide a byte-identity oracle; adoption by a second independent
Foundry is what tests whether this boundary is genuinely reusable. See
[Deterministic casting architecture](https://jmchilton.github.io/foundry-lib/#/architecture/cast)
for the ownership map and the full flow.

```ts
import { castMold, castsTargetDir, loadTargetConfig } from '@galaxy-foundry/cast';

const targetDir = castsTargetDir(repoRoot, 'claude');

const outcome = await castMold({
  repoRoot,
  bundleRoot: bundleDir(targetDir, mold.name),
  targetName: 'claude',
  target: loadTargetConfig(targetDir),
  mold, // read off disk by you
  castContract, // the `cast:` half of your reference contract
  refKinds,
  slugMap,
  metaByPath,
  hooks: MY_HOOKS,
  check: args.check,
  note: null,
});

for (const error of outcome.errors) console.error(error);
process.exitCode = outcome.errors.length ? 1 : 0;
```

Errors and drift come back as values and nothing is printed, because a cast that found four
unresolved refs has produced a result rather than suffered a failure — and how that is rendered
is the caller's decision. The one thing `castMold` decides is whether to publish, since that is
a question about the staged bundle rather than about presentation.

## Hooks are how a Foundry attaches, and they refuse rather than default

`renderers` supplies a function per non-verbatim mode; `skillLede` and `skillSections` say what
the skill document contains; `bundleFiles` contributes files beyond `SKILL.md` and
`_provenance.json`; `bundleChecks` runs an instance's own checks over the finished bundle.

Two are optional, and that is the test of the boundary: a Foundry whose corpus is research notes
has no artifacts, no tools and no commands, and should still cast. `payloadCompanion` answers
the `payload-companion` strategy, `packageLoader` the `package-export` one — and a contract that
declares either strategy while registering nothing gets an error naming the reference that asked.
Falling back to the note would package the file that _frames_ a payload and report success,
which is the one outcome worse than a failure.

`packageLoader` exists because a bare `import(spec)` resolves relative to the file running it.
Written inside this package, it would look for your dependencies beside its own installed copy.
`(spec) => import(spec)`, written anywhere in your tree, is the whole implementation.

## Drift is a value, never an exit

`reconcile` reports what it found and, unless this is a `--check` run, brings the file into
line. It does not decide what stale _means_. A caster reconciles many artifacts in one run and
has to report them together, and it fails for reasons that are not file comparisons at all —
an unresolved reference, a licence that forbids the mode it was asked for. Those verdicts have
to combine, which they cannot do if one of them has already called `process.exit`.

The `--check` path is deliberately inert on disk. It writes nothing, and `reconcileText`
creates the parent directory only on the write path — a check that created the bundle
directory would make the _next_ check pass for the wrong reason.

A drifted entry keeps the hash that was actually on disk, via `recordedHash`. The record
reports what the check **found**, not what it wanted to find.

## Placement belongs to the target

Where bundles sit is a property of the target, declared once in its `_target.yml`:

```yaml
bundle_path: 'skills/{mold}'
```

That one declaration is why the Claude target's directory doubles as a Claude Code plugin root.
A target that declares nothing gets one directory per bundle, named for it.

Quote it. `bundle_path: {mold}` is not the string it looks like — unquoted braces are YAML
_flow-mapping_ syntax, so it loads as `{ mold: null }`, and `bundlePathOf` says so by name
rather than letting a string operation fail three frames away.

Every function here takes the **target directory**, not a repo root and a target name. Where a
Foundry keeps its targets is that Foundry's layout; `castsTargetDir` offers `casts/<target>/`
as the convention the first casting instance settled on, and nothing above it depends on that
choice.

## The provenance record

`PROVENANCE_SCHEMA_VERSION` is bumped when the record shape **narrows**. Adding an optional
field leaves older records valid and needs no bump. Removing a field, or removing a value from
an enum, makes a document that was valid yesterday invalid today — and one version number
naming two incompatible contracts is worse than no version at all.

`readProvenanceCarryOver` preserves the hand-recorded half of an existing record: who cast it,
when, under what note, what was left open. None of it is derivable from the sources, so a
caster that rebuilt the record from scratch would drop it silently — and a drift gate cannot
catch that, because the gate compares against exactly what the caster would write.

## Licences are checked against what the cast did

`applyLicensePolicy` runs the shared redistribution-policy table over the assembled refs,
keyed off each ref's recorded `derived` posture. A Foundry-authored own-words summary is outside
the source licence's redistribution policy; a ref that preserves upstream expression remains
governed by it. The cast mode is deliberately irrelevant: copying or rendering cannot change
whose expression the note contains. The helper also stamps the content hash of any declared
licence file, so the record says which licence text was in force.

It returns one message per violation rather than throwing. A cast reports all its problems
together, and a licence failure has to combine with the unresolved refs and drifted artifacts
found in the same run.

Which notes must declare a `license_file` at all stays with your validator: only an instance
can tell a Foundry-authored licence annotation from genuine third-party redistribution.

## Install

```sh
npm install @galaxy-foundry/cast
```

## License

MIT
