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
export interface KindDefinition<
  Context,
  Shape extends KindShape = KindShape,
> extends CompanionDeclaration {
  kind: string;
  title: string;
  layer: 'substrate' | 'instance';
  summary: string;
  build: (context: Context) => z.ZodObject<Shape, core.$strict>;
  refine?: (
    frontmatter: z.infer<z.ZodObject<Shape, core.$strict>>,
    refinementContext: z.RefinementCtx,
    kindContext: Context,
  ) => void;
}

/**
 * A kind definition with its shape erased for heterogeneous collections.
 * `any` is required because zod object shapes are effectively invariant.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyKindDefinition<Context> = KindDefinition<Context, any>;

export function kindDefiner<Context>() {
  return <Shape extends KindShape>(
    definition: KindDefinition<Context, Shape>,
  ): KindDefinition<Context, Shape> => definition;
}

export type Assembled<Shape extends KindShape> = z.ZodType<
  z.infer<z.ZodObject<Shape, core.$strict>>,
  z.input<z.ZodObject<Shape, core.$strict>>
>;

export function assemble<Context, Shape extends KindShape>(
  definition: KindDefinition<Context, Shape>,
  context: Context,
): Assembled<Shape> {
  const schema = definition.build(context);
  const { refine } = definition;
  const refinedSchema = refine
    ? schema.superRefine((frontmatter, issues) => refine(frontmatter, issues, context))
    : schema;
  return refinedSchema as Assembled<Shape>;
}

type BuiltMembers<Kinds extends readonly unknown[]> = {
  -readonly [Index in keyof Kinds]: Kinds[Index] extends {
    build: (...args: never[]) => infer BuiltSchema extends z.ZodTypeAny;
  }
    ? BuiltSchema
    : z.ZodNever;
};

export type AssembledUnion<Kinds extends readonly unknown[]> = z.ZodType<
  z.infer<BuiltMembers<Kinds>[number]>,
  z.input<BuiltMembers<Kinds>[number]>
>;

export function buildKindUnion<Context, Kinds extends readonly AnyKindDefinition<Context>[]>(
  kinds: Kinds,
  context: Context,
): AssembledUnion<Kinds> {
  if (kinds.length === 0) throw new Error('buildKindUnion needs at least one kind');

  const definitionsByKind = new Map(kinds.map((kind) => [kind.kind, kind]));
  const memberSchemas = kinds.map((kind) => kind.build(context)) as unknown as readonly [
    z.ZodObject<KindShape, core.$strict>,
    ...z.ZodObject<KindShape, core.$strict>[],
  ];

  return z.discriminatedUnion('type', memberSchemas).superRefine((frontmatter, issues) => {
    const definition = definitionsByKind.get((frontmatter as { type: string }).type);
    definition?.refine?.(frontmatter as never, issues, context);
  }) as unknown as AssembledUnion<Kinds>;
}
