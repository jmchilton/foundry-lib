# @galaxy-foundry/content-reader

## 0.4.0

### Minor Changes

- [#133](https://github.com/jmchilton/foundry-lib/pull/133) [`788716e`](https://github.com/jmchilton/foundry-lib/commit/788716e78a93239c60aa8a8a1c4d1f2fa890764d) Thanks [@jmchilton](https://github.com/jmchilton)! - Report wiki-link addresses that more than one note claims.

  A note's primary address is its collection-relative id, flattened and slugified, so two notes reach the same address without sharing a path — `a/b.md` and `a-b.md`, or a flat note and a directory note of the same name in another collection. Which one keeps it was already settled and tested: the later collection wins, and both notes stay routed. What nothing said was that it had happened, so the loser was a published page no `[[...]]` could reach and no build reported.

  `ContentIndex` now carries `duplicateAddresses`: one entry per contested address, listing every claimant in routing order, the last of which holds it. Resolution is unchanged — this is a fact the reader now surfaces, not a policy it enforces. Whether a corpus may contain an unaddressable note stays the instance's call, alongside `targetOf` and `aliases`.

## 0.3.1

### Patch Changes

- Updated dependencies [[`4fbd78a`](https://github.com/jmchilton/foundry-lib/commit/4fbd78aa7f224e189112922729137c2e2a096372)]:
  - @galaxy-foundry/kind-schema@0.6.0

## 0.3.0

### Minor Changes

- [#97](https://github.com/jmchilton/foundry-lib/pull/97) [`a08a333`](https://github.com/jmchilton/foundry-lib/commit/a08a333295e5dd3f818fec7f5b529cd6976dc994) Thanks [@jmchilton](https://github.com/jmchilton)! - Expose `contentIndex()`: one deterministic collection-backed note list plus an alias-aware address
  map pointing to the same source records. Build-time consumers such as casters can now derive source
  paths and parsed frontmatter from the reader's existing walk instead of maintaining a second content
  index and duplicate alias precedence.

## 0.2.1

### Patch Changes

- [#86](https://github.com/jmchilton/foundry-lib/pull/86) [`f9eef81`](https://github.com/jmchilton/foundry-lib/commit/f9eef81c1f74fb3380ebe6a5342b79d77ea05a93) Thanks [@jmchilton](https://github.com/jmchilton)! - Expose every collection-backed note through `noteTargets()`, preserving colliding routes before
  wiki-link aliases and address precedence are applied. Instances can now derive built-page coverage
  from the same route policy used by the reader instead of maintaining a hand-written route list.

## 0.2.0

### Minor Changes

- [#77](https://github.com/jmchilton/foundry-lib/pull/77) [`62aa2bd`](https://github.com/jmchilton/foundry-lib/commit/62aa2bd276f037fd30871c6962edbfe9f71d8307) Thanks [@jmchilton](https://github.com/jmchilton)! - Extract the collection-backed content-reading plumbing and invariant note frame proven by the
  Statistical Genomics Foundry so new Foundry instances do not grow independent Astro infrastructure.

  `@galaxy-foundry/content-reader` owns filesystem enumeration from a collection table, note-id
  derivation, collection-backed wiki-link maps, and the remark/raw-Markdown bindings over that map.
  Instances keep their schema assembly, routing policy, registries, domain model, and alias
  vocabulary. Optional alias derivation reads routed-note frontmatter once and makes it available to
  route targets for summary tooltips, while readers without aliases retain the directory-only path.

  `@galaxy-foundry/site-kit` gains `ContentNote.astro` and `TagChips.astro`. The note frame provides
  semantic slots for instance metadata, badges, references, and prose while keeping package facts,
  source attribution, Mold state, and all other domain furniture outside the package.
