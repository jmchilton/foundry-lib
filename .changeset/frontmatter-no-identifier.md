---
'@galaxy-foundry/audit-citations': patch
---

Stop turning a declared absence of identifiers into a citation to resolve.

A source note may describe a source that has no identifier at all — a chapter of a web textbook, a
package reference manual, an unpublished working paper — and say so in its typed frontmatter.
`noteFrontmatter` read the description anyway and emitted a candidate with no identifiers, which
falls back to a title query. That asks a provider to guess at a record the note has already stated
does not exist, and the guess comes back as an unresolved or mismatched citation against a note that
is correct.

A frontmatter block now produces a candidate only when it names at least one identifier. A numbered
bibliography entry is unchanged: there a missing DOI is an absence rather than a declaration, and
the title fallback is the only way to check it at all.

Adopting corpora will see those candidates leave the run. Regenerate the committed report; no
evidence is invalidated.
