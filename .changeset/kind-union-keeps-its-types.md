---
'@galaxy-foundry/kind-schema': minor
---

`buildKindUnion` is now generic over the kind list, so the union keeps its members' types.

Previously it took `readonly AnyKindDefinition<Ctx>[]` and `z.infer` of the result was `unknown`
with an index signature — every field access compiling and yielding nothing. That was fine for
the validators both instances wrote, which only call `safeParse` and read the issues, but not for
`galaxyproject/foundry`, which re-exports the union's type as `NoteSchema` from its own published
package. Its consumers were being handed the erasure without ever calling this one.

Pass a tuple (`[...] as const`) and the per-member types survive; pass a widened array and the
output still degrades to `any`, exactly as before. Validation is unchanged either way.

Type-level assertions in the test suite now pin the discriminant and the per-arm shapes, so the
next signature that erases them fails to compile rather than passing quietly.
