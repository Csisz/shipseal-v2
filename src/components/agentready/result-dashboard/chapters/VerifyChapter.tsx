import type { ReadinessReport } from '@/lib/types';
import type { RepositoryVerificationResult } from '@/lib/workspace';
import type { RepositoryIntelligenceVerificationBaseline, RepositoryIntelligenceVerificationResult } from '@/lib/repositoryIntelligence';
import { RepositoryIntelligenceVerificationPanel } from '../../RepositoryIntelligenceVerificationPanel';
import { VerificationNarrative } from '../chapterContent';
import { ResultWorkspaceDisclosure } from '../../result-workspace/ResultWorkspaceDisclosure';
import { Button } from '@/components/ui/button';

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
  const counts = result?.counts;

  return (
    <div className="space-y-6">
      <VerificationNarrative intelligenceBaseline={baseline} intelligenceResult={result} optimizationResult={optimizationResult} />
      <section className="rounded-2xl border border-border/55 bg-background/20 p-4" aria-label="Verification next action">
        {counts && (
          <div className="mb-4 flex flex-wrap gap-2 text-xs" aria-label="Verification summary">
            <span className="rounded-full border border-success/35 bg-success/10 px-3 py-1 text-success">{counts['verified-exact'] + counts['verified-present-with-modifications'] + counts['verified-strengthened']} checked</span>
            <span className="rounded-full border border-warning/35 bg-warning/10 px-3 py-1 text-warning">{counts.missing + counts.conflicting + counts['partially-verified'] + counts['requires-human-review']} unresolved</span>
            <span className="rounded-full border border-border/55 bg-secondary/20 px-3 py-1 text-muted-foreground">{counts.unavailable} unavailable</span>
          </div>
        )}
        <Button type="button" onClick={onRescan} disabled={!onRescan || status === 'scanning'} className="bg-primary text-primary-foreground hover:bg-primary/90">
          {status === 'scanning' ? 'Scanning later state…' : 'Run a later scan'}
        </Button>
      </section>
      <ResultWorkspaceDisclosure title="Verification evidence and technical details" lazyMount>
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
