import type {
  CitationAdjudication,
  CitationAuditRun,
  CitationEvidence,
  CitationEvidenceSnapshot,
  CitationFinding,
  CitationIdentifier,
} from './schema.js';
import { compareCodePoints } from './digest.js';
import { evidenceSnapshotDigest } from './identity.js';
import {
  citationVerdicts,
  parseCitationAuditRun,
  parseCitationEvidenceSnapshot,
} from './schema.js';

export function renderCitationAuditMarkdown(
  run: CitationAuditRun,
  snapshot: CitationEvidenceSnapshot,
): string {
  run = parseCitationAuditRun(run);
  snapshot = parseCitationEvidenceSnapshot(snapshot);
  if (run.evidenceSnapshotDigest !== evidenceSnapshotDigest(snapshot)) {
    throw new Error('run evidence snapshot digest does not match the supplied snapshot');
  }
  const candidates = new Map(run.candidates.map((candidate) => [candidate.id, candidate]));
  const evidence = new Map(snapshot.evidence.map((record) => [record.id, record]));
  const reviews = new Map(run.adjudications.map((review) => [review.candidateId, review]));
  const lines = [
    '# Citation-integrity audit',
    '',
    '> This report verifies scholarly citation identity. It does not determine whether a source',
    '> supports the surrounding scientific claim.',
    '',
    `Manual review: **${run.manualReviewStatus}**`,
    `Reviewed flagged findings: **${run.manualReview.completed}/${run.manualReview.required}**`,
    '',
    '## Partitions',
    '',
    '| Verdict | Count |',
    '|---|---:|',
    ...citationVerdicts.map((verdict) => `| ${verdict} | ${run.summary[verdict]} |`),
    `| total | ${run.summary.total} |`,
    '',
    ...verificationSection(run),
    ...coverageSection(run),
  ];

  for (const verdict of citationVerdicts) {
    lines.push(`## ${verdict}`, '');
    const findings = run.findings.filter(
      (finding) => finding.effectiveVerdict === verdict && !finding.excludedFromDenominator,
    );
    if (findings.length === 0) {
      lines.push('None.', '');
      continue;
    }
    lines.push(
      '| Source | Described identity | Resolver evidence | Review note |',
      '|---|---|---|---|',
    );
    for (const finding of findings) {
      const candidate = candidates.get(finding.candidateId);
      if (!candidate)
        throw new Error(`finding references unknown candidate ${finding.candidateId}`);
      const records = finding.evidenceIds.map((id) => {
        const record = evidence.get(id);
        if (!record) throw new Error(`finding ${finding.candidateId} is missing evidence ${id}`);
        return record;
      });
      const review = reviews.get(finding.candidateId);
      lines.push(
        `| \`${candidate.span.artifactPath}:${candidate.span.startLine}\` | ` +
          `${escapeCell(describedIdentity(candidate.identifiers, candidate.described?.title))} | ` +
          `${escapeCell(evidenceSummary(records))} | ` +
          `${escapeCell(reviewSummary(finding, review))} |`,
      );
    }
    lines.push('');
  }

  lines.push(...perArtifactSection(run));

  lines.push('## Adjudicated extractor false positives', '');
  const falsePositives = run.findings.filter((finding) => finding.excludedFromDenominator);
  if (falsePositives.length === 0) lines.push('None.', '');
  else {
    for (const finding of falsePositives) {
      const candidate = candidates.get(finding.candidateId);
      if (!candidate)
        throw new Error(`finding references unknown candidate ${finding.candidateId}`);
      const review = reviews.get(finding.candidateId);
      lines.push(
        `- \`${candidate.span.artifactPath}:${candidate.span.startLine}\` — ${escapeCell(review?.note ?? '')}`,
      );
    }
    lines.push('');
  }
  lines.push(
    '## Extractor diagnostics',
    '',
    `- Generic/non-scholarly URLs excluded: ${run.diagnostics.excludedUrls.length}`,
    `- Potential free-form \`Author Year\` patterns measured (diagnostic only): ${run.diagnostics.authorYearPatternCount}`,
    '',
  );
  return lines.join('\n');
}

function describedIdentity(identifiers: readonly CitationIdentifier[], title?: string): string {
  return (
    title ?? identifiers.map((identifier) => `${identifier.kind}:${identifier.value}`).join('; ')
  );
}

function evidenceSummary(records: readonly CitationEvidence[]): string {
  return records
    .map((record) => {
      const match = record.matchedIdentifier
        ? `${record.matchedIdentifier.kind}:${record.matchedIdentifier.value}`
        : record.state;
      return `${record.provider} ${queryLabel(record)} → ${match}`;
    })
    .join('; ');
}

