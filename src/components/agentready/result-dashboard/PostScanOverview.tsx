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
  variant = 'document',
}: {
  report: ReadinessReport;
  limitedScanReason?: string;
  frictions: RepositoryFriction[];
  onReviewRepositoryIntelligence: () => void;
  onPlanAgentTask: () => void;
  onReset: () => void;
  onReplayReveal?: () => void;
  persistenceControl?: ReactNode;
  variant?: 'document' | 'stage';
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
  const stageOverlay = variant === 'stage';

  return (
    <section className={stageOverlay
      ? 'pointer-events-auto rounded-[1.35rem] border border-primary/15 bg-[linear-gradient(145deg,hsl(var(--universe-surface)/0.82),hsl(var(--universe-stage-bg)/0.7))] px-3.5 py-3 shadow-[0_24px_80px_hsl(var(--universe-stage-bg)/0.58),0_0_42px_hsl(var(--accent)/0.06)] backdrop-blur-xl motion-safe:animate-fade-in'
      : 'mb-2 rounded-2xl border border-primary/20 bg-card/60 px-4 py-3 shadow-sm shadow-primary/10 md:px-5'} aria-labelledby="workspace-result-heading">
      <div className={stageOverlay ? 'flex flex-col gap-2' : 'flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between'}>
        <div className="min-w-0 max-w-4xl">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="outline" className={stageOverlay ? 'border-accent/30 bg-accent/5 text-accent' : 'border-primary/45 text-primary-glow'}>Repository Intelligence</Badge>
            <span className="min-w-0 break-words text-muted-foreground [overflow-wrap:anywhere]">{repositoryIdentity}</span>
            <span className="text-muted-foreground">{branch}</span>
            {!stageOverlay && <span className="text-muted-foreground">{report.stack.primary}</span>}
          </div>
          <h1 id="workspace-result-heading" className={`mt-1 font-display font-semibold leading-tight ${stageOverlay ? 'text-lg' : 'text-xl md:text-2xl'}`}>
            {limited ? 'Repository evidence is limited.' : 'Repository understood.'}
          </h1>
          <p className={`mt-1 max-w-3xl leading-relaxed text-muted-foreground ${stageOverlay ? 'text-xs' : 'text-sm'}`}>
            {limited
              ? `ShipSeal mapped ${fileCount.toLocaleString()} files within the available scan boundary. Conclusions remain limited.`
              : `ShipSeal mapped ${fileCount.toLocaleString()} files into a repository-specific workspace model and found ${frictions.length.toLocaleString()} areas creating agent friction.`}
          </p>
          {limited && !stageOverlay && (
            <p className="mt-3 max-w-3xl rounded-2xl border border-warning/35 bg-warning/10 px-4 py-3 text-sm text-warning/90">
              Limited scan: {limitedScanReason || 'The scanner could not fully analyze the repository, so unavailable areas are not treated as failures.'}
            </p>
          )}
        </div>
        <div className={`flex flex-wrap items-center gap-2 ${stageOverlay ? 'pt-0.5' : 'lg:justify-end'}`}>
          <Button type="button" size="sm" onClick={onReviewRepositoryIntelligence} className="bg-primary text-primary-foreground hover:bg-primary/90">
            Review improvements <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onPlanAgentTask} className="border-border/60 bg-background/20">
            <Compass className="mr-1.5 h-3.5 w-3.5" /> Plan an agent task
          </Button>
          {persistenceControl && (
            <div className={stageOverlay ? '[&>div]:rounded-xl [&>div]:border-primary/10 [&>div]:bg-transparent [&>div]:p-0.5' : ''}>
              {persistenceControl}
            </div>
          )}
          <details className="relative">
            <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-full border border-primary/15 bg-background/10 text-muted-foreground transition hover:border-accent/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="More result actions"><MoreHorizontal className="h-4 w-4" /></summary>
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
