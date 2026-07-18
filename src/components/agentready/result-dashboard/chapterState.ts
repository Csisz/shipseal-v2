import type { ReadinessReport } from '@/lib/types';
import type { RepositoryUniverseModel, RepositoryVerificationResult } from '@/lib/workspace';
import type { ResultChapterStatuses } from './types';

export function getResultChapterStatuses({
  report,
  planReviewed,
  packagePrepared,
  verificationResult,
}: {
  report: ReadinessReport;
  planReviewed: boolean;
  packagePrepared: boolean;
  verificationResult: RepositoryVerificationResult | null;
}) {
  return {
    understand: 'Repository mapped',
    improve: planReviewed ? 'Plan reviewed' : `${Math.max(1, Math.min(6, report.repositoryHealth.topActions.length || report.improvements.length || 1))} next moves`,
    verify: verificationResult?.status === 'matched-rescan'
      ? 'After rescan available'
      : verificationResult?.status === 'repository-mismatch'
        ? 'Baseline mismatch'
        : 'Needs later scan',
    deliver: packagePrepared ? 'Package prepared' : 'Outputs available',
  } satisfies ResultChapterStatuses;
}

export function workspaceInsights(report: ReadinessReport, universe: RepositoryUniverseModel) {
  const documentation = report.summary.instructionFiles.length || report.summary.keyFolders.some(folder => /doc|docs/i.test(folder))
    ? 'Documentation and instruction signals are available.'
    : 'Documentation signals are thin and should be strengthened.';
  const verification = report.stack.runCommands.length || report.stack.testFrameworks.length
    ? 'Verification paths are visible to future agents.'
    : 'Verification commands are not obvious from this scan.';
  const context = universe.summary.folderNodeCount > 0
    ? `${universe.summary.folderNodeCount.toLocaleString()} folders were shaped into navigable workspace context.`
    : 'ShipSeal built a compact workspace model from available repository evidence.';
  return [
    { title: 'Agents have a starting point', detail: documentation },
    { title: 'Context can be routed', detail: context },
    { title: 'Verification is visible', detail: verification },
  ];
}
