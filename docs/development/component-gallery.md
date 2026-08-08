# The component gallery

Every case `@galaxy-foundry/site-kit` says its components handle, rendered twice: once under the
theme the documentation describes, and once under a theme with opinions.

[Open the minimum gallery](gallery/minimum/index.html ':ignore') ·
[Open the designed gallery](gallery/designed/index.html ':ignore')

## Why two

The kit ships no complete theme stylesheet. It names tokens and classes — `SHELL_TOKENS`,
`CONTENT_READER_TOKENS`, `REFERENCE_TOKENS`, `LICENSE_BADGE_TOKENS`, `LICENSE_FILE_TOKENS`,
`SHELL_CLASSES` — and every instance supplies the values. That makes a single gallery ambiguous in
the one way that matters: looking at a page, there is no telling which part came from the package
and which from whoever themed it.

So `minimum.css` defines **exactly** the documented names and nothing else, with plain values. Its
pages are therefore evidence rather than decoration: an instance that satisfies the documented list
gets what is on those pages, and anything rendering unstyled there is a name the documentation is
short. A test compares that stylesheet against the exported lists in both directions, so adding a
colour to make a page prettier fails the build — the ceiling is the point.

`designed.css` has no ceiling. Dark palette, per-kind accents, type and shadow. Everything that
differs between the two galleries is a decision the package did not make.

## Where the cases come from

`@galaxy-foundry/site-kit/specimens` — the props, the name, and the `why` for each case, shipped as
data. The gallery holds none of them. What it holds is which component renders which group, and it
throws at build time rather than rendering an empty section when the kit adds a group it has never
heard of.

Coverage runs the other way too: a test in the package compares the specimen groups against the
component directory, so a component that ships with no cases fails there rather than being noticed
here.

## Running it

```sh
pnpm --filter @galaxy-foundry/gallery dev
pnpm --filter @galaxy-foundry/gallery test   # builds first if the output is stale
```

`pnpm build` at the root builds it too, into `docs/gallery/`, which is why it deploys with these
pages rather than through a pipeline of its own.

## The one thing to know before editing

The app depends on the packages through the workspace, so Vite would inline them — and
`reference-contract` and `license-policy` each read a data file they ship beside, located relative
to their own module. Inlined, that path points inside the build's temporary directory and the build
dies on the first page that renders a specimen. `astro.config.mjs` keeps all three packages
external for that reason. An instance installing from npm never sees this; it is the cost of being
the repository that holds both halves.
