import { describe, expect, it } from 'vitest';

import {
  PROVENANCE_SCHEMA_VERSION,
  provenanceRecord,
  readProvenanceCarryOver,
  type ProvenanceHead,
  type ProvenanceRefEntry,
} from '../src/provenance.js';

describe('the emitted schema version', () => {
  it('is the version this package writes', () => {
    expect(PROVENANCE_SCHEMA_VERSION).toBe(4);
  });
});

// Key order is the whole reason this builder exists, so it is asserted on the serialized text
// rather than the object: `toEqual` compares records key-order-blind and would pass on a
// reshuffle that rewrites every committed provenance file in an instance's repository.
describe('assembling a record', () => {
  const head: ProvenanceHead = {
    provenance_schema_version: PROVENANCE_SCHEMA_VERSION,
    cast_target: 'claude',
    mold: { name: 'm', path: 'content/molds/m/index.md', content_hash: 'abc', commit: null },
    cast_at: '2026-08-04T00:00:00.000Z',
  };
  const refs: ProvenanceRefEntry[] = [
    {
      kind: 'research',
      mode: 'verbatim',
      ref: '[[r]]',
      src: 'content/research/r/index.md',
      dst: 'references/notes/r.md',
      used_at: 'runtime',
      load: 'upfront',
      src_hash: 'h',
      dst_hash: 'h',
      source: 'deterministic',
    },
  ];

  const keysOf = (record: object): string[] => Object.keys(JSON.parse(JSON.stringify(record)));

  it('puts an instance’s own fields between refs and validation_results', () => {
    const record = provenanceRecord({
      head,
      refs,
      extensions: { artifacts: { produces: [], consumes: [] } },
      tail: { validation_results: [], open_questions: ['q'] },
    });
    expect(keysOf(record)).toEqual([
      'provenance_schema_version',
      'cast_target',
      'mold',
      'cast_at',
      'refs',
      'artifacts',
      'validation_results',
      'open_questions',
    ]);
  });

  it('writes the same bytes for an instance that records nothing extra', () => {
    const withNone = provenanceRecord({ head, refs });
    const withEmpty = provenanceRecord({ head, refs, extensions: {} });
    expect(keysOf(withNone)).toEqual([
      'provenance_schema_version',
      'cast_target',
      'mold',
      'cast_at',
      'refs',
    ]);
    expect(JSON.stringify(withNone)).toBe(JSON.stringify(withEmpty));
  });

  // The caller hands over a head object whose own key order is its business; the record's is
  // not. Without this, an instance could reorder its literal and reshuffle every bundle.
  it('ignores the key order of the head it was handed', () => {
    const shuffled: ProvenanceHead = {
      cast_at: head.cast_at,
      mold: head.mold,
      cast_target: head.cast_target,
      provenance_schema_version: head.provenance_schema_version,
    };
    expect(JSON.stringify(provenanceRecord({ head: shuffled, refs }))).toBe(
      JSON.stringify(provenanceRecord({ head, refs })),
    );
  });

  it('keeps a carried cast_history in its declared position, not where it was reassigned', () => {
    const record = provenanceRecord({ head: { ...head, cast_history: [] }, refs });
    record.cast_history = [{ rev: 1, date: '2026-08-04', note: 'n' }];
    expect(keysOf(record)).toEqual([
      'provenance_schema_version',
      'cast_target',
      'mold',
      'cast_at',
      'cast_history',
      'refs',
    ]);
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
