import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docsRoot = path.join(repoRoot, 'docs');
const packagesRoot = path.join(repoRoot, 'packages');
const failures = [];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name === 'typedoc' || entry.name === 'typedoc.json') {
      continue;
    }

    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(entryPath)));
    } else {
      files.push(entryPath);
    }
  }

  return files;
}

function isExternal(target) {
  return /^(?:[a-z]+:|\/\/|#)/i.test(target);
}

function markdownTarget(rawTarget) {
  const trimmed = rawTarget.trim();
  if (trimmed.startsWith('<')) {
    return trimmed.slice(1, trimmed.indexOf('>'));
  }
  return trimmed.split(/\s+/u)[0];
}

async function exists(target) {
  try {
    const info = await stat(target);
    return info.isFile();
  } catch {
    return false;
  }
}

async function workspacePackages() {
  const entries = await readdir(packagesRoot, { withFileTypes: true });
  const packages = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const manifestPath = path.join(packagesRoot, entry.name, 'package.json');
        const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
        return { directory: entry.name, name: manifest.name, private: manifest.private === true };
      }),
  );
  return packages.filter((entry) => !entry.private).sort((a, b) => a.name.localeCompare(b.name));
}

async function checkPackageCoverage(packages) {
  const packageIndexes = [
    path.join(repoRoot, 'README.md'),
    path.join(docsRoot, 'README.md'),
    path.join(docsRoot, 'packages', 'README.md'),
    path.join(docsRoot, 'getting-started.md'),
    path.join(docsRoot, 'api', 'README.md'),
  ];

  for (const indexPath of packageIndexes) {
    const contents = await readFile(indexPath, 'utf8');
    for (const workspacePackage of packages) {
      if (!contents.includes(workspacePackage.name)) {
        failures.push(
          `${path.relative(repoRoot, indexPath)}: missing package: ${workspacePackage.name}`,
        );
      }
    }
  }

  const typedocPath = path.join(repoRoot, 'typedoc.json');
  const typedoc = JSON.parse(await readFile(typedocPath, 'utf8'));
  const actualEntryPoints = new Set(typedoc.entryPoints ?? []);
  const expectedEntryPoints = packages.map(({ directory }) => `packages/${directory}`);
  for (const entryPoint of expectedEntryPoints) {
    if (!actualEntryPoints.has(entryPoint)) {
      failures.push(`typedoc.json: missing package entry point: ${entryPoint}`);
    }
  }
  for (const entryPoint of actualEntryPoints) {
    if (!expectedEntryPoints.includes(entryPoint)) {
      failures.push(`typedoc.json: unexpected package entry point: ${entryPoint}`);
    }
  }

  const coverPath = path.join(docsRoot, '_coverpage.md');
  const cover = await readFile(coverPath, 'utf8');
  const packageCount = /<strong>(\d+)<\/strong><span>focused packages<\/span>/u.exec(cover)?.[1];
  if (Number(packageCount) !== packages.length) {
    failures.push(
      `docs/_coverpage.md: focused package count is ${packageCount ?? 'missing'}, expected ${packages.length}`,
    );
  }
}

