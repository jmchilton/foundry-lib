---
'@galaxy-foundry/site-kit': minor
---

Ship the note frame, and make `ContentNote` the page around it rather than a second one.

`NoteHeader` renders where you are, what kind of thing the note is, what it is called, what it says,
how it is filed, and where its source lives. Over what `ContentNote` drew it adds an eyebrow naming
the kind, a status badge, raw/copy actions, and `data-pagefind-weight="10"` on the summary — so a
note's own summary outranks its body in search instead of ranking behind any page that mentions the
term in passing. That attribute sits on an element no instance renders, which is why it could not
be fixed downstream.

`ContentNote` now composes it and keeps only what a page adds: the `metadata` and `reference` slots
and the article boundary. The alternative was two frames, one richer, sharing a back link, a
summary, a tags row and the Pagefind attributes between two renderings — and scoped styles mean an
instance cannot correct whichever one it was handed.

Three seams are deliberate:

- **`eyebrow` is a resolved string, not a kind.** The label table belongs where the kinds are
  declared and typed against them, so adding a kind is a compile error there rather than an eyebrow
  printing a raw type string here.
- **`status` renders as `data-status`, not as `badge-${status}`.** The vocabulary stays the
  instance's — a status it adds is styled by a rule in its own sheet and costs no release here, the
  seam `LicenseBadge` already uses for `data-policy`. A value with no rule renders as bare text
  rather than as nothing.
- **`rawHref`'s presence is the switch**, replacing a `showActions` flag beside a URL. The two could
  disagree, and disagreeing meant a Raw link pointing at nothing.

The Copy button's handler ships inside the component. Wired from the page instead, an instance that
adopts the component and not the script gets a control that looks live and does nothing, and
nothing fails on either side.

`NOTE_HEADER_TOKENS` / `noteHeaderStyleGaps` name the theme roles the frame reads, asserted in both
directions against the component source: a token exported but unread, or read but unexported, fails
in the package. Scoped styles mean this list is the entire surface an instance can steer the frame
through.

**Breaking for `ContentNote` callers**, all of it visible at the type level except the last:

- `eyebrow` is required. A note's kind was already on the page in every instance rendering this —
  as a pill in the `badges` slot — and the eyebrow is where the frame puts it.
- `showHeading` now defaults to **true**: the frame owns the `<h1>` unless a body says it owns its
  own. It defaulted to false here, so a caller relying on the default renders one heading where it
  rendered none. Pass `showHeading={false}` for a Markdown body that opens with its own H1.
- The `metadata` slot moves below the header, and the tags row moves from above the heading to
  below the summary. Nothing needs editing for either; the page reorders.
