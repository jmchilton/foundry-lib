import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  bundleDir,
  bundlePathOf,
  bundlePathTemplate,
  castsTargetDir,
  DEFAULT_BUNDLE_PATH,
  resolveBundlePath,
} from '../src/target-layout.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'cast-layout-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('resolving a bundle_path template', () => {
  it('substitutes the bundle name, anywhere in the template', () => {
    expect(resolveBundlePath('{mold}', 'summarize-nextflow')).toBe('summarize-nextflow');
    expect(resolveBundlePath('skills/{mold}', 'summarize-nextflow')).toBe(
      'skills/summarize-nextflow',
    );
    expect(resolveBundlePath('{mold}/v1/{mold}', 'a')).toBe('a/v1/a');
  });

  it('refuses a template that cannot place a bundle', () => {
    expect(() => resolveBundlePath('skills', 'a')).toThrow(/must contain \{mold\}/);
  });

  it('refuses a template that escapes the target directory', () => {
    expect(() => resolveBundlePath('../{mold}', 'a')).toThrow(/must stay inside/);
    expect(() => resolveBundlePath('/abs/{mold}', 'a')).toThrow(/must stay inside/);
  });
});

describe('validating a declared bundle_path', () => {
  it('defaults when a target declares none', () => {
    expect(bundlePathOf(undefined, '_target.yml')).toBe(DEFAULT_BUNDLE_PATH);
    expect(bundlePathOf(null, '_target.yml')).toBe(DEFAULT_BUNDLE_PATH);
  });

  it('names the YAML cause when the value is not the string it looks like', () => {
    // `bundle_path: {mold}` is flow-mapping syntax, so YAML hands back { mold: null }.
    expect(() => bundlePathOf({ mold: null }, 'casts/claude/_target.yml')).toThrow(
      /casts\/claude\/_target\.yml: bundle_path must be a string/,
    );
  });
});

describe('reading a target declaration', () => {
  it('defaults when the target declares nothing', () => {
    expect(bundlePathTemplate(dir)).toBe(DEFAULT_BUNDLE_PATH);
  });

  it('reads the declared template', () => {
    writeFileSync(path.join(dir, '_target.yml'), 'bundle_path: "skills/{mold}"\n');
    expect(bundlePathTemplate(dir)).toBe('skills/{mold}');
    expect(bundleDir(dir, 'summarize-nextflow')).toBe(
      path.join(dir, 'skills', 'summarize-nextflow'),
    );
  });

  it('moves every bundle when the declaration moves', () => {
    writeFileSync(path.join(dir, '_target.yml'), 'bundle_path: "{mold}"\n');
    expect(bundleDir(dir, 'a')).toBe(path.join(dir, 'a'));

    writeFileSync(path.join(dir, '_target.yml'), 'bundle_path: "bundles/{mold}/cast"\n');
    expect(bundleDir(dir, 'a')).toBe(path.join(dir, 'bundles', 'a', 'cast'));
  });

  it('points at the declaring file when the declaration is unquoted', () => {
    const declaration = path.join(dir, '_target.yml');
    writeFileSync(declaration, 'bundle_path: {mold}\n');
    expect(() => bundlePathTemplate(dir)).toThrow(declaration);
  });
});

describe('the conventional target directory', () => {
  it('is casts/<target>, for an instance that adopts it', () => {
    mkdirSync(path.join(dir, 'casts', 'claude'), { recursive: true });
    expect(castsTargetDir(dir, 'claude')).toBe(path.join(dir, 'casts', 'claude'));
  });
});
