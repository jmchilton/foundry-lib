# @galaxy-foundry/cast

The deterministic half of casting — turning a Mold into a frozen, target-specific skill
artifact that can be re-derived byte-for-byte and checked for drift.

A cast is only worth anything if it can be _reproduced_. That is what this package holds: the
parts of casting that decide **where a bundle goes**, **whether what is on disk still matches
what would be written**, and **what the provenance record says about how the bytes were
produced**. None of those vary by domain.

What is not here is everything that names a Foundry's own world — its kinds, its slug map, its
validators, its renderers. A caster composes those with these.

```ts
import {
  bundleDir,
  castsTargetDir,
  reconcileText,
  recordedHash,
  PROVENANCE_SCHEMA_VERSION,
} from '@galaxy-foundry/cast';

const targetDir = castsTargetDir(repoRoot, 'claude');
const bundle = bundleDir(targetDir, 'summarize-nextflow');

const drift = reconcileText({
  path: path.join(bundle, 'SKILL.md'),
  expected: renderSkill(mold), // yours
  label: 'SKILL.md',
  check: args.check,
});

if (drift.reason) console.error(drift.reason);
entry.dst_hash = recordedHash(drift, args.check);
```

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

## Install

```sh
npm install @galaxy-foundry/cast
```

## License

MIT
