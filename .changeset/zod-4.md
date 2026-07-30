---
'@galaxy-foundry/kind-manifest': minor
'@galaxy-foundry/kind-schema': minor
---

Move the `zod` peer dependency to v4.

**Breaking: the peer range is now `zod@^4` with no v3 fallback.** Supporting both majors was
considered and rejected — `describeType` reads zod internals, and a dual-major branch on
internals is the kind of code that silently renders every field as `any` on the arm nobody
tests. An instance upgrades zod and these packages together.

`kind-manifest`:

- `describeType` reads `_zod.def.type` instead of `_def.typeName`. Every tag was renamed
  (`ZodString` → `string`), and three accessors moved with them: an array's element is
  `element` not `type`, a literal carries `values` (an array — v4 literals may hold several)
  not `value`, and an enum carries `entries` (an object) not `values`.
- `ZodEffects` is gone. Only `.transform()` still wraps, as a `pipe` whose `in` is the source
  type; `.refine()` now leaves the type alone and hangs a check off it, so a refined string
  describes as `string` without help.
- A discriminated union tags as plain `union` — the discriminator moved into the def — so the
  two cases collapse to one.
- `describeFields` casts the shape's values to the classic schema type. v4 types a
  `ZodRawShape`'s values as the CORE type, which carries neither `.isOptional()` nor enough
  structure to walk.

`kind-schema`:

- `z.ZodObject<T, 'strict'>` becomes `z.ZodObject<T, core.$strict>`; the second parameter is a
  config object in v4, not a mode string.
- `Assembled` and `AssembledUnion` drop the middle `z.ZodTypeDef` parameter, which v4 removed —
  `z.ZodType` is now `<Output, Input>`.

`superRefine`, `RefinementCtx`, `discriminatedUnion`, `ZodTypeAny` and `.strict()` all survive
v4 unchanged, so `assemble` and `buildKindUnion` keep their existing bodies. The type-level
assertions in `kind-schema`'s tests — the ones holding "a kind's shape survives assembly" — pass
unmodified; only the v3-spelled `ZodEnum<['draft','reviewed']>` fixture moved to v4's
record-keyed `ZodEnum<{ draft: 'draft'; reviewed: 'reviewed' }>`.
