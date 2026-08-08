---
'@galaxy-foundry/content-reader': minor
---

Expose `contentIndex()`: one deterministic collection-backed note list plus an alias-aware address
map pointing to the same source records. Build-time consumers such as casters can now derive source
paths and parsed frontmatter from the reader's existing walk instead of maintaining a second content
index and duplicate alias precedence.