function queryLabel(record: CitationEvidence): string {
  return record.query.type === 'identifier'
    ? `\`${record.query.identifier.kind}:${record.query.identifier.value}\``
    : `\`title:${record.query.title}\``;
}

function reviewSummary(finding: CitationFinding, review: CitationAdjudication | undefined): string {
  const reasons = finding.mismatches
    .map((mismatch) =>
      mismatch.severity === 'warning' ? `warning: ${mismatch.detail}` : mismatch.detail,
    )
    .join('; ');
  if (!review) return reasons || '—';
  return [reasons, `manual review: ${review.note}`].filter(Boolean).join('; ');
}

/**
 * A resolution rate means nothing without the number of references the extractor could not read,
 * so the denominator is reported next to the verdict counts rather than left in the diagnostics.
 */
/**
 * `resolved` answers a weaker question than it looks like it answers.
 *
 * A candidate that names an identifier but describes no work resolves and can report no mismatch,
 * because there is nothing to compare a provider's answer against. Folding those into one headline
 * makes a corpus look fully verified while some share of it was only dereferenced, so the split is
 * stated here rather than left to be derived by a reader who already trusts the number.
 */
function verificationSection(run: CitationAuditRun): string[] {
  const unverified = run.summary.resolvedUnverified;
  const verified = run.summary.resolved - unverified;
  const lines = [
    '## Verification',
    '',
    `Verified against a described work: **${verified} of ${run.summary.resolved}** resolved citations.`,
    '',
  ];
  if (unverified === 0) return lines;
  lines.push(
    `The remaining **${unverified}** resolved an identifier that no nearby text describes, so the ` +
      'only thing checked was that the identifier exists. Give the citation a title, or record the ' +
      'identifier in a note field the extraction config declares, and it becomes checkable.',
    '',
    '| Source | Identifier |',
    '|---|---|',
  );
  const candidates = new Map(run.candidates.map((candidate) => [candidate.id, candidate]));
  for (const finding of run.findings) {
    if (finding.excludedFromDenominator) continue;
    if (finding.effectiveVerdict !== 'resolved' || finding.verifiable) continue;
    const candidate = candidates.get(finding.candidateId);
    if (!candidate) throw new Error(`finding references unknown candidate ${finding.candidateId}`);
    lines.push(
      `| \`${candidate.span.artifactPath}:${candidate.span.startLine}\` | ` +
        `${escapeCell(describedIdentity(candidate.identifiers))} |`,
    );
  }
  lines.push('');
  return lines;
}

function coverageSection(run: CitationAuditRun): string[] {
  const extracted = run.candidates.length;
  const unextracted = run.diagnostics.unextractedReferenceLines;
  const seen = extracted + unextracted.length;
  const lines = [
    '## Extraction coverage',
    '',
    `Extracted **${extracted} of ${seen}** reference-section lines. The verdict counts above ` +
      'describe only the extracted lines.',
    '',
  ];
  if (unextracted.length > 0) {
    lines.push(
      'A wrapped entry counts once per physical line, so this is a lower bound on coverage.',
      '',
      ...unextracted.map((entry) => `- \`${entry.artifactPath}:${entry.line}\``),
      '',
    );
  }
  return lines;
}

/**
 * Several flagged citations in one artifact is a stronger signal than the same number spread across
 * a corpus, so findings roll up per artifact with the most affected first.
 */
function perArtifactSection(run: CitationAuditRun): string[] {
  const totals = new Map<string, { total: number; flagged: number }>();
  for (const finding of run.findings) {
    if (finding.excludedFromDenominator) continue;
    const candidate = run.candidates.find((item) => item.id === finding.candidateId);
    if (!candidate) throw new Error(`finding references unknown candidate ${finding.candidateId}`);
    const entry = totals.get(candidate.span.artifactPath) ?? { total: 0, flagged: 0 };
    entry.total += 1;
    if (finding.effectiveVerdict !== 'resolved') entry.flagged += 1;
    totals.set(candidate.span.artifactPath, entry);
  }
  const rows = [...totals.entries()].sort(
    ([leftPath, left], [rightPath, right]) =>
      right.flagged - left.flagged || compareCodePoints(leftPath, rightPath),
  );
  if (rows.length === 0) return ['## Findings per artifact', '', 'None.', ''];
  return [
    '## Findings per artifact',
    '',
    '| Artifact | Citations | Not resolved |',
    '|---|---:|---:|',
    ...rows.map(([path, entry]) => `| \`${path}\` | ${entry.total} | ${entry.flagged} |`),
    '',
  ];
}

function escapeCell(value: string): string {
  return value.replace(/\|/gu, '\\|').replace(/\r?\n/gu, ' ');
}
