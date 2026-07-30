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

export type KindShape = { type: z.ZodTypeAny } & z.ZodRawShape;

/**
 * A kind's frontmatter schema and companion-file layout.
 *
 * Keep `T` inferred through `kindDefiner`; annotating it with the default widens the schema.
 */
export interface KindDefinition<Ctx, T extends KindShape = KindShape> extends CompanionDeclaration {
  kind: string;
  title: string;
  layer: 'substrate' | 'instance';
  summary: string;
  build: (ctx: Ctx) => z.ZodObject<T, core.$strict>;
  refine?: (data: z.infer<z.ZodObject<T, core.$strict>>, ctx: z.RefinementCtx, kctx: Ctx) => void;
}

/**
 * A kind definition with its shape erased for heterogeneous collections.
 * `any` is required because zod object shapes are effectively invariant.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyKindDefinition<Ctx> = KindDefinition<Ctx, any>;

export function kindDefiner<Ctx>() {
  return <T extends KindShape>(definition: KindDefinition<Ctx, T>): KindDefinition<Ctx, T> =>
    definition;
}

export type Assembled<T extends KindShape> = z.ZodType<
  z.infer<z.ZodObject<T, core.$strict>>,
  z.input<z.ZodObject<T, core.$strict>>
>;

export function assemble<Ctx, T extends KindShape>(
  definition: KindDefinition<Ctx, T>,
  ctx: Ctx,
): Assembled<T> {
  const object = definition.build(ctx);
  const { refine } = definition;
  const refined = refine ? object.superRefine((d, issues) => refine(d, issues, ctx)) : object;
  return refined as Assembled<T>;
}

type BuiltMembers<K extends readonly unknown[]> = {
  -readonly [I in keyof K]: K[I] extends {
    build: (...args: never[]) => infer R extends z.ZodTypeAny;
  }
    ? R
    : z.ZodNever;
};

export type AssembledUnion<K extends readonly unknown[]> = z.ZodType<
  z.infer<BuiltMembers<K>[number]>,
  z.input<BuiltMembers<K>[number]>
>;

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
