import type { ReadinessReport } from '../types';
import type { OptimizationApplyPlan, OptimizationPackFile, OptimizationPackManifest } from './repositoryOptimizationApply';
import type { RepositoryOptimizationAction, RepositoryOptimizationReadiness } from './repositoryOptimizationPlan';

export type VerificationBaselineMethod = 'manual-baseline' | 'zip-download' | 'github-pr-created';

export type VerifiedArtifactState =
  | 'verified-file-presence'
  | 'verified-content-match'
  | 'needs-human-review'
  | 'not-detected'
  | 'not-verifiable'
  | 'missing-after-rescan'
  | 'blocked';

export type RepositoryVerificationReadinessState =
  | 'no-baseline'
  | 'baseline-scan'
  | 'repository-mismatch'
  | 'matched-rescan';

export interface RepositoryVerificationIdentity {
  name: string;
  fullName?: string;
  owner?: string;
  repo?: string;
  ref?: string;
  sourceType: ReadinessReport['source']['sourceType'];
}

export interface RepositoryVerificationBaselineArtifact {
  id: string;
  generatedPath: string;
  destinationPath: string;
  action: RepositoryOptimizationAction;
  readiness: RepositoryOptimizationReadiness;
  contributingProposalIds: string[];
  conflictNotes: string[];
  generatedContentSignature?: string;
  existedInBaseline: boolean;
  includedInPackage: boolean;
  includedInPr: boolean;
}

export interface RepositoryVerificationBaseline {
  id: string;
  schemaVersion: 'shipseal.repository-verification-baseline.v1';
  repository: RepositoryVerificationIdentity;
  baselineScan: {
    repositoryName: string;
    scannedAt: string;
    score: number;
    workspaceQuality: number | null;
    analyzedFileCount: number | null;
    detectedInstructionFileCount: number;
    detectedVerificationArtifactCount: number;
  };
  applyPlanId: string;
  applyMethod: VerificationBaselineMethod;
  selectedProposalIds: string[];
  manifest: OptimizationPackManifest;
  baselineFilePaths: string[];
  artifacts: RepositoryVerificationBaselineArtifact[];
}

export interface VerifiedArtifactMatch {
  artifactId: string;
  generatedPath: string;
  destinationPath: string;
  action: RepositoryOptimizationAction;
  readiness: RepositoryOptimizationReadiness;
  state: VerifiedArtifactState;
  label: string;
  previousState: string;
  currentScanState: string;
  contentMatch: 'matched' | 'not-matched' | 'unavailable' | 'not-required';
  evidence: string[];
  reason: string;
  recommendedNextAction: string;
}

export interface WorkspaceMetricComparison {
  id: string;
  label: string;
  baseline: number | null;
  current: number | null;
  delta: number | null;
  unit: 'count' | 'score';
  language: 'observed-after-rescan';
}

export interface VerificationManifest {
  schemaVersion: 'shipseal.repository-verification-manifest.v1';
  baselineRepository: RepositoryVerificationIdentity;
  currentRepository: RepositoryVerificationIdentity;
  selectedProposalIds: string[];
  counts: RepositoryVerificationResult['counts'];
  artifactStates: Array<{
    generatedPath: string;
    destinationPath: string;
    action: RepositoryOptimizationAction;
    readiness: RepositoryOptimizationReadiness;
    state: VerifiedArtifactState;
    evidence: string[];
  }>;
  metricComparison: WorkspaceMetricComparison[];
  limitations: string[];
}

export interface RepositoryVerificationResult {
  id: string;
  schemaVersion: 'shipseal.repository-verification-result.v1';
  status: RepositoryVerificationReadinessState;
  baseline: RepositoryVerificationBaseline;
  currentRepository: RepositoryVerificationIdentity;
  repositoryMatch: {
    matches: boolean;
    reasons: string[];
  };
  artifacts: VerifiedArtifactMatch[];
  counts: {
    detected: number;
    contentMatched: number;
    needsReview: number;
    missing: number;
    notVerifiable: number;
    blocked: number;
  };
  metrics: WorkspaceMetricComparison[];
  manifest: VerificationManifest;
  limitations: string[];
}

export interface BuildRepositoryVerificationBaselineInput {
  report: ReadinessReport;
  applyPlan: OptimizationApplyPlan;
  method?: VerificationBaselineMethod;
}

