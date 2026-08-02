# @galaxy-foundry/wiki-links

## 0.3.0

### Minor Changes

- [#32](https://github.com/jmchilton/foundry-lib/pull/32) [`715e775`](https://github.com/jmchilton/foundry-lib/commit/715e7755718a64ecba0f22d664a9767f3965ecef) Thanks [@jmchilton](https://github.com/jmchilton)! - Hold "a backtick means the syntax, not a link" on the string layer too.

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

## 0.2.0

### Minor Changes

- [#28](https://github.com/jmchilton/foundry-lib/pull/28) [`d3c6cd4`](https://github.com/jmchilton/foundry-lib/commit/d3c6cd45e6a95e8c8a30d85d81cdb88d74d64613) Thanks [@jmchilton](https://github.com/jmchilton)! - Absorb two site helpers both Foundry instances had written twice.

  Additive only — no existing export changes.

  `license-policy` gains `loadLicenseFiles(dir)`, `findLicenseFile(dir, id)`,
  `licenseIdFromFile(path)` and `LICENSE_FILE_EXT`, plus the `LicenseFile` type. The table
  already declares a `license_file` obligation ("a verbatim copy must accompany the carry");
  this reads the copies that satisfy it, conventionally `LICENSES/<id>.LICENSE`. The two
  instances' readers were byte-identical, one of them carrying a comment admitting it was
  cribbed from the other.

  The directory is a parameter rather than a resolved `../LICENSES`. The callers are Astro
  pages whose cwd is a subdirectory, and an implicit relative path is precisely the thing that
  does not survive being shared.

  `wiki-links` gains `addBoldTermAnchors(html)` and `slugifyTerm(term)`. `parseWikiLink`
  already carries `#section` through to the href without asking whether anything answers to
  it; for a glossary rendered from loose markdown nothing does unless something mints the ids.
  That is the other half of the same contract, so it stops living in two site trees.

  **`slugifyTerm` is deliberately NOT `slugify`.** They diverge on spaced hyphens (`A - B` →
  `a---b` vs `a-b`), underscores (kept vs dropped) and repeated hyphens (kept vs collapsed).
  Both glossaries already carry ids minted by `slugifyTerm`, so unifying them would silently
  repoint every existing `#term` deep link — a break no build would catch. A test pins each
  divergent case.

## 0.1.0

### Minor Changes

- [#12](https://github.com/jmchilton/foundry-lib/pull/12) [`6b85663`](https://github.com/jmchilton/foundry-lib/commit/6b85663ebeca747ebfe4287c34c777f9d85c06a5) Thanks [@jmchilton](https://github.com/jmchilton)! - New package: the `[[Target]]` wiki-link grammar and the resolver both a Foundry's renderers
  and its validator run on.

  Ships no link map — which notes exist and what each is addressable by does not transfer
  between instances. What transfers is the grammar and the lookup rule, which three repos had
  independently arrived at and written four byte-identical copies of `slugify` for.

  Two rules are settled here rather than left implicit, because they were the source of every
  divergence found during the extraction:

  - **Resolution is exact.** No prefix fallback. Surveyed across ~4,200 links in two Foundries,
    prefix matching resolved exactly two — an ellipsis (`[[...]]`, which slugifies to the empty
    string and therefore prefixes every key) and a deliberate glob (`[[murrell-*]]`, meaning two
    papers, narrowed to one). Both were bugs.
  - **A backtick means the syntax, not a link.** The `./remark` transform rewrites text nodes
    only. `` `[[Target]]` `` is how the docs name the token and how a note names a slot it
    cannot link.

  Dependency-free, including the remark transform: the walk is short, and taking
  `unist-util-visit` or `@types/mdast` would couple every consuming site to a version pinned
  here.
