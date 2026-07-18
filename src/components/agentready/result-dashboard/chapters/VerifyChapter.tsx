import type { ReadinessReport } from '@/lib/types';
import type { RepositoryVerificationResult } from '@/lib/workspace';
import type { RepositoryIntelligenceVerificationBaseline, RepositoryIntelligenceVerificationResult } from '@/lib/repositoryIntelligence';
import { RepositoryIntelligenceVerificationPanel } from '../../RepositoryIntelligenceVerificationPanel';
import { VerificationNarrative } from '../chapterContent';

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

export default function VerifyChapter({ baseline, result, optimizationResult, status, error, report, onRescan, onDiscardBaseline }: VerifyChapterProps) {
  return (
    <div className="space-y-6">
      <VerificationNarrative intelligenceBaseline={baseline} intelligenceResult={result} optimizationResult={optimizationResult} />
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
    </div>
  );
}
