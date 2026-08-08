# @galaxy-foundry/license-policy

The shared **license → redistribution-policy table** for Foundry-pattern instances, and the
loader for it.

A Foundry's corpus is largely notes derived from other people's work, so every note carries a
`license` and every casting decision has to answer one question: _what may we redistribute,
and in what form?_ This package holds the table that answers it.

## Why it is a package

Two instances — [galaxyproject/foundry](https://github.com/galaxyproject/foundry) and
[jmchilton/statistical-genomics-foundry](https://github.com/jmchilton/statistical-genomics-foundry)
— kept byte-identical copies of this 268-line table, differing only in a comment naming the
other repo, under a file header instructing everyone to _"edit both by hand."_ The neighbouring
file they inherited the same way, `reference_contract.yml`, shows what that instruction is
worth: its key sets still match, but five of its eleven inherited rows had quietly drifted in
wording, and nothing detected it.

Installing a table is harder to get wrong than mirroring one.

## Install

```sh
npm install @galaxy-foundry/license-policy
```

## Use

```ts
import {
  bundledPolicy,
  isValidLicenseId,
  resolveLicenseRow,
  declaresVerbatimCarry,
} from '@galaxy-foundry/license-policy';

const policy = bundledPolicy();

isValidLicenseId(policy, 'CC-BY-4.0'); // true
isValidLicenseId(policy, 'LicenseRef-msmb'); // true — the escape hatch
isValidLicenseId(policy, 'Made-Up-1.0'); // false

const row = resolveLicenseRow(policy, 'CC-BY-NC-4.0');
row.policy; // 'own-words-only' — its text may not be carried into a cast at all

// ...but only pass-through content is governed. Your own summary of that paper is your prose.
declaresVerbatimCarry('own-words-summary'); // false — out of scope
declaresVerbatimCarry('faithful-summary-with-quotes'); // true — the row applies

// An unknown or missing id lands on the default row: own-words-only, `defect: true`.
resolveLicenseRow(policy, 'typo').defect; // true
resolveLicenseRow(policy, 'typo').name; // 'unresolved / missing'

// An uncurated LicenseRef keeps that conservative answer — its terms are unknown too — but is
// named after itself, because the licence IS resolved. Curating a row overrides this.
resolveLicenseRow(policy, 'LicenseRef-yale-non-commercial').defect; // true
resolveLicenseRow(policy, 'LicenseRef-yale-non-commercial').name; // 'yale-non-commercial'
```

Functions take the policy as their first argument rather than reading module state, so a kind
schema can be tested against a synthetic table instead of the real one.

### Reading a table from a repo

Instances migrating away from a vendored copy, or tools operating on a checkout, can read the
table off disk instead:

```ts
import { loadLicensePolicy, findLicensePolicyPath } from '@galaxy-foundry/license-policy';

const policy = loadLicensePolicy('/path/to/instance-repo');
const file = findLicensePolicyPath(); // walks up from cwd
```

### Keeping a local copy honest

If an instance keeps `license-policy.yml` at its own repo root — for tools that read the file
directly, or during migration — one assertion keeps the copy from drifting:

```ts
import { readFileSync } from 'node:fs';
import { bundledPolicyText } from '@galaxy-foundry/license-policy';

it('has not drifted from the shared table', () => {
  expect(readFileSync('license-policy.yml', 'utf8')).toBe(bundledPolicyText());
});
```

That is the point of the package: "any change here is a cross-repo change" stops being a
comment nobody enforces and becomes a failing test in whichever instance has not bumped.

The raw file is also reachable directly, for non-JS consumers:

```
node_modules/@galaxy-foundry/license-policy/data/license-policy.yml
```

## What this package does _not_ do

It answers **"what does this license permit"**, never **"is this note coherent with its
license."**

Those coherence rules genuinely differ between the two instances today. One keys off a
recorded `derived` posture — rejecting a note that declares verbatim carry under an
own-words-only license. The other keys off the row alone — rejecting any own-words-only note
that ships a `license_file` at all. They are related, they are not the same rule, and neither
has been shown to be the one both instances want. Abstracting them here would be inventing a
shared decision nobody has taken.

When the rules converge, they can move here. Until then they stay where they are honest.

## API

| Export                                  | What it does                                                          |
| --------------------------------------- | --------------------------------------------------------------------- |
| `bundledPolicy()`                       | The shipped table, parsed. The default source of truth.               |
| `bundledPolicyText()`                   | Its raw bytes — for conformance-testing a local copy.                 |
| `bundledPolicyPath()`                   | Absolute path to the shipped `license-policy.yml`.                    |
| `parseLicensePolicy(text, source?)`     | Parse and fully validate a table. `source` names the file in errors.  |
| `loadLicensePolicy(repoRoot)`           | Read and validate `<repoRoot>/license-policy.yml`.                    |
| `findLicensePolicyPath(startDir?)`      | Walk up until a table is found.                                       |
| `licenseIds(policy)`                    | The curated SPDX ids — drives an instance's schema grammar.           |
| `isValidLicenseId(policy, id)`          | Curated id, or `LicenseRef-<slug>`.                                   |
| `resolveLicenseRow(policy, id)`         | Row for an id; unknown/missing → `default`, an uncurated ref → named. |
| `declaresVerbatimCarry(derived)`        | Whether a note's posture reproduces upstream expression.              |
| `LICENSE_POLICY_FILE`, `LICENSE_REF_RE` | The conventional filename and the escape-hatch pattern.               |

Types: `LicensePolicy`, `LicenseRow`, `RedistributionPolicy`.

### The license texts themselves

A `license_file: true` row obliges an instance to carry a verbatim copy, conventionally at
`LICENSES/<source>.LICENSE`. These read those copies so a site can render license terms in-app
rather than bouncing the reader out to GitHub.

| Export                                                 | What it does                                       |
| ------------------------------------------------------ | -------------------------------------------------- |
| `loadLicenseFiles(licenseDirectory)`                   | Every `*.LICENSE`, filename-sorted, with its text. |
| `findLicenseFileById(licenseDirectory, licenseFileId)` | One by its file id, or `undefined`.                |
| `licenseFileIdFromPath(path)`                          | `LICENSES/nf-schema.LICENSE` → `nf-schema`.        |
| `LICENSE_FILE_EXTENSION`                               | `.LICENSE`.                                        |

The directory is a parameter rather than a resolved `../LICENSES`, because the callers are
Astro pages whose cwd is a subdirectory — an implicit relative path is the one thing that
does not survive being shared.

Types: `LicenseFile`, `LicenseFileId`.

### Two ids, and they are not interchangeable

| Type            | Is                                | Looks like          | Comes from               |
| --------------- | --------------------------------- | ------------------- | ------------------------ |
| `LicenseId`     | a **licence**                     | `MIT`, `CC-BY-4.0`  | a note's `license:`      |
| `LicenseFileId` | a **vendored copy** of some terms | `msmb`, `nf-schema` | a note's `license_file:` |

A `LicenseFileId` names the **source** whose licence text was vendored, never the licence:
`msmb.LICENSE` holds CC-BY-NC-SA-2.0. Two sources under one licence vendor two files and get two
ids; a note under MIT that vendors nothing has none at all.

Both were spelled `licenseId` until a route compared one against the other. Nothing enforces the
distinction at runtime — both are strings off a filesystem — so `findLicenseFileById` handed a
`LicenseId` returns `undefined`: not an error, not the wrong file, a silent miss that reads as
"this source vendored nothing".

## The table

`version: 1`, 23 curated SPDX rows plus a deny-by-default `default` row, and five
`global_rules` that apply across every row. Each row declares:

| Field          | Meaning                                                      |
| -------------- | ------------------------------------------------------------ |
| `policy`       | `verbatim-ok` or `own-words-only`                            |
| `license_file` | Whether a verbatim `LICENSES/` copy must accompany the carry |
| `copyleft`     | Whether the isolate-in-its-own-file obligation applies       |
| `obligations`  | What honoring the license actually requires                  |

Parsing is strict: both enums are closed, every field is checked, and an unknown value is an
error rather than a silently-ignored key. A published table is a contract, and a row that is
merely well-formed YAML can still authorize a carry nobody intended.

Three invariants are asserted against the shipped table on every run — a verbatim-ok row always
demands a notice, an own-words-only row never requires a `license_file` (nothing is
redistributed, so there is no notice to carry), and no row names a casting transform at all.
The last is asserted rather than merely deleted, so the column cannot come back one row at a
time.

## Provenance

The table materializes the decision taken in
[galaxyproject/foundry-pattern#4](https://github.com/galaxyproject/foundry-pattern/issues/4),
backing the guiding principle _"Redistributed Content Carries Its License."_

**Engineering policy, not legal advice.** The rows encode the discipline these projects chose;
genuinely novel or high-stakes licenses deserve real review before verbatim redistribution.

## License

MIT
