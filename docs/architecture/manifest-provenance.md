# Manifest provenance

Manifest provenance is split because no single participant can know every source fact at the
right time.

## The lifecycle

```text
producer repository
  resolves local schemas
  declares repo + path
  builds and commits manifest
            |
            | fetch at immutable commit
            v
consumer repository
  parses untrusted manifest
  records fetched revision
  renders catalog or comparison
```

## Producer facts

The producer declares:

- `instance`: its stable cross-instance slug;
- `source.repo`: the repository it owns; and
- `source.path`: where the generated manifest lives.

Those values are committed with the artifact and remain deterministic across builds.

## Why the producer omits revision

A generated file cannot carry the commit that contains itself. Adding the current `HEAD`
before committing creates a manifest that becomes stale as soon as the commit is made.

It also defeats a regeneration gate: CI at the new commit would regenerate a different
revision than the bytes committed by the previous working tree.

## Consumer facts

The consumer knows which revision it resolved and fetched. It attaches that immutable commit
with `withRevision` after successful parsing.

This preserves a useful distinction:

- **identity** says who published the manifest and where;
- **observation** says which exact snapshot a consumer used.

## Immutability

`withRevision` returns a new manifest instead of mutating parsed input. A consumer can retain
the producer declaration, compare snapshots, or attach different revisions in tests without
sharing mutable state.

## Failure posture

Provenance is incomplete when a consumer cannot resolve the source revision or the manifest's
declared source does not match the fetched location. Treat that as an ingestion error rather
than rendering unattributed data.

See [Produce a kind manifest](guides/producing-kind-manifests.md) and
[Consume a kind manifest](guides/consuming-kind-manifests.md) for implementation sequences.
