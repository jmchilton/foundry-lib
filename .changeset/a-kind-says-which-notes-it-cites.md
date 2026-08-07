---
'@galaxy-foundry/cast': minor
---

A kind declares the note types it cites.

`cast.note_types` is a new optional list on a kind's `cast:` block, defaulting to the kind's own
name — which is exactly what the caster asserted outright before.

That assertion held because the first Foundry names each kind after the notes it points at: a
`research` ref reaches a `type: research` note. That is a fact about that corpus, not about
casting. The second instance splits its research corpus by publication shape, so one `research`
kind cites `paper`, `book` and `tutorial` notes, and every such ref failed. The repairs available
were renaming the kind after one of the three types it cites, or retyping the corpus to match the
citation — both deforming a corpus to satisfy the caster.

```yaml
research:
  cast:
    resolve: note
    default_mode: verbatim
    note_types: [paper, book, tutorial]
    companions: false
```

Not breaking: a contract that declares nothing behaves exactly as before, and the error message
now lists the accepted types rather than the kind name.

An empty list is refused. A kind that cannot be cast says so by having no `cast:` block at all;
an empty `note_types` would be a kind that is castable in principle and fails every reference in
practice.
