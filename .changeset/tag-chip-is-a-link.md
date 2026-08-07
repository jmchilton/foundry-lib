---
'@galaxy-foundry/site-kit': minor
---

A tag chip is coloured as a link, because that is what it is.

`TagChips` drew a bordered mono pill on `--color-surface-raised`. Both instances that arrived at
this component use exactly that treatment for frontmatter shown as written — a Pattern's pole, a
design record's shelf, a note's status — so the chip and the pill beside it differed only in corner
radius: same surface, same border colour, same face, same size, and on a status pill the same text
colour. Both are legible. Neither says which one is clickable.

Both instances had already removed that pill before the package reintroduced it, and one of them
recorded why in the test it wrote at the time: "A chip spelled out at the call site renders on the
right page, in the right place, with the right text, and is simply a different chip." Adopting the
package put the chip back and rewrote the rule to permit it.

The instance could not have corrected this. These styles are scoped, so an instance's own `.tag`
rule cannot reach a rendered chip; `CONTENT_READER_TOKENS` is the entire surface it can steer them
through. So the list is now what the chip actually reads: `--color-surface-hover`, `--color-link`,
`--color-accent` and `--color-chrome` replace `--color-brand`, `--color-surface-raised`,
`--color-border-subtle` and `--font-mono`. Both instances already declare all four, at identical
values.

Also pinned here: a linked chip carries the chip class. The linked form is the one every note page
renders and the one nothing checked — the existing case read its `href` and said nothing about its
class, so the only spelling under test was the unlinked one no adopting instance renders.
