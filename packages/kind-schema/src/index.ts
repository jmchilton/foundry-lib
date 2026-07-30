// The kind machinery every Foundry-pattern instance needs, and none of the kinds.
//
// Two instances arrived at this independently — galaxyproject/foundry in
// `packages/note-schema/src/{note-schema.ts,types/context.ts}` and
// jmchilton/statistical-genomics-foundry in `site/src/{lib/frontmatter-schema.ts,types/context.ts}`
// — and the two copies agree line for line on the parts that are here, down to the reasons in
// the comments. That is what makes this extractable rather than speculative: nothing below is a
// generalization invented for a second caller, it is the intersection two callers already wrote.
//
// What stays per-instance is everything that names content: the kind directories, the field
// primitives a kind spreads (one instance's note envelope is one field, the other's is seven),
// and the collection table. Those are the DATA. This package is the MECHANISM over it.
//
// One exception to the paragraph above, stated rather than glossed: `./companions` is NOT an
// intersection two callers already wrote. Both instances answer the question it models — in
// hardcoded allowlists, a per-note frontmatter list, a filename-pairing regex, and a site
// component reading literal paths — but they answer it in prose and by hand, and no two of those
// places agree. It is here as a declaration REPLACING four mechanisms, which is a different and
// weaker claim than the rest of this file makes. See that module's header for the measurements.

import { z } from 'zod';
import type * as core from 'zod/v4/core';

import type { CompanionDeclaration } from './companions.js';

export type { KindLayer } from '@galaxy-foundry/kind-manifest';
export { manifestKinds } from './manifest.js';
export type { ManifestKindExtras } from './manifest.js';
export {
  checkCompanions,
  companionsOf,
  NOTE_FILE,
  type Companion,
  type CompanionCheck,
  type CompanionDeclaration,
  type CompanionDisposition,
  type CompanionRequirement,
  type DirectoryEntry,
  type NormalizedCompanion,
  type NoteShape,
} from './companions.js';

/**
 * Any shape a kind may have: an object carrying the `type` discriminator.
 *
 * `type` is the SOLE discriminator — the kind picks the schema, and nothing infers a kind from
 * a directory, a filename or a tag. Stating it in the bound makes it a property of the contract
 * rather than a convention every kind happens to follow, and it is what lets a consumer route
 * on `type` knowing every kind has one. It is also what lets kinds compose into a
 * `z.discriminatedUnion`, which `buildKindUnion` below relies on.
 */
export type KindShape = { type: z.ZodTypeAny } & z.ZodRawShape;

/**
 * What a kind directory exports.
 *
 * Generic over `Ctx`, the instance's kind context — the bag of field primitives a kind spreads
 * in. That parameter is the whole reason this interface can be shared: the two instances agree
 * exactly on a kind's SHAPE and disagree entirely on what a kind may draw from, so the context
 * is the seam. An instance aliases the parameter away once and its kind files never mention it:
 *
 * ```ts
 * export type KindDefinition<T extends KindShape = KindShape> = LibKindDefinition<KindContext, T>;
 * ```
 *
 * Generic over `T` too, and that is not decoration: a definition annotated `: KindDefinition`
 * widens its shape back to the default, and the erasure travels to whatever reads a note's
 * frontmatter. Kinds go through `defineKind` so it stays INFERRED.
 *
 * How loudly that lands is worth stating precisely, because it varies and an instance should not
 * take its site typecheck for a proof. Measured across the two: widening to the default shape
 * costs 1 `astro check` error in one instance and fails the package build outright in the other;
 * widening to an `any` shape costs 8 errors in one and NONE in the other, since an `any`
 * satisfies every field access rather than failing one. The type-level assertions in this
 * package's tests are the check that does not vary.
 *
 * A kind's FRONTMATTER contract is `build` plus an optional `refine`, and nothing else. There is
 * deliberately no hook for assembling an entry out of anything but its own frontmatter: a note
 * that needs a sibling file's fields gets them materialized into its frontmatter by a generator
 * instead. That keeps every kind a plain object — no file I/O inside a schema, and a kind
 * manifest that reports what a note actually carries.
 *
 * Its LAYOUT contract is `shape` and `companions`, inherited from `CompanionDeclaration`. The two
 * halves are separate on purpose: frontmatter is what a note SAYS, layout is where a note IS, and
 * a kind that only declared the first is why four different places in one instance each grew
 * their own answer to "what files belong to this note?".
 */
export interface KindDefinition<Ctx, T extends KindShape = KindShape> extends CompanionDeclaration {
  /** The `type:` discriminator value. MUST equal the directory name. */
  kind: string;
  /** Display name for the kind catalog. */
  title: string;
  /**
   * `substrate` = a kind the Foundry pattern's other instances also declare; `instance` = one
   * this domain added. The cross-instance catalog groups by this.
   *
   * Named `layer`, not `origin`: a kind is free to declare a frontmatter field called `origin`,
   * and one instance does. One manifest carrying both meanings under one word is a trap for
   * anything reading across instances.
   */
  layer: 'substrate' | 'instance';
  /** One line: what a note of this kind IS. Rendered in the catalog. */
  summary: string;
  /**
   * The strict object this kind validates. Its `.shape` is what the manifest generator walks to
   * derive the required-metadata table, so `build` returns the OBJECT — any refinement goes in
   * the slot below.
   */
  build: (ctx: Ctx) => z.ZodObject<T, core.$strict>;
  /** Cross-field rules over this kind's own fields — the constraints a shape cannot state,
   *  because whether one field is valid depends on another's value. */
  refine?: (data: z.infer<z.ZodObject<T, core.$strict>>, ctx: z.RefinementCtx, kctx: Ctx) => void;
}

