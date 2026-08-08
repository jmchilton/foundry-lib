---
'@galaxy-foundry/audit-citations': patch
---

Read two citation forms that were previously reported as defects in correct notes.

A DOI containing parentheses must be percent-encoded to survive a Markdown link, since an unescaped
closing parenthesis would end it. Extraction stopped at the first escape and queried a truncated
DOI that no agency registers, reporting a correctly cited work as unresolved. DOI matching now
accepts `%` and decodes the identifier, keeping it as written when it holds a literal `%` that
`decodeURIComponent` rejects.

Vancouver style writes given names as an unpunctuated run after the family name — `Domingos AI`
against a provider's `Ana I Domingos`. The run normalized to a single token that matched nothing,
so three correctly cited authors read as a fabricated list. A name is now compared with such a run
expanded into one token per letter, refused for a leading token and for a name with no lowercase
letter anywhere, so that a short family name in capitals is not mistaken for initials.