export interface BuildRepositoryVerificationResultInput {
  baseline: RepositoryVerificationBaseline;
  currentReport: ReadinessReport;
  currentContentByPath?: Record<string, string>;
}

export function buildRepositoryVerificationBaseline({
  report,
  applyPlan,
  method = 'manual-baseline',
}: BuildRepositoryVerificationBaselineInput): RepositoryVerificationBaseline {
  const baselineFilePaths = filePathsFor(report);
  const baselinePathSet = new Set(baselineFilePaths);
  const artifacts = applyPlan.files
    .map(file => baselineArtifactFor(file, baselinePathSet))
    .sort((left, right) => left.destinationPath.localeCompare(right.destinationPath) || left.generatedPath.localeCompare(right.generatedPath));
  const repository = repositoryIdentityFor(report);
  const idSeed = [
    repository.fullName || repository.name,
    repository.ref || 'default',
    applyPlan.id,
    method,
    artifacts.map(artifact => `${artifact.generatedPath}:${artifact.destinationPath}:${artifact.readiness}`).join('|'),
  ].join('|');

  return {
    id: `repository-verification-baseline:${stableId(idSeed)}`,
    schemaVersion: 'shipseal.repository-verification-baseline.v1',
    repository,
    baselineScan: scanSummaryFor(report),
    applyPlanId: applyPlan.id,
    applyMethod: method,
    selectedProposalIds: [...applyPlan.manifest.selectedProposalIds].sort(),
    manifest: applyPlan.manifest,
    baselineFilePaths,
    artifacts,
  };
}

export function buildRepositoryVerificationResult({
  baseline,
  currentReport,
  currentContentByPath = {},
}: BuildRepositoryVerificationResultInput): RepositoryVerificationResult {
  const currentRepository = repositoryIdentityFor(currentReport);
  const repositoryMatch = compareRepositoryIdentity(baseline.repository, currentRepository);
  const currentFilePaths = maybeFilePathsFor(currentReport);
  const currentPathSet = currentFilePaths ? new Set(currentFilePaths) : null;
  const currentSignatures = contentSignaturesByPath(currentContentByPath);
  const status: RepositoryVerificationReadinessState = !repositoryMatch.matches
    ? 'repository-mismatch'
    : sameScan(baseline, currentReport)
      ? 'baseline-scan'
      : 'matched-rescan';
  const artifacts = status === 'repository-mismatch'
    ? baseline.artifacts.map(artifact => mismatchArtifactFor(artifact))
    : baseline.artifacts.map(artifact => artifactMatchFor(artifact, currentPathSet, currentSignatures));
  const counts = summarizeArtifacts(artifacts);
  const metrics = status === 'repository-mismatch' ? [] : metricComparisonsFor(baseline, currentReport);
  const limitations = limitationsFor(status, currentFilePaths, baseline, currentReport);

  return {
    id: `repository-verification-result:${stableId(`${baseline.id}:${currentReport.repoName}:${currentReport.scannedAt}`)}`,
    schemaVersion: 'shipseal.repository-verification-result.v1',
    status,
    baseline,
    currentRepository,
    repositoryMatch,
    artifacts,
    counts,
    metrics,
    limitations,
    manifest: {
      schemaVersion: 'shipseal.repository-verification-manifest.v1',
      baselineRepository: baseline.repository,
      currentRepository,
      selectedProposalIds: baseline.selectedProposalIds,
      counts,
      artifactStates: artifacts.map(artifact => ({
        generatedPath: artifact.generatedPath,
        destinationPath: artifact.destinationPath,
        action: artifact.action,
        readiness: artifact.readiness,
        state: artifact.state,
        evidence: artifact.evidence,
      })),
      metricComparison: metrics,
      limitations,
    },
  };
}

function baselineArtifactFor(file: OptimizationPackFile, baselinePathSet: Set<string>): RepositoryVerificationBaselineArtifact {
  return {
    id: file.id,
    generatedPath: normalizePath(file.generatedPath),
    destinationPath: normalizePath(file.destinationPath),
    action: file.action,
    readiness: file.readiness,
    contributingProposalIds: [...file.contributingProposalIds].sort(),
    conflictNotes: file.conflicts.map(conflict => conflict.explanation).sort(),
    generatedContentSignature: file.content ? contentSignature(file.content) : undefined,
    existedInBaseline: baselinePathSet.has(normalizePath(file.destinationPath)),
    includedInPackage: file.includeInZip,
    includedInPr: file.includeInPr,
  };
}

