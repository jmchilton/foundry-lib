---
'@galaxy-foundry/reference-contract': patch
'@galaxy-foundry/site-kit': patch
---

Point reference-contract term documentation at the rendered Foundry Pattern page, and correct
site-kit's peer metadata to the Pagefind 2 component contract its shipped Astro source uses.

The Pagefind range correction excludes no published compatible version: `astro-pagefind` moved from
1.8.6 directly to 2.0.0, so the former `>=1.9` range already resolved only to 2.x releases.
