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

const wideContext: WideContext = {
  base: {
    status: z.enum(['draft', 'reviewed']),
    revised: z.coerce.date(),
    summary: z.string().min(1),
  },
  tag: z.string().regex(/^[a-z]+\/[a-z-]+$/),
};

const narrowContext: NarrowContext = {
  base: { title: z.string().min(1) },
  licenseIds: ['CC-BY-4.0', 'MIT'],
};

const defineWideKind = kindDefiner<WideContext>();
const defineNarrowKind = kindDefiner<NarrowContext>();

const mold = defineWideKind({
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
  build: (context) =>
    z
      .object({
        type: z.literal('mold'),
        ...context.base,
        axis: z.enum(['source-specific', 'general']),
        tags: z.array(context.tag).min(1),
      })
      .strict(),
  refine: (frontmatter, issues) => {
    if (frontmatter.axis === 'source-specific' && !frontmatter.summary.includes('source')) {
      issues.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['summary'],
        message: 'source-specific molds must say which source',
      });
    }
  },
});

const pattern = defineWideKind({
  kind: 'pattern',
  title: 'Pattern',
  layer: 'substrate',
  summary: 'A corpus-backed recipe.',
  shape: 'file',
  companions: [],
  build: (context) =>
    z
      .object({
        type: z.literal('pattern'),
        ...context.base,
        pattern_kind: z.enum(['moc', 'recipe']),
      })
      .strict(),
});

const book = defineNarrowKind({
  kind: 'book',
  title: 'Book',
  layer: 'instance',
  summary: 'A book whose chapters are notes.',
  shape: 'directory',
  companions: [],
  additionalCompanions: 'allow',
  build: (context) =>
    z.object({ type: z.literal('book'), ...context.base, license: z.string() }).strict(),
  refine: (frontmatter, issues, kindContext) => {
    if (!kindContext.licenseIds.includes(frontmatter.license)) {
      issues.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['license'],
        message: `unknown license: ${frontmatter.license}`,
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
    const parsedFrontmatter = assemble(mold, wideContext).parse(validMold);
    expect(parsedFrontmatter.axis).toBe('source-specific');
    expect(parsedFrontmatter.revised).toBeInstanceOf(Date);
  });

  it("runs the kind's refine against its own fields", () => {
    const parseResult = assemble(mold, wideContext).safeParse({
      ...validMold,
      summary: 'walks a workflow',
    });
    expect(parseResult.success).toBe(false);
    expect(parseResult.error?.issues[0]?.message).toBe(
      'source-specific molds must say which source',
    );
  });

  it("hands refine the instance's context, not just the data", () => {
    const schema = assemble(book, narrowContext);
    expect(schema.safeParse({ type: 'book', title: 'MSMB', license: 'MIT' }).success).toBe(true);
    const invalidLicenseResult = schema.safeParse({
      type: 'book',
      title: 'MSMB',
      license: 'Proprietary',
    });
    expect(invalidLicenseResult.error?.issues[0]?.message).toBe('unknown license: Proprietary');
  });

  it('assembles a kind with no refine', () => {
    const parsedFrontmatter = assemble(pattern, wideContext).parse({
      type: 'pattern',
      status: 'reviewed',
      revised: '2026-07-28',
      summary: 'a recipe',
      pattern_kind: 'moc',
    });
    expect(parsedFrontmatter.pattern_kind).toBe('moc');
  });

  it('rejects unknown keys — kinds are strict', () => {
    expect(assemble(mold, wideContext).safeParse({ ...validMold, extra: 1 }).success).toBe(false);
  });
});

describe('buildKindUnion', () => {
  const kinds: readonly AnyKindDefinition<WideContext>[] = [mold, pattern];

  it('dispatches on type', () => {
    const union = buildKindUnion(kinds, wideContext);
    expect(union.parse(validMold).type).toBe('mold');
  });

  it("runs the matched kind's refine and not another kind's", () => {
    const union = buildKindUnion(kinds, wideContext);
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
    expect(buildKindUnion(kinds, wideContext).safeParse({ type: 'nope' }).success).toBe(false);
  });

  it('refuses an empty kind list rather than building a union of nothing', () => {
    expect(() => buildKindUnion([], wideContext)).toThrow(/at least one kind/);
  });

  it('still builds from a widened kind array, where the types cannot survive', () => {
    expect(buildKindUnion(kinds, wideContext).safeParse({ ...validMold, extra: 1 }).success).toBe(
      false,
    );
  });
});

type Equals<Left, Right> =
  (<Candidate>() => Candidate extends Left ? 1 : 2) extends <Candidate>() => Candidate extends Right
    ? 1
    : 2
    ? true
    : false;
type MustBeTrue<Condition extends true> = Condition;

type MoldOutput = z.infer<ReturnType<typeof mold.build>>;
export type AxisIsExact = MustBeTrue<Equals<MoldOutput['axis'], 'source-specific' | 'general'>>;
export type StatusIsExact = MustBeTrue<Equals<MoldOutput['status'], 'draft' | 'reviewed'>>;
export type RevisedIsExact = MustBeTrue<Equals<MoldOutput['revised'], Date>>;

type TupleKinds = readonly [typeof mold, typeof pattern];
type UnionOutput = z.infer<ReturnType<typeof buildKindUnion<WideContext, TupleKinds>>>;
export type UnionDiscriminantIsExact = MustBeTrue<Equals<UnionOutput['type'], 'mold' | 'pattern'>>;

type MoldArm = Extract<UnionOutput, { type: 'mold' }>;
export type UnionMoldAxisIsExact = MustBeTrue<
  Equals<MoldArm['axis'], 'source-specific' | 'general'>
>;
export type UnionPatternHasNoAxis = MustBeTrue<
  Equals<'axis' extends keyof Extract<UnionOutput, { type: 'pattern' }> ? true : false, false>
>;

describe('kindDefiner', () => {
  it("infers the kind's shape rather than widening it to the default", () => {
    const parsedFrontmatter = assemble(mold, wideContext).parse(validMold);
    const axis: 'source-specific' | 'general' = parsedFrontmatter.axis;
    const status: 'draft' | 'reviewed' = parsedFrontmatter.status;
    expect([axis, status]).toEqual(['source-specific', 'draft']);
  });

  it('erases the shape for iteration without rejecting the kinds', () => {
    const kinds: readonly AnyKindDefinition<WideContext>[] = [
      mold,
      pattern,
      defineWideKind(pattern),
    ];
    expect(kinds.map((kind) => kind.kind)).toEqual(['mold', 'pattern', 'pattern']);
    expect(kinds.every((kind) => typeof kind.build(wideContext).parse === 'function')).toBe(true);
  });
});
