#!/usr/bin/env node
// Pack each package exactly as `npm publish` would, unpack the tarball somewhere
// clean, and import it.
//
// This exists because the `files` field is the one part of a package that no test
// and no typecheck exercises. Everything passes locally while `data/` is missing
// from the tarball; the failure lands on whoever installs it. So the check has to
// run against the artifact, not the source tree.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync, symlinkSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const packagesDir = path.join(root, 'packages');

// Each entry names an export the unpacked tarball must actually produce. A tarball
// that imports but exposes nothing is not a working package.
const SMOKE = {
  '@galaxy-foundry/license-policy': (mod) => {
    const policy = mod.bundledPolicy();
    if (!policy || policy.version !== 1)
      throw new Error('bundledPolicy() did not return the table');
    const ids = mod.licenseIds(policy);
    if (ids.length < 20) throw new Error(`only ${ids.length} licenses in the packed table`);
    if (mod.resolveLicenseRow(policy, 'no-such-id').defect !== true) {
      throw new Error('unknown id did not resolve to the defect row');
    }
  },
  '@galaxy-foundry/reference-contract': (mod) => {
    // `data/` has to be in `files` for this to resolve at all — the one thing only a packed
    // tarball can prove.
    const inherited = mod.bundledVocabularies();
    if (!inherited.load['on-demand']?.href) throw new Error('spec_url was not applied to terms');
    const contract = mod.buildReferenceContract({
      kinds: { pattern: { label: 'Pattern', description: 'd', ref_shape: 'wiki-link' } },
    });
    if (mod.contractKeys(contract, 'modes').length !== 3) {
      throw new Error('packed vocabulary did not carry the three cast modes');
    }
  },
  '@galaxy-foundry/tag-registry': (mod) => {
    // No bundled data here — the facet vocabulary is per-instance — so what this proves is
    // that the format rules survive packing, not that an asset shipped.
    const registry = mod.tagRegistry(
      mod.parseTagRegistry(
        'facets:\n  meta:\n    label: Meta\n    description: d\n    values:\n      meta: g\n',
      ),
    );
    // Membership is declared, not parsed off the `/` prefix — both halves of the rule.
    if (!registry.isValidTag('meta')) throw new Error('a bare key was not a valid tag');
    if (registry.isValidTag('meta/anything')) throw new Error('a tag was accepted by prefix');
    let refused = false;
    try {
      mod.parseTagRegistry(
        'facets:\n  a:\n    label: A\n    description: d\n    values:\n      x:\n',
      );
    } catch {
      refused = true;
    }
    if (!refused) throw new Error('packed parser accepted a tag with no gloss');
  },
  '@galaxy-foundry/wiki-links': async (mod, _peer, unpacked) => {
    // No bundled data — the link map is per-instance — so what this proves is that the
    // grammar survives packing, and that BOTH entry points are reachable from the tarball.
    const map = new Map([[mod.slugify('Summarize Nextflow'), { id: 'molds/summarize-nextflow' }]]);
    if (mod.resolveWikiLink('[[Summarize Nextflow]]', map)?.id !== 'molds/summarize-nextflow') {
      throw new Error('packed resolver did not match a slugified name');
    }
    // Exact only: the two corpus links prefix matching ever resolved were both bugs.
    if (mod.resolveWikiLink('[[summarize-next]]', map) !== undefined) {
      throw new Error('packed resolver fell back to a prefix');
    }
    if (mod.resolveWikiLink('[[...]]', map) !== undefined) {
      throw new Error('packed resolver resolved an empty slug');
    }

    // `./remark` is a second `exports` entry. Only a packed tarball proves it ships and
    // resolves — the source tree would import the file directly either way.
    const remarkEntry = path.join(unpacked, 'dist', 'remark.js');
    if (!existsSync(remarkEntry)) throw new Error('tarball has no dist/remark.js');
    const { default: remarkWikiLinks } = await import(pathToFileURL(remarkEntry).href);
    const tree = {
      type: 'paragraph',
      children: [
        { type: 'text', value: 'see [[foo]]' },
        { type: 'inlineCode', value: '[[foo]]' },
      ],
    };
    remarkWikiLinks({ resolve: () => ({ href: '/x' }) })(tree);
    if (tree.children[1]?.type !== 'link') throw new Error('packed transform did not link prose');
    if (tree.children[2]?.type !== 'inlineCode') {
      throw new Error('packed transform rewrote code — a backtick means the syntax');
    }
  },
  '@galaxy-foundry/kind-manifest': async (mod, peer) => {
    // zod is a peer dependency, so the packed tarball does not carry it. Resolving it
    // from beside the unpacked package is exactly what a consumer's install does — and
    // resolving it from this script instead would test the workspace, not the tarball.
    const { z } = await peer('zod');
    const manifest = mod.buildKindManifest({
      instance: 'smoke',
      kinds: [
        {
          kind: 'mold',
          title: 'Mold',
          layer: 'substrate',
          summary: 's',
          shape: { tags: z.array(z.string()), note: z.string().optional() },
        },
      ],
    });
    const fields = manifest.kinds[0]?.fields;
    if (fields?.[0]?.type !== 'string[]') {
      throw new Error(`packed deriver rendered ${JSON.stringify(fields)}`);
    }
    if (mod.parseKindManifest(JSON.parse(JSON.stringify(manifest))).instance !== 'smoke') {
      throw new Error('packed reader did not round-trip the manifest');
    }
  },
  '@galaxy-foundry/kind-schema': async (mod, peer, unpacked) => {
    const { z } = await peer('zod');
    const defineKind = mod.kindDefiner();
    const kind = defineKind({
      kind: 'mold',
      title: 'Mold',
      layer: 'substrate',
      summary: 's',
      build: (ctx) => z.object({ type: z.literal('mold'), axis: ctx.axis }).strict(),
      refine: (data, issues) => {
        if (data.axis === 'banned') {
          issues.addIssue({ code: z.ZodIssueCode.custom, path: ['axis'], message: 'no' });
        }
      },
    });
    const schema = mod.assemble(kind, { axis: z.string() });
    if (schema.parse({ type: 'mold', axis: 'general' }).axis !== 'general') {
      throw new Error('packed assemble did not parse the kind');
    }
    // The refinement is the half that a tarball missing it would still import cleanly.
    if (schema.safeParse({ type: 'mold', axis: 'banned' }).success) {
      throw new Error('packed assemble dropped the kind refinement');
    }

    // The manifest bridge crosses a package boundary, so the packed tarball has to carry types
    // it does not own — a `dependencies` entry, not just a devDependency, or a consumer's
    // `ManifestKindInput` resolves to nothing.
    const [described] = mod.manifestKinds([kind], { axis: z.string() }, { mold: '# Mold' });
    if (described?.doc !== '# Mold' || !('axis' in described.shape)) {
      throw new Error(`packed bridge described the kind as ${JSON.stringify(described)}`);
    }

    // The second entrypoint is declared separately in `exports`, so `files` can ship one and
    // not the other — which is exactly the failure only a packed tarball shows.
    const collections = await import(
      pathToFileURL(path.join(unpacked, 'dist', 'collections.js')).href
    );
    const table = { molds: { base: 'content/molds', pattern: ['**/index.md'], kind: 'mold' } };
    if (collections.collectionOf(table, 'content/molds/a/index.md') !== 'molds') {
      throw new Error('packed router did not route a note to its collection');
    }
    if (collections.collectionOf(table, 'content/molds/a/eval.md') !== undefined) {
      throw new Error('packed router claimed a file the table does not');
    }
  },
};

