import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { assemble, buildKindUnion, kindDefiner, type AnyKindDefinition } from '../src/index.js';

// Two instance contexts, deliberately unalike, because the claim this package makes is that the
// context is the SEAM — the thing instances disagree about — and a test with one context shape
// would prove nothing about that.
//
// These mirror the two real ones: galaxyproject/foundry spreads a seven-field note envelope and
// hands kinds a tag registry to validate against; statistical-genomics-foundry spreads one field
// and hands kinds a license table. Both are modelled small enough to read.

interface WideContext {
  base: { status: z.ZodEnum<['draft', 'reviewed']>; revised: z.ZodDate; summary: z.ZodString };
  tag: z.ZodString;
}

interface NarrowContext {
  base: { title: z.ZodString };
  licenseIds: readonly string[];
}

const wideCtx: WideContext = {
  base: {
    status: z.enum(['draft', 'reviewed']),
    revised: z.coerce.date(),
    summary: z.string().min(1),
  },
  tag: z.string().regex(/^[a-z]+\/[a-z-]+$/),
};

const narrowCtx: NarrowContext = {
  base: { title: z.string().min(1) },
  licenseIds: ['CC-BY-4.0', 'MIT'],
};

const defineWide = kindDefiner<WideContext>();
const defineNarrow = kindDefiner<NarrowContext>();

const mold = defineWide({
  kind: 'mold',
  title: 'Mold',
  layer: 'substrate',
  summary: 'A procedural authoring skill source.',
  build: (ctx) =>
    z
      .object({
        type: z.literal('mold'),
        ...ctx.base,
        axis: z.enum(['source-specific', 'general']),
        tags: z.array(ctx.tag).min(1),
      })
      .strict(),
  // A rule a shape cannot state: whether `source` is required depends on `axis`.
  refine: (data, issues) => {
    if (data.axis === 'source-specific' && !data.summary.includes('source')) {
      issues.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['summary'],
        message: 'source-specific molds must say which source',
      });
    }
  },
});

const pattern = defineWide({
  kind: 'pattern',
  title: 'Pattern',
  layer: 'substrate',
  summary: 'A corpus-backed recipe.',
  build: (ctx) =>
    z
      .object({ type: z.literal('pattern'), ...ctx.base, pattern_kind: z.enum(['moc', 'recipe']) })
      .strict(),
});

const book = defineNarrow({
  kind: 'book',
  title: 'Book',
  layer: 'instance',
  summary: 'A book whose chapters are notes.',
  build: (ctx) => z.object({ type: z.literal('book'), ...ctx.base, license: z.string() }).strict(),
  refine: (data, issues, kctx) => {
    if (!kctx.licenseIds.includes(data.license)) {
      issues.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['license'],
        message: `unknown license: ${data.license}`,
      });
    }
  },
});

const validMold = {
  type: 'mold',
  status: 'draft',
  revised: '2026-07-28',
  summary: 'walks a source workflow to a target',
  axis: 'source-specific',
  tags: ['target/galaxy'],
};

