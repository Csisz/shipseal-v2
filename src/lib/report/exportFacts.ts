import type { ReadinessReport } from '../types';

export type ExportCoverageMode = 'full' | 'bounded' | 'limited-fallback';

export interface ExportCoverageFacts {
  mode: ExportCoverageMode;
  label: 'Full scan' | 'Bounded analysis' | 'Limited fallback';
  discovered: number | null;
  analyzed: number | null;
  excluded: number | null;
  reason?: string;
  summary: string;
}

export interface SharedExportFacts {
  repositoryIdentity: string;
  commit?: string;
  branchOrRef: string;
  coverage: ExportCoverageFacts;
  repositoryHealth: {
    score: number | null;
    status: string;
    confidence: string;
    topActions: string[];
  };
  deliveryReadiness: {
    score: number | null;
    status: string;
  };
  packageLabel: string;
  outputCount: number;
}

export function buildExportCoverageFacts(scanSummaryValue: unknown, scanEvidenceValue?: unknown): ExportCoverageFacts {
  const summary = asRecord(scanSummaryValue);
  const evidence = asRecord(scanEvidenceValue);
  const mode = coverageMode(summary, evidence);
  const discovered = firstNumber(
    evidence.discoveredFileCount,
    summary.discoveredFiles,
    summary.totalFilesFound,
  );
  const analyzed = firstNumber(
    evidence.analyzedFileCount,
    summary.analyzedTextFiles,
    summary.filesAnalyzed,
  );
  const excluded = firstNumber(
    evidence.ignoredFileCount,
    summary.filesIgnored,
    discovered !== null && analyzed !== null ? Math.max(0, discovered - analyzed) : undefined,
  );
  const reason = coverageReason(mode, summary);
  const label = mode === 'bounded' ? 'Bounded analysis' : mode === 'limited-fallback' ? 'Limited fallback' : 'Full scan';
  const countSummary = discovered !== null && analyzed !== null
    ? `${analyzed} of ${discovered} files analyzed${excluded !== null ? `; ${excluded} excluded` : ''}.`
    : 'File coverage counts were not available.';
  return {
    mode,
    label,
    discovered,
    analyzed,
    excluded,
    ...(reason ? { reason } : {}),
    summary: `${label}: ${countSummary}${reason ? ` ${reason}` : ''}`,
  };
}

export function buildSharedExportFacts(input: {
  scoreJson?: unknown;
  report?: ReadinessReport;
  fallbackRepositoryName?: string;
}): SharedExportFacts {
  const score = scoreSource(input.scoreJson);
  const report = input.report;
  const source = asRecord(score.source);
  const evidence = asRecord(score.scanEvidence);
  const scanSummary = asRecord(score.scanSummary);
  const health = report?.repositoryHealth as unknown as Record<string, unknown> || asRecord(score.repositoryHealth);
  const overall = asRecord(health.overall);
  const focus = asRecord(score.deliveryPackFocus);
  const topActions = arrayValue(health.topActions).map(asRecord).map(action => {
    const title = stringValue(action.title) || 'Repository improvement';
    const why = stringValue(action.whyItMatters);
    const actionText = stringValue(action.action);
    return [title, why || actionText].filter(Boolean).join(': ');
  }).filter(Boolean).slice(0, 5);
  const generatedFiles = arrayValue(score.generatedFiles);
  return {
    repositoryIdentity: report?.repoName || stringValue(score.repositoryName) || input.fallbackRepositoryName || 'Not provided',
    ...(stringValue(report?.scanSummary.sourceCommitSha) || stringValue(scanSummary.sourceCommitSha) || stringValue(source.githubCommitSha)
      ? { commit: stringValue(report?.scanSummary.sourceCommitSha) || stringValue(scanSummary.sourceCommitSha) || stringValue(source.githubCommitSha) }
      : {}),
    branchOrRef: report?.scanEvidence.branchOrRef || report?.source.githubBranch || report?.source.githubDefaultBranch
      || stringValue(evidence.branchOrRef) || stringValue(source.githubBranch) || stringValue(source.githubDefaultBranch) || 'default ref',
    coverage: buildExportCoverageFacts(report?.scanSummary || score.scanSummary, report?.scanEvidence || score.scanEvidence),
    repositoryHealth: {
      score: firstNumber(overall.score),
      status: stringValue(overall.status) || 'Insufficient evidence',
      confidence: stringValue(overall.confidence) || 'Low',
      topActions,
    },
    deliveryReadiness: {
      score: firstNumber(report?.score, score.score),
      status: report?.level || stringValue(score.status) || 'Not detected',
    },
    packageLabel: stringValue(focus.packageLabel) || 'Full ShipSeal package',
    outputCount: firstNumber(score.outputCount) ?? generatedFiles.length,
  };
}

function coverageMode(summary: Record<string, unknown>, evidence: Record<string, unknown>): ExportCoverageMode {
  const candidate = stringValue(summary.scanMode) || stringValue(evidence.scanMode);
  if (candidate === 'full' || candidate === 'bounded' || candidate === 'limited-fallback') return candidate;
  return summary.limited === true || evidence.limitedScan === true ? 'limited-fallback' : 'full';
}

function coverageReason(mode: ExportCoverageMode, summary: Record<string, unknown>) {
  if (mode === 'bounded') {
    const reasons = arrayValue(summary.boundedReasons).map(value => String(value));
    if (reasons.includes('selected-file-budget')) return 'Large repository; deterministic high-value evidence selection.';
    if (reasons.includes('readable-byte-budget')) return 'Readable evidence was selected within the deterministic byte budget.';
    if (reasons.includes('repository-discovery-incomplete')) return 'Repository discovery was incomplete; conclusions remain scoped to analyzed evidence.';
    return stringValue(summary.limitationReason) || 'Deterministic high-value evidence selection.';
  }
  if (mode === 'limited-fallback') {
    return stringValue(summary.limitationReason) || 'Repository intake used a limited fallback; treat conclusions as incomplete.';
  }
  return undefined;
}

function scoreSource(value: unknown) {
  const source = asRecord(value);
  const wrapped = asRecord(source.content);
  return Object.keys(wrapped).length ? wrapped : source;
}

function firstNumber(...values: unknown[]): number | null {
  for (const value of values) if (typeof value === 'number' && Number.isFinite(value)) return value;
  return null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