function artifactMatchFor(
  artifact: RepositoryVerificationBaselineArtifact,
  currentPathSet: Set<string> | null,
  currentSignatures: Map<string, string>
): VerifiedArtifactMatch {
  if (artifact.readiness === 'blocked' || !artifact.includedInPackage) {
    return {
      ...artifactBase(artifact),
      state: 'blocked',
      label: 'Blocked',
      previousState: 'Blocked in baseline plan',
      currentScanState: 'Blocked items are not checked as repository changes',
      contentMatch: 'not-required',
      evidence: ['Blocked artifacts are represented in review notes only.'],
      reason: 'Blocked artifacts were not included as normal package or PR files.',
      recommendedNextAction: 'Review the blocker before preparing a new package.',
    };
  }

  if (!currentPathSet) {
    return {
      ...artifactBase(artifact),
      state: 'not-verifiable',
      label: 'Not verifiable from static scan',
      previousState: artifact.existedInBaseline ? 'Path existed in baseline scan' : 'Path absent in baseline scan',
      currentScanState: 'Current scan did not expose comparable file inventory',
      contentMatch: 'unavailable',
      evidence: ['No comparable file inventory was available in the current scan.'],
      reason: 'ShipSeal needs file-path evidence from a later scan to check this artifact.',
      recommendedNextAction: 'Rescan the repository with file inventory available.',
    };
  }

  const destinationPresent = currentPathSet.has(artifact.destinationPath);
  const currentSignature = currentSignatures.get(artifact.destinationPath);
  const contentMatched = Boolean(artifact.generatedContentSignature && currentSignature && currentSignature === artifact.generatedContentSignature);

  if (contentMatched) {
    return {
      ...artifactBase(artifact),
      state: 'verified-content-match',
      label: 'Content match verified',
      previousState: artifact.existedInBaseline ? 'Path existed in baseline scan' : 'Path absent in baseline scan',
      currentScanState: 'Generated content signature matched current scan evidence',
      contentMatch: 'matched',
      evidence: [`${artifact.destinationPath} content signature matched the prepared artifact.`],
      reason: 'The current scan exposed content evidence that matches the prepared generated artifact.',
      recommendedNextAction: 'Review and rescan again after any additional changes.',
    };
  }

  if (artifact.action === 'create') {
    if (destinationPresent && !artifact.existedInBaseline) {
      return {
        ...artifactBase(artifact),
        state: 'verified-file-presence',
        label: 'Detected after rescan',
        previousState: 'Path absent in baseline scan',
        currentScanState: 'Path present in current scan',
        contentMatch: artifact.generatedContentSignature ? 'unavailable' : 'not-required',
        evidence: [`${artifact.destinationPath} was absent before and present after rescan.`],
        reason: 'The later scan detected the planned destination path.',
        recommendedNextAction: 'Review the file contents and run project verification commands.',
      };
    }
    if (destinationPresent) {
      return needsReviewArtifact(artifact, 'Path existed in baseline scan', 'Path present in current scan', 'The path exists, but this scan cannot prove the prepared content was copied.');
    }
    return missingArtifact(artifact, artifact.existedInBaseline ? 'Path existed in baseline scan' : 'Path absent in baseline scan');
  }

  if (destinationPresent) {
    return needsReviewArtifact(
      artifact,
      artifact.existedInBaseline ? 'Path existed in baseline scan' : 'Path absent in baseline scan',
      'Path present in current scan',
      artifact.readiness === 'review-required'
        ? 'Review-required artifacts stay review-required unless content evidence matches.'
        : 'The path exists, but static file-path evidence cannot verify the generated content merge.'
    );
  }

  return {
    ...artifactBase(artifact),
    state: artifact.existedInBaseline ? 'missing-after-rescan' : 'not-detected',
    label: artifact.existedInBaseline ? 'Missing after rescan' : 'Not detected in current scan',
    previousState: artifact.existedInBaseline ? 'Path existed in baseline scan' : 'Path absent in baseline scan',
    currentScanState: 'Path not present in current scan',
    contentMatch: 'unavailable',
    evidence: [`${artifact.destinationPath} was not present in the current scan file inventory.`],
    reason: artifact.existedInBaseline ? 'The planned destination existed before but was not detected after rescan.' : 'The planned destination was not detected after rescan.',
    recommendedNextAction: 'Check whether the file was copied to a different path or rescan the changed repository.',
  };
}