async function checkArchitectureConsistency(packages, documentationFiles) {
  const packageReadmes = packages.map(({ directory }) =>
    path.join(packagesRoot, directory, 'README.md'),
  );
  const activeDocumentation = [...documentationFiles, ...packageReadmes].filter((candidate) =>
    candidate.endsWith('.md'),
  );
  const retiredClaims = [
    {
      pattern: /permitted casting\s+modes/iu,
      message: 'license policy describes redistribution posture, not permitted casting modes',
    },
    {
      pattern: /keyed off each ref['’]s `mode`/iu,
      message: 'cast licensing keys off `derived`, not `mode`',
    },
    {
      pattern: /astro-pagefind`?\s+1\.9\+/iu,
      message: 'site-kit uses the astro-pagefind 2 component contract',
    },
    {
      pattern: /hosting is not\s+finalized/iu,
      message: 'the Foundry Pattern documentation now has a rendered site URL',
    },
  ];

  for (const sourcePath of activeDocumentation) {
    const contents = await readFile(sourcePath, 'utf8');
    for (const retired of retiredClaims) {
      if (retired.pattern.test(contents)) {
        failures.push(
          `${path.relative(repoRoot, sourcePath)}: stale architecture claim: ${retired.message}`,
        );
      }
    }

    const textBlocks = contents.matchAll(/```text\s*\n([\s\S]*?)```/gu);
    for (const block of textBlocks) {
      const body = block[1] ?? '';
      const looksLikeDiagram =
        /[┌┐└┘├┤┬┴┼│─▼▶]/u.test(body) ||
        /(?:--+>|<--+)/u.test(body) ||
        /^\s*[|v]\s*(?:\S.*)?$/mu.test(body);
      if (looksLikeDiagram) {
        failures.push(
          `${path.relative(repoRoot, sourcePath)}: text diagram should be an accessible SVG`,
        );
      }
    }
  }

  const siteKitManifestPath = path.join(packagesRoot, 'site-kit', 'package.json');
  const siteKitManifest = JSON.parse(await readFile(siteKitManifestPath, 'utf8'));
  if (siteKitManifest.peerDependencies?.['astro-pagefind'] !== '>=2') {
    failures.push(
      'packages/site-kit/package.json: astro-pagefind peer must match the documented 2+ runtime',
    );
  }

  const patternAnatomyUrl =
    'https://galaxyproject.github.io/foundry-pattern/pattern/anatomy-of-an-instance/';
  const referenceDataPath = path.join(
    packagesRoot,
    'reference-contract',
    'data',
    'reference-contract.yml',
  );
  const referenceData = await readFile(referenceDataPath, 'utf8');
  const configuredSpecUrl = /^spec_url:\s*(\S+)\s*$/mu.exec(referenceData)?.[1];
  if (configuredSpecUrl !== patternAnatomyUrl) {
    failures.push(
      `packages/reference-contract/data/reference-contract.yml: spec_url is ${configuredSpecUrl ?? 'missing'}, expected rendered Pattern URL`,
    );
  }

  const referenceReadmePath = path.join(packagesRoot, 'reference-contract', 'README.md');
  const referenceReadme = await readFile(referenceReadmePath, 'utf8');
  if (!referenceReadme.includes(patternAnatomyUrl)) {
    failures.push('packages/reference-contract/README.md: does not document the shipped spec_url');
  }

  const diagramRoot = path.join(docsRoot, 'assets', 'diagrams');
  const diagramEntries = await readdir(diagramRoot, { withFileTypes: true });
  for (const diagramEntry of diagramEntries) {
    if (!diagramEntry.isFile() || !diagramEntry.name.endsWith('.svg')) continue;
    const diagramPath = path.join(diagramRoot, diagramEntry.name);
    const svg = await readFile(diagramPath, 'utf8');
    for (const [token, description] of [
      ['<title', 'title'],
      ['<desc', 'description'],
      ['role="img"', 'image role'],
      ['aria-labelledby=', 'accessible-name binding'],
      ['viewBox=', 'responsive viewBox'],
    ]) {
      if (!svg.includes(token)) {
        failures.push(`${path.relative(repoRoot, diagramPath)}: missing SVG ${description}`);
      }
    }
  }

  for (const sourcePath of packageReadmes) {
    const contents = await readFile(sourcePath, 'utf8');
    const rawDiagramLinks = contents.matchAll(
      /https:\/\/raw\.githubusercontent\.com\/jmchilton\/foundry-lib\/main\/docs\/(assets\/diagrams\/[^)\s]+\.svg)/gu,
    );
    for (const link of rawDiagramLinks) {
      const localDiagram = path.join(docsRoot, link[1] ?? '');
      if (!(await exists(localDiagram))) {
        failures.push(
          `${path.relative(repoRoot, sourcePath)}: missing local source for published diagram: ${link[1]}`,
        );
      }
    }
  }
}

async function checkTarget(source, rawTarget) {
  const target = markdownTarget(rawTarget);
  if (!target || isExternal(target)) {
    return;
  }

  const pathOnly = decodeURIComponent(target.split('#', 1)[0].split('?', 1)[0]);
  if (!pathOnly) {
    return;
  }

  let resolved;
  if (pathOnly === '/') {
    resolved = path.join(docsRoot, 'README.md');
  } else {
    resolved = path.resolve(docsRoot, pathOnly.replace(/^\/+/u, ''));
  }

  if (!resolved.startsWith(`${docsRoot}${path.sep}`)) {
    failures.push(`${path.relative(repoRoot, source)}: link escapes docs root: ${target}`);
    return;
  }

  if (!(await exists(resolved))) {
    failures.push(`${path.relative(repoRoot, source)}: missing target: ${target}`);
  }
}

const files = await walk(docsRoot);
const packages = await workspacePackages();
await checkPackageCoverage(packages);
await checkArchitectureConsistency(packages, files);
for (const file of files.filter((candidate) => candidate.endsWith('.md'))) {
  const contents = await readFile(file, 'utf8');
  const links = contents.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/gu);
  for (const match of links) {
    await checkTarget(file, match[1]);
  }
}

const indexPath = path.join(docsRoot, 'index.html');
const indexContents = await readFile(indexPath, 'utf8');
const assets = indexContents.matchAll(/(?:href|src)="([^"]+)"/gu);
for (const match of assets) {
  await checkTarget(indexPath, match[1]);
}

for (const generated of [
  path.join(docsRoot, 'api', 'typedoc', 'index.html'),
  path.join(docsRoot, 'api', 'typedoc.json'),
]) {
  if (!(await exists(generated))) {
    failures.push(`missing generated documentation: ${path.relative(repoRoot, generated)}`);
  }
}

if (failures.length > 0) {
  console.error('Documentation checks failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log(
    `Documentation checks passed (${files.length} source files, ${packages.length} packages).`,
  );
}
