import type {
  CitationAdjudication,
  CitationAuditRun,
  CitationEvidence,
  CitationEvidenceSnapshot,
  CitationFinding,
  CitationIdentifier,
} from './schema.js';
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
  const reasons = finding.mismatchReasons.join('; ');
  if (!review) return reasons || '—';
  return [reasons, `manual review: ${review.note}`].filter(Boolean).join('; ');
}

function escapeCell(value: string): string {
  return value.replace(/\|/gu, '\\|').replace(/\r?\n/gu, ' ');
}