let failures = 0;

for (const name of readdirSync(packagesDir)) {
  const dir = path.join(packagesDir, name);
  const manifest = path.join(dir, 'package.json');
  if (!existsSync(manifest)) continue;

  const { name: pkgName, private: isPrivate } = JSON.parse(
    execFileSync('node', ['-p', `JSON.stringify(require(${JSON.stringify(manifest)}))`], {
      encoding: 'utf8',
    }),
  );
  if (isPrivate) {
    console.log(`- ${pkgName}: private, skipped`);
    continue;
  }

  const work = mkdtempSync(path.join(tmpdir(), 'foundry-smoke-'));
  try {
    const packed = execFileSync('npm', ['pack', '--pack-destination', work, '--silent'], {
      cwd: dir,
      encoding: 'utf8',
    }).trim();
    execFileSync('tar', ['-xzf', path.join(work, packed), '-C', work]);
    const unpacked = path.join(work, 'package');

    // The tarball carries no dependencies; borrow the workspace's resolved ones so
    // the import exercises the packed files rather than failing on `js-yaml`.
    symlinkSync(path.join(dir, 'node_modules'), path.join(unpacked, 'node_modules'), 'dir');

    const entry = path.join(unpacked, 'dist', 'index.js');
    if (!existsSync(entry)) throw new Error('tarball has no dist/index.js');

    // Resolves a peer dependency the way a consumer would: from beside the installed
    // package, not from this script's own tree.
    const peerRequire = createRequire(path.join(unpacked, 'noop.js'));
    const peer = (name) => import(pathToFileURL(peerRequire.resolve(name)).href);

    const mod = await import(pathToFileURL(entry).href);
    if (!SMOKE[pkgName]) throw new Error(`no smoke check registered for ${pkgName}`);
    await SMOKE[pkgName](mod, peer, unpacked);

    console.log(`✓ ${pkgName}: packed, unpacked, imported, exercised`);
  } catch (error) {
    console.error(`✗ ${pkgName}: ${error.message}`);
    failures += 1;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

process.exit(failures === 0 ? 0 : 1);
