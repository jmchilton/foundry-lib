// The other half of the anchor contract.
//
// `parseWikiLink` carries `#section` through to the href untouched — it never asks whether
// anything answers to that id. For a glossary rendered from loose markdown, nothing does
// unless something puts the ids there. That is this module, and it lives beside the resolver
// so the two cannot drift.

/**
 * The id a glossary term is addressed by.
 *
 * NOT `slugify`. The two diverge on spaced hyphens (`A - B` -> `a---b` here, `a-b` there),
 * underscores (kept here, dropped there) and repeated hyphens (kept here, collapsed there).
 * Unifying them would silently repoint every existing `#term` deep link, so they stay
 * separate and a test pins the divergence.
 */
export function slugifyTerm(term: string): string {
  return term
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

/**
 * Give `<p><strong>Term</strong>…` paragraphs an id, so `#term` links resolve.
 *
 * Operates on rendered HTML rather than mdast because the glossary is rendered outside the
 * remark pipeline — by `marked`, from a file the content collections do not own.
 *
 * A term that slugifies to nothing is left alone rather than given `id=""`.
 */
export function addBoldTermAnchors(html: string): string {
  return html.replace(/<p>(\s*)<strong>([^<]+)<\/strong>/g, (match, ws: string, term: string) => {
    const id = slugifyTerm(term);
    if (!id) return match;
    return `<p id="${id}">${ws}<strong>${term}</strong>`;
  });
}
