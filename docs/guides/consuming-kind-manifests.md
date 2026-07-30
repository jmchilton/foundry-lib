# Consume a kind manifest

A catalog or comparison site reads manifests from repositories it does not control. Validate
the payload before rendering it and record exactly which revision supplied it.

## 1. Fetch a pinned snapshot

Resolve a branch or tag to a commit, then fetch the manifest at that immutable revision. Keep
the revision beside the response; it belongs to the consumer's observation, not the
producer's file.

## 2. Parse untrusted JSON

```ts
import { parseKindManifest } from '@galaxy-foundry/kind-manifest';

const parsed = parseKindManifest(JSON.parse(responseText));
```

Parsing enforces field types, layer values, note shape, companion vocabulary, source shape, and the
supported format version. Do not replace it with a TypeScript cast: casts disappear at runtime and
turn malformed input into a broken catalog.

## 2a. Render a companion declaration faithfully

A kind's layout arrives beside its fields. Two of the values are easy to collapse into the same
blank cell, and they say different things:

| you read                        | it means                                | render     |
| ------------------------------- | --------------------------------------- | ---------- |
| `companions: [...]`             | the kind declares these                 | the list   |
| `companions: []`                | the kind declares none, as an assertion | "none"     |
| `additionalCompanions: 'allow'` | the set is deliberately open            | "open set" |

Rendering an open set as empty is the one to avoid: the kinds carrying that flag are the ones a
reader can plainly see have companions.

The reader requires `shape` and `companions`, so there is no third "the producer did not say" state
to handle. That is deliberate — a catalog that had to distinguish it would eventually stop.

## 3. Attach the fetched revision

```ts
import { withRevision } from '@galaxy-foundry/kind-manifest';

const snapshot = withRevision(parsed, resolvedCommit);
```

`withRevision` returns a new manifest value. It does not mutate the producer's parsed
declaration.

## 4. Preserve source attribution

The final source record combines facts known by two parties:

| Field      | Declared by | Meaning                             |
| ---------- | ----------- | ----------------------------------- |
| `repo`     | producer    | repository that owns the instance   |
| `path`     | producer    | repository-relative manifest path   |
| `revision` | consumer    | immutable snapshot actually fetched |

Display or retain all three so readers can trace catalog data back to its exact source.

## 5. Fail closed

Treat these as ingestion failures:

- invalid JSON;
- a malformed manifest;
- a format version newer than the consumer supports;
- a source path that does not match the fetched resource; or
- a revision that cannot be resolved.

Do not guess how a newer version should be interpreted. Upgrade the package, review the
format change, then ingest again.

## 6. Test the consumer

Use fixtures for:

- one valid manifest;
- a missing required field;
- an invalid layer;
- an unsupported version; and
- a valid manifest with the consumer revision attached.

See [Manifest provenance](architecture/manifest-provenance.md) for why the ownership split is
part of the format rather than merely an implementation detail.
