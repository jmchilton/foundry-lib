# Publication

Packages here publish to the `@galaxy-foundry` npm scope from CI. **There is no npm
token in this repo, and there should never be one.** Authentication is OIDC trusted
publishing: npm trusts a specific repo/workflow/environment triple, and mints a
short-lived credential for that run only. Nothing long-lived exists to leak or rotate.

## The flow

1. A PR that changes a published package carries a `.changeset/*.md` describing the
   impact. CI's `changeset` job fails the PR if it doesn't — a package change with no
   changeset merges green and then ships nothing, which is a silent failure that only
   surfaces when someone wonders why the fix isn't on npm.
2. On merge to `main`, `.github/workflows/release.yml` collects the pending changesets
   and opens a "Version Packages" PR bumping versions and writing changelogs.
3. Merging _that_ PR runs the workflow again — no changesets pending, versions already
   bumped — so it publishes to npm with provenance and cuts GitHub releases.

The workflow gates the publish on `typecheck`, `build`, `test`, and `smoke`. `smoke` is
the one that matters at this step: it packs each package, unpacks the tarball somewhere
clean, and imports it. The `files` field is the one part of a package that nothing else
exercises, so a package can pass everything and still ship a tarball missing an asset it
reads at runtime.

## Publishing a package for the first time

Trusted publishing is configured on a package's npm settings page, and that page does
not exist until the package does. So the first version of any new package has to come
from a laptop.

### 1. Stub publish

```sh
pnpm install
pnpm --filter @galaxy-foundry/<pkg> build

npm login   # if you aren't already
cd packages/<pkg>
pnpm publish --no-git-checks --no-provenance --tag stub
```

- `--no-provenance` because provenance needs an OIDC token, which only exists inside
  Actions. It overrides the `publishConfig.provenance: true` in the package.
- `--tag stub` so this throwaway version never becomes `latest`. The next automated
  release publishes the real version and takes `latest` with it.
- `--no-git-checks` because the working tree at `0.0.0` isn't at a release tag.

Publish in dependency order if one package depends on another via `workspace:*`.

### 2. Configure the trusted publisher

On `https://www.npmjs.com/package/@galaxy-foundry/<pkg>` → Settings → Trusted Publishers:

| Field       | Value                   |
| ----------- | ----------------------- |
| Provider    | GitHub Actions          |
| Repository  | `jmchilton/foundry-lib` |
| Workflow    | `release.yml`           |
| Environment | `npm-publish`           |

The environment must match `environment: npm-publish` in `release.yml`. Renaming it in
the workflow without updating every package's entry here breaks the publish.

### 3. Let CI take it from there

Add a `.changeset/*.md` naming the package. Merge; the Version Packages PR opens; merge
that; it publishes.

### A 404 right after the first publish is expected

For a few minutes to an hour after a package's first real publish, `npm view` and
`npm install` will 404 on it while the version endpoint
(`registry.npmjs.org/<pkg>/<version>`) returns full metadata. The publish worked.

Changesets runs `npm info <pkg>` immediately before publishing to decide whether the
version is new; for a package that doesn't exist yet that 404s, and the CDN caches the 404. Nothing to do but wait for it to expire. Check `npm dist-tag ls <pkg>` — it hits a
different endpoint and answers truthfully.

## Repository settings this depends on

- **Settings → Actions → General → Workflow permissions → "Allow GitHub Actions to
  create and approve pull requests."** Without it the Version Packages PR never opens.
  The branch still gets pushed, so the failure looks like a publish problem; it isn't.
  The workflow-level `pull-requests: write` does _not_ override this — it's a separate
  repo-level switch.
- **An `npm-publish` environment.** It carries no protection rules; it exists so npm has
  a stable name to bind trust to. Adding a required reviewer to it later would turn
  every publish into a manual approval, which may be what you want eventually.

## Why not a token

A granular npm token is a bearer credential sitting in repo secrets with a months-long
expiry, readable by any workflow in the repo. Trusted publishing replaces it with a
claim npm verifies against a triple it was told to trust, valid for one job. It also
means provenance is attested rather than asserted — the npm page shows which commit and
which workflow run built the tarball.
