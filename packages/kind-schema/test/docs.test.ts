import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { loadKindDocs, loadKindExamples } from '../src/docs.js';
import { kindDefiner } from '../src/index.js';

const defineKind = kindDefiner<{ base: { title: z.ZodString } }>();

const createKindDefinition = (name: string) =>
  defineKind({
    kind: name,
    title: name,
    layer: 'substrate',
    summary: 's',
    shape: 'directory',
    companions: [],
    build: (context) => z.object({ type: z.literal(name), ...context.base }).strict(),
  });

const mold = createKindDefinition('mold');
const pattern = createKindDefinition('pattern');

let typesDirectory: string;

beforeEach(() => {
  typesDirectory = mkdtempSync(path.join(tmpdir(), 'kind-docs-'));
});

afterEach(() => {
  rmSync(typesDirectory, { recursive: true, force: true });
});

function writeKindDoc(kind: string, body: string): void {
  mkdirSync(path.join(typesDirectory, kind), { recursive: true });
  writeFileSync(path.join(typesDirectory, kind, 'kind.md'), body);
}

function writeKindExample(kind: string, body: string): void {
  mkdirSync(path.join(typesDirectory, kind), { recursive: true });
  writeFileSync(path.join(typesDirectory, kind, 'example.md'), body);
}

describe('loadKindDocs', () => {
  it('reads each kind’s kind.md, keyed by kind name', () => {
    writeKindDoc('mold', '# Mold\n');
    writeKindDoc('pattern', '# Pattern\n');
    expect(loadKindDocs([mold, pattern], typesDirectory)).toEqual({
      mold: '# Mold',
      pattern: '# Pattern',
    });
  });

  it('trims the body', () => {
    writeKindDoc('mold', '\n\n# Mold\n\nbody\n\n\n');
    expect(loadKindDocs([mold], typesDirectory).mold).toBe('# Mold\n\nbody');
  });

  it('ignores a directory no kind declares', () => {
    writeKindDoc('mold', '# Mold\n');
    writeKindDoc('scratch', '# Not a kind\n');
    expect(Object.keys(loadKindDocs([mold], typesDirectory))).toEqual(['mold']);
  });

  it('refuses a kind with no kind.md, naming which one', () => {
    writeKindDoc('mold', '# Mold\n');
    expect(() => loadKindDocs([mold, pattern], typesDirectory)).toThrow(/^pattern: cannot read /);
  });

  it('throws rather than exiting the process', () => {
    let thrownError: unknown;
    try {
      loadKindDocs([mold], typesDirectory);
    } catch (error) {
      thrownError = error;
    }
    expect(thrownError).toBeInstanceOf(Error);
  });
});

describe('loadKindExamples', () => {
  it('reads and trims each kind’s example.md, keyed by kind name', () => {
    writeKindExample('mold', '\n---\ntype: mold\n---\n');
    writeKindExample('pattern', '---\ntype: pattern\n---\n');

    expect(loadKindExamples([mold, pattern], typesDirectory)).toEqual({
      mold: '---\ntype: mold\n---',
      pattern: '---\ntype: pattern\n---',
    });
  });

  it('refuses a kind with no example.md, naming which one and the expected file', () => {
    writeKindExample('mold', '---\ntype: mold\n---\n');
    expect(() => loadKindExamples([mold, pattern], typesDirectory)).toThrow(
      /^pattern: cannot read .*pattern\/example\.md$/,
    );
  });
});
