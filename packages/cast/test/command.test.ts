// The command shell around a cast: what the flags mean, and what a run says when it is done.
//
// This lives behind `@galaxy-foundry/cast/command` rather than in the barrel because the barrel
// promises that nothing in it prints. Splitting the decision from the printing is what keeps
// that honest and this testable: `castReport` returns the lines and the exit code as values,
// and only `castCommand` puts them on a stream.

import { describe, expect, it } from 'vitest';

import { castReport, parseCastArgs } from '../src/command.js';

const opts = { usage: 'statgen-foundry-build cast', defaultTarget: 'claude' };
const parse = (...argv: string[]) => parseCastArgs(argv, opts);

describe('what a cast command was asked to do', () => {
  it('takes the Mold as the one positional', () => {
    expect(parse('audit-wgd-inference')).toMatchObject({
      moldName: 'audit-wgd-inference',
      target: 'claude',
      check: false,
      note: null,
      root: null,
    });
  });

  it('accepts a flag joined by = or separated by a space', () => {
    expect(parse('m', '--target=web').target).toBe('web');
    expect(parse('m', '--target', 'web').target).toBe('web');
    expect(parse('m', '--note=why').note).toBe('why');
    expect(parse('m', '--note', 'why').note).toBe('why');
  });

  it('refuses a flag it does not know, rather than ignoring it', () => {
    // A silently dropped `--dry-run` writes the bundle it was told not to.
    expect(() => parse('m', '--dry-run')).toThrow(/--dry-run/);
  });

  it('refuses a value flag given no value, rather than eating the next flag', () => {
    // `--target --check` read `--check` as the target name. The run then had check=false and
    // wrote the bundle it was asked to inspect — the accident this parser exists to refuse.
    expect(() => parse('m', '--target', '--check')).toThrow(/--target needs a value/);
    expect(() => parse('m', '--target')).toThrow(/--target needs a value/);
    expect(() => parse('m', '--note')).toThrow(/--note needs a value/);
    expect(() => parse('m', '--root')).toThrow(/--root needs a value/);
  });

  it('still takes a value that merely looks odd, as long as it is not a flag', () => {
    expect(parse('m', '--note', '-1 thing').note).toBe('-1 thing');
    expect(parse('m', '--note=--check').note).toBe('--check');
  });

  it('names itself in the usage line, because two Foundries invoke this differently', () => {
    expect(() => parse()).toThrow(/statgen-foundry-build cast/);
    expect(() => parse('a', 'b')).toThrow(/statgen-foundry-build cast/);
  });
});

describe('what a finished cast says', () => {
  const clean = { errors: [], drift: [], wrote: null };

  it('reports a clean check as clean, and succeeds', () => {
    const r = castReport(clean, true, '/repo');
    expect(r.exitCode).toBe(0);
    expect(r.out.join('\n')).toMatch(/clean/);
    expect(r.err).toEqual([]);
  });

  it('fails a check that found drift, and names each drifted file', () => {
    const r = castReport(
      { ...clean, drift: [{ file: 'SKILL.md', reason: 'changed' }] },
      true,
      '/repo',
    );
    expect(r.exitCode).toBe(1);
    expect(r.err.join('\n')).toMatch(/SKILL\.md.*changed/);
  });

  it('fails a check that found errors even with no drift', () => {
    // An unresolved ref is not drift — nothing on disk disagrees, the cast could not be built.
    const r = castReport({ ...clean, errors: ['[[nope]] resolves to nothing'] }, true, '/repo');
    expect(r.exitCode).toBe(1);
    expect(r.err.join('\n')).toMatch(/nope/);
  });

  it('reports what it wrote, relative to the repo', () => {
    const r = castReport(
      { ...clean, wrote: '/repo/casts/claude/skills/m/_provenance.json' },
      false,
      '/repo',
    );
    expect(r.exitCode).toBe(0);
    expect(r.out.join('\n')).toContain('casts/claude/skills/m/_provenance.json');
  });

  it('refuses to record a cast it could not build, and says why', () => {
    // The dangerous outcome is a provenance record describing a bundle that was never assembled.
    const r = castReport({ errors: ['boom'], drift: [], wrote: null }, false, '/repo');
    expect(r.exitCode).toBe(1);
    expect(r.err.join('\n')).toMatch(/refusing to update provenance/);
  });
});
