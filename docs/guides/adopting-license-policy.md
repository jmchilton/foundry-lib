# Adopt the license policy

Replace a copied `license-policy.yml` with the published package so every instance reads the
same reviewed table.

## 1. Install the package

```sh
pnpm add @galaxy-foundry/license-policy
```

The raw YAML ships inside the package for non-TypeScript consumers, while TypeScript callers
should normally use the parsed value:

```ts
import { bundledPolicy } from '@galaxy-foundry/license-policy';

const policy = bundledPolicy();
```

## 2. Replace local parsing

Use package helpers rather than reproducing license grammar or fallback behavior:

```ts
import { bundledPolicy, isValidLicenseId, resolveLicenseRow } from '@galaxy-foundry/license-policy';

const policy = bundledPolicy();

export function checkDeclaredLicense(id: string) {
  if (!isValidLicenseId(policy, id)) {
    throw new Error(`Unsupported license id: ${id}`);
  }

  return resolveLicenseRow(policy, id);
}
```

`isValidLicenseId` accepts a curated SPDX identifier or the explicit
`LicenseRef-<slug>` escape hatch. `resolveLicenseRow` is intentionally more defensive:
unknown or missing values return the default row with `defect: true`.

## 3. Keep coherence local

The policy row answers what redistribution modes a license permits. It does not know whether
an instance's note shape, derivation metadata, or sidecar files are internally coherent.

```ts
import { allowsMode } from '@galaxy-foundry/license-policy';

if (!allowsMode(row, reference.mode)) {
  issues.push(`${reference.mode} is not allowed by ${reference.license}`);
}
```

Build the rest of the validation from the instance's own schema. Do not move those rules into
this package until multiple instances have independently converged on the same behavior.

## 4. Migrate safely

If tooling still reads a root-level `license-policy.yml`, keep it temporarily and assert that
it has not drifted:

```ts
import { readFileSync } from 'node:fs';
import { bundledPolicyText } from '@galaxy-foundry/license-policy';

expect(readFileSync('license-policy.yml', 'utf8')).toBe(bundledPolicyText());
```

Remove the vendored copy only after every direct file reader has moved to the package or to
the package's exported raw file:

```text
node_modules/@galaxy-foundry/license-policy/data/license-policy.yml
```

## 5. Test the boundary

Cover at least these cases in the consuming instance:

- a curated permissive license;
- an own-words-only license;
- a valid `LicenseRef-<slug>`;
- an unknown identifier producing `defect: true`; and
- an instance-specific coherence failure.

The first four protect the shared contract. The last protects the local decision that remains
outside it.

For a broader extraction sequence, see
[Migrate a vendored contract](guides/migrating-vendored-contracts.md).
