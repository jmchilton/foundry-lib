# @galaxy-foundry/reference-contract

The typed-reference vocabulary a Foundry Mold's `references[]` entries draw from.

A reference entry names five things — its `kind`, when it is `used_at`, how it is `load`ed,
which cast `mode` applies, and what `evidence` backs it. **Four of those five are the same in
every Foundry**, because they describe the compilation machinery, which does not vary by
domain. Those four ship here.

`kinds` does not, deliberately. Which reference kinds exist is exactly what _does_ vary: one
instance authors `cli-tool` and `schema` refs; another authors neither and would be declaring
dead vocabulary by inheriting them. The instance supplies its own.

```ts
import {
  buildReferenceContract,
  loadInstanceKinds,
  contractKeys,
} from '@galaxy-foundry/reference-contract';

const contract = buildReferenceContract({
  kinds: loadInstanceKinds('reference_contract.yml'),
});

contractKeys(contract, 'modes'); // ['verbatim', 'condense', 'sidecar'] — inherited
contractKeys(contract, 'kinds'); // whatever your instance declares
```

After adopting this, an instance's `reference_contract.yml` holds **only** `kinds`. The
loader refuses a file that re-declares an inherited block, and `parseInheritedVocabularies`
refuses a shared table that declares `kinds` — the boundary is enforced in both directions,
because it is the kind of split that otherwise decays quietly.

## The glosses

The two instances that had independently written these vocabularies had drifted on five
descriptions. They were reconciled here, and the more specific reading won every time.

Three of them name a rule that **both** instances' validators already enforce but only one had
written down:

| Term                  | The rule it now states             |
| --------------------- | ---------------------------------- |
| `load.on-demand`      | Requires a `trigger`               |
| `evidence.hypothesis` | Requires a `verification`          |
| `modes.verbatim`      | License must permit verbatim carry |

The other two were one instance's specifics leaking into shared vocabulary — an
implementation-status caveat on `modes.condense`, and `evidence.corpus-observed` describing
"real workflows" where the domain-neutral "real sources" is what a cross-instance vocabulary
needs. A test asserts the shipped prose names no instance's domain.

## Scope

This package says what the vocabulary **is**. It does not enforce the cross-field rules the
terms describe — that lives in each instance's validator, against its own note schema, and the
licence half needs [`@galaxy-foundry/license-policy`](https://www.npmjs.com/package/@galaxy-foundry/license-policy)
besides.

## `spec_url`

The shipped table carries one `spec_url`, applied by the loader to every term's `href`, rather
than repeating the same link twelve times in data.

It is currently a **repository** URL, not a site URL, because foundry-pattern's hosting is not
finalized — its `astro.config.mjs` still carries placeholder `site`/`base` values. Point it at
the rendered page, with a per-term anchor, once that lands.
