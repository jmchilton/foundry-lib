---
'@galaxy-foundry/audit-citations': minor
---

Export the configuration-to-options mappings so the CLI and a consumer cannot read a corpus
differently.

Turning a `CitationAuditConfig` into extraction and resolver options was left to each caller, and
there is always more than one: the CLI writes the report, and a consumer that verifies a committed
report replays the audit itself. When a config field reached one caller and not the other, the
report was produced by reading the corpus one way and checked by reading it another, and both runs
passed. Adding `noteFrontmatter` in 0.2.0 did exactly that.

`citationExtractionOptions(config)` and `scholarlyResolverOptions(config)` are now exported from
`@galaxy-foundry/audit-citations/config`, and the CLI calls them. A new configuration field reaches
every caller through those two, and a test asserts each field is claimed by one of them or by
corpus selection.

Additive. `referenceHeadingPattern` is unchanged, and a caller that maps by hand keeps working.
