import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docsRoot = path.join(repoRoot, 'docs');
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
  console.log(`Documentation checks passed (${files.length} source files).`);
}
