import { ArrowRight, Compass, MoreHorizontal, RefreshCw, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { ReadinessReport } from '@/lib/types';
import type { RepositoryFriction } from './types';
import type { ReactNode } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

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
  const isMobile = useIsMobile();
  const limited = report.repositoryHealth.overall.score === null
    || report.scanSummary.limited
    || report.scanSummary.scanMode === 'limited-fallback';
  const bounded = report.scanSummary.scanMode === 'bounded';
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
  const compactMobileStage = stageOverlay && isMobile;

  return (
    <section className={stageOverlay
      ? 'pointer-events-auto rounded-[1.35rem] border border-primary/15 bg-[linear-gradient(145deg,hsl(var(--universe-surface)/0.82),hsl(var(--universe-stage-bg)/0.7))] px-3.5 py-3 shadow-[0_24px_80px_hsl(var(--universe-stage-bg)/0.58),0_0_42px_hsl(var(--accent)/0.06)] backdrop-blur-xl motion-safe:animate-fade-in'
      : 'mb-2 rounded-2xl border border-primary/20 bg-card/60 px-4 py-3 shadow-sm shadow-primary/10 md:px-5'} aria-labelledby="workspace-result-heading">
      <div className={stageOverlay ? 'flex flex-col gap-2' : 'flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between'}>
        <div className="min-w-0 max-w-4xl">
          {compactMobileStage ? (
            <>
              <h1 id="workspace-result-heading" className="font-display text-base font-semibold leading-tight">
                {limited ? 'Repository evidence is limited.' : 'Repository understood.'}
              </h1>
              <p className="mt-0.5 truncate text-xs font-medium text-foreground/85" title={repositoryIdentity}>{repositoryIdentity}</p>
            </>
          ) : (
            <>
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
            </>
          )}
          {limited && !stageOverlay && (
            <p className="mt-3 max-w-3xl rounded-2xl border border-warning/35 bg-warning/10 px-4 py-3 text-sm text-warning/90">
              Limited scan: {limitedScanReason || 'The scanner could not fully analyze the repository, so unavailable areas are not treated as failures.'}
            </p>
          )}
          {bounded && !stageOverlay && (
            <p className="mt-3 max-w-3xl rounded-2xl border border-primary/25 bg-primary/[0.06] px-4 py-3 text-sm text-foreground/85" role="status">
              <span className="font-medium text-foreground">Large repository.</span>{' '}
              ShipSeal indexed {(report.scanSummary.discoveredFiles ?? report.scanSummary.totalFilesFound).toLocaleString()} files and analyzed {(report.scanSummary.analyzedTextFiles ?? report.scanSummary.filesAnalyzed).toLocaleString()} relevant evidence files. Generated, binary, oversized, and lower-priority content was excluded within the safe analysis budget.
            </p>
          )}
        </div>
        <div className={`relative flex flex-wrap items-center gap-2 ${stageOverlay ? 'pt-0.5' : 'lg:justify-end'}`}>
          {isMobile ? (
            <>
              {stageOverlay && (
                <Button type="button" size="sm" onClick={onPlanAgentTask} className="h-9 bg-primary px-3 text-xs text-primary-foreground hover:bg-primary/90" data-mobile-primary-action="true">
                  <Compass className="mr-1.5 h-3.5 w-3.5" /> Plan an agent task
                </Button>
              )}
              <details className="group relative" data-testid="mobile-repository-context-disclosure">
                <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-full border border-primary/15 bg-floating/70 text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden" aria-label="More repository actions">
                  <MoreHorizontal className="h-4 w-4" />
                </summary>
                <div className="absolute right-0 top-[calc(100%+0.5rem)] z-[var(--layer-popover)] max-h-[min(26rem,calc(100dvh-8rem))] w-[min(20rem,calc(100vw-1.5rem))] overflow-y-auto rounded-2xl border border-border/70 bg-drawer p-3 shadow-[var(--shadow-lg-semantic)]">
                  {stageOverlay && (
                    <div className="mb-3 border-b border-border/50 pb-3 text-xs leading-relaxed text-muted-foreground">
                      <div className="break-words font-medium text-foreground [overflow-wrap:anywhere]">{repositoryIdentity}</div>
                      <div className="mt-1">{branch} · {report.stack.primary}</div>
                      <p className="mt-2">
                        {limited
                          ? `ShipSeal mapped ${fileCount.toLocaleString()} files within the available scan boundary. Conclusions remain limited.`
                          : `ShipSeal mapped ${fileCount.toLocaleString()} files and found ${frictions.length.toLocaleString()} areas creating agent friction.`}
                      </p>
                    </div>
                  )}
                  <div className="grid gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={onReviewRepositoryIntelligence} className="w-full justify-start">
                      Review improvements <ArrowRight className="ml-auto h-4 w-4" />
                    </Button>
                    {!stageOverlay && (
                      <Button type="button" variant="outline" size="sm" onClick={onPlanAgentTask} className="w-full justify-start">
                        <Compass className="mr-1.5 h-3.5 w-3.5" /> Plan an agent task
                      </Button>
                    )}
                    {persistenceControl && <div className="[&>div]:rounded-xl [&>div]:border-primary/10 [&>div]:bg-transparent [&>div]:p-0">{persistenceControl}</div>}
                    {onReplayReveal && <Button type="button" variant="ghost" size="sm" onClick={onReplayReveal} className="w-full justify-start"><Sparkles className="mr-1.5 h-3.5 w-3.5" /> Replay reveal</Button>}
                    <Button type="button" variant="ghost" size="sm" onClick={onReset} className="w-full justify-start"><RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Scan another project</Button>
                  </div>
                </div>
              </details>
            </>
          ) : (
            <>
              <Button type="button" variant={stageOverlay ? 'outline' : 'default'} size="sm" onClick={onReviewRepositoryIntelligence} className={stageOverlay ? 'border-border/60 bg-background/20' : 'bg-primary text-primary-foreground hover:bg-primary/90'}>
                Review improvements <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button type="button" variant={stageOverlay ? 'default' : 'outline'} size="sm" onClick={onPlanAgentTask} className={stageOverlay ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'border-border/60 bg-background/20'}>
                <Compass className="mr-1.5 h-3.5 w-3.5" /> Plan an agent task
              </Button>
              {persistenceControl && (
                <div className={stageOverlay ? '[&>div]:rounded-xl [&>div]:border-primary/10 [&>div]:bg-transparent [&>div]:p-0.5' : ''}>
                  {persistenceControl}
                </div>
              )}
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" size="icon" className="h-9 w-9 rounded-full border-primary/15 bg-floating/70 text-muted-foreground" aria-label="More result actions">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" collisionPadding={12} className="w-52" data-overlay-layer="popover">
                  {onReplayReveal && <DropdownMenuItem onSelect={onReplayReveal}><Sparkles className="mr-1.5 h-3.5 w-3.5" /> Replay reveal</DropdownMenuItem>}
                  <DropdownMenuItem onSelect={onReset}><RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Scan another project</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
