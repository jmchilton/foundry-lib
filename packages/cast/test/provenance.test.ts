import { describe, expect, it } from 'vitest';

import { PROVENANCE_SCHEMA_VERSION, readProvenanceCarryOver } from '../src/provenance.js';

describe('the emitted schema version', () => {
  it('is the version this package writes', () => {
    expect(PROVENANCE_SCHEMA_VERSION).toBe(4);
  });
});

describe('carrying hand-recorded fields forward', () => {
  it('has nothing to carry from a first cast', () => {
    expect(readProvenanceCarryOver(null)).toEqual({});
    expect(readProvenanceCarryOver(undefined)).toEqual({});
  });

  it('carries the fields a re-cast cannot derive', () => {
    const carry = readProvenanceCarryOver(
      JSON.stringify({
        cast_method: 'deterministic',
        cast_agent: 'foundry-build',
        cast_date: '2026-01-01',
        cast_revision: 3,
        cast_history: [{ rev: 1, date: '2025-12-01', note: 'first cast' }],
        open_questions: ['does the sidecar belong here?'],
        validation_results: [],
        // Derived from the sources on every run, so carrying it would let a stale value
        // survive a re-cast that should have replaced it.
        refs: [{ ref: 'a' }],
      }),
    );
    expect(carry.cast_method).toBe('deterministic');
    expect(carry.cast_revision).toBe(3);
    expect(carry.cast_history).toEqual([{ rev: 1, date: '2025-12-01', note: 'first cast' }]);
    expect(carry.open_questions).toEqual(['does the sidecar belong here?']);
    expect(carry).not.toHaveProperty('refs');
  });

  it('drops a field whose shape is not the one this version records', () => {
    const carry = readProvenanceCarryOver(
      JSON.stringify({ cast_revision: '3', open_questions: 'one question', cast_agent: 42 }),
    );
    expect(carry).toEqual({});
  });

  it('omits an absent field rather than recording it as null', () => {
    // The record is serialized as JSON, where a present-but-undefined key and an absent one
    // differ: `{"cast_agent": null}` claims the cast had no agent, which is not what a record
    // that never had the field says.
    const carry = readProvenanceCarryOver(JSON.stringify({ cast_method: 'deterministic' }));
    expect(Object.keys(carry)).toEqual(['cast_method']);
  });
});
