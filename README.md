# foundry-lib

Shared substrate packages for [Foundry-pattern](https://github.com/galaxyproject/foundry-pattern)
instances, published under the `@galaxy-foundry` npm scope.

## What lives here

A Foundry instance is a knowledge base with a frontmatter contract, a set of controlled
registries, a validator, and a static site. Two instances exist today —
[galaxyproject/foundry](https://github.com/galaxyproject/foundry) (Galaxy Workflow Foundry) and
[jmchilton/statistical-genomics-foundry](https://github.com/jmchilton/statistical-genomics-foundry)
— and standing up the second one taught which parts of that machinery genuinely transfer.

This repo holds the parts that transfer. Neither instance can host them: an instance depending
on a sibling instance would contradict the pattern's central claim and couple two unrelated
release cadences.

| Package                                                     | Status                                                           |
| ----------------------------------------------------------- | ---------------------------------------------------------------- |
| [`@galaxy-foundry/license-policy`](packages/license-policy) | The shared license → redistribution-policy table, and its loader |

## What does not live here

Some things look shared and are not, and the evidence says so:

- **The base note envelope.** One instance carries 13 fields, the other carries one. The gap is deliberate — backfilling a `created` date across a corpus you did not author today manufactures provenance rather than recording it.
- **The kind schemas.** Only `mold` and `pattern` are common to both instances at all, and even those differ threefold in size.
- **License _coherence_ rules.** The two instances enforce genuinely different rules. See [the package README](packages/license-policy#what-this-package-does-not-do).

The rule this repo follows: a thing moves here once two instances have independently arrived
at it, not because it seems like it should be shared. Abstracting from N=1 is how you ship a
shared decision nobody has taken.

## Development

```sh
pnpm install
pnpm test        # per-package vitest
pnpm typecheck   # tsc, sources and tests
pnpm build       # tsc, topological across the workspace
pnpm smoke       # pack each package, unpack it, import it, exercise it
pnpm format      # prettier
```

`pnpm smoke` is the one that catches what nothing else does. The `files` field of a
`package.json` is never exercised by a test or a typecheck, so a package can pass everything
locally while shipping a tarball that is missing an asset it reads at runtime.

## Releasing

Changesets. A PR that changes a package carries a `.changeset/*.md` describing the impact;
merging to `main` opens a "Version Packages" PR; merging _that_ publishes to npm with
provenance and tags the release.

```sh
pnpm changeset          # describe your change
```

There is no npm token — CI authenticates to npm via OIDC trusted publishing. See
[docs/publication.md](docs/publication.md), including the one-time laptop stub publish a
brand-new package needs before trusted publishing can be configured for it.

## License

MIT
