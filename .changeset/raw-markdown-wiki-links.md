---
'@galaxy-foundry/wiki-links': minor
---

Hold "a backtick means the syntax, not a link" on the string layer too.

Additive — no existing export changes. `WikiLinkDestination` moves to the barrel and is
re-exported from `./remark`, so importing it from either path keeps working.

`resolveWikiLinksInMarkdown(markdown, { resolve })` rewrites `[[Target]]` in RAW markdown,
taking the same `resolve` callback as the remark transform and rendering the same fallbacks: a
resolved link becomes `[display](href#anchor)`, an unresolved one `**display**`.

The remark transform gets the rule for free — a backticked link arrives as `inlineCode` and is
never visited. A page that resolves links BEFORE parsing has no such structure to lean on, and
both instances filled that gap with the same `/\[\[([^[\]]+)\]\]/g` over the whole document.
That rewrites inside code spans, and what it corrupted first was each glossary's own definition
of the thing being named:

| glossary             | how it rendered                                                       |
| -------------------- | --------------------------------------------------------------------- |
| statistical-genomics | ``**Wiki link** — `**Target**`.``                                     |
| galaxy-workflow      | ``… Either Mold-shaped (`mold: **...**`, optionally `loop: true`) …`` |

Both are live today, and neither is reported by anything: the link takes the bold fallback
because `Target` and `...` resolve to nothing, and a validator strips code spans before
scanning — so the renderer and the checker go blind on the same text at the same time. (`[[...]]`
slugifying to the empty string is already documented here as one of the two links that
prefix-matching ever "resolved".)

Masking covers fenced blocks — backtick and tilde, respecting fence length, unclosed fences, and
a backtick fence whose info string disqualifies it — and inline spans, where a run of N
backticks is closed by the next run of exactly N and an unmatched run stays literal text. It
does NOT cover indented four-space blocks or raw HTML blocks: distinguishing those from a list
continuation line needs real block parsing, and a glossary of `**Term** — …` paragraphs has
neither. Stated in the README rather than left to be discovered.
