---
'@galaxy-foundry/content-reader': patch
---

Expose every collection-backed note through `noteTargets()`, preserving colliding routes before
wiki-link aliases and address precedence are applied. Instances can now derive built-page coverage
from the same route policy used by the reader instead of maintaining a hand-written route list.
