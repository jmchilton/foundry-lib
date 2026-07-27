# @galaxy-foundry/kind-manifest

The shared kind-manifest format for [Foundry-pattern](https://github.com/galaxyproject/foundry-pattern)
instances: the types, a zod validator for reading one, and the deriver that turns a kind's
zod shape into its field table.

A kind manifest is what an instance publishes about its own kinds — enough that two
Foundries can be diffed by machine instead of by eye.

```json
{
  "instance": "galaxy-workflow-foundry",
  "version": 1,
  "kinds": [
    {
      "kind": "mold",
      "title": "Mold",
      "layer": "substrate",
      "summary": "…",
      "fields": [{ "name": "tags", "required": true, "type": "string[]" }]
    }
  ]
}
```

## Why this is a package

The format is declared shared by the pattern's own checklist — "the FORMAT is SHARED
ACROSS INSTANCES, the kinds in it are yours". It had **four** independent encodings: the
prose spec, a `kind-manifest.ts` in each of the two instances, and a fourth hand-written
copy of the types in the pattern site that consumes them.

The two instance copies were character-for-character identical apart from quote style,
and so were their test suites. That is not convergent evolution; that is one file living
in two places.

## The deriver

```ts
import { buildKindManifest } from '@galaxy-foundry/kind-manifest';

const manifest = buildKindManifest({
  instance: 'galaxy-workflow-foundry',
  kinds: KINDS.map((d) => ({
    kind: d.kind,
    title: d.title,
    layer: d.layer,
    summary: d.summary,
    shape: d.build(ctx).shape,
    doc: docs[d.kind],
  })),
  source: { repo: 'galaxyproject/foundry', path: 'types/kinds.generated.json' },
});
```

`fields` is **derived from the zod shape, never hand-written**. A hand-maintained
required-metadata table is a second encoding of the schema and drifts the first week;
this one cannot, because it is read off the same object the validator runs.

Note what the deriver does _not_ take: a context, a registry, or a schema factory.
Resolving a kind's schema needs an instance's registries and no two instances do it the
same way, so that step stays on the instance's side of the line. What transfers is what
happens to the shape once it exists.

`required` answers "must an author write this key", so a field carrying `.default()`
counts as optional — it validates without the author writing anything.

## The reader

```ts
import { parseKindManifest } from '@galaxy-foundry/kind-manifest';

const manifest = parseKindManifest(JSON.parse(await readFile(vendored, 'utf8')));
```

A cross-instance catalog consumes manifests it did not produce, from repos it does not
control, at revisions it did not choose. Casting the parsed JSON to an interface makes a
malformed manifest render a broken page instead of failing at the read. A manifest from a
_newer_ format version is rejected rather than guessed at.

## Provenance

`source` is split by who actually knows each fact.

```ts
// the producer declares its own identity
buildKindManifest({ ..., source: { repo: 'owner/name', path: 'types/kinds.generated.json' } });

// whoever vendors a copy records which snapshot they took
withRevision(manifest, 'abc1234');
```

The pattern site used to bolt all of this on after reading the file — literally
`manifest.source = {...}` in its vendoring script. That put the producer's identity in the
consumer's hands and turned vendoring into a mutation.

`revision` stays on the consumer's side for two reasons. It is the wrong party: `revision`
answers "which snapshot is this", which only whoever took the snapshot can say. And it is
structurally impossible for the producer — a manifest is a **committed** artifact whose CI
gate regenerates it and string-compares, so a file carrying the revision it was generated
at never matches the revision CI regenerates it at, and `--check` fails on every commit.
A test pins that: two builds of the same kinds are byte-identical.

## The zod pin

`describeType` reads `_def.typeName`, which is zod 3 internals, and `zod` is a
**peer dependency pinned to `^3.25`**.

This is deliberate rather than an oversight: zod exposes no public reflection API, and the
alternative — a hand-written field table beside each schema — is the second encoding this
package exists to prevent. zod 4 replaces `_def.typeName` entirely; the test suite fails
loudly rather than silently rendering every field as `any`.

The peer range also matters for a second reason: the deriver must read the _same_ zod
instance the schemas were built with. A duplicated zod in the tree renders every field
`any`.

## Why the tests are here

The pattern's checklist is explicit about why the manifest needs unit tests rather than a
regeneration gate:

> `--check` regenerates with the same code and string-compares, so a bug in the type
> renderer produces a wrong manifest that `--check` then blesses forever.

The gate can only catch a renderer that _changed_, never one that was always wrong. So the
renderer is exercised against synthetic shapes — optional, defaulted, effects-wrapped,
array-of-object, enum, literal, nullable, wide union — where a wrong answer is a wrong
answer regardless of what the corpus happens to contain. That suite previously had to be
written once per instance.

## API

| Export                                                                         | Purpose                                                      |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| `buildKindManifest(opts)`                                                      | Derive a manifest from kinds and their built shapes          |
| `withRevision(manifest, rev)`                                                  | Record the snapshot revision on a vendored copy              |
| `describeType(schema)`                                                         | Render one zod type as a short readable string               |
| `describeFields(shape)`                                                        | Walk an object shape into the field table, required first    |
| `parseKindManifest(data)`                                                      | Validate an untrusted manifest, throwing with the path named |
| `kindManifestSchema` and friends                                               | The zod schemas, for composing into a larger check           |
| `KIND_MANIFEST_VERSION`                                                        | The current format version                                   |
| `KindManifest`, `ManifestKind`, `ManifestField`, `ManifestSource`, `KindLayer` | Types                                                        |

## License

MIT
