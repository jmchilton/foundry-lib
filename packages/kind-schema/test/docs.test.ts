import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { loadKindDocs } from '../src/docs.js';
import { kindDefiner } from '../src/index.js';

const defineKind = kindDefiner<{ base: { title: z.ZodString } }>();

const kindOf = (name: string) =>
  defineKind({
    kind: name,
    title: name,
    layer: 'substrate',
    summary: 's',
    build: (ctx) => z.object({ type: z.literal(name), ...ctx.base }).strict(),
  });

const mold = kindOf('mold');
const pattern = kindOf('pattern');

let typesDir: string;

beforeEach(() => {
  typesDir = mkdtempSync(path.join(tmpdir(), 'kind-docs-'));
});

afterEach(() => {
  rmSync(typesDir, { recursive: true, force: true });
});

function writeDoc(kind: string, body: string): void {
  mkdirSync(path.join(typesDir, kind), { recursive: true });
  writeFileSync(path.join(typesDir, kind, 'kind.md'), body);
}

describe('loadKindDocs', () => {
  it('reads each kind’s kind.md, keyed by kind name', () => {
    writeDoc('mold', '# Mold\n');
    writeDoc('pattern', '# Pattern\n');
    expect(loadKindDocs([mold, pattern], typesDir)).toEqual({
      mold: '# Mold',
      pattern: '# Pattern',
    });
  });

  // Trimmed because the manifest is byte-compared by the instances' `--check` gates, and a
  // trailing newline that varies by editor would make the gate fail on whitespace.
  it('trims the body', () => {
    writeDoc('mold', '\n\n# Mold\n\nbody\n\n\n');
    expect(loadKindDocs([mold], typesDir).mold).toBe('# Mold\n\nbody');
  });

  // The reason it walks the kind list rather than the directory: a stray directory under
  // types/ is not a kind, and must not become one just by existing.
  it('ignores a directory no kind declares', () => {
    writeDoc('mold', '# Mold\n');
    writeDoc('scratch', '# Not a kind\n');
    expect(Object.keys(loadKindDocs([mold], typesDir))).toEqual(['mold']);
  });

  // The other half of the same rule: a kind with no doc is an error, not a silent omission,
  // because the manifest would otherwise ship a kind that fails to explain itself.
  it('refuses a kind with no kind.md, naming which one', () => {
    writeDoc('mold', '# Mold\n');
    expect(() => loadKindDocs([mold, pattern], typesDir)).toThrow(/^pattern: cannot read /);
  });

  // Throwing rather than exiting is the whole reason this is testable at all — a
  // `process.exit(1)` here would take the test runner down with it.
  it('throws rather than exiting the process', () => {
    let threw: unknown;
    try {
      loadKindDocs([mold], typesDir);
    } catch (e) {
      threw = e;
    }
    expect(threw).toBeInstanceOf(Error);
  });
});
