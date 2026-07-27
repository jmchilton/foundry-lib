# Adopt the tag registry

Use `@galaxy-foundry/tag-registry` to parse and query an instance's
`meta_tags.yml`. The package owns the format and its invariants; the instance owns
every facet and tag.

This split follows the Foundry Pattern's
[Setting up a Foundry](https://galaxyproject.github.io/foundry-pattern/pattern/setting-up-a-foundry/):
shared machinery stays inherited while domain vocabulary grows from the corpus.

## 1. Install the package

```sh
pnpm add @galaxy-foundry/tag-registry
```

Unlike `reference-contract`, this package ships no YAML vocabulary. Keep
`meta_tags.yml` in the instance repository.

## 2. Declare facets and tags

```yaml
version: 1
facets:
  target:
    label: Target
    description: The platform a note is about.
    values:
      target/galaxy: Galaxy-specific material.
      target/cwl: CWL-specific material.
  meta:
    label: Meta
    description: Notes about the Foundry itself.
    values:
      meta: Process and convention notes.
```

Every facet needs a label and description. A facet may temporarily have no
`values`, but every declared tag needs a non-empty gloss. `version` is accepted and
currently ignored.

The text before `/` is a naming convention, not a parser rule. A bare key such as
`meta` is ordinary, and a tag belongs to whichever facet declares it.

## 3. Load once, then share the accessors

```ts
import { findTagRegistryPath, loadTagRegistry } from '@galaxy-foundry/tag-registry';

const tagsPath = findTagRegistryPath();
export const tags = loadTagRegistry(tagsPath);
```

`loadTagRegistry()` reads, validates, and wraps the file. Prefer one application
composition point over repeated reads in schemas, validators, and page builders.

Use `parseTagRegistry(text, source)` when the YAML is already in memory, and
`tagRegistry(file)` when tests or another loader already produced a parsed object.

## 4. Drive note validation from the registry

```ts
for (const tag of note.tags) {
  if (!tags.isValidTag(tag)) {
    throw new Error(`unregistered tag: ${tag}`);
  }
}
```

Exact declaration decides validity. Do not accept a tag merely because its prefix
resembles a facet. The parser also rejects the same tag under two facets because
`facetOf()` must have one answer.

Rules such as “a note carries at least one tag” or “note kind is not duplicated as
a tag” remain in the instance's schema and coherence validator.

## 5. Build browse surfaces from declarations

```ts
const browseFacets = tags.facets().map((facet) => ({
  ...facet,
  tags: tags.allTags().filter((tag) => tags.facetOf(tag) === facet.key),
}));
```

Declaration order is preserved for both facets and tags. Render
`tagDescription(tag)` beside a tag and `facetLabel(key)` for headings. Group by
`facetOf(tag)`, never by splitting the tag text; this makes an “other” bucket
impossible rather than merely empty.

## 6. Add corpus-level drift tests

The package can validate the registry but cannot see the instance's notes. Keep
local tests that prove:

- every note tag is registered;
- every registered tag is carried by at least one note, unless explicitly staged;
- browse pages include every declared facet and tag;
- descriptions shown to readers come from the registry; and
- schemas and editor completions are generated from `allTags()`.

When replacing a hand-written loader, run both implementations against the real
registry during migration. Include synthetic cases for bare tags and declarations
whose text does not match the facet, because a slash-only real registry cannot
prove declaration-based membership.

See [Migrate a vendored contract](guides/migrating-vendored-contracts.md) for the
broader extraction sequence and the
[generated API](api/typedoc/index.html ':ignore') for every export.
