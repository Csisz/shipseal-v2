import { ArrowRight, Compass, MoreHorizontal, RefreshCw, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ReadinessReport } from '@/lib/types';
import type { RepositoryFriction } from './types';
import type { ReactNode } from 'react';

export function PostScanOverview({
  report,
  limitedScanReason,
  frictions,
  onReviewRepositoryIntelligence,
  onPlanAgentTask,
  onReset,
  onReplayReveal,
  persistenceControl,
}: {
  report: ReadinessReport;
  limitedScanReason?: string;
  frictions: RepositoryFriction[];
  onReviewRepositoryIntelligence: () => void;
  onPlanAgentTask: () => void;
  onReset: () => void;
  onReplayReveal?: () => void;
  persistenceControl?: ReactNode;
}) {
  const limited = report.repositoryHealth.overall.score === null
    || report.scanSummary.limited
    || report.scanSummary.scanMode === 'limited-fallback';
  const fileCount = report.fileCount || report.scanSummary.filesAnalyzed || report.scanSummary.totalFilesFound;
  const githubSource = report.source.sourceType === 'github-app'
    || report.source.sourceType === 'github-url'
    || report.source.sourceType === 'github-public';
  const repositoryIdentity = githubSource
    ? report.scanEvidence.repositoryFullName || [report.source.githubOwner, report.source.githubRepo].filter(Boolean).join('/') || report.repoName
    : report.repoName;
  const branch = githubSource
    ? report.source.githubBranch || report.source.githubDefaultBranch || report.scanEvidence.branchOrRef || 'Branch unavailable'
    : 'Uploaded archive';

  return (
    <section className="mb-4 rounded-3xl border border-primary/20 bg-card/60 px-4 py-4 shadow-sm shadow-primary/10 md:px-6" aria-labelledby="workspace-result-heading">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 max-w-4xl">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="outline" className="border-primary/45 text-primary-glow">Repository Intelligence</Badge>
            <span className="min-w-0 break-words text-muted-foreground [overflow-wrap:anywhere]">{repositoryIdentity}</span>
            <span className="text-muted-foreground">{branch}</span>
            <span className="text-muted-foreground">{report.stack.primary}</span>
          </div>
          <h1 id="workspace-result-heading" className="mt-3 font-display text-2xl font-semibold leading-tight md:text-3xl">
            {limited ? 'Repository evidence is limited.' : 'Repository understood.'}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {limited
              ? `ShipSeal mapped ${fileCount.toLocaleString()} files within the available scan boundary. Conclusions remain limited.`
              : `ShipSeal mapped ${fileCount.toLocaleString()} files into a repository-specific workspace model and found ${frictions.length.toLocaleString()} areas creating agent friction.`}
          </p>
          {limited && (
            <p className="mt-3 max-w-3xl rounded-2xl border border-warning/35 bg-warning/10 px-4 py-3 text-sm text-warning/90">
              Limited scan: {limitedScanReason || 'The scanner could not fully analyze the repository, so unavailable areas are not treated as failures.'}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <Button type="button" onClick={onReviewRepositoryIntelligence} className="w-full justify-between bg-primary text-primary-foreground hover:bg-primary/90">
            Review improvements <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onPlanAgentTask} className="border-border/60 bg-background/20">
            <Compass className="mr-1.5 h-3.5 w-3.5" /> Plan an agent task
          </Button>
          {persistenceControl}
          <details className="relative">
            <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-full border border-border/60 text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="More result actions"><MoreHorizontal className="h-4 w-4" /></summary>
            <div className="absolute right-0 z-10 mt-2 flex w-48 flex-col gap-2 rounded-xl border border-border/60 bg-popover p-2 shadow-lg">
              {onReplayReveal && <Button variant="ghost" size="sm" onClick={onReplayReveal} className="justify-start"><Sparkles className="mr-1.5 h-3.5 w-3.5" /> Replay reveal</Button>}
              <Button variant="ghost" size="sm" onClick={onReset} className="justify-start"><RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Scan another project</Button>
            </div>
          </details>
        </div>
      </div>
    </section>
  );
}
