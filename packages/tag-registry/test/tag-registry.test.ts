import { describe, it, expect } from 'vitest';

import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  TAG_REGISTRY_FILE,
  buildTagIndex,
  findTagRegistryPath,
  loadTagRegistry,
  parseTagRegistry,
  tagRegistry,
} from '../src/index.js';

const VALID = `
version: 1
facets:
  target:
    label: Target
    description: The platform a note is about.
    values:
      target/galaxy: Galaxy-specific material.
      target/cwl: CWL-specific material.
  meta:
    label: Meta
    description: Notes about the Foundry itself.
    values:
      meta: Process and convention notes.
`;

const parse = (text: string) => parseTagRegistry(text, 'test.yml');

describe('parsing', () => {
  it('reads facets, labels, and glosses', () => {
    const registryFile = parse(VALID);
    expect(Object.keys(registryFile.facets)).toEqual(['target', 'meta']);
    expect(registryFile.facets['target']?.label).toBe('Target');
    expect(registryFile.facets['target']?.values?.['target/galaxy']).toBe(
      'Galaxy-specific material.',
    );
  });

  it('accepts a facet declared before it has any members', () => {
    const registryFile = parse(
      'facets:\n  topic:\n    label: Topic\n    description: Subject areas.\n',
    );
    expect(registryFile.facets['topic']?.values).toBeUndefined();
  });

  it('accepts `version` and does not require it', () => {
    expect(parse(VALID).version).toBe(1);
    expect(parse('facets:\n  m:\n    label: M\n    description: D.\n').version).toBeUndefined();
  });

  it('names the source file in its errors', () => {
    expect(() => parse('facets: []')).toThrow(/^test\.yml: /);
  });

  it.each([
    ['not a mapping', '- a\n- b', /not a mapping/],
    ['no facets block', 'version: 1\n', /no `facets` block/],
    ['facets not a mapping', 'facets: []', /`facets` is not a mapping/],
    ['facets empty', 'facets: {}', /`facets` is empty/],
    ['facet not a mapping', 'facets:\n  a: nope\n', /facet `a` is not a mapping/],
    ['no label', 'facets:\n  a:\n    description: D.\n', /missing required field `label`/],
    ['no description', 'facets:\n  a:\n    label: A\n', /missing required field `description`/],
    [
      'values not a mapping',
      'facets:\n  a:\n    label: A\n    description: D.\n    values: [x]\n',
      /`values` that is not a mapping/,
    ],
  ])('refuses a registry with %s', (_name, text, message) => {
    expect(() => parse(text)).toThrow(message);
  });

  it('refuses a tag with no gloss', () => {
    const text = 'facets:\n  a:\n    label: A\n    description: D.\n    values:\n      a/x:\n';
    expect(() => parse(text)).toThrow(/tag `a\/x` in facet `a` has no gloss/);
  });

  it('refuses an empty-string gloss, not just a missing one', () => {
    const text = "facets:\n  a:\n    label: A\n    description: D.\n    values:\n      a/x: ''\n";
    expect(() => parse(text)).toThrow(/has no gloss/);
  });

  it('refuses a tag declared by two facets, naming both', () => {
    const text = `
facets:
  a:
    label: A
    description: D.
    values:
      shared: One gloss.
  b:
    label: B
    description: D.
    values:
      shared: Another gloss.
`;
    expect(() => parse(text)).toThrow(/tag `shared` is declared by both `a` and `b`/);
  });
});

describe('declared membership', () => {
  const registry = tagRegistry(parse(VALID));

  it('resolves a bare key exactly like a slashed one', () => {
    expect(registry.isValidTag('meta')).toBe(true);
    expect(registry.facetOf('meta')).toBe('meta');
    expect(registry.tagDescription('meta')).toBe('Process and convention notes.');
  });

  it('does not accept a tag by prefix alone', () => {
    expect(registry.isValidTag('target/nextflow')).toBe(false);
    expect(registry.facetOf('target/nextflow')).toBeUndefined();
  });

  it('accepts a declared tag whose text does not match its facet', () => {
    const text = `
facets:
  role:
    label: Role
    description: D.
    values:
      cautionary-bad: A deliberately invalid exemplar.
`;
    const customRegistry = tagRegistry(parse(text));
    expect(customRegistry.isValidTag('cautionary-bad')).toBe(true);
    expect(customRegistry.facetOf('cautionary-bad')).toBe('role');
  });

  it('reports every tag and every facet in declaration order', () => {
    expect(registry.allTags()).toEqual(['target/galaxy', 'target/cwl', 'meta']);
    expect(registry.facets().map((facet) => facet.key)).toEqual(['target', 'meta']);
  });

  it('answers nothing for an unregistered tag', () => {
    expect(registry.isValidTag('nope')).toBe(false);
    expect(registry.tagDescription('nope')).toBeUndefined();
    expect(registry.facetOf('nope')).toBeUndefined();
  });

  it('falls back to the facet key when a label is asked for by an unknown key', () => {
    expect(registry.facetLabel('target')).toBe('Target');
    expect(registry.facetLabel('nope')).toBe('nope');
    expect(registry.facetLabel(undefined)).toBe('');
  });

  it('indexes a facet with no members without inventing one', () => {
    const registryFile = parse('facets:\n  topic:\n    label: Topic\n    description: D.\n');
    expect(buildTagIndex(registryFile).size).toBe(0);
    expect(
      tagRegistry(registryFile)
        .facets()
        .map((facet) => facet.key),
    ).toEqual(['topic']);
  });
});

describe('loading from disk', () => {
  it('reads, validates and wraps a file', () => {
    const registryDirectory = mkdtempSync(path.join(tmpdir(), 'tag-registry-'));
    try {
      const registryPath = path.join(registryDirectory, TAG_REGISTRY_FILE);
      writeFileSync(registryPath, VALID);
      expect(loadTagRegistry(registryPath).isValidTag('target/cwl')).toBe(true);
      expect(findTagRegistryPath(registryDirectory)).toBe(registryPath);
    } finally {
      rmSync(registryDirectory, { recursive: true, force: true });
    }
  });

  it('names the missing file rather than failing on a read', () => {
    expect(() => loadTagRegistry('/nonexistent/meta_tags.yml')).toThrow(/missing tag registry/);
  });

  it('reports where it searched when there is nothing to find', () => {
    const registryDirectory = mkdtempSync(path.join(tmpdir(), 'tag-registry-'));
    try {
      expect(() => findTagRegistryPath(registryDirectory)).toThrow(
        /meta_tags\.yml not found above/,
      );
    } finally {
      rmSync(registryDirectory, { recursive: true, force: true });
    }
  });
});
