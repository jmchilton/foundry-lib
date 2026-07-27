# @galaxy-foundry/tag-registry

The `meta_tags.yml` format every Foundry-pattern instance shares: parser, validator, and the
accessors a schema, a validator and a browse surface need.

**This package ships no vocabulary.** Facets are the browse axes of one domain — the Galaxy
Workflow Foundry groups by `source`/`target`/`tool`, the Statistical Genomics Foundry by
`family`/`role`/`domain` — and there is no useful subset to inherit. What is shared is the
format and the three rules that make it work.

```sh
npm install @galaxy-foundry/tag-registry
```

```ts
import { loadTagRegistry } from '@galaxy-foundry/tag-registry';

const tags = loadTagRegistry('meta_tags.yml');

tags.isValidTag('target/galaxy'); // true
tags.facetOf('target/galaxy'); //   'target'
tags.tagDescription('target/galaxy'); // 'Galaxy-specific material.'
tags.facets(); //                   [{ key, label, description }, …] in declared order
tags.allTags(); //                  every registered tag, in declaration order
```

## The format

```yaml
version: 1
facets:
  target:
    label: Target
    description: The platform a note is about.
    values:
      target/galaxy: Galaxy-specific material.
```

`values` may be omitted while a facet is still empty. `version` is accepted and ignored.

## The three rules

**Membership is declared, never parsed off the `/` prefix.** A tag is valid because some
facet lists it under `values`. The slash in `target/galaxy` is a naming convention, so a bare
key like `meta` is an ordinary member — there is no flat-flag special case in the loader, the
schema, or the browse pages. A facet may equally declare a tag whose text looks nothing like
the facet's name.

**Every facet is a closed enum.** No open, free-form, or prefix-wildcard escape hatch, ever.
A tag with no gloss is a tag the browse surface cannot document and a reader cannot learn
from, so `parseTagRegistry` refuses one.

**Browse pages group by the declaring facet.** This is what makes an "other" bucket
impossible rather than merely empty — and it is why a tag declared under two facets is
refused: it would have no single declaring facet, and `facetOf` would answer with whichever
won the iteration.

The rules are specified in the Foundry Pattern
([`content/pattern/standing-up-a-foundry.instructions.txt`](https://github.com/galaxyproject/foundry-pattern/blob/main/content/pattern/standing-up-a-foundry.instructions.txt)).
Treat a format change as a cross-repo change.

## What this package does not do

It does not decide what a valid tag _means_ for a note — that `tags` is required, that a
minimum of one is carried, or that note-kind is never copied into `tags`. Those are schema
rules, and they live in each instance's note schema.

It does not check the registry against a corpus. A registered tag carried by zero notes is
dead vocabulary, but only an instance can see its own notes; that check belongs in the
instance's drift test.

## API

- **Loading**: `loadTagRegistry`, `findTagRegistryPath`, `parseTagRegistry`
- **Accessors**: `tagRegistry`, `buildTagIndex`
- **Types**: `TagRegistry`, `TagRegistryFile`, `Facet`, `FacetInfo`, `TagEntry`
- **Constant**: `TAG_REGISTRY_FILE`

## License

MIT
