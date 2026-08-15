import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import type { ReactNode } from 'react';
import type { AgentOperatingModeId, ReadinessReport, ScanHistoryItem } from '@/lib/types';
import type { ProjectIntake } from '@/lib/intake';
import { resolveSelectedPackages } from '@/lib/packages';
import { buildGitHubConnectionFromReport, type GitHubConnectionState } from '@/lib/githubConnection/types';
import {
  buildRepositoryVerificationResult,
  buildRepositoryUniverseModel,
  buildWorkspaceStory,
  type RepositoryVerificationBaseline,
  type WorkspaceStoryChapterId,
} from '@/lib/workspace';
import type { RepositoryIntelligenceReviewUiSession } from './RepositoryIntelligenceReviewPanel';
import type { RepositoryIntelligenceProviderStatus, RepositoryIntelligenceVerificationBaseline, RepositoryIntelligenceVerificationResult, RepositoryProductIntelligenceResult } from '@/lib/repositoryIntelligence';
import { PostScanOverview } from './result-dashboard/PostScanOverview';
import { ResultChapterNav } from './result-dashboard/ResultChapterNav';
import { ResultChapterShell } from './result-dashboard/ResultChapterShell';
import { ResultChapterLoadBoundary, ResultChapterLoading } from './result-dashboard/ResultChapterLoadBoundary';
import { getResultChapterStatuses } from './result-dashboard/chapterState';
import { selectRepositoryFrictions } from './result-dashboard/repositoryFrictions';
import type { ResultChapterId } from './result-dashboard/types';
import { PostScanViewSelector, type PostScanEntryView } from './result-dashboard/PostScanViewSelector';
import { ResultWorkspaceDisclosure as Disclosure } from './result-workspace/ResultWorkspaceDisclosure';
import {
  selectActiveWorkspaceStoryChapter,
  selectLimitedScanReason,
} from './result-workspace/model/resultWorkspaceSelectors';
import { AiWorkspaceHero } from './result-workspace/universe/UniverseWorkspace';
import { RepositoryFormation } from './RepositoryFormation';
import { PanelsTopLeft } from 'lucide-react';
const RepositoryFuturesWorkspace = lazy(() => import('./result-workspace/futures/RepositoryFuturesWorkspace'));
const ImproveChapter = lazy(() => import('./result-dashboard/chapters/ImproveChapter'));
const VerifyChapter = lazy(() => import('./result-dashboard/chapters/VerifyChapter'));
const DeliverChapter = lazy(() => import('./result-dashboard/chapters/DeliverChapter'));
const DeliverWorkspace = lazy(() => import('./result-workspace/deliver/DeliverWorkspace'));
const SuggestedReadinessFixPack = lazy(() => import('./SuggestedReadinessFixPack').then(module => ({ default: module.SuggestedReadinessFixPack })));

interface Props {
  report: ReadinessReport;
  history: ScanHistoryItem[];
  onReset: () => void;
  onClearHistory: () => void;
  onReplayReveal?: () => void;
  activeStoryChapterId?: WorkspaceStoryChapterId | null;
  onActiveStoryChapterChange?: (chapterId: WorkspaceStoryChapterId | null) => void;
  initialIntake?: ProjectIntake;
  intakeSkipped?: boolean;
  /** Package options the user picked before the scan; defaults to the full package. */
  selectedPackages?: string[];
  /** Internal validated review drafts; selected source context is intentionally not passed into the dashboard. */
  repositoryIntelligenceReviewSession?: RepositoryIntelligenceReviewUiSession | null;
  repositoryIntelligenceReviewPreparing?: boolean;
  repositoryIntelligenceReviewError?: string | null;
  prepareRepositoryIntelligenceReview?: () => Promise<RepositoryIntelligenceReviewUiSession>;
  repositoryIntelligenceProviderStatus?: RepositoryIntelligenceProviderStatus;
  repositoryProductIntelligenceStatus?: RepositoryIntelligenceProviderStatus;
  repositoryProductIntelligence?: RepositoryProductIntelligenceResult | null;
  prepareRepositoryIntelligenceEnhancement?: () => Promise<void>;
  retryRepositoryProductIntelligence?: () => Promise<void>;
  agentOperatingMode?: AgentOperatingModeId;
  githubConnection?: GitHubConnectionState;
  verificationBaseline?: RepositoryVerificationBaseline | null;
  onSaveVerificationBaseline?: (baseline: RepositoryVerificationBaseline) => void;
  onDiscardVerificationBaseline?: () => void;
  repositoryIntelligenceVerificationBaseline?: RepositoryIntelligenceVerificationBaseline | null;
  repositoryIntelligenceVerificationResult?: RepositoryIntelligenceVerificationResult | null;
  repositoryIntelligenceVerificationStatus?: 'idle' | 'scanning' | 'completed' | 'failed';
  repositoryIntelligenceVerificationError?: string | null;
  onSaveRepositoryIntelligenceVerificationBaseline?: (baseline: RepositoryIntelligenceVerificationBaseline) => void;
  onDiscardRepositoryIntelligenceVerificationBaseline?: () => void;
  onRescanRepositoryIntelligence?: () => void;
  persistenceControl?: ReactNode;
}