function needsReviewArtifact(
  artifact: RepositoryVerificationBaselineArtifact,
  previousState: string,
  currentScanState: string,
  reason: string
): VerifiedArtifactMatch {
  return {
    ...artifactBase(artifact),
    state: 'needs-human-review',
    label: 'Needs human review',
    previousState,
    currentScanState,
    contentMatch: artifact.generatedContentSignature ? 'unavailable' : 'not-required',
    evidence: [`${artifact.destinationPath} was detected, but content match was not available from this scan.`],
    reason,
    recommendedNextAction: 'Review the file contents and run repository verification commands.',
  };
}

function missingArtifact(artifact: RepositoryVerificationBaselineArtifact, previousState: string): VerifiedArtifactMatch {
  return {
    ...artifactBase(artifact),
    state: 'not-detected',
    label: 'Not detected in current scan',
    previousState,
    currentScanState: 'Path not present in current scan',
    contentMatch: 'unavailable',
    evidence: [`${artifact.destinationPath} was not detected in the current scan file inventory.`],
    reason: 'The planned destination was not found in the later scan.',
    recommendedNextAction: 'Apply the reviewed file, check the destination path, then rescan.',
  };
}

function mismatchArtifactFor(artifact: RepositoryVerificationBaselineArtifact): VerifiedArtifactMatch {
  return {
    ...artifactBase(artifact),
    state: 'not-verifiable',
    label: 'Not verifiable from static scan',
    previousState: artifact.existedInBaseline ? 'Path existed in baseline scan' : 'Path absent in baseline scan',
    currentScanState: 'Current scan repository identity did not match baseline',
    contentMatch: 'unavailable',
    evidence: ['This scan does not match the saved optimization baseline.'],
    reason: 'ShipSeal does not compare unrelated repositories.',
    recommendedNextAction: 'Discard the baseline or scan the same repository.',
  };
}

function artifactBase(artifact: RepositoryVerificationBaselineArtifact) {
  return {
    artifactId: artifact.id,
    generatedPath: artifact.generatedPath,
    destinationPath: artifact.destinationPath,
    action: artifact.action,
    readiness: artifact.readiness,
  };
}

function summarizeArtifacts(artifacts: VerifiedArtifactMatch[]): RepositoryVerificationResult['counts'] {
  return {
    detected: artifacts.filter(artifact => artifact.state === 'verified-file-presence').length,
    contentMatched: artifacts.filter(artifact => artifact.state === 'verified-content-match').length,
    needsReview: artifacts.filter(artifact => artifact.state === 'needs-human-review').length,
    missing: artifacts.filter(artifact => artifact.state === 'not-detected' || artifact.state === 'missing-after-rescan').length,
    notVerifiable: artifacts.filter(artifact => artifact.state === 'not-verifiable').length,
    blocked: artifacts.filter(artifact => artifact.state === 'blocked').length,
  };
}

function metricComparisonsFor(baseline: RepositoryVerificationBaseline, currentReport: ReadinessReport): WorkspaceMetricComparison[] {
  const current = scanSummaryFor(currentReport);
  return [
    metric('workspace-quality', 'Workspace Quality', baseline.baselineScan.workspaceQuality, current.workspaceQuality, 'score'),
    metric('analyzed-files', 'Analyzed files', baseline.baselineScan.analyzedFileCount, current.analyzedFileCount, 'count'),
    metric('project-memory-anchors', 'Project Memory anchors', baseline.baselineScan.detectedInstructionFileCount, current.detectedInstructionFileCount, 'count'),
    metric('verification-artifacts', 'Verification artifacts', baseline.baselineScan.detectedVerificationArtifactCount, current.detectedVerificationArtifactCount, 'count'),
  ].filter(item => item.baseline !== null && item.current !== null);
}

function metric(id: string, label: string, baseline: number | null, current: number | null, unit: WorkspaceMetricComparison['unit']): WorkspaceMetricComparison {
  return {
    id,
    label,
    baseline,
    current,
    delta: baseline !== null && current !== null ? current - baseline : null,
    unit,
    language: 'observed-after-rescan',
  };
}

