---
'@galaxy-foundry/cast': minor
---

Casting every Mold is casting's job, not each Foundry's.

Both Foundries had written "re-cast every Mold, fail if anything moved" — one as a shell loop in
a Makefile, one as TypeScript reading `process.exitCode` after each iteration — and they disagreed
on output, on enumeration, and on what an uncast Mold means. Three of those disagreements were
accidents of the same cause: both built the sweep by invoking the single-Mold command N times, and
inherited its per-run reporting N times over.

```ts
const result = await castSweep(spec, { molds, target: 'claude', root });
const verdict = sweepReport(result, {
  repoRoot,
  check: true,
  remediation: ["Drift is fixed by 'make casts' + commit;", 'an error is fixed at the source.'],
});
```

`castSweep` calls `castMold` directly and returns what it found; `sweepReport` turns that into
lines and an exit code. Same split as `castCommand`/`castReport`, and for the same reason — the
interesting decision is a value a test can read rather than something only visible on stdout.

**Which Molds are swept is the instance's**, so `molds` is an argument. A Foundry that requires
every Mold to be cast passes its Mold slugs; one that checks only what it has already cast passes
its bundle names. That difference is real and stays declared rather than implied by which
directory a loop happened to read.

**Silent on success under `check`.** One `clean` line per Mold buries the run that matters in the
forty-six that do not, and a gate that passes has said everything by exiting zero. Single-Mold
`castReport` still says `clean: no drift, no errors`, where silence would be ambiguous — the
difference is the number of runs, not the convention. A failing Mold names itself and indents its
findings, and `remediation` follows them once, in the instance's own vocabulary.

Drift counts as failure only under `check`. A write run reports drift while removing it — every
first cast of a Mold drifts against the bundle it does not have yet — so weighing it the same way
would fail every cast-all of a corpus that had never been cast.

## Also exported, because the sweep needed them split out

`prepareCast` reads the target, the contract and the corpus once; `castOne` casts one Mold against
the result. The target and contract are properties of the repository, not of any one Mold, and
reading them per Mold is how a sweep ends up doing forty-seven times the work. `castCommand` is
now these two plus `castReport`, so there is one path rather than a second one beside it.

`MoldSourceError` is thrown when a named Mold has no usable source, because the two callers
disagree about what that means: to `castCommand` it is a usage error and exits 2, to `castSweep`
it is one bad entry the other Molds survive.

Not breaking: nothing that existed changed shape or behaviour.
