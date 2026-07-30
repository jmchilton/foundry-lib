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
    shape: 'directory',
    companions: [],
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

  it('trims the body', () => {
    writeDoc('mold', '\n\n# Mold\n\nbody\n\n\n');
    expect(loadKindDocs([mold], typesDir).mold).toBe('# Mold\n\nbody');
  });

  it('ignores a directory no kind declares', () => {
    writeDoc('mold', '# Mold\n');
    writeDoc('scratch', '# Not a kind\n');
    expect(Object.keys(loadKindDocs([mold], typesDir))).toEqual(['mold']);
  });

  it('refuses a kind with no kind.md, naming which one', () => {
    writeDoc('mold', '# Mold\n');
    expect(() => loadKindDocs([mold, pattern], typesDir)).toThrow(/^pattern: cannot read /);
  });

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
