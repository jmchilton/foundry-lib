---
'@galaxy-foundry/cast': minor
---

Reconcile a file, or a subtree, to ABSENT.

`reconcile` answers "does this file match what we would write?", and had no way to say "this
file should not be there at all" — there is no expected content to hash. So every caller that
needed it hand-rolled the same three lines: exists, check, unlink. The flagship had two, and
its own comment named the gap.

`reconcileAbsent` is the single-file form. `reconcileTreeTo` is the sweep: reduce a subtree to
exactly the files a manifest declares, reporting whatever else was there. `listFilesUnder` comes
along because the sweep needs it and a bundle is not the only tree worth listing.

Absent is the desired state, so arriving at it is silent — reporting would make every cast that
declares no tools announce a stale manifest it never had. A `check` run reports and changes
nothing, including leaving empty directories alone, since pruning on a check run mutates a tree
the check promised not to touch and does so invisibly, because empty directories are not listed
files.

`reconcileTreeTo` takes the subtree as an argument rather than assuming the bundle root. A
bundle holds things a cast never wrote — harvested run output, a note a human added — and a
sweep scoped to the whole bundle would delete them.

Returns `Absence` rather than `Drift`. A file that should not exist has no expected hash, and
widening `Drift.expectedHash` to null would push an impossible case onto every caller that reads
it, to describe a state none of them produce.
