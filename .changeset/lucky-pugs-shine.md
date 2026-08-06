---
'@galaxy-foundry/site-kit': minor
---

Specimens for every component the package ships, not four of six.

`LICENSE_BADGE_SPECIMENS` and `LICENSE_FILE_SPECIMENS` cover the licence badge and the licence-file
body — read against the table `@galaxy-foundry/license-policy` bundles rather than an invented one,
because what a licence permits is the same in every instance. `LicenseBadgeProps` and
`LicenseFileBodyProps` are exported for the same reason the other four are: a caller building props
should type them against the declaration the component reads them from.

A test now compares the groups against the components directory in both directions, so a component
that ships with no cases fails in the package rather than being noticed by whoever builds a gallery.
