import { ArrowRight, Orbit, RefreshCw, Sparkles } from 'lucide-react';
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
  onExploreRepositoryUniverse,
  onReset,
  onReplayReveal,
  persistenceControl,
}: {
  report: ReadinessReport;
  limitedScanReason?: string;
  frictions: RepositoryFriction[];
  onReviewRepositoryIntelligence: () => void;
  onExploreRepositoryUniverse: () => void;
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
    <section className="mb-5 rounded-[2rem] border border-primary/20 bg-[hsl(225_28%_7%)] p-5 shadow-sm shadow-primary/10 md:p-8" aria-labelledby="workspace-result-heading">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-4xl">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-primary/45 text-primary-glow">Repository Intelligence</Badge>
            <span className="min-w-0 break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">{repositoryIdentity}</span>
          </div>
          <h1 id="workspace-result-heading" className="font-display text-3xl font-semibold leading-tight md:text-5xl">
            {limited ? 'Repository evidence is limited.' : 'Repository understood.'}
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground md:text-base">
            {limited
              ? `ShipSeal mapped ${fileCount.toLocaleString()} files within the available scan boundary. Conclusions remain limited.`
              : `ShipSeal mapped ${fileCount.toLocaleString()} files into a repository-specific workspace model.`}
          </p>
          <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <div><dt className="inline text-muted-foreground">Stack </dt><dd className="inline break-words font-medium text-foreground [overflow-wrap:anywhere]">{report.stack.primary}</dd></div>
            <div><dt className="inline text-muted-foreground">Branch </dt><dd className="inline break-words font-medium text-foreground [overflow-wrap:anywhere]">{branch}</dd></div>
          </dl>
          {limited && (
            <p className="mt-4 max-w-3xl rounded-2xl border border-warning/35 bg-warning/10 px-4 py-3 text-sm text-warning/90">
              Limited scan: {limitedScanReason || 'The scanner could not fully analyze the repository, so unavailable areas are not treated as failures.'}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 xl:max-w-xs xl:justify-end">
          {onReplayReveal && (
            <Button variant="outline" size="sm" onClick={onReplayReveal} className="border-primary/35 bg-primary/10 text-primary-glow hover:text-primary-glow">
              <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Replay reveal
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onReset} className="border-border/60 bg-background/20">
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Scan another project
          </Button>
        </div>
      </div>

      <div className="mt-7 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.58fr)]">
        <div className="order-2 min-w-0 lg:order-1">
          <h2 className="font-display text-xl font-semibold">Repository frictions</h2>
          <p className="mt-1 text-sm text-muted-foreground">Deterministic blockers and next actions from this scan.</p>
          <ol className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {frictions.map(friction => (
              <li key={friction.id} className="rounded-2xl border border-border/55 bg-background/20 p-4">
                <div className="mb-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  {friction.source === 'blocker' ? 'Observed blocker' : friction.source === 'top-action' ? 'Recommended next action' : 'Evidence status'}
                </div>
                <div className="text-sm font-semibold text-foreground">{friction.title}</div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{friction.detail}</p>
                {friction.evidence && <p className="mt-2 text-xs leading-relaxed text-muted-foreground"><span className="font-medium text-foreground">Evidence:</span> {friction.evidence}</p>}
                {friction.recommendation && <p className="mt-2 text-xs leading-relaxed text-muted-foreground"><span className="font-medium text-foreground">Next step:</span> {friction.recommendation}</p>}
              </li>
            ))}
          </ol>
        </div>
        <div className="order-1 flex min-w-0 flex-col justify-center gap-3 rounded-3xl border border-primary/25 bg-primary/5 p-4 md:p-5 lg:order-2">
          <Button type="button" onClick={onReviewRepositoryIntelligence} className="w-full min-w-0 justify-between whitespace-normal text-left bg-primary text-primary-foreground hover:bg-primary/90">
            Review Repository Intelligence PR <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" onClick={onExploreRepositoryUniverse} className="w-full min-w-0 justify-between whitespace-normal text-left border-primary/35 bg-background/20 text-foreground">
            Explore in Repository Universe <Orbit className="ml-2 h-4 w-4" />
          </Button>
          {persistenceControl}
          <p className="text-xs leading-relaxed text-muted-foreground">Review prepares the existing in-memory artifact flow. It does not create or change a GitHub PR.</p>
        </div>
      </div>
    </section>
  );
}
