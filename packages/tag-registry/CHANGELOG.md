# @galaxy-foundry/tag-registry

## 0.1.0

### Minor Changes

- [#8](https://github.com/jmchilton/foundry-lib/pull/8) [`d689d15`](https://github.com/jmchilton/foundry-lib/commit/d689d15c6a8600fbd0c0a132806a8ee60464f6d6) Thanks [@jmchilton](https://github.com/jmchilton)! - New package: the `meta_tags.yml` format every Foundry-pattern instance shares — parser,
  validator, and the accessors a schema, a validator and a browse surface need.

  Ships no vocabulary. Facets are the browse axes of one domain — one instance groups by
  `source`/`target`/`tool`, the other by `family`/`role`/`domain`, and only `topic` even
  collides by name — so there is no subset worth inheriting. What is shared is the format and
  the three rules that make it work, which both instances had independently arrived at and
  written down in near-identical prose without either enforcing them in code.

  `parseTagRegistry` now enforces them. A tag with no gloss is refused, because a tag the
  browse surface cannot document is exactly what the closed-enum rule exists to prevent. A tag
  declared by two facets is refused, naming both, because membership is decided by declaration
  and two declarations leave no single declaring facet for `facetOf` to answer with. Neither
  instance validated anything before this: both did `yaml.load(...) as TagRegistryFile` and
  discovered a malformed registry as an undefined somewhere downstream.

  Membership stays declared rather than parsed off the `/` prefix, so a bare key is an ordinary
  member and a facet may declare a tag whose text looks nothing like the facet's name. That is
  the rule the browse surface rests on — it makes an "other" bucket impossible rather than
  merely empty — and it could not be proven against either instance's real registry, because
  both happen to have entirely slashed vocabularies. It is proven here against synthetic ones.