describe('assemble', () => {
  it("parses a kind's own frontmatter", () => {
    const parsed = assemble(mold, wideCtx).parse(validMold);
    expect(parsed.axis).toBe('source-specific');
    expect(parsed.revised).toBeInstanceOf(Date);
  });

  it("runs the kind's refine against its own fields", () => {
    const result = assemble(mold, wideCtx).safeParse({ ...validMold, summary: 'walks a workflow' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('source-specific molds must say which source');
  });

  it("hands refine the instance's context, not just the data", () => {
    const schema = assemble(book, narrowCtx);
    expect(schema.safeParse({ type: 'book', title: 'MSMB', license: 'MIT' }).success).toBe(true);
    const bad = schema.safeParse({ type: 'book', title: 'MSMB', license: 'Proprietary' });
    expect(bad.error?.issues[0]?.message).toBe('unknown license: Proprietary');
  });

  it('assembles a kind with no refine', () => {
    const parsed = assemble(pattern, wideCtx).parse({
      type: 'pattern',
      status: 'reviewed',
      revised: '2026-07-28',
      summary: 'a recipe',
      pattern_kind: 'moc',
    });
    expect(parsed.pattern_kind).toBe('moc');
  });

  it('rejects unknown keys — kinds are strict', () => {
    expect(assemble(mold, wideCtx).safeParse({ ...validMold, extra: 1 }).success).toBe(false);
  });
});

describe('buildKindUnion', () => {
  const kinds: readonly AnyKindDefinition<WideContext>[] = [mold, pattern];

  it('dispatches on type', () => {
    const union = buildKindUnion(kinds, wideCtx);
    expect(union.parse(validMold).type).toBe('mold');
  });

  it("runs the matched kind's refine and not another kind's", () => {
    const union = buildKindUnion(kinds, wideCtx);
    // Same summary that fails as a source-specific mold passes as a pattern: the rule belongs to
    // one kind, so the union must not apply it to the other.
    expect(
      union.safeParse({
        type: 'pattern',
        status: 'draft',
        revised: '2026-07-28',
        summary: 'walks a workflow',
        pattern_kind: 'recipe',
      }).success,
    ).toBe(true);
    expect(union.safeParse({ ...validMold, summary: 'walks a workflow' }).success).toBe(false);
  });

  it('rejects a type no kind declares', () => {
    expect(buildKindUnion(kinds, wideCtx).safeParse({ type: 'nope' }).success).toBe(false);
  });

  it('refuses an empty kind list rather than building a union of nothing', () => {
    expect(() => buildKindUnion([], wideCtx)).toThrow(/at least one kind/);
  });

  it('still builds from a widened kind array, where the types cannot survive', () => {
    // The escape hatch stays usable: a caller holding `AnyKindDefinition[]` gets a working
    // schema, just not a typed one. Only the shapes are lost, never the validation.
    expect(buildKindUnion(kinds, wideCtx).safeParse({ ...validMold, extra: 1 }).success).toBe(
      false,
    );
  });
});

/**
 * Exact type equality, which — unlike an assignment — `any` does NOT satisfy.
 *
 * The distinction is the whole point here. A plain `const axis: "a" | "b" = parsed.axis` passes
 * when `parsed.axis` is correctly inferred AND when the shape has collapsed to `any`, so it
 * reports success in exactly the case worth catching. The two-function-signatures trick is the
 * standard way to make the checker compare types rather than assignability.
 */
type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type MustBeTrue<T extends true> = T;

type MoldOut = z.infer<ReturnType<typeof mold.build>>;
export type _AxisIsExact = MustBeTrue<Equals<MoldOut['axis'], 'source-specific' | 'general'>>;
export type _StatusIsExact = MustBeTrue<Equals<MoldOut['status'], 'draft' | 'reviewed'>>;
export type _RevisedIsExact = MustBeTrue<Equals<MoldOut['revised'], Date>>;

// The union has to keep its members' types too, and for a reason the per-kind assertions above
// do not cover: an instance may re-export the union's type from its own published API, and a
// union that erased to `unknown` would hand that erasure to consumers who never called this
// package. Discriminating on `type` is the least this must preserve — if `.map`'s homogeneous
// array reaches the return type, `UnionOut['type']` is `unknown` and this stops compiling.
const TUPLE_KINDS = [mold, pattern] as const;
type UnionOut = z.infer<ReturnType<typeof buildKindUnion<WideContext, typeof TUPLE_KINDS>>>;
export type _UnionDiscriminantIsExact = MustBeTrue<Equals<UnionOut['type'], 'mold' | 'pattern'>>;

// And the arms stay separable rather than merging into one wide record: `axis` belongs to the
// mold arm only, so narrowing by `type` is what a consumer walking a mixed corpus actually does.
type MoldArm = Extract<UnionOut, { type: 'mold' }>;
export type _UnionMoldAxisIsExact = MustBeTrue<
  Equals<MoldArm['axis'], 'source-specific' | 'general'>
>;
export type _UnionPatternHasNoAxis = MustBeTrue<
  Equals<'axis' extends keyof Extract<UnionOut, { type: 'pattern' }> ? true : false, false>
>;

describe('kindDefiner', () => {
  // The reason `defineKind` exists at all. If the shape widened, `entry.data` degrades to
  // `unknown` — or, worse, to `any` — on pages that never mention this file.
  //
  // The compile-time assertions above are what actually hold this: they are checked by
  // `tsc -p tsconfig.test.json`, and they fail if the shape collapses in EITHER direction. The
  // runtime half below only confirms the values agree with the types.
  it("infers the kind's shape rather than widening it to the default", () => {
    const parsed = assemble(mold, wideCtx).parse(validMold);
    const axis: 'source-specific' | 'general' = parsed.axis;
    const status: 'draft' | 'reviewed' = parsed.status;
    expect([axis, status]).toEqual(['source-specific', 'draft']);
  });

  // `AnyKindDefinition` is the escape hatch for code that ITERATES kinds, and it has to be the
  // `any`-shaped one. `KindDefinition<Ctx>` — the erased-but-bounded type — cannot even hold a
  // concrete kind: `ZodObject` is effectively invariant in its shape parameter, so
  // `KindDefinition<WideContext> = mold` is a type error rather than a lossy assignment. That
  // is why both instances declare the `any` alias instead of reaching for the default.
  it('erases the shape for iteration without rejecting the kinds', () => {
    const kinds: readonly AnyKindDefinition<WideContext>[] = [mold, pattern, defineWide(pattern)];
    expect(kinds.map((k) => k.kind)).toEqual(['mold', 'pattern', 'pattern']);
    expect(kinds.every((k) => typeof k.build(wideCtx).parse === 'function')).toBe(true);
  });
});
