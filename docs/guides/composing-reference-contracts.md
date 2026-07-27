# Compose a reference contract

Use `@galaxy-foundry/reference-contract` when a Foundry authors typed
`references[]` entries. The package supplies the four vocabularies that describe
casting machinery; the instance supplies the one vocabulary that describes its
domain.

Read the Foundry Pattern's
[Anatomy of an Instance](https://galaxyproject.github.io/foundry-pattern/pattern/anatomy-of-an-instance/)
first for the role typed references play in a Mold.

## 1. Install the package

```sh
pnpm add @galaxy-foundry/reference-contract
```

The package is an ES module for Node.js 20 or later. It includes its inherited
vocabulary as a runtime data file, so consumers do not copy that YAML into their
repository.

## 2. Keep only kinds in the instance

Create `reference_contract.yml` at the instance root:

```yaml
kinds:
  pattern:
    label: Pattern
    description: A domain pattern page.
    ref_shape: wiki-link
  schema:
    label: Schema
    description: A repository-relative schema file.
    ref_shape: path
```

`ref_shape` may be `wiki-link` or `path`. The file must not declare `used_at`,
`load`, `modes`, or `evidence`; those groups come from the package. The loader
rejects a local copy so hand-mirroring cannot quietly return.

## 3. Compose the complete contract

```ts
import {
  buildReferenceContract,
  contractKeys,
  findReferenceContractPath,
  loadInstanceKinds,
} from '@galaxy-foundry/reference-contract';

const kindsPath = findReferenceContractPath();
const contract = buildReferenceContract({
  kinds: loadInstanceKinds(kindsPath),
});

const referenceKinds = contractKeys(contract, 'kinds');
const castModes = contractKeys(contract, 'modes');
```

Use the resulting keys to drive schema enums, validation messages, documentation,
and browse surfaces. Do not recreate parallel arrays of valid values.

`findReferenceContractPath()` walks upward from a directory. Pass an explicit path
to `loadInstanceKinds()` when the repository layout or execution context makes that
clearer.

## 4. Narrow only real capability

Inheritance is the default. An unused term is not necessarily drift: it may be
capacity the instance has not exercised yet.

Narrow a group only when supporting a term would claim machinery the instance
deliberately does not have. For example, a deterministic caster can decline the
LLM-backed `condense` mode:

```ts
const contract = buildReferenceContract({
  kinds: loadInstanceKinds(kindsPath),
  narrow: {
    modes: ['verbatim', 'sidecar'],
  },
});
```

The builder preserves the package's declared order, rejects unknown terms, and
refuses an empty group. `kinds` cannot be narrowed because the instance already
owns it directly.

## 5. Keep cross-field rules local

The shared vocabulary describes three coherence rules:

- `load: on-demand` requires a `trigger`;
- `evidence: hypothesis` requires a `verification`; and
- `mode: verbatim` requires a license that permits verbatim carry.

The package does not validate a complete reference entry because it does not own an
instance's note schema. Enforce the first two rules in the instance validator. For
the third, combine the selected mode with
[`@galaxy-foundry/license-policy`](guides/adopting-license-policy.md).

## 6. Test the boundary

An instance integration should prove:

- every `references[]` vocabulary value comes from the composed contract;
- the local YAML contains `kinds` and no inherited group;
- each kind has the intended `ref_shape`;
- any deliberate narrowing matches actual caster capability;
- all cross-field rules fail with useful source locations; and
- generated schema or documentation artifacts are current.

If a vendored full contract existed before adoption, keep a temporary equivalence
test while moving readers to the package. Delete the inherited blocks only after no
code path reads them.

See [Migrate a vendored contract](guides/migrating-vendored-contracts.md) for the
cross-repository sequence and the
[generated API](api/typedoc/index.html ':ignore') for every export.
