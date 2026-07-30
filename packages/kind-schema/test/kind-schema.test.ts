import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { assemble, buildKindUnion, kindDefiner, type AnyKindDefinition } from '../src/index.js';

interface WideContext {
  base: {
    status: z.ZodEnum<{ draft: 'draft'; reviewed: 'reviewed' }>;
    revised: z.ZodDate;
    summary: z.ZodString;
  };
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
  shape: 'directory',
  companions: [
    {
      file: 'eval.md',
      requirement: 'recommended',
      purpose: 'Abstract oracle: the properties a cast must satisfy.',
      disposition: 'foundry-only',
    },
  ],
  build: (ctx) =>
    z
      .object({
        type: z.literal('mold'),
        ...ctx.base,
        axis: z.enum(['source-specific', 'general']),
        tags: z.array(ctx.tag).min(1),
      })
      .strict(),
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
  shape: 'file',
  companions: [],
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
  shape: 'directory',
  companions: [],
  additionalCompanions: 'allow',
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
    expect(buildKindUnion(kinds, wideCtx).safeParse({ ...validMold, extra: 1 }).success).toBe(
      false,
    );
  });
});

type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type MustBeTrue<T extends true> = T;

type MoldOut = z.infer<ReturnType<typeof mold.build>>;
export type _AxisIsExact = MustBeTrue<Equals<MoldOut['axis'], 'source-specific' | 'general'>>;
export type _StatusIsExact = MustBeTrue<Equals<MoldOut['status'], 'draft' | 'reviewed'>>;
export type _RevisedIsExact = MustBeTrue<Equals<MoldOut['revised'], Date>>;

type TupleKinds = readonly [typeof mold, typeof pattern];
type UnionOut = z.infer<ReturnType<typeof buildKindUnion<WideContext, TupleKinds>>>;
export type _UnionDiscriminantIsExact = MustBeTrue<Equals<UnionOut['type'], 'mold' | 'pattern'>>;

type MoldArm = Extract<UnionOut, { type: 'mold' }>;
export type _UnionMoldAxisIsExact = MustBeTrue<
  Equals<MoldArm['axis'], 'source-specific' | 'general'>
>;
export type _UnionPatternHasNoAxis = MustBeTrue<
  Equals<'axis' extends keyof Extract<UnionOut, { type: 'pattern' }> ? true : false, false>
>;

describe('kindDefiner', () => {
  it("infers the kind's shape rather than widening it to the default", () => {
    const parsed = assemble(mold, wideCtx).parse(validMold);
    const axis: 'source-specific' | 'general' = parsed.axis;
    const status: 'draft' | 'reviewed' = parsed.status;
    expect([axis, status]).toEqual(['source-specific', 'draft']);
  });

  it('erases the shape for iteration without rejecting the kinds', () => {
    const kinds: readonly AnyKindDefinition<WideContext>[] = [mold, pattern, defineWide(pattern)];
    expect(kinds.map((k) => k.kind)).toEqual(['mold', 'pattern', 'pattern']);
    expect(kinds.every((k) => typeof k.build(wideCtx).parse === 'function')).toBe(true);
  });
});