function scanSummaryFor(report: ReadinessReport): RepositoryVerificationBaseline['baselineScan'] {
  return {
    repositoryName: report.repoName,
    scannedAt: report.scannedAt,
    score: report.score,
    workspaceQuality: report.repositoryHealth.overall.score,
    analyzedFileCount: typeof report.scanSummary.filesAnalyzed === 'number' ? report.scanSummary.filesAnalyzed : null,
    detectedInstructionFileCount: report.summary.instructionFiles.length,
    detectedVerificationArtifactCount: [
      report.scanEvidence.keyFilesFound.tests,
      report.scanEvidence.keyFilesFound.ciConfig,
      Object.keys(report.stack.scripts).some(script => /test|build|lint|check/i.test(script)),
    ].filter(Boolean).length,
  };
}

function compareRepositoryIdentity(baseline: RepositoryVerificationIdentity, current: RepositoryVerificationIdentity) {
  const reasons: string[] = [];
  if (baseline.fullName && current.fullName) {
    if (baseline.fullName.toLowerCase() !== current.fullName.toLowerCase()) reasons.push('Repository full name differs.');
  } else if (baseline.name.toLowerCase() !== current.name.toLowerCase()) {
    reasons.push('Repository name differs.');
  }
  if (baseline.owner && current.owner && baseline.owner.toLowerCase() !== current.owner.toLowerCase()) reasons.push('Repository owner differs.');
  if (baseline.repo && current.repo && baseline.repo.toLowerCase() !== current.repo.toLowerCase()) reasons.push('Repository name differs.');
  if (baseline.ref && current.ref && baseline.ref !== current.ref) reasons.push('Repository branch or ref differs.');
  if (baseline.sourceType !== current.sourceType && baseline.fullName && current.fullName) reasons.push('Repository source type differs.');
  return { matches: reasons.length === 0, reasons };
}

function sameScan(baseline: RepositoryVerificationBaseline, currentReport: ReadinessReport) {
  return baseline.baselineScan.scannedAt === currentReport.scannedAt
    && baseline.baselineScan.repositoryName === currentReport.repoName;
}

function repositoryIdentityFor(report: ReadinessReport): RepositoryVerificationIdentity {
  return {
    name: report.repoName,
    fullName: report.scanEvidence.repositoryFullName || undefined,
    owner: report.source.githubOwner,
    repo: report.source.githubRepo,
    ref: report.source.githubBranch || report.source.githubDefaultBranch || report.scanEvidence.branchOrRef,
    sourceType: report.source.sourceType,
  };
}

function limitationsFor(
  status: RepositoryVerificationReadinessState,
  currentFilePaths: string[] | null,
  baseline: RepositoryVerificationBaseline,
  currentReport: ReadinessReport
) {
  const limitations: string[] = [];
  if (status === 'baseline-scan') limitations.push('Verification requires a later scan after repository changes are reviewed and copied.');
  if (status === 'repository-mismatch') limitations.push('This scan does not match the saved optimization baseline.');
  if (!currentFilePaths) limitations.push('Current scan did not expose comparable file inventory.');
  if (currentReport.scanSummary.limited) limitations.push('Current scan was limited, so verification is conservative.');
  if (baseline.artifacts.every(artifact => artifact.readiness === 'blocked')) limitations.push('All baseline artifacts were blocked and cannot be counted as detected changes.');
  return limitations;
}

function maybeFilePathsFor(report: ReadinessReport): string[] | null {
  if (Array.isArray(report.analyzedFiles) && report.analyzedFiles.length > 0) return filePathsFor(report);
  if (Array.isArray(report.sampleFiles) && report.sampleFiles.length > 0) return filePathsFor(report);
  return null;
}

function filePathsFor(report: ReadinessReport): string[] {
  return [...new Set((report.analyzedFiles || report.sampleFiles || []).filter(file => !file.isDir).map(file => normalizePath(file.path)).filter(Boolean))].sort();
}

function contentSignaturesByPath(contentByPath: Record<string, string>) {
  return new Map(Object.entries(contentByPath).map(([path, content]) => [normalizePath(path), contentSignature(content)]));
}

function contentSignature(content: string) {
  let hash = 2166136261;
  for (let index = 0; index < content.length; index += 1) {
    hash ^= content.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, '0')}:${content.length}`;
}

function normalizePath(path: string) {
  return path.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+/g, '/').trim();
}

function stableId(value: string) {
  return normalizePath(value)
    .toLowerCase()
    .replace(/[^a-z0-9._/-]+/g, '-')
    .replace(/[/.]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'repository';
}
