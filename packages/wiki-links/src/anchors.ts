/**
 * Keep this separate from `slugify`: changing this algorithm would break existing
 * glossary deep links.
 */
export function slugifyTerm(term: string): string {
  return term
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

export function addBoldTermAnchors(html: string): string {
  return html.replace(
    /<p>(\s*)<strong>([^<]+)<\/strong>/g,
    (match, leadingWhitespace: string, term: string) => {
      const anchorId = slugifyTerm(term);
      if (!anchorId) return match;
      return `<p id="${anchorId}">${leadingWhitespace}<strong>${term}</strong>`;
    },
  );
}
