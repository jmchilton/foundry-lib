// The document a cast writes, and which of the words in it belong to the target rather than to
// casting.
//
// "Mold" is the pattern's own noun and stays. "Skill" is not: it is what one harness calls the
// thing a cast produces, and a target that produces something else — a page, a card, a prompt —
// gets the same document with the wrong word in it. The byte-identity oracle cannot see this,
// because it runs against the one instance whose noun it already is.

import { describe, expect, it } from 'vitest';

import { renderSkillMarkdown, runtimeProcedureBody, skillSummary } from '../src/caster/skill.js';

describe('the noun a cast of a Mold goes by', () => {
  const body = '# do-a-thing\n\n## Step\n\nThis Mold reads the Mold body. Molds are cast.\n';

  it('substitutes the target’s noun for the Mold that was cast', () => {
    const out = runtimeProcedureBody(body, 'do-a-thing', 'skill');
    expect(out).toContain('This skill reads the skill body.');
    expect(out).toContain('skills are cast.');
    expect(out).not.toContain('Mold');
  });

  it('carries a target that calls its output something else', () => {
    const out = runtimeProcedureBody(body, 'do-a-thing', 'page');
    expect(out).toContain('This page reads the page body.');
    expect(out).toContain('pages are cast.');
    expect(out).not.toContain('skill');
  });

  it('names the noun in the fallback description, not the Mold it came from', () => {
    // The one path that skips the substitution above, so "Mold" survived into the description
    // of every bundle whose Mold had no summary.
    expect(skillSummary({}, 'do-a-thing', 'skill')).toBe('Run the do-a-thing skill.');
    expect(skillSummary({}, 'do-a-thing', 'page')).toBe('Run the do-a-thing page.');
  });

  it('prefers what the Mold wrote about itself over any fallback', () => {
    expect(skillSummary({ summary: 'Audits a claim.' }, 'do-a-thing', 'page')).toBe(
      'Audits a claim.',
    );
  });

  it('drops the heading the document already spends on its title', () => {
    const out = runtimeProcedureBody(body, 'do-a-thing', 'skill');
    expect(out.startsWith('### Step')).toBe(true);
  });
});

describe('the document a cast writes', () => {
  const rendered = (noun: string): string =>
    renderSkillMarkdown({
      moldName: 'do-a-thing',
      meta: {},
      lede: 'A lede.',
      sections: [{ title: 'References', body: '- None declared.' }],
      noun,
    });

  it('describes itself with the target’s noun', () => {
    expect(rendered('page')).toContain('description: "Run the do-a-thing page."');
  });

  it('titles the document after the Mold, which is the same name at every target', () => {
    const out = rendered('skill');
    expect(out).toContain('name: do-a-thing');
    expect(out).toContain('# do-a-thing');
  });
});
