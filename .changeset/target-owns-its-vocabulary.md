---
'@galaxy-foundry/cast': minor
---

The target names the document a cast writes, and what a cast is called.

`SKILL.md` was written into the caster, along with the noun "skill" that `runtimeProcedureBody`
substituted for `Mold` and that `skillSummary` fell back to. All three are one agent harness's
vocabulary, not casting's — a target shipping pages or cards got the first Foundry's filename
and was told by its own documents that it shipped skills.

**Breaking.** `_target.yml` must now declare:

```yaml
document:
  path: SKILL.md
  noun: skill
```

Both fields are required and neither has a default. A default would be the same assumption
spelled as a fallback, no longer visible in any target file — and this is the class of mistake
the byte-identity oracle cannot catch, because it re-casts the one instance whose vocabulary
the hardcoded value already is. The wrong answer and the right answer are the same bytes.

`document.path` must be a filename at the bundle root. Placed in a subdirectory it would land
inside a subtree the orphan sweep owns and be deleted on the next cast.

**Breaking for callers.** `runtimeProcedureBody(body, moldName, noun)` and
`skillSummary(meta, moldName, noun)` take the noun; `renderSkillMarkdown` takes a `noun` field.

`required_outputs` now defaults to `[document.path, '_provenance.json']`. Spelling those out by
hand restated what casting always writes, and a restatement is only ever a chance to disagree.

`_provenance.json` stays the caster's, exported as `PROVENANCE_FILE`. Everything that reads a
bundle without knowing which target produced it finds the record by that name.

Not addressed, and named in the code rather than generalised on one example: the document's
`name:`/`description:` frontmatter. The target already declares that pair in
`skill_constraints.frontmatter_required` and the caster still hardcodes it, but closing the gap
needs a rule for which value fills a declared key — which needs a second target to design against.