/**
 * A kind definition with its shape erased — for code that ITERATES the kinds (the manifest
 * generator, the drift tests) rather than validating with one.
 *
 * `any` rather than `unknown` or `KindShape`: `ZodObject` is effectively invariant in its shape
 * parameter, so a narrower bound here rejects every concrete definition. Nothing reads a field
 * off this type, so the looseness buys iteration and costs nothing.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyKindDefinition<Ctx> = KindDefinition<Ctx, any>;

/**
 * Build the `defineKind` an instance's kind directories wrap their definitions in.
 *
 * Curried, because `defineKind` must be generic in the kind's SHAPE while already fixed to the
 * instance's CONTEXT — and TypeScript gives no way to bind one type parameter of a generic
 * function and leave the other free at the call site. Calling this once per instance is what
 * produces a `defineKind` that infers `T` and never mentions `Ctx`.
 *
 * ```ts
 * export const defineKind = kindDefiner<KindContext>();
 * ```
 */
export function kindDefiner<Ctx>() {
  return <T extends KindShape>(definition: KindDefinition<Ctx, T>): KindDefinition<Ctx, T> =>
    definition;
}

/**
 * One kind's assembled schema: parses that kind's frontmatter, yields that kind's own output.
 *
 * Stated as ONE type rather than left to inference, because inference over the optional
 * `refine` slot yields a UNION of "refined" and "not" — and a union is what turns an ordinary
 * field access on a page into an error, since it would have to hold on both arms.
 */
export type Assembled<T extends KindShape> = z.ZodType<
  z.infer<z.ZodObject<T, core.$strict>>,
  z.input<z.ZodObject<T, core.$strict>>
>;

/**
 * Assemble one kind into the schema its collection validates with.
 *
 * `build` returns the bare strict object so the manifest generator can walk its `.shape`;
 * `refine` is applied here, to that kind's schema alone, so a cross-field rule sees only its
 * own kind's fields. That is what makes `superRefine`'s argument already exactly the payload
 * `refine` declares — no cast on it, unlike the union below.
 */
export function assemble<Ctx, T extends KindShape>(
  definition: KindDefinition<Ctx, T>,
  ctx: Ctx,
): Assembled<T> {
  const object = definition.build(ctx);
  const { refine } = definition;
  const refined = refine ? object.superRefine((d, issues) => refine(d, issues, ctx)) : object;
  return refined as Assembled<T>;
}

/**
 * What each kind in `K` builds, in order — recovering the per-kind types `.map` erases.
 *
 * `infer R extends z.ZodTypeAny` rather than a bare `infer R`, so the result is known to be a
 * schema and can be fed to `z.infer` below. The fallback is `ZodNever` rather than `never`
 * because a `never` member would not satisfy that bound either, and the error would surface at
 * the type alias rather than at whatever passed a non-kind.
 */
type BuiltMembers<K extends readonly unknown[]> = {
  -readonly [I in keyof K]: K[I] extends {
    build: (...args: never[]) => infer R extends z.ZodTypeAny;
  }
    ? R
    : z.ZodNever;
};

/**
 * The union's schema: parses any kind's frontmatter, yields the union of their outputs.
 *
 * Stated as one `z.ZodType` over `BuiltMembers<K>[number]` rather than as a `ZodDiscriminatedUnion`
 * of a reconstructed tuple, for the same reason `Assembled` is: naming zod's wrapper types means
 * the declared type has to track what `.superRefine` returns, and getting that wrong erases
 * exactly what this is here to preserve. Distributing `z.infer` over the member union does not.
 */
export type AssembledUnion<K extends readonly unknown[]> = z.ZodType<
  z.infer<BuiltMembers<K>[number]>,
  z.input<BuiltMembers<K>[number]>
>;

/**
 * Every kind in one schema, dispatching on `type` — for a consumer that validates a mixed
 * corpus and does not know a note's kind before reading it.
 *
 * Per-kind assembly (`assemble`) is what a per-collection loader wants; this is for the
 * validator walking everything at once. An instance may need only one of the two — the union is
 * not required to use this package.
 *
 * Generic over the kind LIST, not just the context, and that is load-bearing rather than
 * decorative. `.map` over the kinds returns a homogeneous array, so a signature that took
 * `readonly AnyKindDefinition<Ctx>[]` would hand every caller back a union whose output is
 * `unknown` with an index signature — every field access compiling and yielding nothing. A
 * consumer that re-exports this schema's type from its own published API would pass that
 * erasure on to people who never called this function. Pass a tuple (`[...] as const`) and the
 * per-member types survive; pass a widened array and the output degrades to `any`, as before.
 *
 * The cast on `members` is still unavoidable — `z.discriminatedUnion` demands a non-empty tuple
 * — but it is now contained: the declared return type reconstructs what the cast threw away.
 */
export function buildKindUnion<Ctx, K extends readonly AnyKindDefinition<Ctx>[]>(
  kinds: K,
  ctx: Ctx,
): AssembledUnion<K> {
  if (kinds.length === 0) throw new Error('buildKindUnion needs at least one kind');

  const byName = new Map(kinds.map((k) => [k.kind, k]));
  const members = kinds.map((k) => k.build(ctx)) as unknown as readonly [
    z.ZodObject<KindShape, core.$strict>,
    ...z.ZodObject<KindShape, core.$strict>[],
  ];

  return z.discriminatedUnion('type', members).superRefine((d, issues) => {
    const definition = byName.get((d as { type: string }).type);
    definition?.refine?.(d as never, issues, ctx);
  }) as unknown as AssembledUnion<K>;
}
