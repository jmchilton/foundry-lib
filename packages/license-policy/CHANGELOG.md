# @galaxy-foundry/license-policy

## 0.4.1

### Patch Changes

- [#90](https://github.com/jmchilton/foundry-lib/pull/90) [`8e23106`](https://github.com/jmchilton/foundry-lib/commit/8e23106ae52fec1b63f6ab7398b91501a32fd2af) Thanks [@jmchilton](https://github.com/jmchilton)! - Name an uncurated `LicenseRef-` after itself instead of reporting it as unresolved. Such a ref
  identifies a real licence the table has not curated, so every policy field of the `default` row
  still applies to it verbatim — `policy`, `license_file`, `copyleft`, `defect`, and the table's own
  `obligations` — because its terms are genuinely unknown. Only `name` differs, which states identity
  rather than policy: the default row's "unresolved / missing" said a resolved licence was absent. A
  curated row still wins, and remains the right move for a ref that recurs. Adds a `LicenseBadge`
  specimen for the state, which renders identically to the unresolved one apart from the label.

## 0.4.0

### Minor Changes

- [#68](https://github.com/jmchilton/foundry-lib/pull/68) [`e5c7578`](https://github.com/jmchilton/foundry-lib/commit/e5c75788a78b0f3cd1eb688743b5fd7cf0072f3f) Thanks [@jmchilton](https://github.com/jmchilton)! - **Breaking:** `licenseIdFromFilePath` is now `licenseFileIdFromPath`, and `LicenseFile.licenseId`
  is now `LicenseFile.id`. Two new documented types, `LicenseId` and `LicenseFileId`, say which id a
  signature means.

  The package exported two different ids under one name. `licenseId` meant an SPDX id — `MIT`,
  `CC-BY-4.0`, what a note's `license:` carries and what `resolveLicenseRow` takes — except in
  `license-files.ts`, where it meant the stem of a vendored filename: `msmb`, `nf-schema`. Those name
  the **source** whose licence text was vendored, never a licence. `msmb.LICENSE` holds
  CC-BY-NC-SA-2.0.

  The two met on one line of a consumer's route, comparing a file stem to a file stem while reading
  as a licence comparison, and the site's `/licenses/<id>/` pages are keyed by the first while their
  subject is the second.

  Nothing enforces the distinction at runtime — both are strings off a filesystem — so the names
  carry it, and a new test pins the failure the old name invited: `findLicenseFileById` handed a
  `LicenseId` returns `undefined`. Not an error, not the wrong file; a silent miss that reads as
  "this source vendored nothing".

  Consumers rename the import and the field; no behaviour changed.

- [#68](https://github.com/jmchilton/foundry-lib/pull/68) [`fec0034`](https://github.com/jmchilton/foundry-lib/commit/fec003499b307fe2163ad0460f40eb375d86ee85) Thanks [@jmchilton](https://github.com/jmchilton)! - The vendored-licence route: `LicenseFileBody.astro`, `licenseFileHref`, `licensesUnderFile`,
  `LICENSE_FILE_ROUTE`, and `redistributesUnder` beside the table.

  Both instances built a page per vendored `LICENSES/*.LICENSE` copy, and the parts that were
  identical were the derivations rather than the markup: which licences a copy covers, which notes
  redistribute under it, and the copy's own text. The parts that genuinely differ — walking one note
  collection versus three, `/{id}/` versus `/{collection}/{id}/` — stay with the instance, so `uses`
  is a prop rather than something the component discovers.

  `redistributesUnder(note.license_file, licenseFile.id)` names the comparison that was previously
  written as `licenseIdFromFilePath(...) === license.licenseId`: a file id against a file id, in an
  expression that scanned as a licence check. A copy is keyed by SOURCE, so two books under one
  licence have two copies and one source's page must not list the other's notes.

  `LICENSE_FILE_ROUTE` and `licenseFileHref` exist because `/licenses/` was typed inline in the page
  that builds the route and again in every component linking to it — in two repositories. The route
  and its links agreed by coincidence, and a drift between them builds clean and 404s for readers.

  The body renders the licence text with its bare URLs linked. One instance did that already; the
  other rendered a `<pre>` a reader had to retype the canonical terms from. Everything outside a
  matched URL is emitted verbatim, whitespace included, which is what the `license_file` obligation
  is for.

  The page's `<h1>` and wrapper stay with the instance on purpose: one site marks this route with
  `data-pagefind-body`, and Pagefind reads the first such mark as "index only pages like this one".
  A component shipping the wrapper would decide a site's entire search index from inside a licence
  page.

## 0.3.1

### Patch Changes

- [#49](https://github.com/jmchilton/foundry-lib/pull/49) [`4e3f1d7`](https://github.com/jmchilton/foundry-lib/commit/4e3f1d70983262c58c6824969ea9e7daedc74198) Thanks [@jmchilton](https://github.com/jmchilton)! - Retire `modes.condense`.

  **Breaking:** `condense` is no longer a term in the inherited `modes` vocabulary. An instance
  that narrows to it now gets the unknown-term error, which is the intended reading — the word is
  gone, not deprecated.

  It was kept on the argument that the shared vocabulary belongs to the pattern rather than to any
  instance, and that removing a term would say no Foundry may ever have an LLM phase. Two things
  undid that. The pattern's own model no longer names condensation as a transform mode, so the
  reason had lost its referent. And both instances had already declined the term through `narrow`,
  independently, for the same reason: a mode with no renderer is a word an author can spell and no
  caster can perform. A capacity nobody has built, that every instance separately refuses, is not
  capacity — it is a term waiting for the one instance that forgets to decline it.

  Nothing casts differently. No instance had a live `condense` reference, and both were already
  narrowing it away; this removes the narrowing's reason to exist rather than any behaviour. An
  instance that wants an LLM phase adds the term back with the renderer that performs it, which is
  the same bargain every other mode is under.

  The narrowing examples in the README and guide move to `sidecar`, which is a live one: one
  instance implements it, the other narrows it out having written no renderer.

  Two pieces of prose that named the retired term are corrected with it — the license table's note
  on the `allowed_modes` column it no longer has, and a README paragraph still counting four
  shipped-table invariants when three of the four went with that column.

## 0.3.0

### Minor Changes

- [#42](https://github.com/jmchilton/foundry-lib/pull/42) [`15c20a0`](https://github.com/jmchilton/foundry-lib/commit/15c20a0886a2af63a93d1b1c891b7b8666e545bb) Thanks [@jmchilton](https://github.com/jmchilton)! - Stop policing Foundry-authored notes with the redistribution table.

  `applyLicensePolicy` treated the presence of a `license` field as proof that third-party content
  was being redistributed, and asked `mode` whether it was permitted. Both were wrong. An instance
  whose corpus is written from published sources records the source's license on its own notes, for
  attribution — and `mode` describes how a bundle is built, never whether text may be carried.

  The table already said so. `global_rules.foundry_content_out_of_scope` reads "this table governs
  third-party pass-through content only. Foundry-authored notes are covered by the root LICENSE and
  are never conflated with it," and nothing implemented it.

  `declaresVerbatimCarry` now lives in `@galaxy-foundry/license-policy` beside that rule, and the
  cast-time check consults it. The question is about the source and is settled when the note is
  written, so it keys off the note's `derived` posture — new on `ProvenanceRefEntry`, a widening of
  provenance v4. Notes that keep load-bearing quotes still carry protected expression and are still
  governed; only own-words prose is out of scope. `license_file_hash` stamping is unchanged, because
  recording what a note cites is provenance rather than permission.

  The nine `own-words-only` rows drop `[condense]` for `[]`. No instance implements `condense`, and
  condensing at cast time would still require the restricted text in the repository to condense
  from. Such a source is used by summarizing it when the note is written, which takes the note out
  of this table entirely.

  **Breaking:** the `allowed_modes` column is gone, along with `allowsMode` and the `CastMode`
  type. A license constrains what a note may contain, never how a bundle is assembled from it, so
  mapping a license to casting transforms was the wrong axis — and the column was derivable from
  (`policy`, `copyleft`) on every row without exception, which is how it went unnoticed. `policy`
  is now the whole answer: pass-through content under an `own-words-only` row may not be carried in
  any form, and under a `verbatim-ok` row it may be, subject to `license_file` and `copyleft`.

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

## 0.1.1

### Patch Changes

- [#5](https://github.com/jmchilton/foundry-lib/pull/5) [`f36be24`](https://github.com/jmchilton/foundry-lib/commit/f36be24e0a935f41372ba206e10b2ae0d7a6cc3f) Thanks [@jmchilton](https://github.com/jmchilton)! - Assert three more invariants on the shipped table: an own-words-only row may not permit
  `sidecar` either, a verbatim-ok row must require its `license_file`, and no row may permit
  nothing at all.

  Tests only — the table and the loader are unchanged. These were being asserted in an
  instance's own suite against its hand-mirrored copy; they are properties of the shipped
  table, so they move here rather than being deleted along with that copy.

## 0.1.0

### Minor Changes

- [`febdb87`](https://github.com/jmchilton/foundry-lib/commit/febdb874cec407f86ce5d7b97092da4ca7c51569) Thanks [@jmchilton](https://github.com/jmchilton)! - Initial release: the shared license → redistribution-policy table plus its loader.

  Ships the 268-line table (23 curated SPDX rows, a deny-by-default `default` row, five
  `global_rules`) that two Foundry instances previously kept as hand-mirrored copies, together
  with `bundledPolicy()`, strict parsing/validation, id resolution, and `bundledPolicyText()`
  for conformance-testing a local copy.

  Deliberately excludes license _coherence_ rules — the two instances enforce genuinely
  different ones today, so those stay instance-local until they converge.
