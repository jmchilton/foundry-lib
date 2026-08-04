---
'@galaxy-foundry/audit-citations': patch
---

Run the packaged `foundry-audit-citations` command when a package manager invokes it through its
`.bin` symlink. The direct-execution guard now compares real paths instead of mistaking the symlink
for an import and exiting successfully without producing output.
