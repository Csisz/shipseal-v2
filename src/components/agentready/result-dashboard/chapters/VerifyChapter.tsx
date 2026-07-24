import type { ReadinessReport } from '@/lib/types';
import type { RepositoryVerificationResult } from '@/lib/workspace';
import type { RepositoryIntelligenceVerificationBaseline, RepositoryIntelligenceVerificationResult } from '@/lib/repositoryIntelligence';
import { RepositoryIntelligenceVerificationPanel } from '../../RepositoryIntelligenceVerificationPanel';
import { ResultWorkspaceDisclosure } from '../../result-workspace/ResultWorkspaceDisclosure';

export interface VerifyChapterProps {
  baseline?: RepositoryIntelligenceVerificationBaseline | null;
  result?: RepositoryIntelligenceVerificationResult | null;
  optimizationResult?: RepositoryVerificationResult | null;
  status?: 'idle' | 'scanning' | 'completed' | 'failed';
  error?: string | null;
  report: ReadinessReport;
  onRescan?: () => void;
  onDiscardBaseline?: () => void;
}

export default function VerifyChapter({ baseline, result, status, error, report, onRescan, onDiscardBaseline }: VerifyChapterProps) {
  return (
    <div data-verify-technical-details tabIndex={-1} className="space-y-6 focus:outline-none">
      <ResultWorkspaceDisclosure title="View technical evidence" lazyMount>
        <RepositoryIntelligenceVerificationPanel
          baseline={baseline}
          result={result}
          status={status}
          error={error}
          currentRepository={report.scanEvidence.repositoryFullName || (report.source.githubOwner && report.source.githubRepo ? `${report.source.githubOwner}/${report.source.githubRepo}` : report.repoName)}
          currentBranch={report.source.githubBranch || report.source.githubDefaultBranch || report.scanEvidence.branchOrRef}
          scanLimited={report.scanSummary.limited}
          onRescan={onRescan}
          onDiscardBaseline={onDiscardBaseline}
        />
      </ResultWorkspaceDisclosure>
    </div>
  );
}
