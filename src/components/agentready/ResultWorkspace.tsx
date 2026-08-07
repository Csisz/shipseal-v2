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
import type { RepositoryIntelligenceProviderStatus, RepositoryIntelligenceVerificationBaseline, RepositoryIntelligenceVerificationResult } from '@/lib/repositoryIntelligence';
import { PostScanOverview } from './result-dashboard/PostScanOverview';
import { ResultChapterNav } from './result-dashboard/ResultChapterNav';
import { ResultChapterShell } from './result-dashboard/ResultChapterShell';
import { ResultChapterLoadBoundary, ResultChapterLoading } from './result-dashboard/ResultChapterLoadBoundary';
import { getResultChapterStatuses, workspaceInsights } from './result-dashboard/chapterState';
import { selectRepositoryFrictions } from './result-dashboard/repositoryFrictions';
import type { ResultChapterId } from './result-dashboard/types';
import { ResultWorkspaceDisclosure as Disclosure } from './result-workspace/ResultWorkspaceDisclosure';
import {
  selectActiveWorkspaceStoryChapter,
  selectLimitedScanReason,
} from './result-workspace/model/resultWorkspaceSelectors';
import { AiWorkspaceHero } from './result-workspace/universe/UniverseWorkspace';
import type { RepositoryFutureStageOverlay } from './result-workspace/futures/futurePathwaysPresentation';
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
  prepareRepositoryIntelligenceEnhancement?: () => Promise<void>;
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
  prepareRepositoryIntelligenceEnhancement,
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
  const repositoryHealth = report.repositoryHealth;
  const resolvedPackages = resolveSelectedPackages(selectedPackages ?? []);
  const [localStoryChapterId, setLocalStoryChapterId] = useState<WorkspaceStoryChapterId | null>(null);
  const [activeResultChapter, setActiveResultChapter] = useState<ResultChapterId>('understand');
  const [visitedResultChapters, setVisitedResultChapters] = useState<Set<ResultChapterId>>(() => new Set(['understand']));
  const [workspaceHeroRequested, setWorkspaceHeroRequested] = useState(true);
  const [flightPathRequested, setFlightPathRequested] = useState(false);
  const [pendingDashboardFocus, setPendingDashboardFocus] = useState<'repository-intelligence' | 'repository-universe' | null>(null);
  const [planReviewed, setPlanReviewed] = useState(false);
  const [packagePrepared, setPackagePrepared] = useState(false);
  const [prCreated, setPrCreated] = useState(false);
  const [futureStageOverlay, setFutureStageOverlay] = useState<RepositoryFutureStageOverlay | null>(null);
  const repositoryUniverseRef = useRef<HTMLDivElement>(null);
  const repositoryIntelligenceReviewRef = useRef<HTMLDivElement>(null);
  const workspaceStory = useMemo(() => buildWorkspaceStory(report), [report]);
  const repositoryUniverse = useMemo(() => buildRepositoryUniverseModel(report), [report]);
  const effectiveStoryChapterId = activeStoryChapterId ?? localStoryChapterId;
  const activeStoryChapter = selectActiveWorkspaceStoryChapter(workspaceStory, effectiveStoryChapterId);
  const limitedScanReason = selectLimitedScanReason(report);
  const repositoryFrictions = useMemo(() => selectRepositoryFrictions(repositoryHealth), [repositoryHealth]);
  const verificationResult = useMemo(() => verificationBaseline
    ? buildRepositoryVerificationResult({ baseline: verificationBaseline, currentReport: report })
    : null, [report, verificationBaseline]);
  useEffect(() => {
    setActiveResultChapter('understand');
    setVisitedResultChapters(new Set(['understand']));
    setWorkspaceHeroRequested(true);
    setFlightPathRequested(false);
    setPendingDashboardFocus(null);
    setPlanReviewed(false);
    setPackagePrepared(false);
    setPrCreated(false);
    setFutureStageOverlay(null);
  }, [initialIntake, intakeSkipped, report.repoName, report.scannedAt]);

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
    setWorkspaceHeroRequested(true);
    handleResultChapterChange('understand');
  };
  const handlePlanAgentTask = () => {
    setWorkspaceHeroRequested(true);
    setFlightPathRequested(true);
    handleResultChapterChange('understand');
  };
  const clearRepositoryIntelligenceFocus = useCallback(() => setPendingDashboardFocus(current => current === 'repository-intelligence' ? null : current), []);

  useEffect(() => {
    if (activeResultChapter === 'improve' || activeResultChapter === 'verify') setWorkspaceHeroRequested(true);
  }, [activeResultChapter]);

  useEffect(() => {
    if (pendingDashboardFocus !== 'repository-universe' || !workspaceHeroRequested || activeResultChapter !== 'understand') return;
    const frame = requestAnimationFrame(() => {
      focusDashboardTarget(repositoryUniverseRef.current);
      setPendingDashboardFocus(current => current === 'repository-universe' ? null : current);
    });
    return () => cancelAnimationFrame(frame);
  }, [activeResultChapter, focusDashboardTarget, pendingDashboardFocus, workspaceHeroRequested]);

  useEffect(() => {
    // Fetch the isolated visualization chunk once a truthful report exists; it remains lazily mounted.
    void import('./RepositoryUniverse3D');
  }, [report.repoName, report.scannedAt]);

  useEffect(() => {
    if (workspaceHeroRequested || typeof IntersectionObserver === 'undefined') return;
    const target = repositoryUniverseRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      setWorkspaceHeroRequested(true);
      observer.disconnect();
    }, { rootMargin: '240px 0px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, [workspaceHeroRequested]);
  const chapterStatuses = getResultChapterStatuses({
    report,
    planReviewed,
    packagePrepared: packagePrepared || prCreated,
    verificationResult,
  });

  return (
    <section className="container max-w-[1480px] py-4 md:py-5 animate-fade-in-up">
      <div className="dashboard-print-warning">
        For a client-ready PDF, use the print-ready report export instead of printing this dashboard.
      </div>

      {(!['understand', 'improve'].includes(activeResultChapter) || repositoryHealth.overall.score === null) && <PostScanOverview
        report={report}
        limitedScanReason={limitedScanReason}
        frictions={repositoryFrictions}
        onReviewRepositoryIntelligence={handleReviewRepositoryIntelligence}
        onPlanAgentTask={handlePlanAgentTask}
        onReset={onReset}
        onReplayReveal={onReplayReveal}
        persistenceControl={persistenceControl}
      />}

      {(!['understand', 'improve'].includes(activeResultChapter) || repositoryHealth.overall.score === null) && <ResultChapterNav
        activeChapter={activeResultChapter}
        statuses={chapterStatuses}
        onChange={handleResultChapterChange}
      />}

      {visitedResultChapters.has('improve') && (
        <ResultChapterShell chapter="improve" active={activeResultChapter === 'improve'}>
          <ResultChapterLoadBoundary chapterLabel="Future Pathways">
            <Suspense fallback={<ResultChapterLoading chapterLabel="Future Pathways" />}>
              <ImproveChapter
                variant="pathways"
                frictions={repositoryFrictions}
                targetRef={repositoryIntelligenceReviewRef}
                focusTarget={false}
                onTargetFocused={clearRepositoryIntelligenceFocus}
                githubConnection={githubConnection || buildGitHubConnectionFromReport(report)}
                report={report}
                universe={repositoryUniverse}
                onFutureStageOverlayChange={setFutureStageOverlay}
              />
            </Suspense>
          </ResultChapterLoadBoundary>
        </ResultChapterShell>
      )}

      <header hidden={activeResultChapter !== 'improve'} className="mb-5 max-w-4xl" data-testid="repository-future-impact-heading">
        <div className="text-xs font-mono uppercase tracking-[0.16em] text-primary-glow">2 · Repository impact</div>
        <h2 id="repository-future-impact-title" className="mt-1 font-display text-2xl font-semibold md:text-3xl">See this future in your repository</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground md:text-base">
          {futureStageOverlay?.universeProjection
            ? 'Compare the current Repository Universe with the proposed impact of your selected path.'
            : 'Choose a Future Path above to explore its proposed repository impact.'}
        </p>
      </header>

      <div key="repository-universe" ref={repositoryUniverseRef} id="repository-universe" tabIndex={-1} hidden={activeResultChapter === 'deliver'} aria-labelledby={activeResultChapter === 'improve' ? 'repository-future-impact-title' : undefined} className="relative left-1/2 min-h-[calc(100dvh-5rem)] w-screen -translate-x-1/2 scroll-mt-20 overflow-hidden bg-background focus:outline-none">
        {workspaceHeroRequested ? <AiWorkspaceHero
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
          futureStageOverlay={activeResultChapter === 'improve' ? futureStageOverlay : null}
          universeModel={repositoryUniverse}
        /> : null}
      </div>

      {visitedResultChapters.has('improve') && (
        <div hidden={activeResultChapter !== 'improve'} className="mb-6">
          <ResultChapterLoadBoundary chapterLabel="Other improvements">
            <Suspense fallback={<ResultChapterLoading chapterLabel="Other improvements" />}>
              <ImproveChapter
                variant="other"
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
                report={report}
                universe={repositoryUniverse}
                onVerificationBaseline={onSaveRepositoryIntelligenceVerificationBaseline}
                onFutureStageOverlayChange={setFutureStageOverlay}
              />
            </Suspense>
          </ResultChapterLoadBoundary>
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

      {visitedResultChapters.has('improve') && <div hidden={activeResultChapter !== 'improve'}>
      <Disclosure title="Secondary repository improvements">
        <ResultChapterLoadBoundary chapterLabel="Readiness Fix Pack">
          <Suspense fallback={<ResultChapterLoading chapterLabel="readiness improvements" />}>
            <SuggestedReadinessFixPack report={report} githubConnection={githubConnection} selectedPackages={resolvedPackages} />
          </Suspense>
        </ResultChapterLoadBoundary>
      </Disclosure>
      </div>}

    </section>
  );
}