export function ResultWorkspace({
  report,
  history,
  onReset,
  onClearHistory,
  onReplayReveal,
  activeStoryChapterId,
  onActiveStoryChapterChange,
  initialIntake,
  intakeSkipped = false,
  selectedPackages,
  repositoryIntelligenceReviewSession,
  repositoryIntelligenceReviewPreparing,
  repositoryIntelligenceReviewError,
  prepareRepositoryIntelligenceReview,
  repositoryIntelligenceProviderStatus,
  repositoryProductIntelligenceStatus,
  repositoryProductIntelligence,
  prepareRepositoryIntelligenceEnhancement,
  retryRepositoryProductIntelligence,
  agentOperatingMode,
  githubConnection,
  verificationBaseline,
  onSaveVerificationBaseline,
  onDiscardVerificationBaseline,
  repositoryIntelligenceVerificationBaseline,
  repositoryIntelligenceVerificationResult,
  repositoryIntelligenceVerificationStatus,
  repositoryIntelligenceVerificationError,
  onSaveRepositoryIntelligenceVerificationBaseline,
  onDiscardRepositoryIntelligenceVerificationBaseline,
  onRescanRepositoryIntelligence,
  persistenceControl,
}: Props) {
  const reportIdentity = `${report.repoName}:${report.scannedAt}`;
  const repositoryHealth = report.repositoryHealth;
  const resolvedPackages = resolveSelectedPackages(selectedPackages ?? []);
  const [localStoryChapterId, setLocalStoryChapterId] = useState<WorkspaceStoryChapterId | null>(null);
  const [entryView, setEntryView] = useState<PostScanEntryView | null>(null);
  const [activeResultChapter, setActiveResultChapter] = useState<ResultChapterId>('understand');
  const [visitedResultChapters, setVisitedResultChapters] = useState<Set<ResultChapterId>>(() => new Set(['understand']));
  const [universeRequested, setUniverseRequested] = useState(false);
  const [flightPathRequested, setFlightPathRequested] = useState(false);
  const [pendingDashboardFocus, setPendingDashboardFocus] = useState<'repository-intelligence' | 'repository-universe' | null>(null);
  const [planReviewed, setPlanReviewed] = useState(false);
  const [packagePrepared, setPackagePrepared] = useState(false);
  const [prCreated, setPrCreated] = useState(false);
  const [workspaceReportIdentity, setWorkspaceReportIdentity] = useState(reportIdentity);
  const [futureDegradedAccess, setFutureDegradedAccess] = useState(false);
  const repositoryUniverseRef = useRef<HTMLDivElement>(null);
  const repositoryIntelligenceReviewRef = useRef<HTMLDivElement>(null);
  const workspaceStory = useMemo(() => buildWorkspaceStory(report), [report]);
  const effectiveEntryView = workspaceReportIdentity === reportIdentity ? entryView : null;
  const repositoryModelNeeded = workspaceReportIdentity === reportIdentity && effectiveEntryView !== null;
  const repositoryUniverse = useMemo(() => repositoryModelNeeded
    ? buildRepositoryUniverseModel(report)
    : null, [report, repositoryModelNeeded]);
  const effectiveStoryChapterId = activeStoryChapterId ?? localStoryChapterId;
  const activeStoryChapter = selectActiveWorkspaceStoryChapter(workspaceStory, effectiveStoryChapterId);
  const limitedScanReason = selectLimitedScanReason(report);
  const repositoryFrictions = useMemo(() => selectRepositoryFrictions(repositoryHealth), [repositoryHealth]);
  const verificationResult = useMemo(() => verificationBaseline
    ? buildRepositoryVerificationResult({ baseline: verificationBaseline, currentReport: report })
    : null, [report, verificationBaseline]);
  useEffect(() => {
    setWorkspaceReportIdentity(reportIdentity);
    setEntryView(current => workspaceReportIdentity === reportIdentity ? current : null);
    setActiveResultChapter('understand');
    setVisitedResultChapters(new Set(['understand']));
    setUniverseRequested(current => workspaceReportIdentity === reportIdentity ? current : false);
    setFlightPathRequested(false);
    setPendingDashboardFocus(null);
    setPlanReviewed(false);
    setPackagePrepared(false);
    setPrCreated(false);
    setFutureDegradedAccess(false);
  }, [initialIntake, intakeSkipped, reportIdentity, workspaceReportIdentity]);

  useEffect(() => {
    if (!activeStoryChapter || effectiveStoryChapterId === activeStoryChapter.id) return;
    setLocalStoryChapterId(activeStoryChapter.id);
    onActiveStoryChapterChange?.(activeStoryChapter.id);
  }, [activeStoryChapter, effectiveStoryChapterId, onActiveStoryChapterChange]);

  const handleActiveStoryChapterChange = (chapterId: WorkspaceStoryChapterId | null) => {
    setLocalStoryChapterId(chapterId);
    onActiveStoryChapterChange?.(chapterId);
  };

  const focusDashboardTarget = useCallback((target: HTMLDivElement | null) => {
    if (!target) return;
    target.focus({ preventScroll: true });
    target.scrollIntoView?.({ block: 'start', behavior: 'auto' });
  }, []);
  const handleResultChapterChange = useCallback((chapter: ResultChapterId) => {
    setVisitedResultChapters(current => current.has(chapter) ? current : new Set([...current, chapter]));
    setActiveResultChapter(chapter);
  }, []);
  const handleReviewRepositoryIntelligence = () => {
    setPendingDashboardFocus('repository-intelligence');
    handleResultChapterChange('improve');
  };
  const handleExploreRepositoryUniverse = () => {
    setPendingDashboardFocus('repository-universe');
    setUniverseRequested(true);
    handleResultChapterChange('understand');
  };
  const handlePlanAgentTask = () => {
    setUniverseRequested(true);
    setFlightPathRequested(true);
    handleResultChapterChange('understand');
  };
  const handleEntryViewSelect = useCallback((view: PostScanEntryView) => {
    setEntryView(view);
    if (view === 'universe') {
      setUniverseRequested(true);
      setPendingDashboardFocus('repository-universe');
      handleResultChapterChange('understand');
      return;
    }
    setPendingDashboardFocus(null);
    handleResultChapterChange('improve');
  }, [handleResultChapterChange]);
  const clearRepositoryIntelligenceFocus = useCallback(() => setPendingDashboardFocus(current => current === 'repository-intelligence' ? null : current), []);

  useEffect(() => {
    if (pendingDashboardFocus !== 'repository-universe' || !universeRequested || effectiveEntryView !== 'universe' || activeResultChapter !== 'understand') return;
    const frame = requestAnimationFrame(() => {
      focusDashboardTarget(repositoryUniverseRef.current);
      setPendingDashboardFocus(current => current === 'repository-universe' ? null : current);
    });
    return () => cancelAnimationFrame(frame);
  }, [activeResultChapter, effectiveEntryView, focusDashboardTarget, pendingDashboardFocus, universeRequested]);

  useEffect(() => {
    if (!universeRequested || effectiveEntryView !== 'universe') return;
    // Fetch the isolated visualization chunk only after explicit Universe intent.
    void import('./RepositoryUniverse3D');
  }, [effectiveEntryView, universeRequested]);
  const chapterStatuses = getResultChapterStatuses({
    report,
    planReviewed,
    packagePrepared: packagePrepared || prCreated,
    verificationResult,
  });
  const futuresReady = !repositoryProductIntelligenceStatus
    || repositoryProductIntelligenceStatus.state === 'enhanced' && Boolean(repositoryProductIntelligence?.opportunities.length);
  const futureTerminalFailure = Boolean(repositoryProductIntelligenceStatus
    && ['fallback', 'cancelled'].includes(repositoryProductIntelligenceStatus.state));

  useEffect(() => {
    if (futureTerminalFailure) setFutureDegradedAccess(true);
  }, [futureTerminalFailure]);

  useEffect(() => {
    if (effectiveEntryView === 'futures' && !futuresReady) setEntryView(null);
  }, [effectiveEntryView, futuresReady]);

  const selectorReady = futuresReady || futureDegradedAccess || futureTerminalFailure;

  if (!effectiveEntryView && !selectorReady) {
    const terminalFailure = ['fallback', 'cancelled'].includes(repositoryProductIntelligenceStatus.state);
    return (
      <RepositoryFormation
        repositoryName={report.repoName}
        sourceLabel="Repository scan"
        stage="directions"
        title="Forming future pathways"
        action={repositoryProductIntelligenceStatus?.message || 'Connecting repository evidence to grounded future directions.'}
        failure={terminalFailure ? { message: repositoryProductIntelligenceStatus.message } : undefined}
        fullScreen
      />
    );
  }

  if (!effectiveEntryView) {
    return (
      <PostScanViewSelector
        report={report}
        opportunityCount={repositoryProductIntelligence?.opportunities.length || 0}
        futuresAvailable={futuresReady}
        futuresStatus={repositoryProductIntelligenceStatus}
        onRetryFutures={retryRepositoryProductIntelligence ? () => { void retryRepositoryProductIntelligence(); } : undefined}
        onSelect={handleEntryViewSelect}
      />
    );
  }

  if (effectiveEntryView === 'futures' && repositoryUniverse) {
    return (
      <section data-view-transition="selector-to-futures" data-experience-shell="futures" className="w-full bg-workspace futures-surface-enter motion-reduce:animate-none">
        <div className="dashboard-print-warning">
          For a client-ready PDF, use the print-ready report export instead of printing this dashboard.
        </div>
        <ChangeViewControl currentView="Repository Futures" onChange={() => setEntryView(null)} />
        <Suspense fallback={<ResultChapterLoading chapterLabel="Repository Futures" />}>
          <RepositoryFuturesWorkspace
            report={report}
            repositoryModel={repositoryUniverse}
            productIntelligence={repositoryProductIntelligence}
            productIntelligenceStatus={repositoryProductIntelligenceStatus}
            secondaryOpen={pendingDashboardFocus === 'repository-intelligence'}
            secondaryContent={(
              <div className="space-y-6">
                <ResultChapterLoadBoundary chapterLabel="Other improvements">
                  <Suspense fallback={<ResultChapterLoading chapterLabel="Other improvements" />}>
                    <ImproveChapter
                      frictions={repositoryFrictions}
                      targetRef={repositoryIntelligenceReviewRef}
                      focusTarget={pendingDashboardFocus === 'repository-intelligence'}
                      onTargetFocused={clearRepositoryIntelligenceFocus}
                      session={repositoryIntelligenceReviewSession}
                      preparing={repositoryIntelligenceReviewPreparing}
                      error={repositoryIntelligenceReviewError}
                      prepareSession={prepareRepositoryIntelligenceReview}
                      providerStatus={repositoryIntelligenceProviderStatus}
                      prepareEnhancement={prepareRepositoryIntelligenceEnhancement}
                      githubConnection={githubConnection || buildGitHubConnectionFromReport(report)}
                      onVerificationBaseline={onSaveRepositoryIntelligenceVerificationBaseline}
                    />
                  </Suspense>
                </ResultChapterLoadBoundary>
                <ResultChapterLoadBoundary chapterLabel="Readiness Fix Pack">
                  <Suspense fallback={<ResultChapterLoading chapterLabel="readiness improvements" />}>
                    <SuggestedReadinessFixPack report={report} githubConnection={githubConnection} selectedPackages={resolvedPackages} />
                  </Suspense>
                </ResultChapterLoadBoundary>
              </div>
            )}
          />
        </Suspense>
      </section>
    );
  }

  return (
    <section data-experience-shell="universe" className="container max-w-[1480px] py-4 md:py-5 animate-fade-in-up">
      <div className="dashboard-print-warning">
        For a client-ready PDF, use the print-ready report export instead of printing this dashboard.
      </div>

      <ChangeViewControl currentView="Project Universe" onChange={() => setEntryView(null)} />

      {(!['understand', 'improve'].includes(activeResultChapter) || repositoryHealth.overall.score === null || (activeResultChapter === 'understand' && !universeRequested)) && <PostScanOverview
        report={report}
        limitedScanReason={limitedScanReason}
        frictions={repositoryFrictions}
        onReviewRepositoryIntelligence={handleReviewRepositoryIntelligence}
        onPlanAgentTask={handlePlanAgentTask}
        onReset={onReset}
        onReplayReveal={onReplayReveal}
        persistenceControl={persistenceControl}
      />}

      {(!['understand', 'improve'].includes(activeResultChapter) || repositoryHealth.overall.score === null || (activeResultChapter === 'understand' && !universeRequested)) && <ResultChapterNav
        activeChapter={activeResultChapter}
        statuses={chapterStatuses}
        onChange={handleResultChapterChange}
      />}

      <div key="repository-universe" ref={repositoryUniverseRef} id="repository-universe" tabIndex={-1} hidden={activeResultChapter === 'deliver'} className="relative min-h-[calc(100dvh-5rem)] w-full scroll-mt-20 overflow-hidden bg-background focus:outline-none">
        {universeRequested && repositoryUniverse ? <AiWorkspaceHero
          report={report}
          limitationReason={limitedScanReason}
          story={workspaceStory}
          activeStoryChapter={activeStoryChapter}
          onActiveStoryChapterChange={handleActiveStoryChapterChange}
          activeResultChapter={activeResultChapter}
          onResultChapterChange={handleResultChapterChange}
          repositoryContextOverlay={<PostScanOverview
            report={report}
            limitedScanReason={limitedScanReason}
            frictions={repositoryFrictions}
            onReviewRepositoryIntelligence={handleReviewRepositoryIntelligence}
            onPlanAgentTask={handlePlanAgentTask}
            onReset={onReset}
            onReplayReveal={onReplayReveal}
            persistenceControl={persistenceControl}
            variant="stage"
          />}
          chapterNavOverlay={<ResultChapterNav
            activeChapter={activeResultChapter}
            statuses={chapterStatuses}
            onChange={handleResultChapterChange}
            variant="overlay"
          />}
          flightPathRequested={flightPathRequested}
          onFlightPathRequested={() => setFlightPathRequested(false)}
          onPlanReviewed={() => setPlanReviewed(true)}
          onPackagePrepared={() => setPackagePrepared(true)}
          onPrCreated={() => setPrCreated(true)}
          githubConnection={githubConnection}
          verificationBaseline={verificationBaseline}
          intelligenceVerificationBaseline={repositoryIntelligenceVerificationBaseline}
          intelligenceVerificationResult={repositoryIntelligenceVerificationResult}
          intelligenceVerificationStatus={repositoryIntelligenceVerificationStatus}
          onRescan={onRescanRepositoryIntelligence}
          onSaveVerificationBaseline={onSaveVerificationBaseline}
          onDiscardVerificationBaseline={onDiscardVerificationBaseline}
          universeModel={repositoryUniverse}
        /> : (
          <div data-testid="repository-universe-deferred" className="mx-auto flex min-h-[60dvh] max-w-3xl flex-col items-center justify-center px-6 py-16 text-center">
            <div className="font-mono text-xs uppercase tracking-[0.16em] text-primary-glow">Repository Universe</div>
            <h2 className="mt-3 font-display text-2xl font-semibold md:text-3xl">Explore the repository when you are ready</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
              Future Pathways and the rest of your scan remain interactive while the heavier visual repository view stays deferred.
            </p>
            <button type="button" className="mt-6 min-h-11 rounded-xl bg-primary px-5 py-2.5 font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setUniverseRequested(true)}>
              Explore Repository Universe
            </button>
          </div>
        )}
      </div>

      {visitedResultChapters.has('improve') && (
        <div hidden={activeResultChapter !== 'improve'} className="mb-6">
          <Disclosure title="Secondary repository improvements" defaultOpen={pendingDashboardFocus === 'repository-intelligence'} lazyMount>
            <div className="space-y-6">
              <ResultChapterLoadBoundary chapterLabel="Other improvements">
                <Suspense fallback={<ResultChapterLoading chapterLabel="Other improvements" />}>
                  <ImproveChapter
                    frictions={repositoryFrictions}
                    targetRef={repositoryIntelligenceReviewRef}
                    focusTarget={pendingDashboardFocus === 'repository-intelligence'}
                    onTargetFocused={clearRepositoryIntelligenceFocus}
                    session={repositoryIntelligenceReviewSession}
                    preparing={repositoryIntelligenceReviewPreparing}
                    error={repositoryIntelligenceReviewError}
                    prepareSession={prepareRepositoryIntelligenceReview}
                    providerStatus={repositoryIntelligenceProviderStatus}
                    prepareEnhancement={prepareRepositoryIntelligenceEnhancement}
                    githubConnection={githubConnection || buildGitHubConnectionFromReport(report)}
                    onVerificationBaseline={onSaveRepositoryIntelligenceVerificationBaseline}
                  />
                </Suspense>
              </ResultChapterLoadBoundary>
              <ResultChapterLoadBoundary chapterLabel="Readiness Fix Pack">
                <Suspense fallback={<ResultChapterLoading chapterLabel="readiness improvements" />}>
                  <SuggestedReadinessFixPack report={report} githubConnection={githubConnection} selectedPackages={resolvedPackages} />
                </Suspense>
              </ResultChapterLoadBoundary>
            </div>
          </Disclosure>
        </div>
      )}

      {visitedResultChapters.has('verify') && (
        <ResultChapterShell chapter="verify" active={activeResultChapter === 'verify'}>
          <ResultChapterLoadBoundary chapterLabel="Verify">
            <Suspense fallback={<ResultChapterLoading chapterLabel="Verify" />}>
              <VerifyChapter
                baseline={repositoryIntelligenceVerificationBaseline}
                result={repositoryIntelligenceVerificationResult}
                optimizationResult={verificationResult}
                status={repositoryIntelligenceVerificationStatus}
                error={repositoryIntelligenceVerificationError}
                report={report}
                onRescan={onRescanRepositoryIntelligence}
                onDiscardBaseline={onDiscardRepositoryIntelligenceVerificationBaseline}
              />
            </Suspense>
          </ResultChapterLoadBoundary>
        </ResultChapterShell>
      )}

      {visitedResultChapters.has('deliver') && (
        <ResultChapterShell chapter="deliver" active={activeResultChapter === 'deliver'}>
          <ResultChapterLoadBoundary chapterLabel="Deliver">
            <Suspense fallback={<ResultChapterLoading chapterLabel="Deliver" />}><DeliverChapter /></Suspense>
          </ResultChapterLoadBoundary>
        </ResultChapterShell>
      )}

      {visitedResultChapters.has('deliver') && (
        <Suspense fallback={<ResultChapterLoading chapterLabel="delivery workspace" />}>
          <DeliverWorkspace
            active={activeResultChapter === 'deliver'}
            report={report}
            history={history}
            onReset={onReset}
            onClearHistory={onClearHistory}
            initialIntake={initialIntake}
            intakeSkipped={intakeSkipped}
            resolvedPackages={resolvedPackages}
            agentOperatingMode={agentOperatingMode}
          />
        </Suspense>
      )}

    </section>
  );
}

function ChangeViewControl({ currentView, onChange }: { currentView: 'Project Universe' | 'Repository Futures'; onChange: () => void }) {
  return (
    <div
      data-testid="experience-shell-utility"
      data-current-experience={currentView}
      className="relative z-[var(--layer-toolbar)] w-full border-y border-primary/10 bg-[hsl(var(--surface-floating)/0.72)] backdrop-blur-xl"
    >
      <div className="mx-auto flex min-h-12 w-full max-w-[1920px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <span className="truncate font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground sm:text-[10px]">
          {currentView}
        </span>
        <button
          type="button"
          data-testid="change-view-control"
          onClick={onChange}
          className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full border border-primary/20 bg-background/60 px-3.5 text-xs font-medium text-muted-foreground transition-[color,border-color,background-color] duration-200 hover:border-primary/40 hover:bg-background/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
        >
          <PanelsTopLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Change view
          <span className="sr-only">Current view: {currentView}</span>
        </button>
      </div>
    </div>
  );
}

