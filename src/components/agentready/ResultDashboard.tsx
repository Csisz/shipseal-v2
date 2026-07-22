import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import type { ReactNode } from 'react';
import { AlertOctagon, Check, CheckCircle2, Copy, Crosshair, Download, FileArchive, Layers, Lightbulb, Maximize2, Minimize2, PanelRightClose, PanelRightOpen, RefreshCw, Search, ShieldCheck, Sparkles, Trash2, ZoomIn, ZoomOut } from 'lucide-react';
import type { AgentOperatingModeId, AgentPackFile, MCPRiskSeverity, ReadinessReport, ScanHistoryItem } from '@/lib/types';
import { evaluateReadiness } from '@/lib/scoring';
import { ScoreGauge } from './ScoreGauge';
import { ReadinessBadge } from './ReadinessBadge';
import { CategoryBreakdown } from './CategoryBreakdown';
import { AgentPackTabs } from './AgentPackTabs';
import { ProjectIntakeForm } from './ProjectIntakeForm';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { buildRepoContextPackJson, buildScoreJson, downloadJsonFile, downloadTextFile } from '@/lib/exports';
import { formatFileSize } from '@/lib/uploadValidation';
import { criticalBlockersEmptyStateText, displayReadinessLevel, readinessStatusMessageForPackage } from '@/lib/uiCopy';
import type { ProjectIntake } from '@/lib/intake';
import { createDefaultProjectIntake, normalizeProjectIntake } from '@/lib/intake';
import { FULL_PACKAGE_ID, getShipSealPackage, resolveSelectedPackages } from '@/lib/packages';
import { resolveDeliveryPackFocus } from '@/lib/deliveryPack';
import { getFolderAgentSuggestionPaths } from '@/lib/deliveryPack/folderAgents';
import { buildGitHubConnectionFromReport, type GitHubConnectionState } from '@/lib/githubConnection/types';
import { CreateReadinessPrClientError, createGitHubAppReadinessPr } from '@/lib/github/write';
import { DEFAULT_AGENT_OPERATING_MODE, applyAgentOperatingModeToFiles, getAgentOperatingMode, resolveAgentOperatingMode, selectionUsesAgentDevelopment } from '@/lib/agentOperatingMode';
import { buildToolingRecommendationBundle, recommendationCounts } from '@/lib/toolingRecommendations';
import {
  buildOptimizationApplyPlan,
  buildRepositoryAgentFlightPath,
  buildOptimizationPackZipBlob,
  buildOptimizationPackZipFilename,
  buildRepositoryAtlasModel,
  buildRepositoryOptimizationPlan,
  buildRepositoryTransformationProposalModel,
  buildRepositoryVerificationBaseline,
  buildRepositoryVerificationResult,
  buildRepositoryUniverseModel,
  buildWorkspaceStory,
  chapterForDnaDimension,
  chapterForMentalModelNode,
  repositoryUniverseEdgeVisible,
  repositoryUniverseFilterCounts,
  repositoryUniverseVisibleNodeIds,
  repositoryTransformationDomainCounts,
  serializeRepositoryOptimizationManifest,
  transformationDomainLabel,
  type RepositoryAtlasModel,
  type RepositoryAtlasNode,
  type RepositoryAgentFlightPath,
  type OptimizationApplyPlan,
  type OptimizationPrPreviewFile,
  type RepositoryVerificationBaseline,
  type RepositoryVerificationResult,
  type VerificationBaselineMethod,
  type VerifiedArtifactMatch,
  type RepositoryOptimizationPlan,
  type RepositoryOptimizationPlanItem,
  type RepositoryOptimizationReadiness,
  type RepositoryTransformationDomain,
  type RepositoryTransformationDomainFilter,
  type RepositoryTransformationMode,
  type RepositoryTransformationProposal,
  type RepositoryUniverseFilterKey,
  type RepositoryUniverseModel,
  type RepositoryUniverseNode,
  type RepositoryKnowledgeCluster,
  type RepositoryKnowledgeEdge,
  type WorkspaceStory,
  type WorkspaceStoryAgentStepId,
  type WorkspaceStoryChapter,
  type WorkspaceStoryChapterId,
  type WorkspaceStoryDnaDimensionId,
  type WorkspaceStoryMentalNodeId,
} from '@/lib/workspace';
import { repositoryUniverseClusterLegend } from '@/lib/workspace/repositoryUniverseVisual';
import type { UniverseCameraState } from './RepositoryUniverse3D';
import type { RepositoryIntelligenceReviewUiSession } from './RepositoryIntelligenceReviewPanel';
import type { RepositoryIntelligenceProviderStatus, RepositoryIntelligenceVerificationBaseline, RepositoryIntelligenceVerificationResult } from '@/lib/repositoryIntelligence';
import { PostScanOverview } from './result-dashboard/PostScanOverview';
import { ResultChapterNav } from './result-dashboard/ResultChapterNav';
import { ResultChapterShell } from './result-dashboard/ResultChapterShell';
import { ResultChapterLoadBoundary, ResultChapterLoading } from './result-dashboard/ResultChapterLoadBoundary';
import { getResultChapterStatuses, workspaceInsights } from './result-dashboard/chapterState';
import { selectRepositoryFrictions } from './result-dashboard/repositoryFrictions';
import type { ResultChapterId } from './result-dashboard/types';

const RepositoryUniverse3D = lazy(() => import('./RepositoryUniverse3D'));
const UnderstandChapter = lazy(() => import('./result-dashboard/chapters/UnderstandChapter'));
const ImproveChapter = lazy(() => import('./result-dashboard/chapters/ImproveChapter'));
const VerifyChapter = lazy(() => import('./result-dashboard/chapters/VerifyChapter'));
const DeliverChapter = lazy(() => import('./result-dashboard/chapters/DeliverChapter'));
const DeliveryPackPreview = lazy(() => import('./DeliveryPackPreview').then(module => ({ default: module.DeliveryPackPreview })));
const SuggestedReadinessFixPack = lazy(() => import('./SuggestedReadinessFixPack').then(module => ({ default: module.SuggestedReadinessFixPack })));

interface RepositoryUniverseBoundaryProps {
  resetKey: string;
  children: ReactNode;
  fallback: (retry: () => void) => ReactNode;
}

interface RepositoryUniverseBoundaryState {
  error: Error | null;
}

class RepositoryUniverseErrorBoundary extends Component<RepositoryUniverseBoundaryProps, RepositoryUniverseBoundaryState> {
  state: RepositoryUniverseBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    if (import.meta.env.DEV) {
      console.error('Repository Universe could not be rendered.', error);
    }
  }

  componentDidUpdate(previousProps: RepositoryUniverseBoundaryProps) {
    if (this.state.error && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  retry = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) return this.props.fallback(this.retry);
    return this.props.children;
  }
}

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

type RepositoryHealth = ReadinessReport['repositoryHealth'];
type RepositoryHealthSignal = RepositoryHealth['dimensions']['repositoryIntelligence']['signals'][number];

export function ResultDashboard({
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
  const fullPackageSelected = resolvedPackages.includes(FULL_PACKAGE_ID);
  const folderAgentPaths = getFolderAgentSuggestionPaths(report.repoContextPack);
  const deliveryFocus = resolveDeliveryPackFocus(resolvedPackages, { folderAgentPaths });
  const resolvedAgentMode = resolveAgentOperatingMode(agentOperatingMode || report.recommendedAgentOperatingMode || DEFAULT_AGENT_OPERATING_MODE);
  const agentMode = getAgentOperatingMode(resolvedAgentMode);
  const modeAgentPack = applyAgentOperatingModeToFiles(report, resolvedAgentMode);
  const [contextCopied, setContextCopied] = useState(false);
  const [appliedIntake, setAppliedIntake] = useState(() => normalizeProjectIntake(initialIntake, report.repoName));
  const [draftIntake, setDraftIntake] = useState(() => normalizeProjectIntake(initialIntake, report.repoName));
  const [wasIntakeSkipped, setWasIntakeSkipped] = useState(intakeSkipped);
  const [localStoryChapterId, setLocalStoryChapterId] = useState<WorkspaceStoryChapterId | null>(null);
  const [activeResultChapter, setActiveResultChapter] = useState<ResultChapterId>('understand');
  const [visitedResultChapters, setVisitedResultChapters] = useState<Set<ResultChapterId>>(() => new Set(['understand']));
  const [workspaceHeroRequested, setWorkspaceHeroRequested] = useState(true);
  const [flightPathRequested, setFlightPathRequested] = useState(false);
  const [pendingDashboardFocus, setPendingDashboardFocus] = useState<'repository-intelligence' | 'repository-universe' | null>(null);
  const [planReviewed, setPlanReviewed] = useState(false);
  const [packagePrepared, setPackagePrepared] = useState(false);
  const [prCreated, setPrCreated] = useState(false);
  const repositoryUniverseRef = useRef<HTMLDivElement>(null);
  const repositoryIntelligenceReviewRef = useRef<HTMLDivElement>(null);
  const readiness = evaluateReadiness(report.score, report.blockers);
  const ready = readiness.isReady;
  const workspaceStory = useMemo(() => buildWorkspaceStory(report), [report]);
  const effectiveStoryChapterId = activeStoryChapterId ?? localStoryChapterId;
  const activeStoryChapter = workspaceStory.chapters.find(chapter => chapter.id === effectiveStoryChapterId)
    || workspaceStory.chapters.find(chapter => chapter.id === workspaceStory.initialChapterId)
    || null;
  const limitedScan = report.scanSummary.limited || report.scanSummary.scanMode === 'limited-fallback';
  const statusMessage = readinessStatusMessageForPackage(readiness.statusMessage, resolvedPackages);
  const limitedScanReason = report.scanEvidence.limitationReason || report.scanSummary.warnings.find(warning => /limited scan|fallback|file limit|archive|GitHub access|ZIP/i.test(warning));
  const readinessReport = report.agentPack.find(file => file.name === 'AGENT_READINESS_REPORT.md');
  const repoContextJson = buildRepoContextPackJson(report);
  const scoreJson = buildScoreJson(report, { selectedPackages: resolvedPackages, agentOperatingMode: resolvedAgentMode });
  const toolingRecommendationCounts = recommendationCounts(buildToolingRecommendationBundle(report));
  const repositoryFrictions = useMemo(() => selectRepositoryFrictions(repositoryHealth), [repositoryHealth]);
  const verificationResult = useMemo(() => verificationBaseline
    ? buildRepositoryVerificationResult({ baseline: verificationBaseline, currentReport: report })
    : null, [report, verificationBaseline]);
  const mcpPackFiles: AgentPackFile[] = report.mcpReadiness.generatedFiles.map(file => ({
    name: file.filename,
    language: 'markdown',
    description: 'MCP governance policy generated from this repository scan.',
    content: file.content,
  }));
  const copyContextPack = async () => {
    await navigator.clipboard.writeText(report.contextPack);
    setContextCopied(true);
    setTimeout(() => setContextCopied(false), 1500);
  };

  useEffect(() => {
    const nextIntake = normalizeProjectIntake(initialIntake, report.repoName);
    setAppliedIntake(nextIntake);
    setDraftIntake(nextIntake);
    setWasIntakeSkipped(intakeSkipped);
    setActiveResultChapter('understand');
    setVisitedResultChapters(new Set(['understand']));
    setWorkspaceHeroRequested(true);
    setFlightPathRequested(false);
    setPendingDashboardFocus(null);
    setPlanReviewed(false);
    setPackagePrepared(false);
    setPrCreated(false);
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

  const intakeDirty = !sameIntake(appliedIntake, draftIntake);
  const regenerateReport = () => {
    setAppliedIntake(normalizeProjectIntake(draftIntake, report.repoName));
    setWasIntakeSkipped(false);
  };
  const clearIntake = () => {
    setDraftIntake(createDefaultProjectIntake(report.repoName));
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
    <section className="container py-12 md:py-16 animate-fade-in-up">
      <div className="dashboard-print-warning">
        For a client-ready PDF, use the print-ready report export instead of printing this dashboard.
      </div>

      <PostScanOverview
        report={report}
        limitedScanReason={limitedScanReason}
        frictions={repositoryFrictions}
        onReviewRepositoryIntelligence={handleReviewRepositoryIntelligence}
        onPlanAgentTask={handlePlanAgentTask}
        onReset={onReset}
        onReplayReveal={onReplayReveal}
        persistenceControl={persistenceControl}
      />

      <ResultChapterNav
        activeChapter={activeResultChapter}
        statuses={chapterStatuses}
        onChange={handleResultChapterChange}
      />

      <div ref={repositoryUniverseRef} id="repository-universe" tabIndex={-1} hidden={activeResultChapter === 'deliver'} className="scroll-mt-24 focus:outline-none">
        {workspaceHeroRequested ? <AiWorkspaceHero
          report={report}
          limitationReason={limitedScanReason}
          story={workspaceStory}
          activeStoryChapter={activeStoryChapter}
          onActiveStoryChapterChange={handleActiveStoryChapterChange}
          activeResultChapter={activeResultChapter}
          onResultChapterChange={handleResultChapterChange}
          flightPathRequested={flightPathRequested}
          onFlightPathRequested={() => setFlightPathRequested(false)}
          onPlanReviewed={() => setPlanReviewed(true)}
          onPackagePrepared={() => setPackagePrepared(true)}
          onPrCreated={() => setPrCreated(true)}
          githubConnection={githubConnection}
          verificationBaseline={verificationBaseline}
          onSaveVerificationBaseline={onSaveVerificationBaseline}
          onDiscardVerificationBaseline={onDiscardVerificationBaseline}
        /> : null}
      </div>

      {visitedResultChapters.has('understand') && (
        <ResultChapterShell chapter="understand" active={activeResultChapter === 'understand'}>
          <ResultChapterLoadBoundary chapterLabel="Understand">
            <Suspense fallback={<ResultChapterLoading chapterLabel="Understand" />}><UnderstandChapter report={report} story={workspaceStory} /></Suspense>
          </ResultChapterLoadBoundary>
        </ResultChapterShell>
      )}

      {visitedResultChapters.has('improve') && (
        <ResultChapterShell chapter="improve" active={activeResultChapter === 'improve'}>
          <ResultChapterLoadBoundary chapterLabel="Improve">
            <Suspense fallback={<ResultChapterLoading chapterLabel="Improve" />}>
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
                report={report}
                onVerificationBaseline={onSaveRepositoryIntelligenceVerificationBaseline}
              />
            </Suspense>
          </ResultChapterLoadBoundary>
        </ResultChapterShell>
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

      {activeResultChapter === 'understand' && (
        <Disclosure title="Supporting workspace views">
          <div className="grid gap-6">
            <WorkspaceOverview report={report} />
            <LiveAgentSimulator report={report} activeChapter={activeStoryChapter} />
          </div>
        </Disclosure>
      )}

      <div className={activeResultChapter === 'understand' ? '' : 'hidden'} aria-hidden={activeResultChapter !== 'understand'}>
      <Disclosure title="Repository evidence" defaultOpen={false}>
        {repositoryHealth.overall.score !== null && (
          <>
            <RepositoryHealthActions repositoryHealth={repositoryHealth} />
            <RepositoryHealthDimensions repositoryHealth={repositoryHealth} />
          </>
        )}

        <div className="grid gap-6 mb-8 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
          <ScanEvidencePanel report={report} />
          <MeasurementBoundary repositoryHealth={repositoryHealth} />
        </div>

        <DecisionSummary report={report} ready={ready} nextActions={report.aiNarrative.nextBestActions.slice(0, 3)} />
      </Disclosure>
      </div>

      {visitedResultChapters.has('deliver') && <div hidden={activeResultChapter !== 'deliver'}>
      <Disclosure title="Exports and reports">
      <section className="mb-8" aria-labelledby="delivery-outputs-heading">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Exports and reports</div>
            <h2 id="delivery-outputs-heading" className="mt-1 font-display text-2xl font-semibold">Reports and Delivery Outputs</h2>
          </div>
          <Badge variant="outline" className="border-primary/40 text-primary-glow">
            Export scope
          </Badge>
        </div>

      <div className="glass rounded-3xl p-6 md:p-10 mb-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-glow opacity-30 pointer-events-none" />
        <div className="relative flex flex-col lg:flex-row lg:items-center gap-8">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Project</span>
              <ReadinessBadge level={readiness.level} size="md" />
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-bold mb-2 truncate">{report.repoName}</h1>
            <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1">
              <span><span className="text-foreground/80 font-medium">{report.stack.primary}</span> - {report.stack.languages.join(', ') || 'unknown'}</span>
              <span>{isGitHubSource(report.source.sourceType) ? `GitHub: ${report.source.githubOwner}/${report.source.githubRepo}${report.source.githubBranch ? ` @ ${report.source.githubBranch}` : ''}` : 'ZIP upload'}</span>
              <span>{report.fileCount.toLocaleString()} files</span>
              <span>{(report.totalSizeBytes / 1024).toFixed(0)} KB</span>
              <span>scanned {new Date(report.scannedAt).toLocaleTimeString()}</span>
            </div>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <SummaryTile label="Delivery readiness" value={`${report.score}/100`} />
              <SummaryTile label="Readiness status" value={displayReadinessLevel(readiness.level)} />
              <SummaryTile label="Critical blockers" value={String(report.blockers.length)} />
            </div>
            {readiness.level === 'Partially Ready' && !limitedScan && (
              <div className="mt-3 rounded-xl border border-border/60 bg-secondary/20 px-4 py-3 text-xs text-muted-foreground">
                Status: Partially Ready. This is a readiness status based on the score, not a limited scan.
              </div>
            )}
            <ProjectPackageSummary
              packageLabel={deliveryFocus.packageLabel}
              outputCount={deliveryFocus.generatedPaths.length}
              packageSummary={deliveryFocus.packageSummary}
              hasContextCompressionPack={deliveryFocus.generatedPaths.includes('07-context/ARCHITECTURE.md')}
              hasFolderAgentSuggestions={deliveryFocus.generatedPaths.some(path => path.startsWith('07-context/folder-agents/'))}
              hasSpecializedContextPacks={deliveryFocus.generatedPaths.includes('07-context/GLOBAL_CONTEXT.md')}
              hasToolingRecommendations={deliveryFocus.generatedPaths.includes('07-context/SKILL_RECOMMENDATIONS.md') || deliveryFocus.generatedPaths.includes('07-context/MCP_RECOMMENDATIONS.md')}
              skillRecommendationCount={toolingRecommendationCounts.skills}
              mcpRecommendationCount={toolingRecommendationCounts.mcpTools}
            />
            {selectionUsesAgentDevelopment(resolvedPackages) && (
              <AgentOperatingModeSummary
                modeLabel={agentMode.label}
                expectedTokenUsage={agentMode.expectedTokenUsage}
                confidence={agentMode.confidence}
                summary={agentMode.summary}
              />
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Selected packages</span>
              {fullPackageSelected ? (
                <Badge variant="outline" className="border-primary/50 bg-primary/10 text-foreground">Full ShipSeal package</Badge>
              ) : (
                resolvedPackages.map(id => {
                  const pack = getShipSealPackage(id);
                  if (!pack) return null;
                  return (
                    <Badge key={id} variant="outline" className="border-primary/40 bg-primary/10 text-foreground">
                      {pack.title}
                    </Badge>
                  );
                })
              )}
              {!fullPackageSelected && (
                <span className="text-[11px] text-muted-foreground">
                  This export is focused on the selected goal. Choose Full ShipSeal package for every output.
                </span>
              )}
            </div>

            <div className={`mt-6 rounded-2xl p-5 border ${ready ? 'bg-success/10 border-success/30' : report.blockers.length ? 'bg-destructive/10 border-destructive/30' : 'bg-warning/10 border-warning/30'}`}>
              <div className="flex items-start gap-3">
                {ready ? <Sparkles className="h-5 w-5 text-success mt-0.5" /> : <AlertOctagon className="h-5 w-5 text-destructive mt-0.5" />}
                <div>
                  <div className="font-display font-semibold text-lg">{statusMessage}</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {ready
                      ? 'This project is ready for a controlled AI handoff. Download the ShipSeal Delivery Pack and review it with the client before production use.'
                      : 'Resolve the risks below before treating this project as ready for client handoff.'}
                  </div>
                </div>
              </div>
            </div>
            {limitedScan && (
              <div className="mt-4 rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm text-warning">
                <div className="font-semibold">Limited scan</div>
                <div className="mt-1 text-warning/90">
                  {limitedScanReason || 'ShipSeal could not fully analyze this repository, so the report is based on limited scan data.'}
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-col items-stretch gap-3 lg:w-64">
            <div className="rounded-2xl border border-border/60 bg-secondary/25 p-4 text-sm leading-relaxed text-muted-foreground">
              Delivery Outputs package the workspace findings for review, handoff, and export.
            </div>
            <div className="flex flex-col sm:flex-row lg:flex-col gap-2 w-full">
              <Button
                variant="outline"
                size="sm"
                onClick={() => readinessReport && downloadTextFile('AGENT_READINESS_REPORT.md', readinessReport.content)}
                className="border-border/60"
              >
                <Download className="h-3.5 w-3.5 mr-1.5" /> Export report
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadJsonFile('score.json', buildScoreJson(report, { selectedPackages: resolvedPackages, agentOperatingMode: resolvedAgentMode }))}
                className="border-border/60"
              >
                <Download className="h-3.5 w-3.5 mr-1.5" /> Export score.json
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={onReset} className="border-border/60">
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Scan another project
            </Button>
          </div>
        </div>
      </div>

      <Disclosure title="Delivery readiness details">
        <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
          <div className="glass rounded-2xl p-6 flex flex-col items-center justify-center">
            <ScoreGauge score={report.score} size={200} label="delivery / 100" />
            <div className="mt-3 text-center text-sm text-muted-foreground">
              Supporting delivery and verification score.
            </div>
          </div>
          <div>
            <h2 className="font-display text-2xl font-semibold mb-4">Delivery readiness categories</h2>
            <CategoryBreakdown categories={report.categories} />
          </div>
        </div>
      </Disclosure>

      <ResultChapterLoadBoundary chapterLabel="Delivery outputs">
        <Suspense fallback={<ResultChapterLoading chapterLabel="delivery outputs" />}>
          <DeliveryPackPreview report={report} agentFiles={modeAgentPack} intake={appliedIntake} intakeSkipped={wasIntakeSkipped} selectedPackages={resolvedPackages} agentOperatingMode={resolvedAgentMode} />
        </Suspense>
      </ResultChapterLoadBoundary>

      <Disclosure title="Project context used for Delivery Outputs" defaultOpen={wasIntakeSkipped || intakeDirty}>
        <ProjectContextPanel
          appliedIntake={appliedIntake}
          draftIntake={draftIntake}
          skipped={wasIntakeSkipped}
          dirty={intakeDirty}
          onDraftChange={setDraftIntake}
          onRegenerate={regenerateReport}
          onClear={clearIntake}
        />
      </Disclosure>
      </section>
      </Disclosure>
      </div>}

      {visitedResultChapters.has('improve') && <div hidden={activeResultChapter !== 'improve'}>
      <Disclosure title="Secondary repository improvements">
        <ResultChapterLoadBoundary chapterLabel="Readiness Fix Pack">
          <Suspense fallback={<ResultChapterLoading chapterLabel="readiness improvements" />}>
            <SuggestedReadinessFixPack report={report} githubConnection={githubConnection} selectedPackages={resolvedPackages} />
          </Suspense>
        </ResultChapterLoadBoundary>
      </Disclosure>
      </div>}

      {visitedResultChapters.has('deliver') && <div hidden={activeResultChapter !== 'deliver'}>
      <Disclosure title="Specialist and technical exports">
      <div className="glass rounded-2xl p-6 mb-8">
        <div className="flex flex-wrap items-start gap-3 mb-5">
          <Sparkles className={ready ? 'h-4 w-4 text-success mt-1' : 'h-4 w-4 text-accent mt-1'} />
          <div className="min-w-0 flex-1">
            <h3 className="font-display font-semibold">AI Readiness Narrative</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-3xl">{report.aiNarrative.executiveSummary}</p>
          </div>
          <Badge variant="outline" className={ready ? 'border-success/40 text-success' : 'border-warning/60 text-warning'}>
            Local deterministic provider
          </Badge>
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          <NarrativePanel title={ready ? 'Why this repo is AI Coding Ready' : 'Why this repo is not AI Coding Ready'} text={report.aiNarrative.readinessExplanation} />
          <NarrativePanel title="Blocker explanation" text={report.aiNarrative.blockerExplanation} />
          <NarrativeList title={ready ? 'Minimum next actions' : 'Minimum path to readiness'} items={report.aiNarrative.nextBestActions} />
          <NarrativeList title={ready ? 'Optional improvements' : 'Improvement priorities'} items={report.aiNarrative.improvementPriorities} />
        </div>
        <div className="mt-4 rounded-lg border border-border/60 bg-secondary/25 px-3 py-2 text-xs text-muted-foreground">
          {report.aiNarrative.confidenceNote}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="glass rounded-2xl p-6 lg:col-span-1">
          <div className="flex items-center gap-2 mb-4">
            <AlertOctagon className="h-4 w-4 text-destructive" />
            <h3 className="font-display font-semibold">Critical blockers</h3>
            <span className="ml-auto text-xs font-mono text-muted-foreground">{report.blockers.length}</span>
          </div>
          {report.blockers.length === 0 ? (
            <div className="rounded-lg border border-success/30 bg-success/10 p-3 text-sm text-muted-foreground flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
              <span>{criticalBlockersEmptyStateText(ready)}</span>
            </div>
          ) : (
            <ul className="space-y-3">
              {report.blockers.map(b => (
                <li key={b.id} className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
                  <div className="text-sm font-medium text-foreground">{b.title}</div>
                  <div className="text-xs text-muted-foreground mt-1">{b.detail}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="glass rounded-2xl p-6 lg:col-span-1">
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb className="h-4 w-4 text-accent" />
            <h3 className="font-display font-semibold">Optional improvements</h3>
            <Badge variant="outline" className="border-accent/50 text-accent text-[10px]">Optional</Badge>
            <span className="ml-auto text-xs font-mono text-muted-foreground">{report.improvements.length}</span>
          </div>
          {report.improvements.length === 0 ? (
            <div className="rounded-lg border border-border/60 bg-secondary/25 p-3 text-sm text-muted-foreground">No optional improvements are open right now.</div>
          ) : (
            <ul className="space-y-2 max-h-72 overflow-auto pr-1">
              {report.improvements.slice(0, 12).map(i => (
                <li key={i.id} className="text-xs">
                  <div className="text-foreground/90">{i.title}</div>
                  <div className="text-muted-foreground/70">{i.category}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="glass rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="h-4 w-4 text-primary-glow" />
            <h3 className="font-display font-semibold">Detected stack & commands</h3>
          </div>
          <div className="space-y-3 text-sm">
            <Row label="Primary" value={report.stack.primary} />
            <Row label="Languages" value={report.stack.languages.join(', ') || '-'} />
            <Row label="Frameworks" value={report.stack.frameworks.join(', ') || '-'} />
            <Row label="Tests" value={report.stack.testFrameworks.join(', ') || '-'} />
            <Row label="Pkg mgr" value={report.summary.packageManager} />
            <Row label="Folders" value={report.summary.keyFolders.join(', ') || '-'} />
            <Row label="Instructions" value={report.summary.instructionFiles.join(', ') || '-'} />
          </div>
          {report.stack.runCommands.length > 0 && (
            <div className="mt-4 space-y-1.5">
              {report.stack.runCommands.map(c => (
                <div key={c.label} className="font-mono text-xs bg-secondary/60 rounded-md px-2.5 py-1.5 flex items-center gap-2">
                  <span className="text-muted-foreground">{c.label}:</span>
                  <span>{c.cmd}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="glass rounded-2xl p-6 mb-8">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <ShieldCheck className="h-4 w-4 text-success" />
          <h3 className="font-display font-semibold">Scanner safety</h3>
          <Badge variant="outline" className="border-success/40 text-success">No code execution</Badge>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
          <SafetyMetric label="Total files found" value={report.scanSummary.totalFilesFound.toLocaleString()} />
          <SafetyMetric label="Files analyzed" value={report.scanSummary.filesAnalyzed.toLocaleString()} />
          <SafetyMetric label="Files ignored" value={report.scanSummary.filesIgnored.toLocaleString()} />
          <SafetyMetric label="Readable text analyzed" value={formatFileSize(report.scanSummary.readableTextBytesAnalyzed)} />
          <SafetyMetric label="Generated/vendor ignored" value={report.scanSummary.generatedVendorFilesIgnored.toLocaleString()} />
          <SafetyMetric label="Binary files ignored" value={report.scanSummary.binaryFilesIgnored.toLocaleString()} />
          <SafetyMetric label="Max file count" value={report.scanSummary.limits.maxFileCount.toLocaleString()} />
          <SafetyMetric label="Max ZIP size" value={formatFileSize(report.scanSummary.limits.maxZipSizeBytes)} />
        </div>
        {report.scanSummary.ignoredGeneratedFolders.length > 0 && (
          <div className="mt-4 text-xs text-muted-foreground">
            Ignored generated/vendor folders: {report.scanSummary.ignoredGeneratedFolders.join(', ')}
          </div>
        )}
        {report.scanSummary.warnings.length > 0 && (
          <ul className="mt-4 space-y-1 text-xs text-warning">
            {report.scanSummary.warnings.map(warning => <li key={warning}>{warning}</li>)}
          </ul>
        )}
        <div className="mt-4 text-xs text-muted-foreground">
          Static scan complete: ShipSeal read repository structure and key project files without executing code. It reads metadata, key config/docs/test files, and a safe limited text subset while ignoring generated/vendor folders such as node_modules, dist, build, .next, and coverage.
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-secondary/20 p-4 text-sm text-muted-foreground">
        Delivery readiness categories are available in Delivery readiness details above. Scanner, MCP and generated-file details stay available without changing Workspace Quality or Repository Health.
      </div>

      <div className="mt-8 glass rounded-2xl p-6">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <ShieldCheck className="h-4 w-4 text-primary-glow" />
          <h3 className="font-display font-semibold">MCP Readiness</h3>
          <Badge variant="outline" className="border-primary/40 text-primary-glow">{displayMcpReadiness(report.mcpReadiness.status)}</Badge>
          <span className="ml-auto font-mono text-sm text-foreground/90">{report.mcpReadiness.score}/100</span>
        </div>
        <p className="text-sm text-muted-foreground max-w-3xl">
          {mcpGovernanceSummary(report)}
        </p>
        {report.mcpReadiness.aiNarrative && (
          <div className="mt-3 rounded-lg border border-border/60 bg-secondary/25 p-3 text-xs text-muted-foreground">
            {report.mcpReadiness.aiNarrative.riskNarrative}
          </div>
        )}
        <div className="mt-5 grid lg:grid-cols-2 gap-5">
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">Recommended server categories</div>
            {report.mcpReadiness.recommendedServerCategories.length === 0 ? (
              <div className="text-sm text-muted-foreground">No MCP server categories recommended until stronger repository signals exist.</div>
            ) : (
              <div className="space-y-2">
                {report.mcpReadiness.recommendedServerCategories.slice(0, 6).map(rec => (
                  <div key={`${rec.category}-${rec.label}`} className="rounded-lg border border-border/60 bg-secondary/25 p-3">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium">{rec.label}</div>
                      <Badge variant="outline" className="ml-auto border-border/70 text-[10px]">{rec.riskLevel}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{rec.whyUseful}</div>
                    <div className="text-[11px] text-muted-foreground/80 mt-2">{rec.safetyNotes}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">Risk findings</div>
            {report.mcpReadiness.riskFindings.length === 0 ? (
              <div className="text-sm text-muted-foreground">No MCP-specific risk findings detected.</div>
            ) : (
              <div className="space-y-2">
                {report.mcpReadiness.riskFindings.slice(0, 6).map(finding => (
                  <div key={`${finding.severity}-${finding.title}`} className="rounded-lg border border-border/60 bg-secondary/25 p-3">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium">{finding.title}</div>
                      <Badge variant="outline" className={severityClass(finding.severity)}>{finding.severity}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{finding.description}</div>
                    <div className="text-[11px] text-muted-foreground/80 mt-2">{finding.recommendation}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="mt-4 text-sm font-medium text-foreground/90">
          MCP readiness is a separate governance dimension for tool access and requires human approval for high-risk categories.
        </div>
        <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {report.mcpReadiness.generatedFiles.map(file => (
            <div key={file.filename} className="rounded-lg border border-border/60 bg-secondary/30 px-3 py-2 font-mono text-xs text-foreground/85">
              {file.filename}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass rounded-2xl p-6 lg:col-span-1">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <FileArchive className="h-4 w-4 text-accent shrink-0" />
            <h3 className="font-display font-semibold">Repo Context Pack</h3>
            <div className="ml-auto flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={copyContextPack}>
                {contextCopied ? <Check className="h-3.5 w-3.5 mr-1.5 text-success" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
                {contextCopied ? 'Copied' : 'Copy'}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => downloadTextFile('REPO_CONTEXT_PACK.md', report.contextPack)}>
                <Download className="h-3.5 w-3.5 mr-1.5" /> MD
              </Button>
              <Button variant="ghost" size="sm" onClick={() => downloadJsonFile('repo-context-pack.json', repoContextJson)}>
                <Download className="h-3.5 w-3.5 mr-1.5" /> JSON
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Sanitized metadata for future server-side AI or coding-agent context. It excludes raw full file contents and secrets.
          </p>
          <pre className="text-[11px] font-mono leading-relaxed bg-[hsl(240_20%_4%)] rounded-lg p-3 max-h-80 overflow-auto text-foreground/85">
            {report.contextPack}
          </pre>
        </div>
        <div className="lg:col-span-2">
          <h3 className="font-display text-xl font-semibold mb-3">Delivery Pack file preview</h3>
          <AgentPackTabs
            files={modeAgentPack}
            repositoryName={report.repoName}
            mcpFiles={report.mcpReadiness.generatedFiles}
            contextFiles={{ markdown: report.contextPack, json: repoContextJson }}
            scoreJson={scoreJson}
            intake={appliedIntake}
            selectedPackages={resolvedPackages}
          />
          <h3 className="font-display text-xl font-semibold mt-8 mb-3">MCP Governance Pack</h3>
          <AgentPackTabs files={mcpPackFiles} />
        </div>
      </div>

      <RecentScans history={history} onClear={onClearHistory} />
      </Disclosure>
      </div>}
    </section>
  );
}

function AiWorkspaceHero({
  report,
  limitationReason,
  story,
  activeStoryChapter,
  onActiveStoryChapterChange,
  activeResultChapter,
  onResultChapterChange,
  flightPathRequested,
  onFlightPathRequested,
  onPlanReviewed,
  onPackagePrepared,
  onPrCreated,
  githubConnection,
  verificationBaseline,
  onSaveVerificationBaseline,
  onDiscardVerificationBaseline,
}: {
  report: ReadinessReport;
  limitationReason?: string;
  story: WorkspaceStory;
  activeStoryChapter: WorkspaceStoryChapter | null;
  onActiveStoryChapterChange?: (chapterId: WorkspaceStoryChapterId | null) => void;
  activeResultChapter: ResultChapterId;
  onResultChapterChange: (chapter: ResultChapterId) => void;
  flightPathRequested: boolean;
  onFlightPathRequested: () => void;
  onPlanReviewed: () => void;
  onPackagePrepared: () => void;
  onPrCreated: () => void;
  githubConnection?: GitHubConnectionState;
  verificationBaseline?: RepositoryVerificationBaseline | null;
  onSaveVerificationBaseline?: (baseline: RepositoryVerificationBaseline) => void;
  onDiscardVerificationBaseline?: () => void;
}) {
  const health = report.repositoryHealth;
  const unavailable = health.overall.score === null;
  const repositoryDna = buildRepositoryDna(report);
  const mentalModel = buildMentalModel(report);
  const topAction = health.topActions[0];
  const [exploredChapterIds, setExploredChapterIds] = useState<WorkspaceStoryChapterId[]>([]);
  const [manualMentalNodeId, setManualMentalNodeId] = useState<MentalModelNodeId | null>(null);
  const selectedMentalNodeId = activeStoryChapter?.mentalModelNodeId as MentalModelNodeId | undefined;
  const activeMentalNodeId = manualMentalNodeId || selectedMentalNodeId || 'architecture';
  const activeDnaDimensionId = activeStoryChapter?.dnaDimensionId as RepositoryDnaDimensionId | undefined;

  const selectStoryChapter = (chapterId: WorkspaceStoryChapterId) => {
    const chapter = story.chapters.find(item => item.id === chapterId);
    if (!chapter) return;
    setExploredChapterIds(current => current.includes(chapterId) ? current : [...current, chapterId]);
    setManualMentalNodeId((chapter.mentalModelNodeId as MentalModelNodeId | undefined) || null);
    onActiveStoryChapterChange?.(chapterId);
  };

  const selectMentalModelNode = (nodeId: MentalModelNodeId) => {
    setManualMentalNodeId(nodeId);
    const chapter = chapterForMentalModelNode(story, nodeId as WorkspaceStoryMentalNodeId);
    if (chapter) {
      setExploredChapterIds(current => current.includes(chapter.id) ? current : [...current, chapter.id]);
      onActiveStoryChapterChange?.(chapter.id);
    }
  };

  const selectDnaDimension = (dimensionId: RepositoryDnaDimensionId) => {
    const chapter = chapterForDnaDimension(story, dimensionId as WorkspaceStoryDnaDimensionId);
    if (chapter) selectStoryChapter(chapter.id);
  };

  return (
    <section className="mb-6 overflow-hidden rounded-[2rem] border border-primary/25 bg-[hsl(225_28%_7%)] p-3 shadow-glow md:p-5 animate-fade-in-up" aria-label="Repository Intelligence">
      <div className="relative">
        <div className="absolute inset-0 -m-10 bg-[radial-gradient(circle_at_24%_18%,hsl(var(--primary)/0.22),transparent_34%),radial-gradient(circle_at_78%_26%,hsl(var(--accent)/0.13),transparent_32%),linear-gradient(180deg,hsl(var(--background)/0),hsl(var(--background)/0.2))] pointer-events-none" />
        {unavailable ? (
          <div className="relative rounded-3xl border border-warning/35 bg-warning/10 p-5 text-sm leading-relaxed text-warning md:p-6">
            <div className="text-xs font-mono uppercase tracking-wider text-warning/80">Repository Intelligence</div>
            <h2 className="mt-2 font-display text-2xl font-semibold text-foreground">I need more evidence to understand this repository.</h2>
            <p className="mt-3 font-medium text-warning">The repository model is incomplete.</p>
            <p className="mt-3 text-warning/90">{limitationReason || health.blockers[0]?.detail || 'The scan was limited or synthetic fallback data was used.'}</p>
            <p className="mt-2 text-warning/90">Reconnect GitHub, upload the complete ZIP, or retry the full scan.</p>
          </div>
        ) : (
          <>
            <RepositoryAtlasVisualization
              report={report}
              story={story}
              activeChapter={activeStoryChapter}
              onSelectChapter={selectStoryChapter}
              activeResultChapter={activeResultChapter}
              onResultChapterChange={onResultChapterChange}
              flightPathRequested={flightPathRequested}
              onFlightPathRequested={onFlightPathRequested}
              onPlanReviewed={onPlanReviewed}
              onPackagePrepared={onPackagePrepared}
              onPrCreated={onPrCreated}
              githubConnection={githubConnection}
              verificationBaseline={verificationBaseline}
              onSaveVerificationBaseline={onSaveVerificationBaseline}
              onDiscardVerificationBaseline={onDiscardVerificationBaseline}
            />

            {activeResultChapter === 'understand' && <details className="relative mt-5 rounded-3xl border border-primary/20 bg-background/20 p-5 md:p-6">
              <summary className="cursor-pointer select-none font-display text-lg font-semibold text-foreground">Workspace story and evidence</summary>
              <div className="mt-5">
                <WorkspaceStoryNavigator
                  story={story}
                  activeChapter={activeStoryChapter}
                  exploredChapterIds={exploredChapterIds}
                  onSelectChapter={selectStoryChapter}
                />
                {activeStoryChapter ? (
                  <WorkspaceEvidenceTrail chapter={activeStoryChapter} />
                ) : (
                  <p className="rounded-2xl border border-border/55 bg-background/20 p-4 text-sm text-muted-foreground">
                    Select a story chapter to follow the evidence trail from repository signal to agent use.
                  </p>
                )}
              </div>
            </details>}

            {activeResultChapter === 'understand' && <details className="relative mt-5 rounded-3xl border border-primary/20 bg-background/20 p-5 md:p-6">
              <summary className="cursor-pointer select-none font-display text-lg font-semibold text-foreground">Repository models and metrics</summary>
              <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(380px,0.95fr)]">
                <div className="min-h-[560px] overflow-hidden rounded-3xl border border-primary/20 bg-background/20 p-5 md:p-6">
                  <MentalModelVisualization
                    model={mentalModel}
                    activeId={activeMentalNodeId}
                    storyNodeId={selectedMentalNodeId}
                    activeChapter={activeStoryChapter}
                    onSelectNode={selectMentalModelNode}
                  />
                </div>

                <aside className="min-h-[560px] overflow-hidden rounded-3xl border border-primary/20 bg-background/20 p-5 md:p-6">
                  <RepositoryDnaVisualization
                    dimensions={repositoryDna}
                    unavailable={unavailable}
                    activeDimensionId={activeDnaDimensionId}
                    activeChapter={activeStoryChapter}
                    onSelectDimension={selectDnaDimension}
                  />
                </aside>
              </div>
            </details>}
          </>
        )}

        {activeResultChapter === 'understand' && <details className="relative mt-6 rounded-2xl border border-border/60 bg-secondary/15 px-4 py-3 text-sm text-muted-foreground">
          <summary className="cursor-pointer select-none font-medium text-foreground">Workspace metrics and next action</summary>
          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={repositoryHealthStatusClass(health.overall.status)}>
                {health.overall.status}
              </Badge>
              <span>{health.overall.confidence} confidence</span>
              {health.overall.score !== null && <span>Workspace Quality {health.overall.score} / 100</span>}
            </div>
            {topAction && (
              <div>
                <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">First improvement</div>
                <div className="mt-1 font-semibold text-foreground">{topAction.title}</div>
                <p className="mt-1 leading-relaxed">{topAction.action}</p>
              </div>
            )}
          </div>
        </details>}
      </div>
    </section>
  );
}

interface AtlasFilters {
  files: boolean;
  folders: boolean;
  concepts: boolean;
  evidence: boolean;
  heuristic: boolean;
  missing: boolean;
}

function RepositoryAtlasVisualization({
  report,
  story,
  activeChapter,
  onSelectChapter,
  activeResultChapter,
  onResultChapterChange,
  flightPathRequested,
  onFlightPathRequested,
  onPlanReviewed,
  onPackagePrepared,
  onPrCreated,
  githubConnection,
  verificationBaseline,
  onSaveVerificationBaseline,
  onDiscardVerificationBaseline,
}: {
  report: ReadinessReport;
  story: WorkspaceStory;
  activeChapter: WorkspaceStoryChapter | null;
  onSelectChapter: (chapterId: WorkspaceStoryChapterId) => void;
  activeResultChapter: ResultChapterId;
  onResultChapterChange: (chapter: ResultChapterId) => void;
  flightPathRequested: boolean;
  onFlightPathRequested: () => void;
  onPlanReviewed: () => void;
  onPackagePrepared: () => void;
  onPrCreated: () => void;
  githubConnection?: GitHubConnectionState;
  verificationBaseline?: RepositoryVerificationBaseline | null;
  onSaveVerificationBaseline?: (baseline: RepositoryVerificationBaseline) => void;
  onDiscardVerificationBaseline?: () => void;
}) {
  const atlas = useMemo(() => buildRepositoryAtlasModel(report), [report]);
  const universe = useMemo(() => buildRepositoryUniverseModel(report), [report]);
  const transformation = useMemo(() => buildRepositoryTransformationProposalModel(report, universe, atlas), [report, universe, atlas]);
  const connection = useMemo(() => githubConnection || buildGitHubConnectionFromReport(report), [githubConnection, report]);
  const initialUniverseCamera = useMemo(() => initialUniverseCameraState(universe), [universe]);
  const prefersReducedMotion = usePrefersReducedMotion();
  const atlasRootRef = useRef<HTMLElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const fullscreenLayerRef = useRef<HTMLDivElement | null>(null);
  const fullscreenButtonRef = useRef<HTMLButtonElement | null>(null);
  const exitFullscreenButtonRef = useRef<HTMLButtonElement | null>(null);
  const initialNodeId = activeChapter?.knowledgeNodeId || atlas.rootNodeId;
  const [selectedNodeId, setSelectedNodeId] = useState(initialNodeId);
  const [focusedClusterId, setFocusedClusterId] = useState<string | null>(activeChapter ? `cluster:${activeChapter.id}` : null);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<AtlasFilters>({
    files: true,
    folders: true,
    concepts: true,
    evidence: true,
    heuristic: true,
    missing: true,
  });
  const [view, setView] = useState({ x: 0, y: 0, scale: 0.82 });
  const [viewMode, setViewMode] = useState<'universe3d' | 'atlas2d'>('universe3d');
  const [transformationMode, setTransformationMode] = useState<RepositoryTransformationMode | 'after-rescan'>('current');
  const [transformationDomain, setTransformationDomain] = useState<RepositoryTransformationDomainFilter>('all');
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null);
  const [excludedProposalIds, setExcludedProposalIds] = useState<Set<string>>(() => new Set());
  const [optimizationPlanOpen, setOptimizationPlanOpen] = useState(false);
  const [selectedOptimizationItemId, setSelectedOptimizationItemId] = useState<string | null>(null);
  const [selectedUniverseNodeId, setSelectedUniverseNodeId] = useState(universe.rootNodeId);
  const [universeCamera, setUniverseCamera] = useState<UniverseCameraState>(initialUniverseCamera);
  const [universeRotationPaused, setUniverseRotationPaused] = useState(prefersReducedMotion);
  const [universeSceneSettled, setUniverseSceneSettled] = useState(prefersReducedMotion);
  const [universeRetryKey, setUniverseRetryKey] = useState(0);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string; detail: string } | null>(null);
  const [atlasReady, setAtlasReady] = useState(prefersReducedMotion);
  const [navigationActive, setNavigationActive] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [agentFlightPathTask, setAgentFlightPathTask] = useState('');
  const [agentFlightPath, setAgentFlightPath] = useState<RepositoryAgentFlightPath | null>(null);
  const [agentFlightPathCopied, setAgentFlightPathCopied] = useState(false);
  const [flightPathOpen, setFlightPathOpen] = useState(false);
  const dragRef = useRef<{ pointerId: number; x: number; y: number; viewX: number; viewY: number; moved: boolean } | null>(null);
  const exitFullscreen = useCallback(() => {
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => undefined);
    }
    setFullscreen(false);
  }, []);
  const selectedNode = atlas.nodes.find(node => node.id === selectedNodeId) || atlas.nodes.find(node => node.id === initialNodeId) || atlas.nodes[0];
  const selectedUniverseNode = universe.nodes.find(node => node.id === selectedUniverseNodeId) || universe.nodes.find(node => node.id === universe.rootNodeId) || universe.nodes[0];
  const activeCluster = focusedClusterId ? atlas.clusters.find(cluster => cluster.id === focusedClusterId) : null;
  const activeUniverseCluster = focusedClusterId ? universe.clusters.find(cluster => cluster.id === focusedClusterId) : null;
  const activeChapterNodeId = activeChapter?.knowledgeNodeId;
  const selectedProposal = selectedProposalId ? transformation.proposals.find(proposal => proposal.id === selectedProposalId) || null : null;
  const domainCounts = useMemo(() => repositoryTransformationDomainCounts(transformation.proposals), [transformation.proposals]);
  const visibleTransformationProposals = useMemo(() => transformation.proposals.filter(proposal => transformationDomain === 'all' || proposal.domain === transformationDomain), [transformation.proposals, transformationDomain]);
  const includedProposalCount = transformation.proposals.filter(proposal => !excludedProposalIds.has(proposal.id)).length;
  const activeTransformationArtifactCount = useMemo(() => new Set(
    transformation.proposals
      .filter(proposal => !excludedProposalIds.has(proposal.id))
      .flatMap(proposal => proposal.artifactActions.map(action => action.path))
  ).size, [excludedProposalIds, transformation.proposals]);
  const optimizationPlan = useMemo(() => optimizationPlanOpen
    ? buildRepositoryOptimizationPlan({
      report,
      transformation,
      universe,
      atlas,
      excludedProposalIds,
    })
    : null, [atlas, excludedProposalIds, optimizationPlanOpen, report, transformation, universe]);
  const optimizationApplyPlan = useMemo(() => optimizationPlan
    ? buildOptimizationApplyPlan(optimizationPlan, {
      githubAvailable: connection.canCreatePullRequest && Boolean(connection.installationId && connection.owner && connection.repo),
      githubUnavailableReason: githubUnavailableReason(connection),
    })
    : null, [connection, optimizationPlan]);
  const verificationResult = useMemo(() => verificationBaseline
    ? buildRepositoryVerificationResult({ baseline: verificationBaseline, currentReport: report })
    : null, [report, verificationBaseline]);
  const selectedOptimizationItem = selectedOptimizationItemId
    ? optimizationPlan?.items.find(item => item.id === selectedOptimizationItemId) || null
    : optimizationPlan?.items[0] || null;
  const relatedNodeIds = useMemo(() => relatedAtlasNodeIds(atlas, selectedNode?.id, activeChapterNodeId, focusedClusterId), [atlas, selectedNode?.id, activeChapterNodeId, focusedClusterId]);
  const searchMatches = useMemo(() => matchingAtlasNodeIds(atlas, query), [atlas, query]);
  const universeSearchMatches = useMemo(() => matchingUniverseNodeIds(universe, query), [universe, query]);
  const universeFilterCounts = useMemo(() => repositoryUniverseFilterCounts(universe), [universe]);
  const universeClusterLegend = useMemo(() => repositoryUniverseClusterLegend(universe.clusters), [universe.clusters]);
  const hasVerifiedRescanComparison = verificationResult?.status === 'matched-rescan';
  const verifiedDestinationPaths = useMemo(() => new Set((verificationResult?.artifacts || [])
    .filter(artifact => artifact.state === 'verified-file-presence' || artifact.state === 'verified-content-match')
    .map(artifact => normalizeWorkspacePath(artifact.destinationPath))), [verificationResult?.artifacts]);
  const visibleNodes = useMemo(() => atlas.nodes.filter(node => nodeVisibleInAtlas(node, filters)), [atlas.nodes, filters]);
  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map(node => node.id)), [visibleNodes]);
  const visibleEdges = useMemo(
    () => atlas.edges.filter(edge => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target) && edgeVisibleInAtlas(edge, selectedNode?.id, activeChapterNodeId, focusedClusterId)),
    [atlas.edges, visibleNodeIds, selectedNode?.id, activeChapterNodeId, focusedClusterId]
  );
  const visibleUniverseNodeIds = useMemo(() => repositoryUniverseVisibleNodeIds(universe, filters), [universe, filters]);
  const visibleUniverseEdgeIds = useMemo(
    () => new Set(universe.edges.filter(edge => repositoryUniverseEdgeVisible(edge, visibleUniverseNodeIds)).map(edge => edge.id)),
    [universe.edges, visibleUniverseNodeIds]
  );
  const visibleUniverseNodeIdList = useMemo(() => [...visibleUniverseNodeIds], [visibleUniverseNodeIds]);
  const visibleUniverseEdgeIdList = useMemo(() => [...visibleUniverseEdgeIds], [visibleUniverseEdgeIds]);
  const universeSearchMatchIdList = useMemo(() => [...universeSearchMatches], [universeSearchMatches]);
  const excludedProposalIdList = useMemo(() => [...excludedProposalIds], [excludedProposalIds]);
  const selectedUniverseNodeVisible = selectedUniverseNode ? visibleUniverseNodeIds.has(selectedUniverseNode.id) : false;
  const proposalAffectedAtlasNodeIds = useMemo(() => {
    const ids = new Set<string>();
    if (transformationMode !== 'with-shipseal') return ids;
    for (const proposal of visibleTransformationProposals) {
      for (const universeNodeId of proposal.graphChanges.affectedExistingNodeIds) {
        const atlasNode = atlasNodeForUniverseNodeId(universeNodeId, universe, atlas);
        if (atlasNode) ids.add(atlasNode.id);
      }
    }
    return ids;
  }, [atlas, transformationMode, universe, visibleTransformationProposals]);
  const searchResults = query.trim()
    ? (viewMode === 'universe3d'
      ? universe.nodes.filter(node => universeSearchMatches.has(node.id) && visibleUniverseNodeIds.has(node.id)).slice(0, 8)
      : atlas.nodes.filter(node => searchMatches.has(node.id)).slice(0, 5))
    : [];
  const atlasNavigationActive = navigationActive || fullscreen;
  const planReadyForChapter = activeResultChapter === 'verify';
  const flightPathUniverseNodeIds = useMemo(() => agentFlightPath?.routeNodeIds.universeNodeIds || [], [agentFlightPath]);
  const flightPathAtlasNodeIdSet = useMemo(() => new Set(agentFlightPath?.routeNodeIds.atlasNodeIds || []), [agentFlightPath]);

  useEffect(() => {
    setSelectedNodeId(current => {
      const currentNode = atlas.nodes.find(node => node.id === current);
      const currentChapterId = typeof currentNode?.metadata.storyChapterId === 'string'
        ? currentNode.metadata.storyChapterId
        : typeof currentNode?.metadata.chapterId === 'string'
          ? currentNode.metadata.chapterId
          : null;
      if (activeChapter?.id && currentChapterId === activeChapter.id) return current;
      return initialNodeId;
    });
    setFocusedClusterId(activeChapter?.id ? `cluster:${activeChapter.id}` : null);
    setSelectedUniverseNodeId(current => {
      const currentNode = universe.nodes.find(node => node.id === current);
      if (activeChapter?.id && currentNode?.metadata.storyChapterId === activeChapter.id) return current;
      const chapterNode = universe.nodes.find(node => node.metadata.storyChapterId === activeChapter?.id && node.importance === 'primary')
        || universe.nodes.find(node => node.metadata.storyChapterId === activeChapter?.id)
        || universe.nodes.find(node => node.id === universe.rootNodeId);
      return chapterNode?.id || universe.rootNodeId;
    });
  }, [atlas.nodes, initialNodeId, activeChapter?.id, report.repoName, report.scannedAt, universe.nodes, universe.rootNodeId]);

  useEffect(() => {
    setUniverseCamera(initialUniverseCamera);
    setUniverseSceneSettled(prefersReducedMotion);
    setTransformationMode('current');
    setTransformationDomain('all');
    setSelectedProposalId(null);
    setExcludedProposalIds(new Set());
    setOptimizationPlanOpen(false);
    setSelectedOptimizationItemId(null);
    setAgentFlightPathTask('');
    setAgentFlightPath(null);
    setAgentFlightPathCopied(false);
  }, [report.repoName, report.scannedAt, initialUniverseCamera, prefersReducedMotion]);

  useEffect(() => {
    if (!optimizationPlan?.items.length) {
      setSelectedOptimizationItemId(null);
      return;
    }
    if (!selectedOptimizationItemId || !optimizationPlan.items.some(item => item.id === selectedOptimizationItemId)) {
      setSelectedOptimizationItemId(optimizationPlan.items[0].id);
    }
  }, [optimizationPlan?.items, selectedOptimizationItemId]);

  useEffect(() => {
    if (!planReadyForChapter || transformation.proposals.length === 0) return;
    setTransformationMode(current => current === 'after-rescan' ? current : 'with-shipseal');
    setOptimizationPlanOpen(true);
    onPlanReviewed();
  }, [onPlanReviewed, planReadyForChapter, transformation.proposals.length]);

  useEffect(() => {
    if (prefersReducedMotion) {
      setAtlasReady(true);
      return;
    }

    setAtlasReady(false);
    const timer = window.setTimeout(() => setAtlasReady(true), 1700);
    return () => window.clearTimeout(timer);
  }, [prefersReducedMotion, report.repoName, report.scannedAt]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleWheel = (event: WheelEvent) => {
      if (!fullscreen && !navigationActive) return;
      event.preventDefault();
      const direction = event.deltaY > 0 ? -0.08 : 0.08;
      setView(current => ({ ...current, scale: clamp(current.scale + direction, 0.55, 1.55) }));
    };

    viewport.addEventListener('wheel', handleWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', handleWheel);
  }, [fullscreen, navigationActive, viewMode]);

  useEffect(() => {
    if (!navigationActive || fullscreen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!atlasRootRef.current?.contains(event.target as Node)) {
        setNavigationActive(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [fullscreen, navigationActive]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (tooltip) {
        setTooltip(null);
        return;
      }
      if (fullscreen) {
        exitFullscreen();
        return;
      }
      if (navigationActive) {
        setNavigationActive(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [exitFullscreen, fullscreen, navigationActive, tooltip]);

  useEffect(() => {
    if (!fullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const layer = fullscreenLayerRef.current;
    layer?.requestFullscreen?.().catch(() => undefined);
    window.setTimeout(() => exitFullscreenButtonRef.current?.focus(), 0);

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setFullscreen(false);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [fullscreen]);

  useEffect(() => {
    if (!flightPathRequested) return;
    setFlightPathOpen(true);
    onFlightPathRequested();
  }, [flightPathRequested, onFlightPathRequested]);

  useEffect(() => {
    if (fullscreen) return;
    fullscreenButtonRef.current?.focus();
  }, [fullscreen]);

  const selectNode = useCallback((node: RepositoryAtlasNode) => {
    setSelectedNodeId(node.id);
    const matchingUniverseNode = node.path
      ? universe.nodes.find(item => item.path === node.path)
      : universe.nodes.find(item => item.metadata.atlasNodeId === node.id);
    if (matchingUniverseNode) setSelectedUniverseNodeId(matchingUniverseNode.id);
    if (node.clusterId) setFocusedClusterId(node.clusterId);
    const chapterId = typeof node.metadata.storyChapterId === 'string'
      ? node.metadata.storyChapterId as WorkspaceStoryChapterId
      : typeof node.metadata.chapterId === 'string'
        ? node.metadata.chapterId as WorkspaceStoryChapterId
        : null;
    if (chapterId && story.chapters.some(chapter => chapter.id === chapterId)) {
      onSelectChapter(chapterId);
    }
  }, [onSelectChapter, story.chapters, universe.nodes]);

  const selectUniverseNode = useCallback((node: RepositoryUniverseNode) => {
    setSelectedUniverseNodeId(node.id);
    if (node.clusterId) setFocusedClusterId(node.clusterId);
    if (node.metadata.atlasNodeId) setSelectedNodeId(node.metadata.atlasNodeId);
    const chapterId = typeof node.metadata.storyChapterId === 'string' ? node.metadata.storyChapterId as WorkspaceStoryChapterId : null;
    if (chapterId && story.chapters.some(chapter => chapter.id === chapterId)) {
      onSelectChapter(chapterId);
    }
  }, [onSelectChapter, story.chapters]);

  const changeViewMode = (mode: 'universe3d' | 'atlas2d') => {
    if (mode === viewMode) return;
    if (mode === 'atlas2d') {
      const universeNode = universe.nodes.find(node => node.id === selectedUniverseNodeId);
      const atlasNode = universeNode?.path
        ? atlas.nodes.find(node => node.path === universeNode.path)
        : atlas.nodes.find(node => node.id === universeNode?.metadata.atlasNodeId);
      if (atlasNode) setSelectedNodeId(atlasNode.id);
    } else {
      const atlasNode = atlas.nodes.find(node => node.id === selectedNodeId);
      const universeNode = atlasNode?.path
        ? universe.nodes.find(node => node.path === atlasNode.path)
        : universe.nodes.find(node => node.metadata.atlasNodeId === atlasNode?.id);
      if (universeNode) setSelectedUniverseNodeId(universeNode.id);
    }
    setViewMode(mode);
  };

  const openAtlasFallback = () => {
    changeViewMode('atlas2d');
  };

  const retryUniverse = () => {
    setUniverseRetryKey(current => current + 1);
    setViewMode('universe3d');
  };

  const changeTransformationMode = (mode: RepositoryTransformationMode | 'after-rescan') => {
    setTransformationMode(mode);
    if (mode !== 'with-shipseal') setSelectedProposalId(null);
  };

  const openOptimizationPlan = () => {
    setTransformationMode('with-shipseal');
    setOptimizationPlanOpen(true);
    onPlanReviewed();
  };

  const selectProposal = useCallback((proposal: RepositoryTransformationProposal) => {
    setTransformationMode('with-shipseal');
    setSelectedProposalId(proposal.id);
    setFocusedClusterId(current => proposal.graphChanges.proposedNodes[0]?.clusterId || current);
  }, []);

  const handleUniverseSelectNode = useCallback((nodeId: string) => {
    const node = universe.nodes.find(item => item.id === nodeId);
    if (node) selectUniverseNode(node);
  }, [selectUniverseNode, universe.nodes]);

  const handleUniverseSelectProposal = useCallback((proposalId: string) => {
    const proposal = transformation.proposals.find(item => item.id === proposalId);
    if (proposal) selectProposal(proposal);
  }, [selectProposal, transformation.proposals]);

  const handleUniverseSceneSettled = useCallback(() => setUniverseSceneSettled(true), []);

  const generateAgentFlightPath = useCallback(() => {
    const next = buildRepositoryAgentFlightPath({
      task: agentFlightPathTask,
      report,
      universe,
      atlas,
    });
    setAgentFlightPath(next);
    setAgentFlightPathCopied(false);
  }, [agentFlightPathTask, atlas, report, universe]);

  const copyAgentFlightPathPrompt = useCallback(async () => {
    if (!agentFlightPath?.prompt) return;
    try {
      await navigator.clipboard?.writeText(agentFlightPath.prompt);
      setAgentFlightPathCopied(true);
    } catch {
      setAgentFlightPathCopied(false);
    }
  }, [agentFlightPath?.prompt]);

  const focusAgentFlightPathRoute = useCallback(() => {
    if (!agentFlightPath) return;
    const universeNode = agentFlightPath.routeNodeIds.universeNodeIds
      .map(id => universe.nodes.find(node => node.id === id))
      .find(Boolean);
    if (universeNode) {
      setSelectedUniverseNodeId(universeNode.id);
      if (universeNode.metadata.atlasNodeId) setSelectedNodeId(universeNode.metadata.atlasNodeId);
      if (universeNode.clusterId) setFocusedClusterId(universeNode.clusterId);
      setUniverseCamera(current => ({
        ...current,
        radius: universeNode.kind === 'file' ? 220 : 300,
        target: universeNode.position,
      }));
      return;
    }

    const atlasNode = agentFlightPath.routeNodeIds.atlasNodeIds
      .map(id => atlas.nodes.find(node => node.id === id))
      .find(Boolean);
    if (atlasNode) {
      setSelectedNodeId(atlasNode.id);
      if (atlasNode.clusterId) setFocusedClusterId(atlasNode.clusterId);
      const matchingUniverseNode = atlasNode.path
        ? universe.nodes.find(node => node.path === atlasNode.path)
        : universe.nodes.find(node => node.metadata.atlasNodeId === atlasNode.id);
      if (matchingUniverseNode) setSelectedUniverseNodeId(matchingUniverseNode.id);
    }
  }, [agentFlightPath, atlas.nodes, universe.nodes]);

  const toggleProposalIncluded = (proposalId: string) => {
    setExcludedProposalIds(current => {
      const next = new Set(current);
      if (next.has(proposalId)) next.delete(proposalId);
      else next.add(proposalId);
      return next;
    });
  };

  const resetAtlas = () => {
    setSelectedNodeId(initialNodeId);
    setSelectedUniverseNodeId(universe.rootNodeId);
    setFocusedClusterId(activeChapter ? `cluster:${activeChapter.id}` : null);
    setQuery('');
    setFilters({ files: true, folders: true, concepts: true, evidence: true, heuristic: true, missing: true });
    setView({ x: 0, y: 0, scale: 0.82 });
    setUniverseCamera(initialUniverseCamera);
    setUniverseRetryKey(current => current + 1);
    setTransformationMode('current');
    setTransformationDomain('all');
    setSelectedProposalId(null);
  };

  const toggleFilter = (key: RepositoryUniverseFilterKey) => {
    if (universeFilterCounts[key] === 0) return;
    setFilters(current => ({ ...current, [key]: !current[key] }));
  };

  const setScale = (next: number) => {
    setView(current => ({ ...current, scale: clamp(next, 0.55, 1.55) }));
  };

  const enterFullscreen = () => {
    setNavigationActive(false);
    setFullscreen(true);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('button') || target.closest('input')) return;
    if (!fullscreen && !navigationActive) {
      setNavigationActive(true);
      return;
    }
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, viewX: view.x, viewY: view.y, moved: false };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.x;
    const deltaY = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(deltaX, deltaY) < 4) return;
    drag.moved = true;
    setView(current => ({
      ...current,
      x: drag.viewX + deltaX,
      y: drag.viewY + deltaY,
    }));
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  };

  const atlasToolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <label className="relative min-w-[220px] flex-1 xl:flex-none">
        <span className="sr-only">Search repository atlas or universe</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={event => setQuery(event.target.value)}
          onFocus={() => setNavigationActive(true)}
          className="h-9 w-full rounded-full border border-border/60 bg-background/35 pl-8 pr-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/25"
          placeholder="Search files, paths, roles"
        />
      </label>
      <div className="flex rounded-full border border-border/60 bg-background/25 p-1" aria-label="Repository view selector">
        <button
          type="button"
          aria-pressed={viewMode === 'universe3d'}
          onClick={() => changeViewMode('universe3d')}
          className={`rounded-full px-3 py-1.5 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${viewMode === 'universe3d' ? 'bg-primary/20 text-primary-glow' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Universe 3D
        </button>
        <button
          type="button"
          aria-pressed={viewMode === 'atlas2d'}
          onClick={() => changeViewMode('atlas2d')}
          className={`rounded-full px-3 py-1.5 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${viewMode === 'atlas2d' ? 'bg-primary/20 text-primary-glow' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Atlas 2D
        </button>
      </div>
      {viewMode === 'universe3d' && (
        <Button type="button" variant="outline" size="sm" onClick={() => setUniverseRotationPaused(current => !current)} className="border-border/60 bg-background/25">
          {universeRotationPaused || prefersReducedMotion ? 'Resume rotation' : 'Pause rotation'}
        </Button>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => viewMode === 'universe3d'
          ? setUniverseCamera(current => ({ ...current, radius: Math.max(80, current.radius - 80) }))
          : setScale(view.scale + 0.14)}
        className="border-border/60 bg-background/25"
        aria-label="Zoom in"
      >
        <ZoomIn className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => viewMode === 'universe3d'
          ? setUniverseCamera(current => ({ ...current, radius: Math.min(1500, current.radius + 80) }))
          : setScale(view.scale - 0.14)}
        className="border-border/60 bg-background/25"
        aria-label="Zoom out"
      >
        <ZoomOut className="h-3.5 w-3.5" />
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={resetAtlas} className="border-border/60 bg-background/25">
        <Crosshair className="mr-1.5 h-3.5 w-3.5" /> Reset view
      </Button>
      {!fullscreen && (
        <Button ref={fullscreenButtonRef} type="button" variant="outline" size="sm" onClick={enterFullscreen} className="border-primary/35 bg-primary/10 text-primary-glow hover:text-primary-glow">
          <Maximize2 className="mr-1.5 h-3.5 w-3.5" /> Fullscreen
        </Button>
      )}
      {fullscreen && (
        <>
          <Button type="button" variant="outline" size="sm" onClick={() => setInspectorCollapsed(current => !current)} className="border-border/60 bg-background/25">
            {inspectorCollapsed ? <PanelRightOpen className="mr-1.5 h-3.5 w-3.5" /> : <PanelRightClose className="mr-1.5 h-3.5 w-3.5" />}
            {inspectorCollapsed ? 'Expand inspector' : 'Collapse inspector'}
          </Button>
          <Button ref={exitFullscreenButtonRef} type="button" variant="outline" size="sm" onClick={exitFullscreen} className="border-primary/45 bg-primary/10 text-primary-glow hover:text-primary-glow">
            <Minimize2 className="mr-1.5 h-3.5 w-3.5" /> Exit fullscreen
          </Button>
        </>
      )}
    </div>
  );

  const atlasFilters = (
    <div className="flex flex-wrap gap-2" aria-label="Repository Atlas filters">
      <AtlasFilterButton label="Files" count={universeFilterCounts.files} active={filters.files} zeroDescription="No file entities were produced by this scan." onClick={() => toggleFilter('files')} />
      <AtlasFilterButton label="Folders" count={universeFilterCounts.folders} active={filters.folders} zeroDescription="No folder entities were produced by this scan." onClick={() => toggleFilter('folders')} />
      <AtlasFilterButton label="Concepts" count={universeFilterCounts.concepts} active={filters.concepts} zeroDescription="No concept entities were produced by this scan." onClick={() => toggleFilter('concepts')} />
      <AtlasFilterButton label="Evidence" count={universeFilterCounts.evidence} active={filters.evidence} zeroDescription="No evidence-backed entities were produced by this scan." onClick={() => toggleFilter('evidence')} />
      <AtlasFilterButton label="Heuristic" count={universeFilterCounts.heuristic} active={filters.heuristic} zeroDescription="No heuristic entities were produced by this scan." onClick={() => toggleFilter('heuristic')} />
      <AtlasFilterButton label="Proposed" count={universeFilterCounts.missing} active={filters.missing} zeroDescription="No proposed or missing entities were produced by this scan." onClick={() => toggleFilter('missing')} />
    </div>
  );

  const transformationControls = (
    <div className="flex flex-col gap-2 rounded-2xl border border-primary/15 bg-background/20 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-full border border-border/60 bg-background/25 p-1" aria-label="Repository transformation preview mode">
          <button
            type="button"
            aria-pressed={transformationMode === 'current'}
            onClick={() => changeTransformationMode('current')}
            className={`rounded-full px-3 py-1.5 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${transformationMode === 'current' ? 'bg-primary/20 text-primary-glow' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Current
          </button>
          <button
            type="button"
            aria-pressed={transformationMode === 'with-shipseal'}
            disabled={transformation.proposals.length === 0}
            onClick={() => changeTransformationMode('with-shipseal')}
            className={`rounded-full px-3 py-1.5 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-45 ${transformationMode === 'with-shipseal' ? 'bg-primary/20 text-primary-glow' : 'text-muted-foreground hover:text-foreground'}`}
          >
            With ShipSeal
          </button>
          {verificationResult && (
            <button
              type="button"
              aria-pressed={transformationMode === 'after-rescan'}
              disabled={!hasVerifiedRescanComparison}
              onClick={() => changeTransformationMode('after-rescan')}
              className={`rounded-full px-3 py-1.5 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-45 ${transformationMode === 'after-rescan' ? 'bg-primary/20 text-primary-glow' : 'text-muted-foreground hover:text-foreground'}`}
            >
              After rescan
            </button>
          )}
        </div>
        <div className="text-xs text-muted-foreground" aria-live="polite">
          {transformationMode === 'current'
            ? `${transformation.summary.currentFiles.toLocaleString()} current files - ${transformation.summary.currentClusters.toLocaleString()} knowledge clusters`
            : transformationMode === 'after-rescan' && verificationResult
              ? `${verificationResult.counts.detected + verificationResult.counts.contentMatched} detected - ${verificationResult.counts.needsReview} need review`
              : `${transformation.summary.proposedArtifacts.toLocaleString()} proposed artifacts - ${transformation.summary.proposedRelationships.toLocaleString()} proposed relationships`}
        </div>
        {transformation.proposals.length > 0 && (
          <div className="ml-auto rounded-full border border-border/45 bg-background/20 px-3 py-1.5 text-xs text-muted-foreground">
            {includedProposalCount.toLocaleString()} proposed improvements selected
          </div>
        )}
        {transformation.proposals.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={openOptimizationPlan}
            disabled={activeTransformationArtifactCount === 0}
            className="border-primary/35 bg-primary/10 text-primary-glow hover:text-primary-glow"
          >
            Review optimization plan
          </Button>
        )}
      </div>
      {activeTransformationArtifactCount > 0 && (
        <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground" aria-live="polite">
          <span>{includedProposalCount.toLocaleString()} selected proposals</span>
          <span>-</span>
          <span>{activeTransformationArtifactCount.toLocaleString()} unique artifacts</span>
          <span>-</span>
          <span>{optimizationPlan ? `${optimizationPlan.summary.readyItemCount.toLocaleString()} ready` : 'Open plan for readiness'}</span>
          {optimizationPlan && (
            <>
              <span>-</span>
              <span>{(optimizationPlan.summary.reviewRequiredItemCount + optimizationPlan.summary.blockedItemCount).toLocaleString()} need review</span>
            </>
          )}
        </div>
      )}
      {transformation.proposals.length > 0 ? (
        <div className="flex flex-wrap gap-2" aria-label="Transformation domains">
          <TransformationDomainButton label="All improvements" count={transformation.proposals.length} active={transformationDomain === 'all'} onClick={() => setTransformationDomain('all')} />
          {(['project-memory', 'agent-routing', 'verification-path'] as RepositoryTransformationDomain[]).filter(domain => domainCounts[domain] > 0).map(domain => (
            <TransformationDomainButton
              key={domain}
              label={transformationDomainLabel(domain)}
              count={domainCounts[domain]}
              active={transformationDomain === domain}
              onClick={() => setTransformationDomain(domain)}
            />
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">ShipSeal did not find a supported transformation to preview from this scan.</p>
      )}
      {transformation.summary.limitedScan && (
        <p className="text-xs text-warning">Limited scan: preview confidence is cautious and based on the available scan boundary.</p>
      )}
    </div>
  );

  const clusterLegend = viewMode === 'universe3d' && (
    <details className="group rounded-2xl border border-border/45 bg-background/20 px-3 py-2 text-xs text-muted-foreground">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="font-medium text-foreground">Cluster colors</span>
        <span>{universeClusterLegend.length.toLocaleString()} clusters</span>
      </summary>
      <div className="mt-3 flex flex-wrap gap-2" aria-label="Repository Universe cluster colors">
        {universeClusterLegend.map(item => (
          <button
            key={item.id}
            type="button"
            aria-pressed={focusedClusterId === item.id}
            aria-label={`${item.label} cluster, ${item.nodeCount} entities, ${item.token.label} color`}
            onClick={() => setFocusedClusterId(current => current === item.id ? null : item.id)}
            className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              focusedClusterId === item.id ? 'border-primary/45 bg-primary/10 text-primary-glow' : 'border-border/45 bg-background/20 hover:border-primary/35 hover:text-foreground'
            }`}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.token.css }} aria-hidden="true" />
            <span>{item.label}</span>
            <span className="text-muted-foreground">{item.nodeCount}</span>
          </button>
        ))}
      </div>
    </details>
  );

  const optimizationPlanReview = optimizationPlanOpen && optimizationPlan && (
    <OptimizationPlanReview
      report={report}
      plan={optimizationPlan}
      applyPlan={optimizationApplyPlan}
      connection={connection}
      proposals={transformation.proposals}
      excludedProposalIds={excludedProposalIds}
      verificationBaseline={verificationBaseline}
      verificationResult={verificationResult}
      selectedItem={selectedOptimizationItem}
      onSelectItem={item => setSelectedOptimizationItemId(item.id)}
      onToggleProposalIncluded={toggleProposalIncluded}
      onSaveVerificationBaseline={onSaveVerificationBaseline}
      onDiscardVerificationBaseline={onDiscardVerificationBaseline}
      onPackDownloaded={onPackagePrepared}
      onPrCreated={onPrCreated}
      onClose={() => setOptimizationPlanOpen(false)}
    />
  );

  const searchResultList = searchResults.length > 0 && (
    <div className="flex flex-wrap gap-2" aria-label="Repository search results">
      {searchResults.map(node => (
        <button
          key={node.id}
          type="button"
          onClick={() => viewMode === 'universe3d'
            ? selectUniverseNode(node as RepositoryUniverseNode)
            : selectNode(node as RepositoryAtlasNode)}
          className="rounded-full border border-primary/35 bg-primary/10 px-3 py-1.5 text-xs text-primary-glow transition hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {node.label}
          {viewMode === 'universe3d' && 'path' in node && node.path ? <span className="ml-1 text-primary-glow/65">{node.path}</span> : null}
        </button>
      ))}
    </div>
  );

  const atlasCanvas = (
    <div
      ref={viewportRef}
      className={`relative overflow-hidden rounded-[1.5rem] border border-primary/15 bg-[radial-gradient(circle_at_50%_48%,hsl(var(--primary)/0.16),transparent_34%),linear-gradient(180deg,hsl(var(--background)/0.2),hsl(var(--background)/0.08))] select-none ${fullscreen ? 'min-h-0 flex-1' : 'min-h-[560px]'} ${atlasNavigationActive ? 'touch-none overscroll-contain cursor-grab' : 'touch-pan-y cursor-default'}`}
      role="img"
      tabIndex={0}
      aria-label="Repository Atlas knowledge graph. Select nodes to inspect evidence and relationships."
      aria-describedby="repository-atlas-navigation-status"
      data-motion={prefersReducedMotion ? 'reduced' : 'animated'}
      data-ready={atlasReady ? 'true' : 'false'}
      data-navigation-active={atlasNavigationActive ? 'true' : 'false'}
      data-fullscreen={fullscreen ? 'true' : 'false'}
      data-scale={view.scale.toFixed(2)}
      onFocusCapture={() => setNavigationActive(true)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onContextMenu={event => {
        if (atlasNavigationActive) event.preventDefault();
      }}
    >
      <div
        className="absolute left-1/2 top-1/2 h-[640px] w-[920px] origin-center transition-transform duration-300"
        style={{ transform: `translate(calc(-50% + ${view.x}px), calc(-50% + ${view.y}px)) scale(${view.scale})` }}
      >
        <svg viewBox="0 0 920 640" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
          <defs>
            <linearGradient id="atlas-edge-evidence" x1="0" y1="0" x2="1" y2="1">
              <stop stopColor="hsl(var(--primary))" stopOpacity="0.72" />
              <stop offset="1" stopColor="hsl(var(--accent))" stopOpacity="0.36" />
            </linearGradient>
          </defs>
          {visibleEdges.map(edge => {
            const source = atlas.nodes.find(node => node.id === edge.source);
            const target = atlas.nodes.find(node => node.id === edge.target);
            if (!source || !target) return null;
            const selectedEdge = edge.source === selectedNode?.id || edge.target === selectedNode?.id || edge.source === activeChapterNodeId || edge.target === activeChapterNodeId;
            return (
              <line
                key={edge.id}
                data-testid={`atlas-edge-${edge.id}`}
                x1={source.x + 460}
                y1={source.y + 320}
                x2={target.x + 460}
                y2={target.y + 320}
                stroke={edge.evidenceType === 'evidence' ? 'url(#atlas-edge-evidence)' : 'hsl(var(--muted-foreground))'}
                strokeWidth={selectedEdge ? 2.6 : edge.evidenceType === 'evidence' ? 1.5 : 1}
                strokeOpacity={selectedEdge ? 0.9 : 0.34}
                strokeDasharray={edge.evidenceType === 'heuristic' ? '6 8' : undefined}
                className="transition-all duration-500"
              />
            );
          })}
        </svg>

        {atlas.clusters.filter(cluster => cluster.id !== 'cluster:repository').map((cluster, index) => {
          const focused = focusedClusterId === cluster.id;
          const storyFocused = activeChapter && cluster.id === `cluster:${activeChapter.id}`;
          return (
            <button
              key={cluster.id}
              type="button"
              onClick={() => setFocusedClusterId(cluster.id)}
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border text-left transition-all duration-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                focused
                  ? 'border-primary/45 bg-primary/10 shadow-sm shadow-primary/20'
                  : storyFocused
                    ? 'border-accent/35 bg-accent/10'
                    : 'border-primary/15 bg-background/5 hover:border-primary/35'
              } ${!atlasReady && !prefersReducedMotion ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}
              style={{
                left: cluster.x + 460,
                top: cluster.y + 320,
                width: cluster.radius * 2,
                height: cluster.radius * 2,
                transitionDelay: prefersReducedMotion ? '0ms' : `${180 + index * 130}ms`,
              }}
              aria-label={`${cluster.label} cluster`}
            >
              <span className="absolute left-1/2 top-3 -translate-x-1/2 whitespace-nowrap rounded-full border border-border/50 bg-background/70 px-3 py-1 text-[11px] font-semibold text-foreground shadow-sm">
                {cluster.category}
              </span>
            </button>
          );
        })}

        {visibleNodes.map((node, index) => {
          const selected = selectedNode?.id === node.id;
          const transformationAffected = proposalAffectedAtlasNodeIds.has(node.id);
          const verifiedByRescan = transformationMode === 'after-rescan' && Boolean(node.path && verifiedDestinationPaths.has(normalizeWorkspacePath(node.path)));
          const routeHighlighted = flightPathAtlasNodeIdSet.has(node.id);
          const related = relatedNodeIds.has(node.id) || transformationAffected || routeHighlighted;
          const matched = searchMatches.has(node.id);
          const dimmed = Boolean((selectedNode || activeChapter || focusedClusterId || query.trim()) && !selected && !related && !matched && node.id !== atlas.rootNodeId);
          const labelVisible = node.labelPriority !== 'detail' || selected || related || matched || view.scale > 1.05;
          return (
            <button
              key={node.id}
              type="button"
              data-testid={`atlas-node-${node.id}`}
              data-route-node={routeHighlighted ? 'true' : 'false'}
              aria-pressed={selected}
              aria-label={`${node.label} ${node.kind} ${evidenceStateLabel(node.evidenceType)}`}
              onClick={() => selectNode(node)}
              onMouseEnter={event => setTooltip({
                x: event.clientX,
                y: event.clientY,
                label: node.label,
                detail: `${node.kind} · ${evidenceStateLabel(node.evidenceType)} · ${atlas.edges.filter(edge => edge.source === node.id || edge.target === node.id).length} relationships`,
              })}
              onMouseMove={event => setTooltip(current => current ? { ...current, x: event.clientX, y: event.clientY } : current)}
              onMouseLeave={() => setTooltip(null)}
              className={`absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border text-center transition-all duration-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                selected
                  ? 'z-30 border-primary/75 bg-primary/25 text-primary-glow shadow-glow'
                  : node.evidenceType === 'evidence'
                    ? 'z-20 border-primary/45 bg-background/70 text-foreground'
                    : node.evidenceType === 'missing'
                      ? 'z-10 border-warning/45 bg-background/45 text-warning'
                      : 'z-10 border-border/60 bg-background/45 text-muted-foreground'
              } ${matched ? 'ring-2 ring-accent/55' : ''} ${routeHighlighted ? 'ring-2 ring-primary/55 shadow-sm shadow-primary/20' : ''} ${transformationAffected ? 'ring-2 ring-primary/30' : ''} ${verifiedByRescan ? 'ring-2 ring-success/60' : ''} ${dimmed ? 'opacity-28' : 'opacity-100'} ${!atlasReady && node.kind !== 'repository' && !prefersReducedMotion ? 'scale-50 opacity-0' : 'scale-100'}`}
              style={{
                left: node.x + 460,
                top: node.y + 320,
                width: node.radius * 2,
                height: node.radius * 2,
                transitionDelay: prefersReducedMotion ? '0ms' : `${node.kind === 'repository' ? 0 : 720 + index * 38}ms`,
              }}
            >
              <span className={`${node.kind === 'repository' ? 'h-3 w-3' : 'h-2 w-2'} rounded-full ${atlasNodeDotClass(node)}`} />
              {labelVisible && (
                <span className={`pointer-events-none absolute left-1/2 top-[calc(100%+7px)] max-w-[150px] -translate-x-1/2 rounded-full border border-border/45 bg-background/75 px-2 py-1 text-[10px] font-medium leading-tight shadow-sm ${selected ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {shortAtlasLabel(node.label)}
                </span>
              )}
            </button>
          );
        })}

        {transformationMode === 'with-shipseal' && visibleTransformationProposals.flatMap(proposal => (
          proposal.graphChanges.proposedEdges.map(edge => {
            const proposed = proposal.graphChanges.proposedNodes.find(node => node.id === edge.source);
            const target = atlasNodeForUniverseNodeId(edge.target, universe, atlas);
            if (!proposed || !target) return null;
            return (
              <svg key={edge.id} className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden="true">
                <line
                  x1={proposed.x + 460}
                  y1={proposed.y + 320}
                  x2={target.x + 460}
                  y2={target.y + 320}
                  stroke="hsl(var(--primary))"
                  strokeWidth={selectedProposalId === proposal.id ? 2 : 1.2}
                  strokeOpacity={excludedProposalIds.has(proposal.id) ? 0.16 : selectedProposalId === proposal.id ? 0.58 : 0.3}
                  strokeDasharray="7 8"
                  className="transition-all duration-500"
                />
              </svg>
            );
          })
        ))}

        {transformationMode === 'with-shipseal' && visibleTransformationProposals.flatMap(proposal => (
          proposal.graphChanges.proposedNodes.map(node => {
            const selected = selectedProposalId === proposal.id;
            const excluded = excludedProposalIds.has(proposal.id);
            return (
              <button
                key={node.id}
                type="button"
                aria-pressed={selected}
                aria-label={`${node.label}. Proposed With ShipSeal entity.`}
                onClick={() => selectProposal(proposal)}
                className={`absolute z-40 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-dashed text-center transition-all duration-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  selected
                    ? 'border-primary/80 bg-primary/20 text-primary-glow shadow-glow'
                    : 'border-primary/45 bg-background/55 text-primary-glow/85 hover:border-primary/70'
                } ${excluded ? 'opacity-35' : 'opacity-100'}`}
                style={{
                  left: node.x + 460,
                  top: node.y + 320,
                  width: selected ? 72 : 58,
                  height: selected ? 72 : 58,
                }}
              >
                <span className="h-3 w-3 rounded-full border border-primary/60 bg-primary/15" />
                <span className="pointer-events-none absolute left-1/2 top-[calc(100%+7px)] max-w-[170px] -translate-x-1/2 rounded-full border border-primary/35 bg-background/80 px-2 py-1 text-[10px] font-medium leading-tight text-primary-glow shadow-sm">
                  Proposed
                </span>
              </button>
            );
          })
        ))}
      </div>

      {tooltip && (
        <div
          role="tooltip"
          className="pointer-events-none fixed z-50 max-w-[220px] rounded-xl border border-border/60 bg-background/95 px-3 py-2 text-xs shadow-xl"
          style={{ left: tooltip.x + 12, top: tooltip.y + 12 }}
        >
          <div className="font-semibold text-foreground">{tooltip.label}</div>
          <div className="mt-1 text-muted-foreground">{tooltip.detail}</div>
        </div>
      )}
    </div>
  );

  const universeCanvas = (
    <div className={`${fullscreen ? 'min-h-0 flex-1' : 'min-h-[560px]'}`}>
      <RepositoryUniverseErrorBoundary
        resetKey={`${report.repoName}:${report.scannedAt}:${universeRetryKey}:universe3d`}
        fallback={(resetBoundary) => (
          <RepositoryUniverseRecovery
            onOpenAtlas={openAtlasFallback}
            onRetry={() => {
              resetBoundary();
              retryUniverse();
            }}
          />
        )}
      >
        <Suspense fallback={<RepositoryUniverseLoading onOpenAtlas={openAtlasFallback} />}>
          <RepositoryUniverse3D
            key={`${report.repoName}:${report.scannedAt}:${universeRetryKey}:${fullscreen ? 'fullscreen' : 'embedded'}`}
            model={universe}
            selectedNodeId={selectedUniverseNode?.id}
            focusedClusterId={focusedClusterId}
            routeNodeIds={flightPathUniverseNodeIds}
            searchMatchIds={universeSearchMatchIdList}
            visibleNodeIds={visibleUniverseNodeIdList}
            visibleEdgeIds={visibleUniverseEdgeIdList}
            cameraState={universeCamera}
            rotationPaused={universeRotationPaused || prefersReducedMotion}
            reducedMotion={prefersReducedMotion}
            animateIn={!universeSceneSettled}
            fullscreen={fullscreen}
            transformation={transformation}
            transformationMode={transformationMode === 'after-rescan' ? 'current' : transformationMode}
            transformationDomain={transformationDomain}
            selectedProposalId={selectedProposalId}
            excludedProposalIds={excludedProposalIdList}
            onCameraStateChange={setUniverseCamera}
            onSelectNode={handleUniverseSelectNode}
            onSelectProposal={handleUniverseSelectProposal}
            onSceneSettled={handleUniverseSceneSettled}
          />
        </Suspense>
      </RepositoryUniverseErrorBoundary>
    </div>
  );

  const inspector = (
    selectedProposal && transformationMode === 'with-shipseal'
      ? (
        <TransformationInspector
          proposal={selectedProposal}
          included={!excludedProposalIds.has(selectedProposal.id)}
          collapsed={fullscreen && inspectorCollapsed}
          onToggleCollapsed={() => setInspectorCollapsed(current => !current)}
          onToggleIncluded={() => toggleProposalIncluded(selectedProposal.id)}
          onClear={() => setSelectedProposalId(null)}
        />
      )
      : viewMode === 'universe3d'
      ? (
        <UniverseInspector
          universe={universe}
          node={selectedUniverseNode}
          nodeHiddenByFilters={Boolean(selectedUniverseNode && !selectedUniverseNodeVisible)}
          cluster={activeUniverseCluster}
          activeChapter={activeChapter}
          repositoryName={report.repoName}
          scanSummary={{
            sourceLabel: isGitHubSource(report.source.sourceType)
              ? `${report.source.githubOwner}/${report.source.githubRepo}${report.source.githubBranch ? ` @ ${report.source.githubBranch}` : ''}`
              : 'ZIP upload',
            analyzedFiles: report.scanEvidence.analyzedFileCount || report.scanSummary.filesAnalyzed || report.fileCount,
            clusterCount: universe.clusters.length,
          }}
          rootNodeId={universe.rootNodeId}
          collapsed={fullscreen && inspectorCollapsed}
          onToggleCollapsed={() => setInspectorCollapsed(current => !current)}
          onFocusNode={() => selectedUniverseNode && setUniverseCamera(current => ({ ...current, radius: selectedUniverseNode.kind === 'file' ? 220 : 300, target: selectedUniverseNode.position }))}
          onFocusCluster={() => selectedUniverseNode?.clusterId && setFocusedClusterId(selectedUniverseNode.clusterId)}
          onClearFocus={() => setFocusedClusterId(null)}
          onReturnRepository={() => {
            setSelectedUniverseNodeId(universe.rootNodeId);
            setUniverseCamera(initialUniverseCamera);
          }}
          onOpenAtlas={() => changeViewMode('atlas2d')}
          onSelectNode={selectUniverseNode}
        />
      )
      : (
        <AtlasInspector
          atlas={atlas}
          node={selectedNode}
          cluster={activeCluster}
          activeChapter={activeChapter}
          collapsed={fullscreen && inspectorCollapsed}
          onToggleCollapsed={() => setInspectorCollapsed(current => !current)}
          onFocusCluster={() => selectedNode?.clusterId && setFocusedClusterId(selectedNode.clusterId)}
          onClearFocus={() => setFocusedClusterId(null)}
          onSelectNode={selectNode}
        />
      )
  );
  const resultChapterTitle = activeResultChapter === 'understand'
    ? 'Explore the repository universe'
    : activeResultChapter === 'improve'
      ? 'Review ShipSeal improvements'
      : activeResultChapter === 'verify'
        ? 'Verify after rescan'
        : 'Delivery outputs';
  const resultChapterEyebrow = activeResultChapter === 'understand'
    ? 'Repository Universe'
    : activeResultChapter === 'improve'
      ? 'Improve'
      : activeResultChapter === 'verify'
        ? 'Verify'
        : 'Deliver';
  const resultChapterSummary = activeResultChapter === 'understand'
    ? (viewMode === 'universe3d'
      ? `${visibleUniverseNodeIds.size.toLocaleString()} entities visible. ${universe.statusNote}`
      : atlas.statusNote)
    : activeResultChapter === 'improve'
      ? 'Preview what ShipSeal can prepare. No repository files change here.'
      : activeResultChapter === 'verify' && verificationResult?.status === 'matched-rescan'
          ? 'ShipSeal is showing only what this later scan detected.'
          : activeResultChapter === 'verify'
            ? 'Verification requires a saved baseline and a later scan of the changed repository.'
            : 'Client handoff and exports remain available without changing their contents.';
  const showUniverseWorkspace = activeResultChapter === 'understand' || activeResultChapter === 'improve';
  const showTransformationPanel = activeResultChapter === 'improve';
  const showPlanReview = optimizationPlanReview && (activeResultChapter === 'improve' || activeResultChapter === 'verify');

  return (
    <section ref={atlasRootRef} className="relative rounded-[1.75rem] border border-primary/25 bg-[hsl(224_31%_6%)] p-4 shadow-sm shadow-primary/10 md:p-5" aria-labelledby="repository-atlas-heading">
      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{resultChapterEyebrow}</div>
          <h2 id="repository-atlas-heading" className="mt-1 font-display text-2xl font-semibold">{resultChapterTitle}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {resultChapterSummary}
          </p>
        </div>
        {!fullscreen && showUniverseWorkspace && atlasToolbar}
      </div>

      {!fullscreen && (
        <>
          {showUniverseWorkspace && (
            <div id="repository-atlas-navigation-status" className="mb-4 rounded-full border border-border/50 bg-background/20 px-3 py-2 text-xs text-muted-foreground" aria-live="polite">
              {atlasNavigationActive ? `${viewMode === 'universe3d' ? 'Universe' : 'Atlas'} navigation active - Press Esc to release` : 'Click to explore - Scroll to zoom - Drag to move'}
            </div>
          )}

          {showTransformationPanel && <div className="mb-4">{transformationControls}</div>}
          {showPlanReview && <div className="mb-4">{optimizationPlanReview}</div>}
          {activeResultChapter === 'improve' && !optimizationPlanOpen && (
            <div className="mb-4 rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <div className="font-display text-lg font-semibold">ShipSeal found concrete improvements.</div>
              <p className="mt-1 text-sm text-muted-foreground">Review the generated plan, then package only what should be human-reviewed.</p>
              <Button type="button" size="sm" onClick={openOptimizationPlan} className="mt-3 bg-primary text-primary-foreground hover:bg-primary/90">
                Prepare optimization package
              </Button>
            </div>
          )}
          {activeResultChapter === 'verify' && !optimizationPlanReview && (
            <div className="mb-4 rounded-2xl border border-border/55 bg-background/20 p-4">
              <p className="text-sm text-muted-foreground">No active optimization artifacts are selected yet.</p>
              <Button type="button" size="sm" onClick={() => onResultChapterChange('improve')} className="mt-3 bg-primary text-primary-foreground hover:bg-primary/90">
                Review ShipSeal improvements
              </Button>
            </div>
          )}
        </>
      )}

      {!fullscreen && showUniverseWorkspace && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          {viewMode === 'universe3d' ? universeCanvas : atlasCanvas}
          {inspector}
        </div>
      )}

      {!fullscreen && showUniverseWorkspace && (
        <div className="mt-4 space-y-3">
          {searchResultList}
          <details className="rounded-2xl border border-border/45 bg-background/20 px-3 py-2">
            <summary className="cursor-pointer text-sm font-medium text-foreground">Layers and filters</summary>
            <div className="mt-3">{atlasFilters}</div>
          </details>
          {clusterLegend}
          {activeResultChapter === 'understand' && (
            <details open={flightPathOpen} onToggle={event => setFlightPathOpen(event.currentTarget.open)} className="rounded-2xl border border-border/45 bg-background/20 p-3">
              <summary className="cursor-pointer text-sm font-medium text-foreground">Plan an agent task</summary>
              <div className="mt-3">
                <AgentFlightPathPanel
                  task={agentFlightPathTask}
                  flightPath={agentFlightPath}
                  copied={agentFlightPathCopied}
                  onTaskChange={setAgentFlightPathTask}
                  onGenerate={generateAgentFlightPath}
                  onCopyPrompt={copyAgentFlightPathPrompt}
                  onFocusRoute={focusAgentFlightPathRoute}
                />
              </div>
            </details>
          )}
          {activeResultChapter === 'understand' && (
            <details className="rounded-2xl border border-border/45 bg-background/20 p-3">
              <summary className="cursor-pointer text-sm font-medium text-foreground">Repository insights</summary>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                {workspaceInsights(report, universe).map(insight => (
                  <div key={insight.title} className="rounded-2xl border border-border/50 bg-background/20 p-4">
                    <div className="text-sm font-semibold text-foreground">{insight.title}</div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{insight.detail}</p>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      <p className="sr-only" aria-live="polite">
        {viewMode === 'universe3d'
          ? selectedUniverseNode
            ? `Selected ${selectedUniverseNode.label}. ${universe.edges.filter(edge => edge.source === selectedUniverseNode.id || edge.target === selectedUniverseNode.id).length} relationships available.`
            : 'Repository Universe loaded.'
          : selectedNode
            ? `Selected ${selectedNode.label}. ${atlas.edges.filter(edge => edge.source === selectedNode.id || edge.target === selectedNode.id).length} relationships available.`
            : 'Repository Atlas loaded.'}
      </p>

      {fullscreen && (
        <div
          ref={fullscreenLayerRef}
          role="dialog"
          aria-modal="true"
          aria-label={`${viewMode === 'universe3d' ? 'Repository Universe' : 'Repository Atlas'} fullscreen`}
          className="fixed inset-0 z-[100] flex flex-col bg-[hsl(224_31%_5%)] p-4 text-foreground md:p-6"
        >
          <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{viewMode === 'universe3d' ? 'Repository Universe' : 'Repository Atlas'}</div>
              <h2 className="mt-1 font-display text-2xl font-semibold">Fullscreen exploration</h2>
              <p className="mt-1 text-sm text-muted-foreground">{viewMode === 'universe3d' ? 'Universe' : 'Atlas'} navigation active - Press Esc to exit fullscreen</p>
            </div>
            {atlasToolbar}
          </div>
          <div className="mb-4">{transformationControls}</div>
          {optimizationPlanReview && <div className="mb-4">{optimizationPlanReview}</div>}
          <div className="mb-4">{atlasFilters}</div>
          {clusterLegend && <div className="mb-4">{clusterLegend}</div>}
          {searchResultList && <div className="mb-4">{searchResultList}</div>}
          <div className={`grid min-h-0 flex-1 gap-4 ${inspectorCollapsed ? 'xl:grid-cols-[minmax(0,1fr)_220px]' : 'xl:grid-cols-[minmax(0,1fr)_360px]'}`}>
            {viewMode === 'universe3d' ? universeCanvas : atlasCanvas}
            {inspector}
          </div>
        </div>
      )}
    </section>
  );
}

function AgentFlightPathPanel({
  task,
  flightPath,
  copied,
  onTaskChange,
  onGenerate,
  onCopyPrompt,
  onFocusRoute,
}: {
  task: string;
  flightPath: RepositoryAgentFlightPath | null;
  copied: boolean;
  onTaskChange: (task: string) => void;
  onGenerate: () => void;
  onCopyPrompt: () => void;
  onFocusRoute: () => void;
}) {
  const routeNodeCount = flightPath?.metadata.routeNodeCount || 0;

  return (
    <section className="rounded-[1.35rem] border border-primary/20 bg-[linear-gradient(135deg,hsl(var(--primary)/0.08),hsl(var(--background)/0.24)_42%,hsl(var(--accent)/0.06))] p-4 shadow-sm shadow-primary/10" aria-label="Agent Flight Path">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <div className="text-xs font-mono uppercase tracking-wider text-primary-glow/80">Agent Flight Path</div>
          <h3 id="agent-flight-path-heading" className="mt-1 font-display text-xl font-semibold text-foreground">Plan the first pass before coding.</h3>
          <p className="mt-1 text-sm text-muted-foreground">Evidence-bound repository route for an AI coding agent.</p>
        </div>
        {flightPath && (
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline" className={agentFlightPathConfidenceClass(flightPath.confidence)}>
              {flightPath.confidence} confidence
            </Badge>
            <Badge variant="outline" className="border-border/60 bg-background/25 text-muted-foreground">
              {routeNodeCount.toLocaleString()} mapped nodes
            </Badge>
          </div>
        )}
      </div>

      <form
        className="mt-4 flex flex-col gap-3 md:flex-row"
        onSubmit={event => {
          event.preventDefault();
          onGenerate();
        }}
      >
        <label className="min-w-0 flex-1">
          <span className="sr-only">Describe what your AI agent should do</span>
          <input
            value={task}
            onChange={event => onTaskChange(event.target.value)}
            className="h-11 w-full rounded-full border border-border/60 bg-background/45 px-4 text-sm outline-none transition placeholder:text-muted-foreground/70 focus:border-primary/55 focus:ring-2 focus:ring-primary/25"
            placeholder="Describe what your AI agent should do..."
          />
        </label>
        <Button type="submit" className="h-11 rounded-full bg-primary px-5 text-primary-foreground hover:bg-primary/90">
          <Sparkles className="mr-2 h-4 w-4" />
          Generate flight path
        </Button>
      </form>

      {!flightPath && (
        <div className="mt-4 rounded-2xl border border-border/50 bg-background/20 p-4 text-sm text-muted-foreground">
          Try “Improve PDF export”, “Fix the mobile pricing layout” or “Add tests for the scan flow”.
        </div>
      )}

      {flightPath && (
        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-2xl border border-border/55 bg-background/24 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-foreground">{flightPath.normalizedTaskIntent}</div>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{flightPath.summary}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={onCopyPrompt} className="border-primary/35 bg-primary/10 text-primary-glow hover:text-primary-glow">
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  {copied ? 'Prompt copied' : 'Copy prompt'}
                </Button>
                <Button type="button" variant="outline" size="sm" disabled={routeNodeCount === 0} onClick={onFocusRoute} className="border-border/60 bg-background/25">
                  <Crosshair className="mr-1.5 h-3.5 w-3.5" />
                  Focus route
                </Button>
              </div>
            </div>

            <ol className="mt-4 grid gap-2" aria-label="Agent Flight Path route steps">
              {flightPath.routeSteps.map(step => (
                <li key={step.id} className="grid grid-cols-[32px_minmax(0,1fr)] gap-3 rounded-2xl border border-border/45 bg-background/20 p-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-primary/35 bg-primary/10 text-xs font-semibold text-primary-glow">
                    {step.order}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{step.title}</span>
                      <Badge variant="outline" className={step.evidenceState === 'evidence' ? 'border-success/35 bg-success/10 text-success' : 'border-warning/35 bg-warning/10 text-warning'}>
                        {step.evidenceState}
                      </Badge>
                    </div>
                    {step.path && <div className="mt-1 truncate font-mono text-xs text-primary-glow/85">{step.path}</div>}
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.reason}</p>
                    {step.command && (
                      <div className="mt-2 rounded-xl border border-border/45 bg-background/25 px-3 py-2 font-mono text-xs text-foreground">
                        {step.command.cmd}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>

            {flightPath.status === 'needs-clarification' && (
              <div className="mt-4 rounded-2xl border border-warning/25 bg-warning/10 p-3">
                <div className="text-sm font-semibold text-warning">Clarify the task for a sharper route.</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {flightPath.clarificationSuggestions.map(suggestion => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => onTaskChange(suggestion)}
                      className="rounded-full border border-warning/30 bg-background/20 px-3 py-1.5 text-xs text-foreground transition hover:border-warning/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="grid content-start gap-3">
            <div className="rounded-2xl border border-border/55 bg-background/20 p-4">
              <div className="text-sm font-semibold text-foreground">Review gates</div>
              {flightPath.reviewGates.length ? (
                <div className="mt-3 grid gap-2">
                  {flightPath.reviewGates.map(gate => (
                    <div key={gate.id} className="rounded-xl border border-warning/25 bg-warning/10 p-3">
                      <div className="text-xs font-semibold text-warning">{gate.label}</div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{gate.reason}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">No special review gate detected from the task wording.</p>
              )}
            </div>

            <details className="rounded-2xl border border-border/55 bg-background/20 p-4">
              <summary className="cursor-pointer select-none text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Evidence and avoided paths</summary>
              <div className="mt-3 grid gap-3 text-xs text-muted-foreground">
                <div>
                  <div className="font-semibold text-foreground">Context</div>
                  <ul className="mt-2 grid gap-1">
                    {flightPath.contextFiles.slice(0, 8).map(file => (
                      <li key={`${file.role}:${file.path}`} className="truncate font-mono">{file.path}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="font-semibold text-foreground">Avoid unless needed</div>
                  <ul className="mt-2 grid gap-1">
                    {flightPath.avoidances.length
                      ? flightPath.avoidances.map(item => <li key={item.path} className="truncate font-mono">{item.path}</li>)
                      : <li>No generated/vendor folders were reported by the scan.</li>}
                  </ul>
                </div>
              </div>
            </details>

            <details className="rounded-2xl border border-border/55 bg-background/20 p-4">
              <summary className="cursor-pointer select-none text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Prompt preview</summary>
              <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl border border-border/45 bg-background/35 p-3 text-xs leading-relaxed text-muted-foreground">{flightPath.prompt}</pre>
            </details>
          </div>
        </div>
      )}
    </section>
  );
}

function agentFlightPathConfidenceClass(confidence: RepositoryAgentFlightPath['confidence']) {
  if (confidence === 'high') return 'border-success/40 bg-success/10 text-success';
  if (confidence === 'medium') return 'border-primary/40 bg-primary/10 text-primary-glow';
  if (confidence === 'low') return 'border-warning/40 bg-warning/10 text-warning';
  return 'border-border/60 bg-background/25 text-muted-foreground';
}

function OptimizationPlanReview({
  report,
  plan,
  applyPlan,
  connection,
  proposals,
  excludedProposalIds,
  verificationBaseline,
  verificationResult,
  selectedItem,
  onSelectItem,
  onToggleProposalIncluded,
  onSaveVerificationBaseline,
  onDiscardVerificationBaseline,
  onPackDownloaded,
  onPrCreated,
  onClose,
}: {
  report: ReadinessReport;
  plan: RepositoryOptimizationPlan;
  applyPlan: OptimizationApplyPlan | null;
  connection: GitHubConnectionState;
  proposals: RepositoryTransformationProposal[];
  excludedProposalIds: Set<string>;
  verificationBaseline?: RepositoryVerificationBaseline | null;
  verificationResult?: RepositoryVerificationResult | null;
  selectedItem: RepositoryOptimizationPlanItem | null;
  onSelectItem: (item: RepositoryOptimizationPlanItem) => void;
  onToggleProposalIncluded: (proposalId: string) => void;
  onSaveVerificationBaseline?: (baseline: RepositoryVerificationBaseline) => void;
  onDiscardVerificationBaseline?: () => void;
  onPackDownloaded?: () => void;
  onPrCreated?: () => void;
  onClose: () => void;
}) {
  const manifestPreview = serializeRepositoryOptimizationManifest(plan.manifest);
  const [packState, setPackState] = useState<'idle' | 'building' | 'downloaded' | 'error'>('idle');
  const [packError, setPackError] = useState('');
  const [prConfirmed, setPrConfirmed] = useState(false);
  const [prState, setPrState] = useState<'idle' | 'creating' | 'created' | 'error'>('idle');
  const [prError, setPrError] = useState('');
  const [prResult, setPrResult] = useState<{ url: string; branchName: string } | null>(null);
  const baselineSavedForCurrentPlan = Boolean(verificationBaseline && applyPlan && verificationBaseline.applyPlanId === applyPlan.id);

  const saveVerificationBaseline = (method: VerificationBaselineMethod) => {
    if (!applyPlan || !onSaveVerificationBaseline) return;
    onSaveVerificationBaseline(buildRepositoryVerificationBaseline({ report, applyPlan, method }));
  };

  const handleDownloadPack = async () => {
    if (!applyPlan) return;
    setPackState('building');
    setPackError('');
    try {
      const blob = await buildOptimizationPackZipBlob(applyPlan);
      downloadBlob(blob, buildOptimizationPackZipFilename(plan.repositoryName));
      saveVerificationBaseline('zip-download');
      setPackState('downloaded');
      onPackDownloaded?.();
    } catch (error) {
      setPackState('error');
      setPackError(error instanceof Error ? error.message : 'Optimization Pack ZIP could not be prepared.');
    }
  };

  const handleCreatePr = async () => {
    if (!applyPlan?.prPreview.canUseGitHubApp || !connection.installationId || !connection.owner || !connection.repo || !prConfirmed) return;
    setPrState('creating');
    setPrError('');
    setPrResult(null);
    try {
      const result = await createGitHubAppReadinessPr({
        installationId: connection.installationId,
        owner: connection.owner,
        repo: connection.repo,
        baseBranch: connection.defaultBranch,
        branchName: applyPlan.prPreview.branchName,
        prTitle: applyPlan.prPreview.title,
        prBody: applyPlan.prPreview.body,
        files: applyPlan.prPreview.files.map(file => ({ path: file.path, content: file.content })),
      });
      setPrState('created');
      setPrResult({ url: result.prUrl, branchName: result.branchName });
      saveVerificationBaseline('github-pr-created');
      onPrCreated?.();
    } catch (error) {
      setPrState('error');
      setPrError(friendlyOptimizationPrError(error));
    }
  };

  return (
    <section className="rounded-[1.5rem] border border-primary/20 bg-background/25 p-4 md:p-5" aria-labelledby="optimization-plan-heading">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Optimization Plan</div>
          <h3 id="optimization-plan-heading" className="mt-1 font-display text-xl font-semibold">Review generator-backed artifacts</h3>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Review selected artifacts, package them for human review, or preview a GitHub PR. No repository files have been changed.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-primary/40 text-primary-glow">Prepared for review</Badge>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Close plan
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <OptimizationPlanMetric label="Selected proposals" value={plan.summary.selectedProposalCount} />
        <OptimizationPlanMetric label="Unique artifacts" value={plan.summary.artifactCount} />
        <OptimizationPlanMetric label="Create" value={plan.summary.actionCounts.create} />
        <OptimizationPlanMetric label="Update" value={plan.summary.actionCounts.update} />
        <OptimizationPlanMetric label="Strengthen" value={plan.summary.actionCounts.strengthen} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {plan.summary.selectedDomains.map(domain => (
          <Badge key={domain} variant="outline" className="border-border/60 text-muted-foreground">
            {transformationDomainLabel(domain)}
          </Badge>
        ))}
        <Badge variant="outline" className={plan.summary.blockedItemCount > 0 ? 'border-warning/50 text-warning' : plan.summary.reviewRequiredItemCount > 0 ? 'border-primary/35 text-primary-glow' : 'border-success/40 text-success'}>
          {plan.summary.blockedItemCount > 0
            ? `${plan.summary.blockedItemCount} blocked`
            : plan.summary.reviewRequiredItemCount > 0
              ? `${plan.summary.reviewRequiredItemCount} review required`
              : 'Ready for package'}
        </Badge>
      </div>

      {plan.items.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-border/55 bg-secondary/15 p-4 text-sm text-muted-foreground">
          No selected proposals are active. Re-include a proposed improvement to restore its deterministic plan item.
        </div>
      ) : (
        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.2fr)]">
          <div className="space-y-2" aria-label="Optimization Plan artifacts">
            {plan.items.map(item => (
              <button
                key={item.id}
                type="button"
                aria-pressed={selectedItem?.id === item.id}
                onClick={() => onSelectItem(item)}
                className={`block w-full rounded-2xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  selectedItem?.id === item.id
                    ? 'border-primary/50 bg-primary/10'
                    : 'border-border/55 bg-background/20 hover:border-primary/35'
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 break-all text-sm font-medium text-foreground">{item.artifact.path}</span>
                  <Badge variant="outline" className={optimizationReadinessClass(item.readiness)}>
                    {optimizationReadinessLabel(item.readiness)}
                  </Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                  <span>{optimizationActionLabel(item.artifact.action)}</span>
                  <span>-</span>
                  <span>{transformationDomainLabel(item.domains[0])}</span>
                  <span>-</span>
                  <span>{item.proposalIds.length} proposal{item.proposalIds.length === 1 ? '' : 's'}</span>
                </div>
                <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{item.purpose}</p>
              </button>
            ))}
          </div>

          <OptimizationPlanArtifactDetail
            item={selectedItem}
            proposals={proposals}
            excludedProposalIds={excludedProposalIds}
            onToggleProposalIncluded={onToggleProposalIncluded}
          />
        </div>
      )}

      <OptimizationApplyFlow
        applyPlan={applyPlan}
        connection={connection}
        packState={packState}
        packError={packError}
        prConfirmed={prConfirmed}
        prState={prState}
        prError={prError}
        prResult={prResult}
        manifestPreview={manifestPreview}
        baseline={verificationBaseline}
        verificationResult={verificationResult}
        baselineSavedForCurrentPlan={baselineSavedForCurrentPlan}
        onDownloadPack={handleDownloadPack}
        onSaveBaseline={() => saveVerificationBaseline('manual-baseline')}
        onDiscardBaseline={onDiscardVerificationBaseline}
        onPrConfirmedChange={setPrConfirmed}
        onCreatePr={handleCreatePr}
      />
    </section>
  );
}

function OptimizationPlanMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-secondary/15 p-3">
      <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-2xl font-semibold text-foreground">{value.toLocaleString()}</div>
    </div>
  );
}

function OptimizationApplyFlow({
  applyPlan,
  connection,
  packState,
  packError,
  prConfirmed,
  prState,
  prError,
  prResult,
  manifestPreview,
  baseline,
  verificationResult,
  baselineSavedForCurrentPlan,
  onDownloadPack,
  onSaveBaseline,
  onDiscardBaseline,
  onPrConfirmedChange,
  onCreatePr,
}: {
  applyPlan: OptimizationApplyPlan | null;
  connection: GitHubConnectionState;
  packState: 'idle' | 'building' | 'downloaded' | 'error';
  packError: string;
  prConfirmed: boolean;
  prState: 'idle' | 'creating' | 'created' | 'error';
  prError: string;
  prResult: { url: string; branchName: string } | null;
  manifestPreview: string;
  baseline?: RepositoryVerificationBaseline | null;
  verificationResult?: RepositoryVerificationResult | null;
  baselineSavedForCurrentPlan: boolean;
  onDownloadPack: () => void;
  onSaveBaseline: () => void;
  onDiscardBaseline?: () => void;
  onPrConfirmedChange: (confirmed: boolean) => void;
  onCreatePr: () => void;
}) {
  if (!applyPlan) return null;
  const prPreview = applyPlan.prPreview;
  const canCreatePr = prPreview.canUseGitHubApp && prConfirmed && prState !== 'creating';
  const reviewCount = applyPlan.summary.reviewRequiredCount;
  const blockedCount = applyPlan.summary.blockedCount;

  return (
    <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]" aria-label="Optimization Apply Flow">
      <section className="rounded-2xl border border-primary/20 bg-background/20 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Optimization Pack ZIP</div>
            <h4 className="mt-1 font-display text-lg font-semibold">Download review package</h4>
          </div>
          <Badge variant="outline" className={blockedCount > 0 ? 'border-warning/50 text-warning' : reviewCount > 0 ? 'border-primary/35 text-primary-glow' : 'border-success/40 text-success'}>
            {applyPlan.summary.zipFileCount} files
          </Badge>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <OptimizationPlanMetric label="Ready" value={applyPlan.summary.readyCount} />
          <OptimizationPlanMetric label="Review" value={reviewCount} />
          <OptimizationPlanMetric label="Blocked" value={blockedCount} />
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Includes selected artifacts, `optimization-manifest.json`, `APPLY_INSTRUCTIONS.md` and `REVIEW_NOTES.md`.
        </p>
        <Button
          type="button"
          size="sm"
          onClick={onDownloadPack}
          disabled={packState === 'building'}
          className="mt-4 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Download className="mr-2 h-4 w-4" />
          {packState === 'building' ? 'Preparing ZIP' : 'Download Optimization Pack'}
        </Button>
        <div className="mt-3 min-h-5 text-xs" aria-live="polite">
          {packState === 'downloaded' && <span className="text-success">Package downloaded. Review before copying files into the repository.</span>}
          {packState === 'error' && <span className="text-warning">{packError}</span>}
          {packState === 'idle' && <span className="text-muted-foreground">This download does not modify the repository.</span>}
        </div>
      </section>

      <section className="rounded-2xl border border-primary/20 bg-background/20 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">GitHub PR Preview</div>
            <h4 className="mt-1 font-display text-lg font-semibold">Create through GitHub App</h4>
          </div>
          <Badge variant="outline" className={prPreview.canUseGitHubApp ? 'border-success/40 text-success' : 'border-border/60 text-muted-foreground'}>
            {prPreview.canUseGitHubApp ? 'Available' : 'Manual fallback'}
          </Badge>
        </div>

        <div className="mt-4 grid gap-2 text-sm">
          <Row label="Repository" value={connection.owner && connection.repo ? `${connection.owner}/${connection.repo}` : 'Not connected'} />
          <Row label="Branch" value={prPreview.branchName} />
          <Row label="Title" value={prPreview.title} />
          <Row label="Files in PR" value={`${prPreview.files.length}`} />
          <Row label="Review-required" value={`${prPreview.reviewRequiredFiles.length}`} />
          <Row label="Blocked" value={`${prPreview.blockedFiles.length}`} />
        </div>

        {prPreview.canUseGitHubApp ? (
          <div className="mt-4 space-y-3">
            <label className="flex gap-3 rounded-2xl border border-border/55 bg-secondary/15 p-3 text-sm">
              <input
                type="checkbox"
                checked={prConfirmed}
                onChange={event => onPrConfirmedChange(event.target.checked)}
                className="mt-1 h-4 w-4 accent-primary"
              />
              <span>
                I understand ShipSeal will open a Pull Request only after this confirmation. Human review is still required.
              </span>
            </label>
            <Button type="button" size="sm" onClick={onCreatePr} disabled={!canCreatePr} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {prState === 'creating' ? 'Creating PR' : 'Create GitHub PR'}
            </Button>
            <div className="min-h-5 text-xs" aria-live="polite">
              {prState === 'created' && prResult && (
                <span className="text-success">
                  PR created on `{prResult.branchName}`. <a href={prResult.url} className="underline underline-offset-4" target="_blank" rel="noreferrer">Open pull request</a>
                </span>
              )}
              {prState === 'error' && <span className="text-warning">{prError}</span>}
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-border/55 bg-secondary/15 p-3 text-sm text-muted-foreground">
            <p>{prPreview.unavailableReason}</p>
            <p className="mt-2">Use the Optimization Pack ZIP and manual git flow, or reconnect with the GitHub App and rescan the selected repository.</p>
          </div>
        )}

        <details className="mt-4 rounded-2xl border border-border/55 bg-secondary/15 p-4">
          <summary className="cursor-pointer select-none text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Diff preview
          </summary>
          <div className="mt-3 space-y-3">
            {prPreview.files.slice(0, 8).map(file => <OptimizationPrFilePreview key={file.path} file={file} />)}
            {prPreview.files.length === 0 && <p className="text-sm text-muted-foreground">No PR-ready files are selected.</p>}
          </div>
        </details>
      </section>

      <RepositoryVerificationPanel
        applyPlan={applyPlan}
        baseline={baseline}
        verificationResult={verificationResult}
        baselineSavedForCurrentPlan={baselineSavedForCurrentPlan}
        onSaveBaseline={onSaveBaseline}
        onDiscardBaseline={onDiscardBaseline}
      />

      <details className="xl:col-span-2 rounded-2xl border border-border/55 bg-secondary/15 p-4">
        <summary className="cursor-pointer select-none text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Manifest and apply instructions
        </summary>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-black/25 p-3 text-[11px] leading-relaxed text-muted-foreground">
            {JSON.stringify(applyPlan.manifest, null, 2)}
          </pre>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-black/25 p-3 text-[11px] leading-relaxed text-muted-foreground">
            {applyPlan.applyInstructions}
          </pre>
        </div>
        <details className="mt-3 rounded-xl border border-border/45 bg-background/20 p-3">
          <summary className="cursor-pointer select-none text-xs font-semibold text-muted-foreground">Source Optimization Plan manifest</summary>
          <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap rounded-xl bg-black/25 p-3 text-[11px] leading-relaxed text-muted-foreground">
            {manifestPreview}
          </pre>
        </details>
      </details>
    </div>
  );
}

function RepositoryVerificationPanel({
  applyPlan,
  baseline,
  verificationResult,
  baselineSavedForCurrentPlan,
  onSaveBaseline,
  onDiscardBaseline,
}: {
  applyPlan: OptimizationApplyPlan;
  baseline?: RepositoryVerificationBaseline | null;
  verificationResult?: RepositoryVerificationResult | null;
  baselineSavedForCurrentPlan: boolean;
  onSaveBaseline: () => void;
  onDiscardBaseline?: () => void;
}) {
  const hasMatchingRescan = verificationResult?.status === 'matched-rescan';
  const hasMismatch = verificationResult?.status === 'repository-mismatch';
  const sameScanBaseline = verificationResult?.status === 'baseline-scan';

  return (
    <section className="xl:col-span-2 rounded-2xl border border-primary/20 bg-background/20 p-4" aria-label="Rescan Verification">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Rescan Verification</div>
          <h4 className="mt-1 font-display text-lg font-semibold">Verify after a later scan</h4>
        </div>
        <Badge variant="outline" className={hasMatchingRescan ? 'border-success/40 text-success' : hasMismatch ? 'border-warning/50 text-warning' : 'border-border/60 text-muted-foreground'}>
          {hasMatchingRescan ? 'After rescan' : hasMismatch ? 'Baseline mismatch' : baseline ? 'Baseline saved' : 'No baseline'}
        </Badge>
      </div>

      {!baseline && (
        <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <p className="text-sm text-muted-foreground">
            Download or create a PR, then rescan to verify. Verification requires a later scan of the changed repository.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={onSaveBaseline} className="border-primary/35 bg-primary/10 text-primary-glow hover:text-primary-glow">
            Save verification baseline
          </Button>
        </div>
      )}

      {baseline && !hasMatchingRescan && !hasMismatch && (
        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="text-sm text-muted-foreground">
            <p>Baseline scan saved for {baseline.artifacts.length.toLocaleString()} selected artifacts.</p>
            <p className="mt-1">Apply reviewed changes outside ShipSeal, then scan this repository again.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!baselineSavedForCurrentPlan && (
              <Button type="button" variant="outline" size="sm" onClick={onSaveBaseline} className="border-primary/35 bg-primary/10 text-primary-glow hover:text-primary-glow">
                Save current baseline
              </Button>
            )}
            {onDiscardBaseline && (
              <Button type="button" variant="ghost" size="sm" onClick={onDiscardBaseline}>
                Discard baseline
              </Button>
            )}
          </div>
          {sameScanBaseline && (
            <p className="lg:col-span-2 text-xs text-muted-foreground">
              Current scan is the baseline scan. No after-rescan verification is shown yet.
            </p>
          )}
        </div>
      )}

      {hasMismatch && verificationResult && (
        <div className="mt-4 rounded-2xl border border-warning/35 bg-warning/10 p-4 text-sm text-warning/90">
          <p className="font-medium">This scan does not match the saved optimization baseline.</p>
          <ul className="mt-2 space-y-1">
            {verificationResult.repositoryMatch.reasons.map(reason => <li key={reason}>{reason}</li>)}
          </ul>
          {onDiscardBaseline && (
            <Button type="button" variant="outline" size="sm" onClick={onDiscardBaseline} className="mt-3 border-warning/45 bg-background/20 text-warning hover:text-warning">
              Discard baseline
            </Button>
          )}
        </div>
      )}

      {hasMatchingRescan && verificationResult && (
        <div className="mt-4 space-y-4">
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <OptimizationPlanMetric label="Detected" value={verificationResult.counts.detected} />
            <OptimizationPlanMetric label="Content match" value={verificationResult.counts.contentMatched} />
            <OptimizationPlanMetric label="Review" value={verificationResult.counts.needsReview} />
            <OptimizationPlanMetric label="Missing" value={verificationResult.counts.missing} />
            <OptimizationPlanMetric label="Static limit" value={verificationResult.counts.notVerifiable} />
            <OptimizationPlanMetric label="Blocked" value={verificationResult.counts.blocked} />
          </div>
          <p className="text-sm text-muted-foreground">
            Projected before apply is separate from verified after rescan. ShipSeal only reports what the current scan detected.
          </p>
          {verificationResult.metrics.length > 0 && (
            <details className="rounded-2xl border border-border/55 bg-secondary/15 p-4">
              <summary className="cursor-pointer select-none text-sm font-semibold">Observed workspace metrics</summary>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {verificationResult.metrics.map(metric => (
                  <div key={metric.id} className="rounded-xl border border-border/45 bg-background/20 p-3">
                    <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">{metric.label}</div>
                    <div className="mt-1 text-sm text-foreground">{metric.baseline} to {metric.current}</div>
                    <div className="mt-1 text-xs text-muted-foreground">Changed since baseline: {metric.delta !== null && metric.delta > 0 ? '+' : ''}{metric.delta}</div>
                  </div>
                ))}
              </div>
            </details>
          )}
          <details open className="rounded-2xl border border-border/55 bg-secondary/15 p-4">
            <summary className="cursor-pointer select-none text-sm font-semibold">Artifact verification details</summary>
            <div className="mt-3 space-y-2">
              {verificationResult.artifacts.map(artifact => <RepositoryVerificationArtifactRow key={`${artifact.generatedPath}:${artifact.destinationPath}`} artifact={artifact} />)}
            </div>
          </details>
        </div>
      )}

      {applyPlan.summary.selectedArtifactCount === 0 && (
        <p className="mt-3 text-xs text-muted-foreground">No selected artifacts are available for a verification baseline.</p>
      )}
    </section>
  );
}

function RepositoryVerificationArtifactRow({ artifact }: { artifact: VerifiedArtifactMatch }) {
  return (
    <article className="rounded-xl border border-border/45 bg-background/20 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 flex-1 break-all text-sm font-medium text-foreground">{artifact.destinationPath}</span>
        <Badge variant="outline" className={verificationStateClass(artifact.state)}>{artifact.label}</Badge>
        <Badge variant="outline" className="border-border/60 text-muted-foreground">{optimizationActionLabel(artifact.action)}</Badge>
      </div>
      <div className="mt-2 grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
        <Row label="Generated path" value={artifact.generatedPath} />
        <Row label="Previous state" value={artifact.previousState} />
        <Row label="Current scan" value={artifact.currentScanState} />
        <Row label="Content match" value={artifact.contentMatch} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{artifact.reason}</p>
      <p className="mt-1 text-xs text-muted-foreground">{artifact.recommendedNextAction}</p>
    </article>
  );
}

function OptimizationPrFilePreview({ file }: { file: OptimizationPrPreviewFile }) {
  return (
    <article className="rounded-xl border border-border/45 bg-background/20 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 flex-1 break-all text-sm font-medium">{file.path}</span>
        <Badge variant="outline" className={optimizationReadinessClass(file.readiness)}>
          {optimizationReadinessLabel(file.readiness)}
        </Badge>
        <Badge variant="outline" className="border-border/60 text-muted-foreground">
          {optimizationActionLabel(file.action)}
        </Badge>
      </div>
      <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded-lg bg-black/20 p-2 text-[11px] text-muted-foreground">
        {file.excerpt || 'No preview available.'}
      </pre>
    </article>
  );
}

function OptimizationPlanArtifactDetail({
  item,
  proposals,
  excludedProposalIds,
  onToggleProposalIncluded,
}: {
  item: RepositoryOptimizationPlanItem | null;
  proposals: RepositoryTransformationProposal[];
  excludedProposalIds: Set<string>;
  onToggleProposalIncluded: (proposalId: string) => void;
}) {
  if (!item) {
    return (
      <aside className="rounded-2xl border border-border/55 bg-secondary/15 p-5 text-sm text-muted-foreground">
        Select an artifact to inspect evidence, destination and generated content.
      </aside>
    );
  }

  const relatedProposals = proposals
    .filter(proposal => proposal.artifactActions.some(action => action.path === item.artifact.path))
    .sort((left, right) => left.title.localeCompare(right.title));
  const activeRelatedProposals = relatedProposals.filter(proposal => !excludedProposalIds.has(proposal.id));
  const excludedRelatedProposals = relatedProposals.filter(proposal => excludedProposalIds.has(proposal.id));

  return (
    <aside className="rounded-2xl border border-primary/15 bg-background/25 p-5" aria-labelledby="optimization-artifact-heading">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={optimizationReadinessClass(item.readiness)}>
          {optimizationReadinessLabel(item.readiness)}
        </Badge>
        <Badge variant="outline" className="border-border/60 text-muted-foreground">{optimizationActionLabel(item.artifact.action)}</Badge>
        <Badge variant="outline" className={item.confidence === 'low' ? 'border-warning/45 text-warning' : 'border-primary/30 text-muted-foreground'}>
          {item.confidence} confidence
        </Badge>
      </div>

      <h4 id="optimization-artifact-heading" className="mt-3 break-words font-display text-lg font-semibold">{item.title}</h4>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.purpose}</p>

      <div className="mt-4 grid gap-2 text-sm">
        <Row label="Generated path" value={item.artifact.path} />
        <Row label="Future destination" value={item.artifact.repositoryDestinationPath} />
        <Row label="Generator" value={item.artifact.generatorId} />
        <Row label="Contributors" value={item.proposalIds.join(', ')} />
      </div>

      <details open className="mt-4 rounded-2xl border border-border/55 bg-secondary/15 p-4">
        <summary className="cursor-pointer select-none text-sm font-semibold">Contributing proposals</summary>
        <div className="mt-3 space-y-2">
          {activeRelatedProposals.map(proposal => (
            <div key={proposal.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/45 bg-background/20 px-3 py-2">
              <div className="min-w-0">
                <div className="break-words text-sm font-medium text-foreground">{proposal.title}</div>
                <div className="text-xs text-muted-foreground">{transformationDomainLabel(proposal.domain)}</div>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => onToggleProposalIncluded(proposal.id)} className="border-border/60 bg-background/25">
                Remove from plan
              </Button>
            </div>
          ))}
          {excludedRelatedProposals.map(proposal => (
            <div key={proposal.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/45 bg-background/10 px-3 py-2 opacity-85">
              <div className="min-w-0">
                <div className="break-words text-sm font-medium text-muted-foreground">{proposal.title}</div>
                <div className="text-xs text-muted-foreground">Excluded from current plan</div>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => onToggleProposalIncluded(proposal.id)} className="border-primary/35 bg-primary/10 text-primary-glow hover:text-primary-glow">
                Add back to plan
              </Button>
            </div>
          ))}
        </div>
      </details>

      <details open className="mt-4 rounded-2xl border border-border/55 bg-secondary/15 p-4">
        <summary className="cursor-pointer select-none text-sm font-semibold">Scan evidence</summary>
        <ul className="mt-3 space-y-2">
          {item.evidenceReferences.slice(0, 6).map(evidence => (
            <li key={`${evidence.state}:${evidence.label}:${evidence.detail || ''}`} className="rounded-xl border border-border/45 bg-background/20 px-3 py-2">
              <div className="text-sm font-medium text-foreground">{evidence.label}</div>
              {evidence.detail && <div className="mt-1 text-xs text-muted-foreground">{evidence.detail}</div>}
            </li>
          ))}
        </ul>
      </details>

      <details className="mt-3 rounded-2xl border border-border/55 bg-secondary/15 p-4">
        <summary className="cursor-pointer select-none text-sm font-semibold">Affected repository areas</summary>
        <div className="mt-3 flex flex-wrap gap-2">
          {item.affectedCurrentEntities.length > 0 ? item.affectedCurrentEntities.slice(0, 8).map(entity => (
            <span key={`${entity.source}:${entity.id}`} className="rounded-full border border-border/50 bg-background/20 px-2.5 py-1 text-[11px] text-muted-foreground">
              {entity.path || entity.label}
            </span>
          )) : (
            <span className="text-sm text-muted-foreground">No specific repository entity was mapped.</span>
          )}
        </div>
      </details>

      <details className="mt-3 rounded-2xl border border-border/55 bg-secondary/15 p-4">
        <summary className="cursor-pointer select-none text-sm font-semibold">Expected agent behavior</summary>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          {item.expectedAgentBehavior.map(text => <li key={text}>{text}</li>)}
        </ul>
      </details>

      <details className="mt-3 rounded-2xl border border-border/55 bg-secondary/15 p-4">
        <summary className="cursor-pointer select-none text-sm font-semibold">Generated content outline</summary>
        <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
          {item.artifact.outline.map(line => <li key={line} className="break-words">{line}</li>)}
        </ul>
      </details>

      <details className="mt-3 rounded-2xl border border-border/55 bg-secondary/15 p-4">
        <summary className="cursor-pointer select-none text-sm font-semibold">Real generated content preview</summary>
        <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-black/25 p-3 text-[11px] leading-relaxed text-muted-foreground">
          {item.artifact.excerpt || 'Generated content could not be prepared for this artifact.'}
        </pre>
      </details>

      {item.conflicts.length > 0 && (
        <details open className="mt-3 rounded-2xl border border-warning/35 bg-warning/10 p-4">
          <summary className="cursor-pointer select-none text-sm font-semibold text-warning">Conflict and review state</summary>
          <ul className="mt-3 space-y-2">
            {item.conflicts.map(conflict => (
              <li key={`${conflict.kind}:${conflict.paths.join('|')}`} className="text-sm text-warning/90">
                <span className="font-medium">{optimizationConflictLabel(conflict.kind)}:</span> {conflict.explanation}
              </li>
            ))}
          </ul>
        </details>
      )}
    </aside>
  );
}

function AtlasFilterButton({
  label,
  count,
  active,
  zeroDescription,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  zeroDescription: string;
  onClick: () => void;
}) {
  const unavailable = count === 0;
  const state = unavailable ? zeroDescription : active ? 'Matching entities are visible.' : 'Matching entities are hidden.';
  const descriptionId = `repository-filter-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-disabled={unavailable}
      aria-label={label}
      aria-describedby={descriptionId}
      title={state}
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        unavailable
          ? 'border-border/35 bg-background/10 text-muted-foreground/45'
          : active
            ? 'border-primary/40 bg-primary/10 text-primary-glow'
            : 'border-border/55 bg-background/20 text-muted-foreground'
      }`}
    >
      <span>{label}</span>
      <span className="ml-1.5 text-[10px] opacity-70" aria-hidden="true">{count.toLocaleString()}</span>
      <span id={descriptionId} className="sr-only">{count.toLocaleString()} matching entities. {state}</span>
    </button>
  );
}

function TransformationDomainButton({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={`${label}, ${count.toLocaleString()} proposals`}
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        active ? 'border-primary/40 bg-primary/10 text-primary-glow' : 'border-border/55 bg-background/20 text-muted-foreground hover:text-foreground'
      }`}
    >
      {label}
      <span className="ml-1.5 text-[10px] opacity-70">{count.toLocaleString()}</span>
    </button>
  );
}

function TransformationInspector({
  proposal,
  included,
  collapsed = false,
  onToggleCollapsed,
  onToggleIncluded,
  onClear,
}: {
  proposal: RepositoryTransformationProposal;
  included: boolean;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  onToggleIncluded: () => void;
  onClear: () => void;
}) {
  if (collapsed) {
    return (
      <aside className="rounded-[1.5rem] border border-primary/15 bg-background/25 p-4" aria-labelledby="transformation-inspector-collapsed">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">With ShipSeal</div>
            <h3 id="transformation-inspector-collapsed" className="mt-1 truncate font-display text-base font-semibold">{proposal.title}</h3>
            <p className="mt-1 text-xs text-muted-foreground">Proposed - not yet applied</p>
          </div>
          {onToggleCollapsed && (
            <Button type="button" variant="ghost" size="sm" onClick={onToggleCollapsed} aria-label="Expand inspector">
              <PanelRightOpen className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </aside>
    );
  }

  return (
    <aside className="rounded-[1.5rem] border border-primary/15 bg-background/25 p-5" aria-labelledby="transformation-inspector-heading">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="border-primary/45 text-primary-glow">Proposed</Badge>
        <Badge variant="outline" className="border-border/60 text-muted-foreground">{transformationDomainLabel(proposal.domain)}</Badge>
        <Badge variant="outline" className={proposal.confidence === 'low' ? 'border-warning/45 text-warning' : 'border-primary/30 text-muted-foreground'}>
          {proposal.confidence} confidence
        </Badge>
        {onToggleCollapsed && (
          <Button type="button" variant="ghost" size="sm" onClick={onToggleCollapsed} className="ml-auto" aria-label="Collapse inspector">
            <PanelRightClose className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <h3 id="transformation-inspector-heading" className="mt-3 font-display text-xl font-semibold">{proposal.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{proposal.summary}</p>
      <p className="mt-3 rounded-2xl border border-primary/25 bg-primary/10 px-3 py-2 text-xs text-primary-glow">
        Status: Proposed - not yet applied. Generated after approval.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onToggleIncluded} className="border-primary/35 bg-primary/10 text-primary-glow hover:text-primary-glow">
          {included ? 'Remove from plan' : 'Add to optimization plan'}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onClear}>
          Return to repository entity
        </Button>
      </div>

      <div className="mt-5 space-y-4 text-sm">
        <section>
          <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Why ShipSeal recommends this</h4>
          <ul className="mt-2 space-y-2">
            {proposal.sourceEvidence.map(item => (
              <li key={`${item.label}:${item.detail}`} className="rounded-2xl border border-border/45 bg-background/25 px-3 py-2">
                <div className="font-medium text-foreground">{item.label}</div>
                {item.detail && <div className="mt-1 text-xs text-muted-foreground">{item.detail}</div>}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">What ShipSeal would create or update</h4>
          <div className="mt-2 space-y-2">
            {proposal.artifactActions.map(action => (
              <details key={action.path} className="rounded-2xl border border-border/45 bg-background/25 px-3 py-2">
                <summary className="cursor-pointer list-none font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {action.action} - {action.path}
                </summary>
                <p className="mt-2 text-xs text-muted-foreground">{action.description}</p>
                {action.preview && (
                  <div className="mt-3 rounded-xl border border-border/40 bg-background/35 p-3">
                    <div className="text-xs font-medium text-foreground">Preview from existing generator</div>
                    <div className="mt-2 text-xs text-muted-foreground">{action.preview.outline.slice(0, 4).join(' / ')}</div>
                    <pre className="mt-3 max-h-44 overflow-auto whitespace-pre-wrap rounded-lg bg-black/25 p-3 text-[11px] leading-relaxed text-muted-foreground">{action.preview.excerpt}</pre>
                  </div>
                )}
              </details>
            ))}
          </div>
        </section>

        <section>
          <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Where it connects</h4>
          <p className="mt-2 text-muted-foreground">{proposal.graphChanges.affectedExistingNodeIds.length.toLocaleString()} current repository entities are connected by proposed relationships.</p>
        </section>

        <section>
          <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">How an AI agent would use it</h4>
          <p className="mt-2 text-muted-foreground">{proposal.expectedEffect.agentBehavior}</p>
          <p className="mt-2 text-muted-foreground">{proposal.expectedEffect.repositoryMeaning}</p>
        </section>
      </div>
    </aside>
  );
}

function RepositoryUniverseLoading({ onOpenAtlas }: { onOpenAtlas: () => void }) {
  return (
    <div className="grid h-full min-h-[560px] place-items-center rounded-[1.5rem] border border-primary/15 bg-[#050914] p-8 text-center">
      <div className="max-w-md">
        <div className="font-display text-xl font-semibold">Opening Repository Universe</div>
        <p className="mt-2 text-sm text-muted-foreground">Preparing the WebGL knowledge space. Your scan is already available.</p>
        <Button type="button" variant="outline" size="sm" onClick={onOpenAtlas} className="mt-5 border-primary/35 bg-primary/10 text-primary-glow hover:text-primary-glow">
          Open Atlas 2D
        </Button>
      </div>
    </div>
  );
}

function RepositoryUniverseRecovery({ onOpenAtlas, onRetry }: { onOpenAtlas: () => void; onRetry: () => void }) {
  return (
    <div className="grid h-full min-h-[560px] place-items-center rounded-[1.5rem] border border-primary/15 bg-[#050914] p-8 text-center">
      <div className="max-w-md rounded-3xl border border-primary/20 bg-background/35 p-6 shadow-sm shadow-primary/10">
        <div className="font-display text-xl font-semibold">Repository Universe could not be rendered.</div>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Your scan and repository evidence are still available. Continue in Atlas 2D or retry the 3D view.
        </p>
        <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={onOpenAtlas} className="border-primary/35 bg-primary/10 text-primary-glow hover:text-primary-glow">
            Open Atlas 2D
          </Button>
          <Button type="button" variant="ghost" onClick={onRetry}>
            Retry Universe
          </Button>
        </div>
      </div>
    </div>
  );
}

function UniverseInspector({
  universe,
  node,
  nodeHiddenByFilters = false,
  cluster,
  activeChapter,
  repositoryName,
  scanSummary,
  rootNodeId,
  collapsed = false,
  onToggleCollapsed,
  onFocusNode,
  onFocusCluster,
  onClearFocus,
  onReturnRepository,
  onOpenAtlas,
  onSelectNode,
}: {
  universe: RepositoryUniverseModel;
  node?: RepositoryUniverseNode;
  nodeHiddenByFilters?: boolean;
  cluster?: RepositoryUniverseModel['clusters'][number] | null;
  activeChapter: WorkspaceStoryChapter | null;
  repositoryName: string;
  scanSummary: {
    sourceLabel: string;
    analyzedFiles: number;
    clusterCount: number;
  };
  rootNodeId: string;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  onFocusNode: () => void;
  onFocusCluster: () => void;
  onClearFocus: () => void;
  onReturnRepository: () => void;
  onOpenAtlas: () => void;
  onSelectNode: (node: RepositoryUniverseNode) => void;
}) {
  const isRepositoryOverview = !node || node.id === rootNodeId || node.kind === 'repository';
  const relationships = node ? universe.edges.filter(edge => edge.source === node.id || edge.target === node.id) : [];
  const relatedNodes = relationships
    .map(edge => universe.nodes.find(item => item.id === (edge.source === node?.id ? edge.target : edge.source)))
    .filter(Boolean) as RepositoryUniverseNode[];
  const sameFolderNodes = node?.metadata.directory
    ? universe.nodes.filter(item => item.kind === 'file' && item.id !== node.id && item.metadata.directory === node.metadata.directory).slice(0, 8)
    : [];
  const clusterNodes = cluster ? cluster.nodeIds.map(id => universe.nodes.find(item => item.id === id)).filter(Boolean).slice(0, 8) as RepositoryUniverseNode[] : [];

  if (collapsed) {
    return (
      <aside className="rounded-[1.5rem] border border-primary/15 bg-background/25 p-4" aria-labelledby="universe-inspector-heading-collapsed">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{isRepositoryOverview ? 'Repository overview' : 'Selected entity'}</div>
            <h3 id="universe-inspector-heading-collapsed" className="mt-1 truncate font-display text-base font-semibold">{isRepositoryOverview ? repositoryName : node?.label || 'Repository Universe'}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{isRepositoryOverview ? `${scanSummary.analyzedFiles.toLocaleString()} files analyzed` : node ? `${universeKindLabel(node.kind)} - ${relationships.length} relationships` : 'No entity selected'}</p>
          </div>
          {onToggleCollapsed && (
            <Button type="button" variant="ghost" size="sm" onClick={onToggleCollapsed} aria-label="Expand inspector">
              <PanelRightOpen className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </aside>
    );
  }

  return (
    <aside className="rounded-[1.5rem] border border-primary/15 bg-background/25 p-5" aria-labelledby="universe-inspector-heading">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={node?.evidenceType === 'evidence' ? 'border-primary/40 text-primary-glow' : node?.evidenceType === 'missing' ? 'border-warning/50 text-warning' : 'border-border/70 text-muted-foreground'}>
          {node ? evidenceStateLabel(node.evidenceType) : 'Entity'}
        </Badge>
        {node?.importance && (
          <Badge variant="outline" className="border-border/60 text-muted-foreground">
            {node.importance}
          </Badge>
        )}
        {activeChapter && (
          <Badge variant="outline" className="border-accent/40 text-accent">
            {activeChapter.shortLabel}
          </Badge>
        )}
        {onToggleCollapsed && (
          <Button type="button" variant="ghost" size="sm" onClick={onToggleCollapsed} className="ml-auto" aria-label="Collapse inspector">
            <PanelRightClose className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <h3 id="universe-inspector-heading" className="mt-3 font-display text-xl font-semibold">{isRepositoryOverview ? 'Repository overview' : 'Selected entity'}</h3>
      <div className="mt-2 break-words text-lg font-semibold text-foreground">{isRepositoryOverview ? repositoryName : node?.label || 'Repository Universe'}</div>
      {node?.path && <p className="mt-1 break-all text-xs text-muted-foreground">{node.path}</p>}
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {isRepositoryOverview
          ? 'ShipSeal mapped the scan boundary, major clusters and evidence signals into a navigable AI workspace. Select a file, folder or knowledge node to inspect the local evidence.'
          : String(node?.metadata.repositoryRole || 'Select a file, folder or knowledge node to inspect how ShipSeal understands it.')}
      </p>
      {nodeHiddenByFilters && (
        <p className="mt-3 rounded-2xl border border-warning/35 bg-warning/10 px-3 py-2 text-xs text-warning">
          This entity is selected but hidden by the current filters. Re-enable its type or evidence state to show it in the Universe.
        </p>
      )}
      {node && (node.evidenceType === 'missing' || node.kind === 'recommendation') && (
        <p className="mt-3 rounded-2xl border border-warning/35 bg-warning/10 px-3 py-2 text-xs text-warning">
          Proposed entity. This does not currently exist as a repository file in the scan.
        </p>
      )}

      <div className="mt-4 grid gap-2 text-sm">
        <Row label="Type" value={node ? universeKindLabel(node.kind) : 'n/a'} />
        <Row label="Cluster" value={cluster?.label || 'Repository'} />
        {isRepositoryOverview && <Row label="Scan boundary" value={scanSummary.sourceLabel} />}
        {isRepositoryOverview && <Row label="Analyzed files" value={scanSummary.analyzedFiles.toLocaleString()} />}
        {isRepositoryOverview && <Row label="Main clusters" value={scanSummary.clusterCount.toLocaleString()} />}
        <Row label="Category" value={String(node?.metadata.category || 'n/a')} />
        <Row label="Parent folder" value={String(node?.metadata.directory || 'root')} />
        <Row label="Relationships" value={String(relationships.length)} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onFocusNode} disabled={!node} className="border-border/60 bg-background/20">
          Focus node
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onFocusCluster} disabled={!node?.clusterId} className="border-border/60 bg-background/20">
          Focus cluster
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onReturnRepository}>
          Return to repository
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onOpenAtlas}>
          Open in 2D Atlas
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onClearFocus}>
          Clear focus
        </Button>
      </div>

      {cluster && (
        <details open className="mt-5 rounded-2xl border border-border/55 bg-secondary/15 p-4">
          <summary className="cursor-pointer select-none text-sm font-semibold">Focused cluster</summary>
          <p className="mt-2 text-sm text-muted-foreground">{cluster.summary}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {clusterNodes.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectNode(item)}
                className="rounded-full border border-border/55 bg-background/25 px-2.5 py-1 text-[11px] text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {shortAtlasLabel(item.label)}
              </button>
            ))}
          </div>
        </details>
      )}

      <details open className="mt-3 rounded-2xl border border-border/55 bg-secondary/15 p-4">
        <summary className="cursor-pointer select-none text-sm font-semibold">Evidence</summary>
        <ul className="mt-3 space-y-2">
          {(node?.evidenceItems || []).slice(0, 5).map((item, index) => (
            <li key={`${item.state}-${item.label}-${index}`} className="text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="break-all text-foreground/90">{item.label}</span>
                <Badge variant="outline" className={evidenceStateClass(item.state)}>
                  {evidenceStateLabel(item.state)}
                </Badge>
              </div>
              {item.detail && <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>}
            </li>
          ))}
        </ul>
      </details>

      <details className="mt-3 rounded-2xl border border-border/55 bg-secondary/15 p-4">
        <summary className="cursor-pointer select-none text-sm font-semibold">Connected repository entities</summary>
        <div className="mt-3 space-y-2">
          {relationships.length ? relationships.slice(0, 8).map(edge => {
            const related = relatedNodes.find(item => item.id === (edge.source === node?.id ? edge.target : edge.source));
            return (
              <button
                key={edge.id}
                type="button"
                onClick={() => related && onSelectNode(related)}
                className="block w-full rounded-xl border border-border/50 bg-background/20 p-3 text-left text-sm transition hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="font-medium text-foreground">{related?.label || 'Related entity'}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{relationshipLabel(edge)} - {edge.evidenceType}</span>
              </button>
            );
          }) : (
            <p className="text-sm text-muted-foreground">No direct relationship selected.</p>
          )}
        </div>
      </details>

      {sameFolderNodes.length > 0 && (
        <details className="mt-3 rounded-2xl border border-border/55 bg-secondary/15 p-4">
          <summary className="cursor-pointer select-none text-sm font-semibold">Same folder</summary>
          <div className="mt-3 flex flex-wrap gap-2">
            {sameFolderNodes.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectNode(item)}
                className="rounded-full border border-border/55 bg-background/25 px-2.5 py-1 text-[11px] text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {shortAtlasLabel(item.label)}
              </button>
            ))}
          </div>
        </details>
      )}

      <details className="mt-3 rounded-2xl border border-border/55 bg-secondary/15 p-4">
        <summary className="cursor-pointer select-none text-sm font-semibold">Agent relevance</summary>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{String(node?.metadata.agentRelevance || 'No agent-specific relevance surfaced for this entity.')}</p>
        {node?.metadata.dnaDimensionId && <p className="mt-2 text-xs text-muted-foreground">DNA: {String(node.metadata.dnaDimensionId)}</p>}
        {Array.isArray(node?.metadata.simulatorStepIds) && <p className="mt-1 text-xs text-muted-foreground">Simulator: {node.metadata.simulatorStepIds.join(', ')}</p>}
      </details>
    </aside>
  );
}

function AtlasInspector({
  atlas,
  node,
  cluster,
  activeChapter,
  collapsed = false,
  onToggleCollapsed,
  onFocusCluster,
  onClearFocus,
  onSelectNode,
}: {
  atlas: RepositoryAtlasModel;
  node?: RepositoryAtlasNode;
  cluster?: RepositoryKnowledgeCluster | null;
  activeChapter: WorkspaceStoryChapter | null;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  onFocusCluster: () => void;
  onClearFocus: () => void;
  onSelectNode: (node: RepositoryAtlasNode) => void;
}) {
  const relationships = node ? atlas.edges.filter(edge => edge.source === node.id || edge.target === node.id) : [];
  const relatedNodes = relationships
    .map(edge => atlas.nodes.find(item => item.id === (edge.source === node?.id ? edge.target : edge.source)))
    .filter(Boolean) as RepositoryAtlasNode[];
  const clusterNodes = cluster ? cluster.nodeIds.map(id => atlas.nodes.find(node => node.id === id)).filter(Boolean) as RepositoryAtlasNode[] : [];

  if (collapsed) {
    return (
      <aside className="rounded-[1.5rem] border border-primary/15 bg-background/25 p-4" aria-labelledby="atlas-inspector-heading-collapsed">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Selected entity</div>
            <h3 id="atlas-inspector-heading-collapsed" className="mt-1 truncate font-display text-base font-semibold">{node?.label || 'Repository Atlas'}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{node ? `${atlasKindLabel(node.kind)} · ${relationships.length} relationships` : 'No entity selected'}</p>
          </div>
          {onToggleCollapsed && (
            <Button type="button" variant="ghost" size="sm" onClick={onToggleCollapsed} aria-label="Expand inspector">
              <PanelRightOpen className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </aside>
    );
  }

  return (
    <aside className="rounded-[1.5rem] border border-primary/15 bg-background/25 p-5" aria-labelledby="atlas-inspector-heading">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={node?.evidenceType === 'evidence' ? 'border-primary/40 text-primary-glow' : node?.evidenceType === 'missing' ? 'border-warning/50 text-warning' : 'border-border/70 text-muted-foreground'}>
          {node ? evidenceStateLabel(node.evidenceType) : 'Entity'}
        </Badge>
        {activeChapter && (
          <Badge variant="outline" className="border-accent/40 text-accent">
            {activeChapter.shortLabel}
          </Badge>
        )}
        {onToggleCollapsed && (
          <Button type="button" variant="ghost" size="sm" onClick={onToggleCollapsed} className="ml-auto" aria-label="Collapse inspector">
            <PanelRightClose className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <h3 id="atlas-inspector-heading" className="mt-3 font-display text-xl font-semibold">Selected entity</h3>
      <div className="mt-2 text-lg font-semibold text-foreground">{node?.label || 'Repository Atlas'}</div>
      {node?.path && <p className="mt-1 break-all text-xs text-muted-foreground">{node.path}</p>}
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{String(node?.metadata.repositoryRole || node?.metadata.summary || 'Select an entity to inspect how ShipSeal connected it.')}</p>

      <div className="mt-4 grid gap-2 text-sm">
        <Row label="Type" value={node ? atlasKindLabel(node.kind) : 'n/a'} />
        <Row label="Cluster" value={clusterLabelForNode(atlas, node)} />
        <Row label="Relationships" value={String(relationships.length)} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onFocusCluster} disabled={!node?.clusterId} className="border-border/60 bg-background/20">
          Focus cluster
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onClearFocus}>
          Clear focus
        </Button>
      </div>

      {cluster && (
        <div className="mt-5 rounded-2xl border border-border/55 bg-secondary/15 p-4">
          <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Focused cluster</div>
          <div className="mt-1 font-display font-semibold text-foreground">{cluster.label}</div>
          <p className="mt-1 text-sm text-muted-foreground">{cluster.summary}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {clusterNodes.slice(0, 5).map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectNode(item)}
                className="rounded-full border border-border/55 bg-background/25 px-2.5 py-1 text-[11px] text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {shortAtlasLabel(item.label)}
              </button>
            ))}
          </div>
        </div>
      )}

      <details open className="mt-5 rounded-2xl border border-border/55 bg-secondary/15 p-4">
        <summary className="cursor-pointer select-none text-sm font-semibold">Evidence</summary>
        <ul className="mt-3 space-y-2">
          {(node?.evidenceItems || []).slice(0, 4).map(item => (
            <li key={`${item.state}-${item.label}`} className="text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="break-all text-foreground/90">{item.label}</span>
                <Badge variant="outline" className={evidenceStateClass(item.state)}>
                  {evidenceStateLabel(item.state)}
                </Badge>
              </div>
              {item.detail && <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>}
            </li>
          ))}
        </ul>
      </details>

      <details className="mt-3 rounded-2xl border border-border/55 bg-secondary/15 p-4">
        <summary className="cursor-pointer select-none text-sm font-semibold">Relationships</summary>
        <div className="mt-3 space-y-2">
          {relationships.length ? relationships.slice(0, 5).map(edge => {
            const related = relatedNodes.find(item => item.id === (edge.source === node?.id ? edge.target : edge.source));
            return (
              <button
                key={edge.id}
                type="button"
                onClick={() => related && onSelectNode(related)}
                className="block w-full rounded-xl border border-border/50 bg-background/20 p-3 text-left text-sm transition hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="font-medium text-foreground">{related?.label || 'Related entity'}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{relationshipLabel(edge)} · {edge.evidenceType}</span>
              </button>
            );
          }) : (
            <p className="text-sm text-muted-foreground">No direct relationship selected.</p>
          )}
        </div>
      </details>

      <details className="mt-3 rounded-2xl border border-border/55 bg-secondary/15 p-4">
        <summary className="cursor-pointer select-none text-sm font-semibold">Agent relevance</summary>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{String(node?.metadata.agentRelevance || 'No agent-specific relevance surfaced for this entity.')}</p>
        {node?.metadata.dnaDimensionId && <p className="mt-2 text-xs text-muted-foreground">DNA: {String(node.metadata.dnaDimensionId)}</p>}
        {Array.isArray(node?.metadata.agentStepIds) && <p className="mt-1 text-xs text-muted-foreground">Simulator: {node.metadata.agentStepIds.join(', ')}</p>}
      </details>
    </aside>
  );
}

function WorkspaceStoryNavigator({
  story,
  activeChapter,
  exploredChapterIds,
  onSelectChapter,
}: {
  story: WorkspaceStory;
  activeChapter: WorkspaceStoryChapter | null;
  exploredChapterIds: WorkspaceStoryChapterId[];
  onSelectChapter: (chapterId: WorkspaceStoryChapterId) => void;
}) {
  if (!story.chapters.length) return null;

  return (
    <nav className="relative mb-5" aria-label="Workspace Story">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Workspace Story</div>
          <p className="mt-1 text-sm text-muted-foreground">Follow the evidence ShipSeal used to understand this repository.</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {story.chapters.map((chapter, index) => {
          const active = chapter.id === activeChapter?.id;
          const explored = exploredChapterIds.includes(chapter.id);
          return (
            <button
              key={chapter.id}
              type="button"
              aria-current={active ? 'step' : undefined}
              onClick={() => onSelectChapter(chapter.id)}
              className={`min-w-0 rounded-full border px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                active
                  ? 'border-primary/55 bg-primary/15 text-primary-glow'
                  : explored
                    ? 'border-success/35 bg-success/5 text-foreground'
                    : 'border-border/60 bg-background/20 text-muted-foreground hover:text-foreground'
              }`}
            >
              <span className="mr-2 text-xs text-muted-foreground">{index + 1}</span>
              <span className="font-medium">{chapter.label}</span>
              <span className="sr-only">{active ? ', selected chapter' : explored ? ', explored chapter' : ''}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function WorkspaceEvidenceTrail({ chapter }: { chapter: WorkspaceStoryChapter }) {
  const primaryEvidence = chapter.evidenceItems.slice(0, 3);
  const secondaryEvidence = chapter.evidenceItems.slice(3);

  return (
    <section className="relative mb-5 rounded-3xl border border-primary/20 bg-background/20 p-5 md:p-6" aria-labelledby="workspace-evidence-trail-heading">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={chapter.evidenceType === 'evidence' ? 'border-primary/40 text-primary-glow' : 'border-border/70 text-muted-foreground'}>
              {chapter.evidenceType === 'evidence' ? 'Evidence-backed' : 'Heuristic'}
            </Badge>
            <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Evidence trail</span>
          </div>
          <h2 id="workspace-evidence-trail-heading" className="mt-3 font-display text-2xl font-semibold">{chapter.label}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{chapter.summary}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <EvidenceTrailBlock title="What ShipSeal found" items={primaryEvidence} />
          <div className="space-y-4">
            <EvidenceTrailText title="Why it is connected" text={chapter.relationship} />
            <EvidenceTrailText title="What it means" text={chapter.repositoryMeaning} />
            <EvidenceTrailText title="How an AI agent uses it" text={chapter.agentUse} />
          </div>
        </div>
      </div>

      {secondaryEvidence.length > 0 && (
        <details className="mt-4 rounded-2xl border border-border/60 bg-secondary/15 p-4">
          <summary className="cursor-pointer select-none text-sm font-medium">More evidence</summary>
          <EvidenceTrailBlock title="Additional signals" items={secondaryEvidence} compact />
        </details>
      )}
    </section>
  );
}

function EvidenceTrailBlock({ title, items, compact = false }: { title: string; items: WorkspaceStoryChapter['evidenceItems']; compact?: boolean }) {
  return (
    <div>
      <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{title}</div>
      <ul className={`mt-3 ${compact ? 'grid gap-2 sm:grid-cols-2' : 'space-y-2'}`}>
        {items.map(item => (
          <li key={`${item.state}-${item.label}`} className="rounded-xl border border-border/50 bg-secondary/15 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="break-all text-sm font-medium text-foreground">{item.label}</span>
              <Badge variant="outline" className={evidenceStateClass(item.state)}>
                {evidenceStateLabel(item.state)}
              </Badge>
            </div>
            {item.detail && <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function EvidenceTrailText({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{title}</div>
      <p className="mt-1 text-sm leading-relaxed text-foreground/90">{text}</p>
    </div>
  );
}

function evidenceStateLabel(state: WorkspaceStoryChapter['evidenceItems'][number]['state']) {
  if (state === 'evidence') return 'Evidence';
  if (state === 'missing') return 'Missing';
  return 'Heuristic';
}

function evidenceStateClass(state: WorkspaceStoryChapter['evidenceItems'][number]['state']) {
  if (state === 'evidence') return 'border-primary/40 text-primary-glow';
  if (state === 'missing') return 'border-warning/50 text-warning';
  return 'border-border/70 text-muted-foreground';
}

function optimizationActionLabel(action: RepositoryOptimizationPlanItem['artifact']['action']) {
  if (action === 'create') return 'Create';
  if (action === 'update') return 'Update';
  if (action === 'strengthen') return 'Strengthen';
  return 'Unavailable';
}

function optimizationReadinessLabel(readiness: RepositoryOptimizationReadiness) {
  if (readiness === 'ready') return 'Ready for package';
  if (readiness === 'review-required') return 'Review required';
  return 'Blocked';
}

function optimizationReadinessClass(readiness: RepositoryOptimizationReadiness) {
  if (readiness === 'ready') return 'border-success/40 text-success';
  if (readiness === 'review-required') return 'border-primary/35 text-primary-glow';
  return 'border-warning/50 text-warning';
}

function verificationStateClass(state: VerifiedArtifactMatch['state']) {
  if (state === 'verified-file-presence' || state === 'verified-content-match') return 'border-success/40 text-success';
  if (state === 'needs-human-review') return 'border-primary/35 text-primary-glow';
  if (state === 'blocked' || state === 'missing-after-rescan' || state === 'not-detected') return 'border-warning/50 text-warning';
  return 'border-border/60 text-muted-foreground';
}

function normalizeWorkspacePath(path: string) {
  return path.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+/g, '/').trim();
}

function githubUnavailableReason(connection: GitHubConnectionState) {
  if (connection.sourceMode === 'zip-upload') {
    return 'This scan came from a ZIP upload. Download the Optimization Pack and apply it manually in a branch.';
  }
  if (connection.sourceMode === 'public-url') {
    return 'This scan came from a public GitHub URL without an installed GitHub App connection.';
  }
  if (connection.connectionStatus === 'installation_detected') {
    return 'GitHub App installation was detected, but no selected repository is available for PR creation.';
  }
  if (connection.connectionStatus === 'not_configured') {
    return 'GitHub App PR creation is not configured for this environment.';
  }
  return 'Reconnect GitHub and rescan the selected repository to create this PR through the GitHub App.';
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function friendlyOptimizationPrError(error: unknown) {
  if (error instanceof CreateReadinessPrClientError) {
    if (error.status === 401 || error.status === 403) return 'GitHub permission was denied. Reconnect the GitHub App and try again.';
    if (error.status === 413) return 'The PR preview contains a file larger than the GitHub App limit. Download the ZIP for manual review.';
    return error.message.replace(/Readiness Fix Pack|Readiness PR|Readiness/gi, 'Optimization Pack');
  }
  return 'The GitHub PR could not be created. Download the Optimization Pack and use the manual flow.';
}

function optimizationConflictLabel(kind: RepositoryOptimizationPlanItem['conflicts'][number]['kind']) {
  if (kind === 'exact-existing-path') return 'Existing path';
  if (kind === 'case-insensitive-path-collision') return 'Case collision';
  if (kind === 'duplicate-target') return 'Consolidated target';
  if (kind === 'unresolved-folder-agents-destination') return 'Unresolved folder destination';
  if (kind === 'unavailable-generator-output') return 'Unavailable generator output';
  return 'Action review';
}

function relatedAtlasNodeIds(atlas: RepositoryAtlasModel, selectedNodeId?: string, activeChapterNodeId?: string, focusedClusterId?: string | null) {
  const related = new Set<string>();
  if (selectedNodeId) related.add(selectedNodeId);
  if (activeChapterNodeId) related.add(activeChapterNodeId);

  for (const edge of atlas.edges) {
    if (selectedNodeId && (edge.source === selectedNodeId || edge.target === selectedNodeId)) {
      related.add(edge.source);
      related.add(edge.target);
    }
    if (activeChapterNodeId && (edge.source === activeChapterNodeId || edge.target === activeChapterNodeId)) {
      related.add(edge.source);
      related.add(edge.target);
    }
  }

  if (focusedClusterId) {
    const cluster = atlas.clusters.find(item => item.id === focusedClusterId);
    cluster?.nodeIds.forEach(id => related.add(id));
  }

  related.add(atlas.rootNodeId);
  return related;
}

function matchingAtlasNodeIds(atlas: RepositoryAtlasModel, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return new Set<string>();

  return new Set(atlas.nodes.filter(node => {
    const cluster = atlas.clusters.find(item => item.id === node.clusterId);
    return [
      node.label,
      node.path,
      cluster?.label,
      cluster?.category,
      String(node.metadata.repositoryRole || ''),
      String(node.metadata.agentRelevance || ''),
    ].some(value => value?.toLowerCase().includes(normalized));
  }).map(node => node.id));
}

function matchingUniverseNodeIds(universe: RepositoryUniverseModel, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return new Set<string>();

  return new Set(universe.nodes.filter(node => {
    const cluster = universe.clusters.find(item => item.id === node.clusterId);
    return [
      node.label,
      node.path,
      node.metadata.directory,
      node.metadata.extension,
      node.metadata.category,
      node.metadata.language,
      node.metadata.repositoryRole,
      node.metadata.agentRelevance,
      cluster?.label,
      cluster?.category,
    ].some(value => String(value || '').toLowerCase().includes(normalized));
  }).map(node => node.id));
}

function atlasNodeForUniverseNodeId(universeNodeId: string, universe: RepositoryUniverseModel, atlas: RepositoryAtlasModel) {
  const universeNode = universe.nodes.find(node => node.id === universeNodeId);
  if (!universeNode) return null;
  if (universeNode.metadata.atlasNodeId) {
    const byAtlasId = atlas.nodes.find(node => node.id === universeNode.metadata.atlasNodeId);
    if (byAtlasId) return byAtlasId;
  }
  if (universeNode.path) {
    const byPath = atlas.nodes.find(node => node.path === universeNode.path);
    if (byPath) return byPath;
  }
  return atlas.nodes.find(node => node.id === universeNodeId) || null;
}

function nodeVisibleInAtlas(node: RepositoryAtlasNode, filters: AtlasFilters) {
  if (node.kind === 'repository') return true;
  if (node.kind === 'file' && !filters.files) return false;
  if (node.kind === 'folder' && !filters.folders) return false;
  if ((node.kind === 'concept' || node.kind === 'workflow' || node.kind === 'memory') && !filters.concepts) return false;
  if (node.evidenceType === 'evidence' && !filters.evidence) return false;
  if (node.evidenceType === 'heuristic' && !filters.heuristic) return false;
  if ((node.evidenceType === 'missing' || node.kind === 'recommendation') && !filters.missing) return false;
  return true;
}

function edgeVisibleInAtlas(edge: RepositoryKnowledgeEdge, selectedNodeId?: string, activeChapterNodeId?: string, focusedClusterId?: string | null) {
  if (edge.source === selectedNodeId || edge.target === selectedNodeId) return true;
  if (edge.source === activeChapterNodeId || edge.target === activeChapterNodeId) return true;
  if (!selectedNodeId && !activeChapterNodeId && !focusedClusterId) return edge.relationship === 'related-concept';
  return edge.relationship === 'related-concept';
}

function atlasNodeDotClass(node: RepositoryAtlasNode) {
  if (node.kind === 'repository') return 'bg-primary-glow';
  if (node.evidenceType === 'evidence') return 'bg-primary';
  if (node.evidenceType === 'missing') return 'bg-warning';
  return 'bg-muted-foreground';
}

function shortAtlasLabel(label: string) {
  if (label.length <= 26) return label;
  return `${label.slice(0, 23)}...`;
}

function atlasKindLabel(kind: RepositoryAtlasNode['kind']) {
  if (kind === 'repository') return 'Repository';
  if (kind === 'file') return 'File';
  if (kind === 'folder') return 'Folder';
  if (kind === 'workflow') return 'Workflow';
  if (kind === 'memory') return 'Project memory';
  if (kind === 'recommendation') return 'Recommendation';
  return 'Concept';
}

function universeKindLabel(kind: RepositoryUniverseNode['kind']) {
  if (kind === 'repository') return 'Repository';
  if (kind === 'file') return 'File';
  if (kind === 'folder') return 'Folder';
  if (kind === 'workflow') return 'Workflow';
  if (kind === 'recommendation') return 'Recommendation';
  return 'Concept';
}

function clusterLabelForNode(atlas: RepositoryAtlasModel, node?: RepositoryAtlasNode) {
  if (!node?.clusterId) return 'Repository';
  return atlas.clusters.find(cluster => cluster.id === node.clusterId)?.label || node.clusterId;
}

function relationshipLabel(edge: Pick<RepositoryKnowledgeEdge, 'relationship'>) {
  if (edge.relationship === 'related-concept') return 'Related concept';
  if (edge.relationship === 'routes-agent-to') return 'Routes agent to';
  if (edge.relationship === 'supports-workflow') return 'Supports workflow';
  if (edge.relationship === 'contains') return 'Contains';
  if (edge.relationship === 'documents') return 'Documents';
  if (edge.relationship === 'tests') return 'Tests';
  if (edge.relationship === 'configures') return 'Configures';
  if (edge.relationship === 'heuristic') return 'Heuristic link';
  return 'References';
}

function initialUniverseCameraState(universe: RepositoryUniverseModel): UniverseCameraState {
  const visibleNodes = universe.nodes.filter(node => node.kind !== 'concept' || node.id === universe.rootNodeId);
  if (!visibleNodes.length) {
    return { theta: -0.68, phi: 1.08, radius: 520, target: { x: 0, y: 0, z: 0 } };
  }

  const bounds = visibleNodes.reduce((box, node) => ({
    minX: Math.min(box.minX, node.position.x),
    maxX: Math.max(box.maxX, node.position.x),
    minY: Math.min(box.minY, node.position.y),
    maxY: Math.max(box.maxY, node.position.y),
    minZ: Math.min(box.minZ, node.position.z),
    maxZ: Math.max(box.maxZ, node.position.z),
  }), {
    minX: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
    minZ: Number.POSITIVE_INFINITY,
    maxZ: Number.NEGATIVE_INFINITY,
  });

  const target = {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
    z: (bounds.minZ + bounds.maxZ) / 2,
  };
  const spread = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, bounds.maxZ - bounds.minZ);

  return {
    theta: -0.68,
    phi: 1.08,
    radius: clamp(spread * 1.12, 360, 780),
    target,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);

  return reduced;
}

type MentalModelNodeId =
  | 'documentation'
  | 'architecture'
  | 'source'
  | 'aiInstructions'
  | 'tests'
  | 'buildCi'
  | 'context'
  | 'recommendations';

interface MentalModelNode {
  id: MentalModelNodeId;
  label: string;
  description: string;
  evidence: string[];
  status: 'strong' | 'partial' | 'missing';
  x: number;
  y: number;
}

interface MentalModelConnection {
  from: MentalModelNodeId;
  to: MentalModelNodeId;
  label: string;
  evidence: string[];
}

interface MentalModel {
  nodes: MentalModelNode[];
  connections: MentalModelConnection[];
}

function MentalModelVisualization({
  model,
  activeId,
  storyNodeId,
  activeChapter,
  onSelectNode,
}: {
  model: MentalModel;
  activeId: MentalModelNodeId;
  storyNodeId?: MentalModelNodeId;
  activeChapter: WorkspaceStoryChapter | null;
  onSelectNode: (nodeId: MentalModelNodeId) => void;
}) {
  const active = model.nodes.find(node => node.id === activeId) || model.nodes[0];
  const related = model.connections.filter(connection => connection.from === active.id || connection.to === active.id);

  return (
    <div className="flex h-full min-h-[512px] flex-col">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Mental Model</div>
              <h2 className="mt-1 font-display text-2xl font-semibold">How ShipSeal understands this repository</h2>
              {activeChapter && <p className="mt-1 text-sm text-muted-foreground">Selected story: {activeChapter.label}</p>}
        </div>
        <Badge variant="outline" className="border-primary/40 text-primary-glow">
          Semantic map
        </Badge>
      </div>

      <div className="grid flex-1 gap-5 lg:grid-rows-[minmax(300px,1fr)_auto]">
        <div className="relative min-h-[320px] overflow-hidden rounded-3xl border border-border/40 bg-[radial-gradient(circle_at_50%_48%,hsl(var(--primary)/0.13),transparent_34%)]">
          <svg viewBox="0 0 720 420" role="img" aria-label="Mental Model semantic repository graph" className="absolute inset-0 h-full w-full">
            <defs>
              <linearGradient id="mental-model-link" x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="hsl(var(--primary))" stopOpacity="0.45" />
                <stop offset="1" stopColor="hsl(var(--accent))" stopOpacity="0.22" />
              </linearGradient>
            </defs>
            {model.connections.map((connection, index) => {
              const from = model.nodes.find(node => node.id === connection.from);
              const to = model.nodes.find(node => node.id === connection.to);
              if (!from || !to) return null;
              const activeConnection = connection.from === active.id || connection.to === active.id;
              return (
                <g key={`${connection.from}-${connection.to}`}>
                  <line
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    stroke="url(#mental-model-link)"
                    strokeWidth={activeConnection ? 2.6 : 1.3}
                    strokeOpacity={activeConnection ? 0.85 : 0.32}
                    strokeDasharray={connection.evidence.length ? '0' : '5 7'}
                    className="transition-all duration-700"
                    style={{ transitionDelay: `${index * 70}ms` }}
                  />
                </g>
              );
            })}
          </svg>

          {model.nodes.map((node, index) => {
            const activeNode = active.id === node.id;
            const storyNode = storyNodeId === node.id;
            return (
              <button
                key={node.id}
                type="button"
                onClick={() => onSelectNode(node.id)}
                aria-pressed={activeNode}
                className={`absolute w-[126px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border px-3 py-3 text-left shadow-sm transition-all duration-500 animate-scale-in ${
                  activeNode
                    ? 'border-primary/60 bg-primary/15 shadow-primary/20'
                    : node.status === 'strong'
                      ? 'border-success/35 bg-background/45'
                      : node.status === 'partial'
                        ? 'border-primary/25 bg-background/35'
                        : 'border-warning/35 bg-background/30'
                } ${!activeNode && storyNodeId ? 'opacity-55' : ''} ${storyNode ? 'ring-1 ring-primary/45' : ''}`}
                style={{ left: `${(node.x / 720) * 100}%`, top: `${(node.y / 420) * 100}%`, animationDelay: `${index * 85}ms` }}
                aria-label={`${node.label}: ${node.status} signal`}
              >
                <span className={`mb-2 block h-2 w-2 rounded-full ${node.status === 'strong' ? 'bg-success' : node.status === 'partial' ? 'bg-primary-glow' : 'bg-warning'}`} />
                <span className="block text-sm font-semibold leading-tight text-foreground">{node.label}</span>
                <span className="mt-1 block truncate text-[11px] text-muted-foreground">{node.evidence[0] || 'Needs evidence'}</span>
              </button>
            );
          })}
        </div>

        <div className="rounded-2xl border border-border/60 bg-secondary/15 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-lg font-semibold">{active.label}</h3>
                <Badge variant="outline" className={mentalModelStatusClass(active.status)}>
                  {mentalModelStatusLabel(active.status)}
                </Badge>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{active.description}</p>
              {activeChapter?.mentalModelNodeId === active.id && (
                <p className="mt-2 text-sm leading-relaxed text-foreground/90">{activeChapter.relationship}</p>
              )}
            </div>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <RepositoryDnaList title="Evidence" items={active.evidence} emptyText="No strong evidence surfaced." compact />
            <RepositoryDnaList title="Connections" items={related.map(connection => connection.label)} emptyText="No strong relationship surfaced." compact />
          </div>
        </div>
      </div>
    </div>
  );
}

type RepositoryDnaDimensionId =
  | 'documentation'
  | 'architecture'
  | 'projectMemory'
  | 'contextEfficiency'
  | 'aiRouting'
  | 'verification';

interface RepositoryDnaDimension {
  id: RepositoryDnaDimensionId;
  label: string;
  shortLabel: string;
  description: string;
  score: number | null;
  potentialScore: number | null;
  source: 'Evidence' | 'Heuristic';
  evidence: string[];
  recommendations: string[];
  signals: string[];
  missing: string[];
}

function RepositoryDnaVisualization({
  dimensions,
  unavailable,
  activeDimensionId,
  activeChapter,
  onSelectDimension,
}: {
  dimensions: RepositoryDnaDimension[];
  unavailable: boolean;
  activeDimensionId?: RepositoryDnaDimensionId;
  activeChapter: WorkspaceStoryChapter | null;
  onSelectDimension: (dimensionId: RepositoryDnaDimensionId) => void;
}) {
  const [localActiveId, setLocalActiveId] = useState<RepositoryDnaDimensionId>(dimensions[0]?.id || 'documentation');
  const activeId = activeDimensionId || localActiveId;
  const active = dimensions.find(dimension => dimension.id === activeId) || dimensions[0];
  const center = 160;
  const outerRadius = 112;
  const total = dimensions.length;
  const currentPoints = dimensions.map((dimension, index) => {
    const point = radarPoint(index, total, radiusForScore(dimension.score, outerRadius), center);
    return `${point.x},${point.y}`;
  }).join(' ');
  const potentialPoints = dimensions.map((dimension, index) => {
    const point = radarPoint(index, total, radiusForScore(dimension.potentialScore, outerRadius), center);
    return `${point.x},${point.y}`;
  }).join(' ');

  return (
    <div className="flex h-full min-h-[472px] flex-col">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Repository DNA</div>
          <h2 className="mt-1 font-display text-2xl font-semibold">AI workspace profile</h2>
          {activeChapter?.dnaDimensionId && <p className="mt-1 text-sm text-muted-foreground">Linked to {activeChapter.label}</p>}
        </div>
        <Badge variant="outline" className="border-primary/40 text-primary-glow">
          Evidence-backed
        </Badge>
      </div>

      <div className="grid flex-1 gap-5 lg:grid-rows-[auto_1fr]">
        <div className="relative mx-auto aspect-square w-full max-w-[360px]">
          <svg viewBox="0 0 320 320" role="img" aria-label="Repository DNA radar profile" className="h-full w-full overflow-visible">
            <defs>
              <radialGradient id="repository-dna-fill" cx="50%" cy="48%" r="62%">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.36" />
                <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0.08" />
              </radialGradient>
              <linearGradient id="repository-dna-stroke" x1="32" y1="32" x2="288" y2="288">
                <stop stopColor="hsl(var(--primary))" />
                <stop offset="1" stopColor="hsl(var(--accent))" />
              </linearGradient>
            </defs>

            {[0.25, 0.5, 0.75, 1].map(ring => (
              <polygon
                key={ring}
                points={dimensions.map((_, index) => {
                  const point = radarPoint(index, total, outerRadius * ring, center);
                  return `${point.x},${point.y}`;
                }).join(' ')}
                fill="none"
                stroke="hsl(var(--border))"
                strokeOpacity={ring === 1 ? 0.38 : 0.18}
                strokeWidth={ring === 1 ? 1.2 : 1}
              />
            ))}

            {dimensions.map((dimension, index) => {
              const outer = radarPoint(index, total, outerRadius, center);
              const current = radarPoint(index, total, radiusForScore(dimension.score, outerRadius), center);
              const potential = radarPoint(index, total, radiusForScore(dimension.potentialScore, outerRadius), center);
              const selected = activeId === dimension.id;
              const unavailableDimension = unavailable || dimension.score === null;

              return (
                <g key={dimension.id}>
                  <line
                    x1={center}
                    y1={center}
                    x2={outer.x}
                    y2={outer.y}
                    stroke="hsl(var(--primary))"
                    strokeOpacity={selected ? 0.42 : 0.18}
                    strokeWidth={selected ? 1.6 : 1}
                    className="transition-all duration-500"
                    style={{ transitionDelay: `${index * 90}ms` }}
                  />
                  <circle
                    cx={potential.x}
                    cy={potential.y}
                    r={selected ? 4.5 : 3}
                    fill="hsl(var(--success))"
                    fillOpacity={unavailableDimension ? 0.16 : 0.54}
                    className="transition-all duration-500"
                  />
                  <g
                    role="button"
                    tabIndex={0}
                    aria-label={`${dimension.label}: ${dimension.score === null ? 'unavailable' : `${dimension.score} current score`}`}
                    onFocus={() => setLocalActiveId(dimension.id)}
                    onClick={() => {
                      setLocalActiveId(dimension.id);
                      onSelectDimension(dimension.id);
                    }}
                    onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setLocalActiveId(dimension.id);
                        onSelectDimension(dimension.id);
                      }
                    }}
                    className="cursor-pointer outline-none"
                  >
                    <circle
                      cx={current.x}
                      cy={current.y}
                      r={selected ? 8 : 6}
                      fill={unavailableDimension ? 'hsl(var(--warning))' : 'hsl(var(--primary))'}
                      fillOpacity={unavailableDimension ? 0.65 : 0.95}
                      stroke="hsl(var(--background))"
                      strokeWidth="3"
                      className="transition-all duration-500 animate-scale-in"
                      style={{ animationDelay: `${index * 120}ms` }}
                    />
                    <circle
                      cx={current.x}
                      cy={current.y}
                      r={selected ? 15 : 11}
                      fill="transparent"
                      stroke={selected ? 'hsl(var(--primary))' : 'transparent'}
                      strokeOpacity="0.38"
                    />
                  </g>
                  <text
                    x={outer.x}
                    y={outer.y}
                    dy={outer.y < center ? -12 : outer.y > center ? 18 : 4}
                    textAnchor={outer.x < center - 10 ? 'end' : outer.x > center + 10 ? 'start' : 'middle'}
                    className="fill-muted-foreground text-[10px] font-semibold"
                  >
                    {dimension.shortLabel}
                  </text>
                </g>
              );
            })}

            <polygon points={potentialPoints} fill="none" stroke="hsl(var(--success))" strokeOpacity="0.56" strokeWidth="1.4" strokeDasharray="5 6" />
            <polygon points={currentPoints} fill="url(#repository-dna-fill)" stroke="url(#repository-dna-stroke)" strokeWidth="2.5" className="animate-fade-in" />
            <circle cx={center} cy={center} r="25" fill="hsl(var(--background))" fillOpacity="0.68" stroke="hsl(var(--primary))" strokeOpacity="0.24" />
            <text x={center} y={center - 3} textAnchor="middle" className="fill-foreground font-display text-[13px] font-semibold">DNA</text>
            <text x={center} y={center + 13} textAnchor="middle" className="fill-muted-foreground text-[8px]">Workspace</text>
          </svg>
        </div>

        <div className="rounded-2xl border border-border/60 bg-secondary/15 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-lg font-semibold">{active.label}</h3>
                <Badge variant="outline" className={active.source === 'Evidence' ? 'border-primary/40 text-primary-glow' : 'border-border/70 text-muted-foreground'}>
                  {active.source}
                </Badge>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{active.description}</p>
              {activeChapter?.dnaDimensionId === active.id && (
                <p className="mt-2 text-sm leading-relaxed text-foreground/90">{activeChapter.repositoryMeaning}</p>
              )}
            </div>
            <div className="text-right">
              <div className="text-2xl font-semibold">{active.score === null ? 'Unavailable' : `${active.score}`}</div>
              <div className="text-xs text-muted-foreground">Potential {active.potentialScore === null ? 'n/a' : active.potentialScore}</div>
            </div>
          </div>

          <RepositoryDnaList title="Evidence" items={active.evidence} emptyText="No strong evidence surfaced." />
          <RepositoryDnaList title="Recommendations" items={active.recommendations} emptyText="No recommendation generated." />
          <details className="mt-4 rounded-xl border border-border/60 bg-background/20 p-3">
            <summary className="cursor-pointer select-none text-sm font-medium">Signals and missing pieces</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <RepositoryDnaList title="Signals" items={active.signals} emptyText="No signal surfaced." compact />
              <RepositoryDnaList title="Missing pieces" items={active.missing} emptyText="No major missing piece surfaced." compact />
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}

function RepositoryDnaList({
  title,
  items,
  emptyText,
  compact = false,
}: {
  title: string;
  items: string[];
  emptyText: string;
  compact?: boolean;
}) {
  const visible = compact ? items.slice(0, 4) : items.slice(0, 3);
  return (
    <div className={compact ? '' : 'mt-4'}>
      <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{title}</div>
      {visible.length ? (
        <ul className="mt-2 space-y-2">
          {visible.map(item => (
            <li key={item} className="text-sm leading-relaxed text-foreground/90">
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">{emptyText}</p>
      )}
    </div>
  );
}

function radarPoint(index: number, total: number, radius: number, center: number) {
  const angle = (index / Math.max(total, 1)) * Math.PI * 2 - Math.PI / 2;
  return {
    x: Number((center + Math.cos(angle) * radius).toFixed(2)),
    y: Number((center + Math.sin(angle) * radius).toFixed(2)),
  };
}

function radiusForScore(score: number | null, radius: number) {
  if (score === null) return radius * 0.12;
  return radius * Math.max(0.08, Math.min(100, score) / 100);
}

function buildRepositoryDna(report: ReadinessReport): RepositoryDnaDimension[] {
  const health = report.repositoryHealth;
  const files = normalizedReportFiles(report);
  const documentationFiles = firstMatchingFiles(files, [/readme/i, /(^|\/)docs\//i, /architecture/i, /changelog/i], 4);
  const architectureFiles = firstMatchingFiles(files, [/architecture/i, /adr/i, /(^|\/)src\//i, /(^|\/)app\//i], 4);
  const instructionFiles = uniqueStrings([...report.summary.instructionFiles, ...report.repoContextPack.existingInstructionFiles]).slice(0, 4);
  const verificationFiles = firstMatchingFiles(files, [/test/i, /spec/i, /vitest/i, /jest/i, /\.github\/workflows/i], 4);
  const ignoredFolders = (report.repoContextPack.ignoredFolders || []).slice(0, 4);
  const sourceFolders = uniqueStrings([...(report.summary.keyFolders || []), ...(report.repoContextPack.keyFolders || [])]).slice(0, 4);
  const runCommands = (report.stack.runCommands || []).map(command => command.label).slice(0, 4);

  return [
    dnaDimension({
      report,
      id: 'documentation',
      label: 'Documentation',
      shortLabel: 'Docs',
      description: 'The visible onboarding path for humans and AI coding agents.',
      score: averageScores(health.dimensions.repositoryIntelligence.score, health.dimensions.deliveryConfidence.score),
      source: documentationFiles.length ? 'Evidence' : 'Heuristic',
      evidence: compactText([
        ...documentationFiles,
        ...signalEvidence(health.dimensions.repositoryIntelligence.signals, ['readme', 'documentation', 'docs', 'architecture']),
      ]),
      recommendations: compactText([
        ...recommendationsForDimensions(report, ['repositoryIntelligence', 'deliveryConfidence']),
        documentationFiles.length ? 'Keep the strongest docs current and linked from the main README.' : 'Add a concise README path for setup, architecture and safe change workflow.',
      ]),
      signals: signalLabels(health.dimensions.repositoryIntelligence.signals, ['readme', 'documentation', 'docs', 'architecture']),
      missing: compactText([
        ...missingSignalLabels(health.dimensions.repositoryIntelligence.signals, ['readme', 'documentation', 'docs', 'architecture']),
        documentationFiles.length ? '' : 'README or active docs entry point',
      ]),
    }),
    dnaDimension({
      report,
      id: 'architecture',
      label: 'Architecture',
      shortLabel: 'Shape',
      description: 'How clearly repository structure reveals where product behavior lives.',
      score: averageScores(health.dimensions.repositoryIntelligence.score, health.dimensions.agentRouting.score),
      source: sourceFolders.length || architectureFiles.length ? 'Evidence' : 'Heuristic',
      evidence: compactText([
        ...sourceFolders.map(folder => `Key folder: ${folder}`),
        ...architectureFiles,
        report.stack.primary !== 'Unknown' ? `Detected stack: ${report.stack.primary}` : '',
      ]),
      recommendations: compactText([
        ...recommendationsForDimensions(report, ['repositoryIntelligence', 'agentRouting']),
        sourceFolders.length ? 'Document which folders are product-critical and which are support surfaces.' : 'Add a short architecture map that names critical folders and entry points.',
      ]),
      signals: compactText([
        ...signalLabels(health.dimensions.repositoryIntelligence.signals, ['entry', 'source', 'architecture', 'folder']),
        ...signalLabels(health.dimensions.agentRouting.signals, ['folder', 'route', 'source']),
      ]),
      missing: compactText([
        ...missingSignalLabels(health.dimensions.repositoryIntelligence.signals, ['entry', 'source', 'architecture', 'folder']),
        sourceFolders.length ? '' : 'Critical source folder map',
      ]),
    }),
    dnaDimension({
      report,
      id: 'projectMemory',
      label: 'Project Memory',
      shortLabel: 'Memory',
      description: 'Persistent instructions and context anchors agents can reuse between tasks.',
      score: health.dimensions.repositoryIntelligence.score,
      source: instructionFiles.length ? 'Evidence' : 'Heuristic',
      evidence: compactText([
        ...instructionFiles,
        ...signalEvidence(health.dimensions.repositoryIntelligence.signals, ['agent', 'instruction', 'memory', 'context']),
      ]),
      recommendations: compactText([
        ...recommendationsForDimensions(report, ['repositoryIntelligence']),
        instructionFiles.length ? 'Keep agent instructions short, current and linked to repository-specific workflows.' : 'Add AGENTS.md or equivalent project memory for agent onboarding.',
      ]),
      signals: signalLabels(health.dimensions.repositoryIntelligence.signals, ['agent', 'instruction', 'memory', 'context']),
      missing: compactText([
        ...missingSignalLabels(health.dimensions.repositoryIntelligence.signals, ['agent', 'instruction', 'memory', 'context']),
        instructionFiles.length ? '' : 'Agent instruction file',
      ]),
    }),
    dnaDimension({
      report,
      id: 'contextEfficiency',
      label: 'Context Efficiency',
      shortLabel: 'Context',
      description: 'How much avoidable context can stay out of the first agent pass.',
      score: health.dimensions.contextWaste.contextEfficiencyScore,
      source: ignoredFolders.length || health.dimensions.contextWaste.contextEfficiencyScore !== null ? 'Evidence' : 'Heuristic',
      evidence: compactText([
        ...ignoredFolders.map(folder => `Ignored folder: ${folder}`),
        `${report.scanSummary.generatedVendorFilesIgnored + report.scanSummary.binaryFilesIgnored} generated, vendor or binary files ignored`,
        ...signalEvidence(health.dimensions.contextWaste.signals, ['generated', 'vendor', 'binary', 'ignore', 'context']),
      ]),
      recommendations: compactText([
        ...recommendationsForDimensions(report, ['contextWaste']),
        ignoredFolders.length ? 'Keep generated and vendor folders excluded from first-pass agent context.' : 'Mark generated, vendor and build-output folders so agents avoid noisy context.',
      ]),
      signals: signalLabels(health.dimensions.contextWaste.signals, ['generated', 'vendor', 'binary', 'ignore', 'context']),
      missing: compactText([
        ...missingSignalLabels(health.dimensions.contextWaste.signals, ['generated', 'vendor', 'binary', 'ignore', 'context']),
        ignoredFolders.length ? '' : 'Explicit generated/vendor ignore map',
      ]),
    }),
    dnaDimension({
      report,
      id: 'aiRouting',
      label: 'AI Routing',
      shortLabel: 'Routing',
      description: 'How quickly an agent can map a task to the right files and verification path.',
      score: health.dimensions.agentRouting.score,
      source: sourceFolders.length || instructionFiles.length ? 'Evidence' : 'Heuristic',
      evidence: compactText([
        ...sourceFolders.map(folder => `Routable folder: ${folder}`),
        ...instructionFiles.map(file => `Instruction anchor: ${file}`),
        ...signalEvidence(health.dimensions.agentRouting.signals, ['route', 'folder', 'agent', 'entry', 'test']),
      ]),
      recommendations: compactText([
        ...recommendationsForDimensions(report, ['agentRouting']),
        'Add or maintain folder-level guidance for where agents should start common changes.',
      ]),
      signals: signalLabels(health.dimensions.agentRouting.signals, ['route', 'folder', 'agent', 'entry', 'test']),
      missing: compactText([
        ...missingSignalLabels(health.dimensions.agentRouting.signals, ['route', 'folder', 'agent', 'entry', 'test']),
        sourceFolders.length && instructionFiles.length ? '' : 'Folder-to-task routing guidance',
      ]),
    }),
    dnaDimension({
      report,
      id: 'verification',
      label: 'Verification',
      shortLabel: 'Verify',
      description: 'The available test, build and review path after an AI-assisted change.',
      score: health.dimensions.aiDevelopmentReadiness.score,
      source: verificationFiles.length || runCommands.length ? 'Evidence' : 'Heuristic',
      evidence: compactText([
        ...verificationFiles,
        ...runCommands.map(command => `Command: ${command}`),
        ...signalEvidence(health.dimensions.aiDevelopmentReadiness.signals, ['test', 'build', 'lint', 'ci', 'verify']),
      ]),
      recommendations: compactText([
        ...recommendationsForDimensions(report, ['aiDevelopmentReadiness']),
        runCommands.length ? 'Keep build, lint and test commands obvious for every agent handoff.' : 'Declare build, lint and test commands where agents can find them.',
      ]),
      signals: signalLabels(health.dimensions.aiDevelopmentReadiness.signals, ['test', 'build', 'lint', 'ci', 'verify']),
      missing: compactText([
        ...missingSignalLabels(health.dimensions.aiDevelopmentReadiness.signals, ['test', 'build', 'lint', 'ci', 'verify']),
        runCommands.length ? '' : 'Declared verification commands',
      ]),
    }),
  ];
}

function dnaDimension(input: Omit<RepositoryDnaDimension, 'potentialScore'> & { report: ReadinessReport }) {
  const relevantActions = input.report.repositoryHealth.topActions.filter(action =>
    action.dimensions.some(dimension => recommendationDimensions(input.id).includes(dimension))
  );
  const potentialGain = Math.max(0, ...relevantActions.map(action => action.potentialDimensionGain));
  const potentialScore = input.score === null ? null : Math.min(100, input.score + potentialGain);
  const { report: _report, ...dimension } = input;
  return {
    ...dimension,
    potentialScore,
    evidence: compactText(dimension.evidence),
    recommendations: compactText(dimension.recommendations),
    signals: compactText(dimension.signals),
    missing: compactText(dimension.missing),
  };
}

function recommendationDimensions(id: RepositoryDnaDimensionId) {
  if (id === 'contextEfficiency') return ['contextWaste'];
  if (id === 'aiRouting') return ['agentRouting'];
  if (id === 'verification') return ['aiDevelopmentReadiness'];
  if (id === 'documentation') return ['repositoryIntelligence', 'deliveryConfidence'];
  return ['repositoryIntelligence', 'agentRouting'];
}

function recommendationsForDimensions(report: ReadinessReport, dimensions: ReturnType<typeof recommendationDimensions>) {
  return report.repositoryHealth.topActions
    .filter(action => action.dimensions.some(dimension => dimensions.includes(dimension)))
    .map(action => action.action);
}

function averageScores(...scores: Array<number | null>) {
  const available = scores.filter((score): score is number => score !== null);
  if (!available.length) return null;
  return Math.round(available.reduce((sum, score) => sum + score, 0) / available.length);
}

function signalEvidence(signals: RepositoryHealthSignal[], terms: string[]) {
  return signals
    .filter(signal => signal.evidence.length && textMatchesTerms(`${signal.id} ${signal.label} ${signal.evidence.join(' ')}`, terms))
    .flatMap(signal => signal.evidence)
    .slice(0, 4);
}

function signalLabels(signals: RepositoryHealthSignal[], terms: string[]) {
  return signals
    .filter(signal => textMatchesTerms(`${signal.id} ${signal.label}`, terms))
    .map(signal => `${signal.label}: ${signal.status}`);
}

function missingSignalLabels(signals: RepositoryHealthSignal[], terms: string[]) {
  return signals
    .filter(signal => (signal.status === 'fail' || signal.status === 'partial' || signal.status === 'unknown') && textMatchesTerms(`${signal.id} ${signal.label}`, terms))
    .map(signal => signal.label);
}

function textMatchesTerms(text: string, terms: string[]) {
  const normalized = text.toLowerCase();
  return terms.some(term => normalized.includes(term.toLowerCase()));
}

function compactText(items: string[]) {
  return uniqueStrings(items.map(item => item.trim()).filter(Boolean));
}

function buildMentalModel(report: ReadinessReport): MentalModel {
  const files = normalizedReportFiles(report);
  const health = report.repositoryHealth;
  const documentationFiles = firstMatchingFiles(files, [/readme/i, /(^|\/)docs\//i, /architecture/i], 3);
  const sourceFolders = uniqueStrings([...(report.summary.keyFolders || []), ...(report.repoContextPack.keyFolders || [])]).slice(0, 4);
  const sourceFiles = firstMatchingFiles(files, [/^src\//i, /^app\//i, /^components\//i, /^lib\//i], 3);
  const instructionFiles = uniqueStrings([...report.summary.instructionFiles, ...report.repoContextPack.existingInstructionFiles]).slice(0, 3);
  const testFiles = firstMatchingFiles(files, [/test/i, /spec/i, /__tests__/i], 3);
  const ciFiles = firstMatchingFiles(files, [/\.github\/workflows/i, /gitlab-ci/i, /circleci/i], 2);
  const runCommands = (report.stack.runCommands || []).map(command => command.label).slice(0, 3);
  const ignoredCount = report.scanSummary.generatedVendorFilesIgnored + report.scanSummary.binaryFilesIgnored;
  const ignoredFolders = (report.repoContextPack.ignoredFolders || []).slice(0, 3);
  const topAction = health.topActions[0];

  const nodes: MentalModelNode[] = [
    {
      id: 'documentation',
      label: 'Documentation',
      description: 'The onboarding surface ShipSeal found for humans and agents.',
      evidence: compactText(documentationFiles.length ? documentationFiles : signalEvidence(health.dimensions.repositoryIntelligence.signals, ['readme', 'documentation', 'docs'])),
      status: documentationFiles.length ? 'strong' : health.dimensions.repositoryIntelligence.score !== null ? 'partial' : 'missing',
      x: 160,
      y: 105,
    },
    {
      id: 'architecture',
      label: 'Architecture',
      description: 'The project shape inferred from stack, folders and architecture signals.',
      evidence: compactText([
        report.stack.primary !== 'Unknown' ? `Stack: ${report.stack.primary}` : '',
        ...sourceFolders.map(folder => `Folder: ${folder}`),
        ...signalEvidence(health.dimensions.repositoryIntelligence.signals, ['architecture', 'entry', 'source']),
      ]),
      status: scoreToMentalModelStatus(averageScores(health.dimensions.repositoryIntelligence.score, health.dimensions.agentRouting.score)),
      x: 360,
      y: 72,
    },
    {
      id: 'source',
      label: 'Source',
      description: 'Where ShipSeal believes product behavior is likely to live.',
      evidence: compactText([...sourceFolders.map(folder => `Key folder: ${folder}`), ...sourceFiles]),
      status: sourceFolders.length || sourceFiles.length ? 'strong' : 'missing',
      x: 548,
      y: 156,
    },
    {
      id: 'aiInstructions',
      label: 'AI Instructions',
      description: 'Reusable project memory for coding agents.',
      evidence: compactText(instructionFiles.length ? instructionFiles : signalEvidence(health.dimensions.repositoryIntelligence.signals, ['agent', 'instruction'])),
      status: instructionFiles.length ? 'strong' : 'missing',
      x: 166,
      y: 305,
    },
    {
      id: 'tests',
      label: 'Tests',
      description: 'Verification evidence an agent can use after changing code.',
      evidence: compactText([...testFiles, ...report.stack.testFrameworks.map(framework => `Framework: ${framework}`)]),
      status: testFiles.length || report.stack.testFrameworks.length ? 'strong' : health.dimensions.aiDevelopmentReadiness.score !== null ? 'partial' : 'missing',
      x: 360,
      y: 348,
    },
    {
      id: 'buildCi',
      label: 'Build / CI',
      description: 'Declared commands and automation for repeatable verification.',
      evidence: compactText([...ciFiles, ...runCommands.map(command => `Command: ${command}`)]),
      status: ciFiles.length || runCommands.length ? 'strong' : 'missing',
      x: 560,
      y: 300,
    },
    {
      id: 'context',
      label: 'Context',
      description: 'Signals that help agents avoid generated, vendor or noisy files.',
      evidence: compactText([
        ignoredCount ? `${ignoredCount} generated, vendor or binary files ignored` : '',
        ...ignoredFolders.map(folder => `Ignored: ${folder}`),
      ]),
      status: ignoredCount || ignoredFolders.length || health.dimensions.contextWaste.contextEfficiencyScore !== null ? 'strong' : 'partial',
      x: 360,
      y: 210,
    },
    {
      id: 'recommendations',
      label: 'Recommendations',
      description: 'The most useful improvement ShipSeal can see from the current evidence.',
      evidence: compactText(topAction ? [topAction.title, ...topAction.evidence.slice(0, 2)] : []),
      status: topAction ? 'strong' : 'partial',
      x: 76,
      y: 205,
    },
  ];

  const evidenceFor = (id: MentalModelNodeId) => nodes.find(node => node.id === id)?.evidence || [];
  const connections: MentalModelConnection[] = [
    {
      from: 'documentation',
      to: 'architecture',
      label: documentationFiles.length ? 'Docs explain the project shape.' : 'Docs should become the entry point to architecture.',
      evidence: evidenceFor('documentation'),
    },
    {
      from: 'architecture',
      to: 'source',
      label: sourceFolders.length ? 'Architecture resolves into source folders.' : 'Source routing needs clearer folder evidence.',
      evidence: evidenceFor('source'),
    },
    {
      from: 'aiInstructions',
      to: 'source',
      label: instructionFiles.length ? 'Agent memory points toward implementation work.' : 'Agent memory is missing from source discovery.',
      evidence: evidenceFor('aiInstructions'),
    },
    {
      from: 'source',
      to: 'tests',
      label: testFiles.length || report.stack.testFrameworks.length ? 'Source changes have a verification path.' : 'Source-to-test relationship is unclear.',
      evidence: evidenceFor('tests'),
    },
    {
      from: 'tests',
      to: 'buildCi',
      label: runCommands.length || ciFiles.length ? 'Verification can be run through declared commands.' : 'Build and CI evidence is thin.',
      evidence: evidenceFor('buildCi'),
    },
    {
      from: 'context',
      to: 'source',
      label: ignoredCount || ignoredFolders.length ? 'Context filters protect source exploration from noise.' : 'Context filtering is mostly inferred.',
      evidence: evidenceFor('context'),
    },
    {
      from: 'recommendations',
      to: topAction?.dimensions.includes('agentRouting') ? 'source' : topAction?.dimensions.includes('aiDevelopmentReadiness') ? 'tests' : 'documentation',
      label: topAction ? `Next improvement: ${topAction.title}` : 'No primary recommendation generated.',
      evidence: evidenceFor('recommendations'),
    },
  ];

  return { nodes, connections };
}

function scoreToMentalModelStatus(score: number | null): MentalModelNode['status'] {
  if (score === null) return 'missing';
  if (score >= 70) return 'strong';
  if (score >= 45) return 'partial';
  return 'missing';
}

function mentalModelStatusLabel(status: MentalModelNode['status']) {
  if (status === 'strong') return 'Understood';
  if (status === 'partial') return 'Partly understood';
  return 'Needs evidence';
}

function mentalModelStatusClass(status: MentalModelNode['status']) {
  if (status === 'strong') return 'border-success/40 text-success';
  if (status === 'partial') return 'border-primary/40 text-primary-glow';
  return 'border-warning/50 text-warning';
}

function workspaceUnderstandingSentence(report: ReadinessReport) {
  const status = report.repositoryHealth.overall.status;
  if (status === 'AI-ready workspace') return 'This repository is well prepared for AI-assisted development.';
  if (status === 'Workable with optimization') return 'This repository has a usable AI workspace forming.';
  if (status === 'Fragmented workspace') return 'This repository has useful signals, but the workspace is fragmented.';
  if (status === 'High agent friction') return 'This repository can be understood, but agents will hit friction.';
  if (status === 'Blocked') return 'ShipSeal found a blocker before this can become a reliable AI workspace.';
  return 'ShipSeal built the first map of this repository.';
}

function WorkspaceOverview({ report }: { report: ReadinessReport }) {
  const health = report.repositoryHealth;
  const friction = health.dimensions.contextWaste.riskScore;
  const projectMemoryAnchors = report.summary.instructionFiles.length + report.repoContextPack.keyFolders.length;

  const cards = [
    {
      label: 'Workspace Quality',
      value: health.overall.score === null ? 'Unavailable' : `${health.overall.score} / 100`,
      detail: 'Primary workspace metric',
      badge: 'Current',
      badgeClass: 'border-primary/45 text-primary-glow',
    },
    {
      label: 'Repository Friction',
      value: friction === null ? 'Unavailable' : `${friction} / 100`,
      detail: 'Higher friction means more context discovery',
      badge: contextWasteRiskLabel(friction),
      badgeClass: contextWasteRiskClass(friction),
    },
    {
      label: 'Project Memory',
      value: projectMemoryAnchors ? `${projectMemoryAnchors} anchors` : 'Planned',
      detail: 'Instructions, folders, context',
      badge: projectMemoryAnchors ? 'Detected' : 'Upcoming',
      badgeClass: projectMemoryAnchors ? 'border-primary/45 text-primary-glow' : 'border-border/70 text-muted-foreground',
    },
    {
      label: 'Agent Productivity',
      value: 'Planned',
      detail: 'Future workspace analytics',
      badge: 'Upcoming',
      badgeClass: 'border-border/70 text-muted-foreground',
    },
  ];

  return (
    <section className="mb-8" aria-labelledby="workspace-overview-heading">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Workspace Overview</div>
          <h2 id="workspace-overview-heading" className="mt-1 font-display text-2xl font-semibold">Repository as an AI workspace</h2>
        </div>
        <Badge variant="outline" className="border-border/70 bg-background/25">
          Static scan
        </Badge>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map(card => (
          <article key={card.label} className="glass rounded-2xl p-5 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-display text-base font-semibold">{card.label}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{card.detail}</p>
              </div>
              <Badge variant="outline" className={card.badgeClass}>{card.badge}</Badge>
            </div>
            <div className="mt-5 text-2xl font-semibold tracking-tight">{card.value}</div>
          </article>
        ))}
      </div>
    </section>
  );
}

type SimulatorSignalSource = 'Evidence' | 'Heuristic';

interface SimulatorStep {
  id: WorkspaceStoryAgentStepId;
  title: string;
  detail: string;
  source: SimulatorSignalSource;
}

interface SimulatorRecommendation {
  label: string;
  reason: string;
  source: SimulatorSignalSource;
}

interface SimulatorPlan {
  steps: SimulatorStep[];
  likelyFirstFiles: SimulatorRecommendation[];
  likelyIgnoredFolders: SimulatorRecommendation[];
  contextReduction: string;
  routingQuality: string;
  heuristics: string[];
}

function LiveAgentSimulator({ report, activeChapter }: { report: ReadinessReport; activeChapter?: WorkspaceStoryChapter | null }) {
  const plan = buildAgentSimulatorPlan(report);
  const [activeStep, setActiveStep] = useState(0);
  const [runId, setRunId] = useState(0);
  const complete = activeStep >= plan.steps.length - 1;
  const highlightedStepIds = new Set(activeChapter?.agentStepIds || []);

  useEffect(() => {
    setActiveStep(0);
    const interval = window.setInterval(() => {
      setActiveStep(current => {
        if (current >= plan.steps.length - 1) {
          window.clearInterval(interval);
          return current;
        }
        return current + 1;
      });
    }, 650);

    return () => window.clearInterval(interval);
  }, [report.scannedAt, report.repoName, plan.steps.length, runId]);

  return (
    <section className="mb-8" aria-labelledby="live-agent-simulator-heading">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Live Agent Simulator</div>
          <h2 id="live-agent-simulator-heading" className="mt-1 font-display text-2xl font-semibold">Estimated repository exploration</h2>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setActiveStep(0);
            setRunId(current => current + 1);
          }}
          className="border-border/60"
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Replay
        </Button>
      </div>

      <div className="glass rounded-3xl p-6 md:p-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <div>
            <div className="mb-5 rounded-2xl border border-border/60 bg-secondary/15 p-4 text-sm text-muted-foreground">
              Estimated repository exploration based on ShipSeal Repository Intelligence.
            </div>
            <div className="space-y-3">
              {plan.steps.map((step, index) => {
                const state = index < activeStep ? 'done' : index === activeStep ? 'active' : 'upcoming';
                const storyRelated = highlightedStepIds.has(step.id);
                return (
                  <div
                    key={step.id}
                    className={`rounded-2xl border p-4 transition-all duration-500 ${
                      state === 'active'
                        ? 'border-primary/45 bg-primary/10 shadow-sm shadow-primary/10'
                        : state === 'done'
                          ? 'border-success/30 bg-success/5'
                          : 'border-border/50 bg-secondary/10 opacity-70'
                    } ${storyRelated ? 'ring-1 ring-primary/35' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] ${
                        state === 'done'
                          ? 'border-success/50 text-success'
                          : state === 'active'
                            ? 'border-primary/60 text-primary-glow'
                            : 'border-border/70 text-muted-foreground'
                      }`}>
                        {state === 'done' ? <Check className="h-3 w-3" /> : index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-semibold text-foreground">{step.title}</h3>
                          <Badge variant="outline" className={step.source === 'Evidence' ? 'border-primary/40 text-primary-glow' : 'border-border/70 text-muted-foreground'}>
                            {step.source}
                          </Badge>
                          {storyRelated && (
                            <Badge variant="outline" className="border-primary/35 text-primary-glow">
                              Story signal
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{step.detail}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            <div className={`rounded-2xl border border-border/60 bg-secondary/15 p-5 transition-opacity duration-500 ${complete ? 'opacity-100' : 'opacity-55'}`}>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary-glow" />
                <h3 className="font-display font-semibold">Workspace understanding {complete ? 'complete' : 'in progress'}</h3>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <SummaryTile label="Context reduction" value={plan.contextReduction} />
                <SummaryTile label="Routing quality" value={plan.routingQuality} />
              </div>
            </div>

            {complete && (
              <>
                <SimulatorRecommendationList title="Likely first files" items={plan.likelyFirstFiles} />
                <SimulatorRecommendationList title="Likely ignored folders" items={plan.likelyIgnoredFolders} />
                <details className="rounded-2xl border border-border/60 bg-secondary/15 p-4">
                  <summary className="cursor-pointer select-none text-sm font-semibold">Temporary heuristics</summary>
                  <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                    {plan.heuristics.map(item => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </details>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function SimulatorRecommendationList({ title, items }: { title: string; items: SimulatorRecommendation[] }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-secondary/15 p-5">
      <h3 className="font-display font-semibold">{title}</h3>
      <div className="mt-4 space-y-3">
        {items.map(item => (
          <div key={`${title}-${item.label}`} className="rounded-xl border border-border/50 bg-background/20 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-foreground">{item.label}</span>
              <Badge variant="outline" className={item.source === 'Evidence' ? 'border-primary/40 text-primary-glow' : 'border-border/70 text-muted-foreground'}>
                {item.source}
              </Badge>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.reason}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function buildAgentSimulatorPlan(report: ReadinessReport): SimulatorPlan {
  const files = normalizedReportFiles(report);
  const docs = firstMatchingFiles(files, [
    /(^|\/)readme\.md$/i,
    /(^|\/)docs\/readme\.md$/i,
    /(^|\/)documentation\.md$/i,
  ], 2);
  const architecture = firstMatchingFiles(files, [
    /(^|\/)architecture(\.md)?$/i,
    /(^|\/)docs\/architecture(\.md)?$/i,
    /(^|\/)system[-_ ]?design(\.md)?$/i,
    /(^|\/)docs\/.*architecture.*\.md$/i,
  ], 2);
  const instructionFiles = uniqueStrings([
    ...report.summary.instructionFiles,
    ...firstMatchingFiles(files, [
      /(^|\/)agents\.md$/i,
      /(^|\/)claude\.md$/i,
      /(^|\/)\.cursorrules$/i,
      /(^|\/)\.cursor\/rules/i,
    ], 3),
  ]).slice(0, 3);
  const manifestFiles = firstMatchingFiles(files, [
    /(^|\/)package\.json$/i,
    /(^|\/)pyproject\.toml$/i,
    /(^|\/)go\.mod$/i,
    /(^|\/)cargo\.toml$/i,
    /(^|\/)pom\.xml$/i,
  ], 2);
  const sourceFolders = report.summary.keyFolders.slice(0, 4);
  const ignoredFolders = likelyIgnoredFolders(report);
  const likelyFirstFiles = likelyFirstFilesForSimulator(report, docs, architecture, instructionFiles, manifestFiles, files);

  const steps: SimulatorStep[] = [
    {
      id: 'repositoryDetected',
      title: 'Repository detected',
      detail: `${report.scanEvidence.repositoryFullName} from ${displayEvidenceSource(report.scanEvidence.sourceType)}.`,
      source: 'Evidence',
    },
    {
      id: 'frameworkIdentified',
      title: 'Framework identified',
      detail: report.stack.primary !== 'Unknown'
        ? `${report.stack.primary}; ${report.stack.languages.join(', ') || 'language signals unavailable'}.`
        : 'No strong framework signal was detected; the simulator falls back to file and manifest heuristics.',
      source: report.stack.primary !== 'Unknown' ? 'Evidence' : 'Heuristic',
    },
    {
      id: 'findDocumentation',
      title: 'Looking for project documentation',
      detail: docs.length ? `Starts with ${docs.join(', ')}.` : 'No README-like file was found in scanned evidence.',
      source: docs.length ? 'Evidence' : 'Heuristic',
    },
    {
      id: 'searchArchitecture',
      title: 'Searching architecture',
      detail: architecture.length ? `Architecture signal: ${architecture.join(', ')}.` : 'No architecture file was detected; folder map and stack signals become more important.',
      source: architecture.length ? 'Evidence' : 'Heuristic',
    },
    {
      id: 'locateAiInstructions',
      title: 'Locating AI instruction files',
      detail: instructionFiles.length ? `Instruction signal: ${instructionFiles.join(', ')}.` : 'No AGENTS, CLAUDE or tool instruction file was detected.',
      source: instructionFiles.length ? 'Evidence' : 'Heuristic',
    },
    {
      id: 'findBuildAndTest',
      title: 'Finding build and test commands',
      detail: report.stack.runCommands.length ? report.stack.runCommands.slice(0, 3).map(command => `${command.label}: ${command.cmd}`).join('; ') : 'No declared build or test commands were detected.',
      source: report.stack.runCommands.length ? 'Evidence' : 'Heuristic',
    },
    {
      id: 'ignoreGeneratedFolders',
      title: 'Ignoring generated folders',
      detail: ignoredFolders.length ? `Likely skipped: ${ignoredFolders.slice(0, 5).map(folder => folder.label).join(', ')}.` : 'No generated/vendor folders were reported by the scan.',
      source: ignoredFolders.length ? 'Evidence' : 'Heuristic',
    },
    {
      id: 'identifySourceFolders',
      title: 'Identifying critical source folders',
      detail: sourceFolders.length ? `Likely starting folders: ${sourceFolders.join(', ')}.` : 'Source folders are inferred from common project layouts.',
      source: sourceFolders.length ? 'Evidence' : 'Heuristic',
    },
    {
      id: 'workspaceComplete',
      title: 'Workspace understanding complete',
      detail: 'The plan is ready for a first-pass coding-agent handoff.',
      source: 'Heuristic',
    },
  ];

  return {
    steps,
    likelyFirstFiles,
    likelyIgnoredFolders: ignoredFolders.length ? ignoredFolders : fallbackIgnoredFolders(),
    contextReduction: estimatedContextReduction(report),
    routingQuality: estimatedRoutingQuality(report),
    heuristics: [
      'Context reduction is estimated from ignored/generated file counts, not measured token usage.',
      'Routing quality is estimated from Repository Health agent-routing signals and instruction coverage.',
      'The simulator does not expose Claude, Codex, GPT, or other model internals.',
    ],
  };
}

function likelyFirstFilesForSimulator(
  report: ReadinessReport,
  docs: string[],
  architecture: string[],
  instructionFiles: string[],
  manifestFiles: string[],
  files: string[]
): SimulatorRecommendation[] {
  const candidates: SimulatorRecommendation[] = [];
  for (const file of docs) {
    candidates.push({ label: file, reason: 'Project documentation is the highest-signal place to understand purpose and setup.', source: 'Evidence' });
  }
  for (const file of instructionFiles) {
    candidates.push({ label: file, reason: 'Agent instruction files define repository-specific working rules and boundaries.', source: 'Evidence' });
  }
  for (const file of architecture) {
    candidates.push({ label: file, reason: 'Architecture documentation helps route work before opening source files.', source: 'Evidence' });
  }
  for (const file of manifestFiles) {
    candidates.push({ label: file, reason: 'Stack manifests reveal scripts, dependencies and project shape.', source: 'Evidence' });
  }

  if (candidates.length < 5) {
    for (const folder of report.summary.keyFolders.slice(0, 3)) {
      candidates.push({
        label: `${folder}/`,
        reason: 'A key folder was detected in the repository summary and may contain the first source files to inspect.',
        source: 'Evidence',
      });
    }
  }

  if (candidates.length < 5) {
    for (const file of firstMatchingFiles(files, [/src\/main\./i, /src\/index\./i, /app\/page\./i, /pages\/index\./i], 3)) {
      candidates.push({
        label: file,
        reason: 'Common entry-point heuristic used when stronger documentation or routing evidence is limited.',
        source: 'Heuristic',
      });
    }
  }

  return dedupeRecommendations(candidates).slice(0, 6);
}

function likelyIgnoredFolders(report: ReadinessReport): SimulatorRecommendation[] {
  const fromScan = report.scanSummary.ignoredGeneratedFolders.map(folder => ({
    label: folder,
    reason: 'Reported by the scanner as generated or vendor context that should not anchor first-pass exploration.',
    source: 'Evidence' as const,
  }));
  const common = fallbackIgnoredFolders().filter(folder => !fromScan.some(item => normalizePath(item.label) === normalizePath(folder.label)));
  return [...fromScan, ...common].slice(0, 6);
}

function fallbackIgnoredFolders(): SimulatorRecommendation[] {
  return ['node_modules', 'dist', 'coverage', 'build', '.tmp'].map(folder => ({
    label: folder,
    reason: 'Common generated or temporary folder heuristic; skip unless the task specifically targets build artifacts.',
    source: 'Heuristic' as const,
  }));
}

function estimatedContextReduction(report: ReadinessReport) {
  const total = Math.max(report.scanSummary.totalFilesFound || report.fileCount, 1);
  const ignored = Math.max(report.scanSummary.filesIgnored, report.scanSummary.generatedVendorFilesIgnored + report.scanSummary.binaryFilesIgnored);
  const percent = Math.max(0, Math.min(95, Math.round((ignored / total) * 100)));
  if (percent > 0) return `${percent}% estimated`;
  if (report.repositoryHealth.dimensions.contextWaste.riskScore !== null && report.repositoryHealth.dimensions.contextWaste.riskScore <= 25) {
    return 'Low waste';
  }
  return 'Not enough evidence';
}

function estimatedRoutingQuality(report: ReadinessReport) {
  const score = report.repositoryHealth.dimensions.agentRouting.score;
  if (score === null) return 'Unavailable';
  if (score >= 85) return 'Strong';
  if (score >= 70) return 'Workable';
  if (score >= 50) return 'Needs routing';
  return 'High friction';
}

function normalizedReportFiles(report: ReadinessReport) {
  return uniqueStrings([
    ...report.sampleFiles.map(file => file.path),
    ...report.repoContextPack.sampleFiles,
    ...report.repoContextPack.existingInstructionFiles,
    ...report.summary.instructionFiles,
  ]).map(path => path.replace(/\\/g, '/'));
}

function firstMatchingFiles(files: string[], patterns: RegExp[], max: number) {
  const matches: string[] = [];
  for (const pattern of patterns) {
    for (const file of files) {
      if (pattern.test(file) && !matches.includes(file)) {
        matches.push(file);
        if (matches.length >= max) return matches;
      }
    }
  }
  return matches;
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function dedupeRecommendations(items: SimulatorRecommendation[]) {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = normalizePath(item.label);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizePath(path: string) {
  return path.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
}

function WorkspaceModulePlaceholders() {
  const modules = ['Project Memory', 'Agent Heatmap', 'Context Timeline'];

  return (
    <section className="mb-8" aria-labelledby="workspace-modules-heading">
      <div className="mb-4">
        <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Workspace modules</div>
        <h2 id="workspace-modules-heading" className="mt-1 font-display text-2xl font-semibold">Next workspace surfaces</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {modules.map(module => (
          <article key={module} className="rounded-2xl border border-border/60 bg-secondary/15 p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-display text-base font-semibold">{module}</h3>
              <Badge variant="outline" className="border-border/70 text-muted-foreground">Planned</Badge>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Coming in upcoming Workspace Optimization updates.
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function RepositoryHealthActions({ repositoryHealth }: { repositoryHealth: RepositoryHealth }) {
  const actions = repositoryHealth.topActions.slice(0, 5);

  return (
    <section className="mb-8" aria-labelledby="repository-health-actions-heading">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Lightbulb className="h-5 w-5 text-accent" />
        <h2 id="repository-health-actions-heading" className="font-display text-2xl font-semibold">Top repository improvements</h2>
      </div>
      {actions.length === 0 ? (
        <div className="glass rounded-2xl p-5 text-sm text-muted-foreground">No high-priority Repository Health actions were generated from the current scan.</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {actions.map(action => (
            <article key={action.id} className="glass rounded-2xl p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={action.priority === 'High' ? 'border-warning/70 text-warning' : 'border-border/70 text-muted-foreground'}>
                  {action.priority} priority
                </Badge>
                {action.suggestedTargetPath && (
                  <code className="rounded bg-secondary/70 px-2 py-1 text-[11px] text-foreground/90 break-all">{action.suggestedTargetPath}</code>
                )}
              </div>
              <h3 className="mt-3 font-display text-lg font-semibold leading-snug">{action.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{action.whyItMatters}</p>
              <p className="mt-2 text-sm leading-relaxed text-foreground/90">{action.action}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {action.dimensions.map(dimension => (
                  <Badge key={dimension} variant="outline" className="border-primary/35 text-primary-glow">
                    {dimensionLabel(dimension)}
                  </Badge>
                ))}
              </div>
              {action.potentialDimensionGain > 0 && (
                <div className="mt-3 text-xs text-muted-foreground">
                  Potential {dimensionLabel(action.dimensions[0])} improvement: up to {action.potentialDimensionGain} dimension points.
                </div>
              )}
              <EvidenceList evidence={action.evidence.slice(0, 3)} className="mt-3" />
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function RepositoryHealthDimensions({ repositoryHealth }: { repositoryHealth: RepositoryHealth }) {
  const dimensions = [
    {
      id: 'repositoryIntelligence' as const,
      name: 'Repository Intelligence',
      description: 'How much reusable project knowledge is available to an AI agent before work begins.',
      score: repositoryHealth.dimensions.repositoryIntelligence.score,
      confidence: repositoryHealth.dimensions.repositoryIntelligence.confidence,
      signals: repositoryHealth.dimensions.repositoryIntelligence.signals,
    },
    {
      id: 'contextWaste' as const,
      name: 'Context Waste Risk',
      description: 'How likely an agent is to process unnecessary, duplicated or poorly routed repository context.',
      score: repositoryHealth.dimensions.contextWaste.riskScore,
      confidence: repositoryHealth.dimensions.contextWaste.confidence,
      signals: repositoryHealth.dimensions.contextWaste.signals,
      risk: true,
    },
    {
      id: 'aiDevelopmentReadiness' as const,
      name: 'AI Development Readiness',
      description: "How clearly an agent can build, test and verify changes using the repository's declared workflow.",
      score: repositoryHealth.dimensions.aiDevelopmentReadiness.score,
      confidence: repositoryHealth.dimensions.aiDevelopmentReadiness.confidence,
      signals: repositoryHealth.dimensions.aiDevelopmentReadiness.signals,
    },
    {
      id: 'agentRouting' as const,
      name: 'Agent Routing',
      description: 'How clearly tasks map to folders, critical files and focused verification steps.',
      score: repositoryHealth.dimensions.agentRouting.score,
      confidence: repositoryHealth.dimensions.agentRouting.confidence,
      signals: repositoryHealth.dimensions.agentRouting.signals,
    },
    {
      id: 'deliveryConfidence' as const,
      name: 'Delivery Confidence',
      description: 'How clearly the project can be understood, operated and handed over.',
      score: repositoryHealth.dimensions.deliveryConfidence.score,
      confidence: repositoryHealth.dimensions.deliveryConfidence.confidence,
      signals: repositoryHealth.dimensions.deliveryConfidence.signals,
    },
  ];

  return (
    <section className="mb-8" aria-labelledby="repository-health-dimensions-heading">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Layers className="h-5 w-5 text-primary-glow" />
        <h2 id="repository-health-dimensions-heading" className="font-display text-2xl font-semibold">Repository Health dimensions</h2>
      </div>
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {dimensions.map(dimension => (
          <DimensionCard key={dimension.id} {...dimension} />
        ))}
      </div>
    </section>
  );
}

function DimensionCard({
  name,
  description,
  score,
  confidence,
  signals,
  risk = false,
}: {
  name: string;
  description: string;
  score: number | null;
  confidence: string;
  signals: RepositoryHealthSignal[];
  risk?: boolean;
}) {
  const positive = signals.filter(signal => signal.status === 'pass').slice(0, 2);
  const gaps = signals.filter(signal => signal.status === 'fail' || signal.status === 'partial').slice(0, 2);
  const displayScore = score === null ? 'Unavailable' : risk ? `${score} / 100 risk` : `${score} / 100`;
  const label = score === null ? 'Insufficient evidence' : risk ? contextWasteRiskLabel(score) : dimensionQualityLabel(score);

  return (
    <article className="glass rounded-2xl p-5 min-w-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-semibold">{name}</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
        </div>
        <Badge variant="outline" className={risk ? contextWasteRiskClass(score) : dimensionQualityClass(score)}>
          {label}
        </Badge>
      </div>
      <div className="mt-4">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="font-semibold text-foreground">{displayScore}</span>
          <span className="text-muted-foreground">{confidence} confidence</span>
        </div>
        {score !== null && (
          <div
            className="mt-2 h-2 overflow-hidden rounded-full bg-secondary"
            role="img"
            aria-label={`${name} ${displayScore}${risk ? ', higher means higher risk' : ''}`}
          >
            <div
              className={risk ? 'h-full rounded-full bg-gradient-to-r from-warning to-destructive' : 'h-full rounded-full bg-gradient-to-r from-primary to-accent'}
              style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
            />
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <SignalSummary title="Evidence" signals={positive} emptyText="No strong positive signal surfaced." />
        <SignalSummary title="Main gaps" signals={gaps} emptyText="No main gap surfaced." />
      </div>

      <details className="mt-4 rounded-lg border border-border/60 bg-secondary/20 p-3">
        <summary className="cursor-pointer select-none text-sm font-medium">Why this score?</summary>
        <ul className="mt-3 space-y-3">
          {signals.slice(0, 6).map(signal => (
            <li key={signal.id} className="text-xs leading-relaxed">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-border/70 text-[10px]">{signal.status}</Badge>
                <span className="font-medium text-foreground/90">{signal.label}</span>
              </div>
              <EvidenceList evidence={signal.evidence.slice(0, 2)} className="mt-2" />
            </li>
          ))}
        </ul>
      </details>
    </article>
  );
}

function MeasurementBoundary({ repositoryHealth }: { repositoryHealth: RepositoryHealth }) {
  return (
    <details className="glass rounded-2xl p-6">
      <summary className="cursor-pointer select-none font-display font-semibold text-foreground">
        How this score is measured
      </summary>
      <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
        <p>Repository Health is the current repository state from this scan, before generated ShipSeal improvements are applied.</p>
        <ul className="space-y-2">
          {repositoryHealth.measurementBoundary.map(boundary => (
            <li key={boundary} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-glow" />
              <span>{boundary}</span>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

function SignalSummary({ title, signals, emptyText }: { title: string; signals: RepositoryHealthSignal[]; emptyText: string }) {
  return (
    <div>
      <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">{title}</div>
      {signals.length === 0 ? (
        <div className="text-xs text-muted-foreground">{emptyText}</div>
      ) : (
        <ul className="space-y-2">
          {signals.map(signal => (
            <li key={signal.id} className="text-xs leading-relaxed text-foreground/90">
              {signal.evidence[0] || signal.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EvidenceList({ evidence, className = '' }: { evidence: string[]; className?: string }) {
  if (evidence.length === 0) return null;
  return (
    <ul className={`space-y-1 text-xs leading-relaxed text-muted-foreground ${className}`}>
      {evidence.map(item => (
        <li key={item} className="break-words">
          <span className="sr-only">Evidence: </span>{item}
        </li>
      ))}
    </ul>
  );
}

function repositoryHealthSummarySentence(status: RepositoryHealth['overall']['status']) {
  if (status === 'AI-ready workspace') return 'The repository has strong project knowledge, routing and verification signals for AI-agent work.';
  if (status === 'Workable with optimization') return 'The repository has usable project knowledge and verification signals, but agents may still need broad context discovery.';
  if (status === 'Fragmented workspace') return 'The repository has useful signals, but project knowledge and routing are fragmented.';
  if (status === 'High agent friction') return 'The repository is likely to require substantial context discovery before agent work is reliable.';
  if (status === 'Blocked') return 'A critical repository issue blocks trustworthy AI-agent handoff until it is resolved.';
  return 'ShipSeal does not have enough repository evidence to calculate Repository Health.';
}

function contextWasteRiskLabel(score: number | null) {
  if (score === null) return 'Unavailable';
  if (score >= 75) return 'Very high';
  if (score >= 50) return 'High';
  if (score >= 25) return 'Moderate';
  return 'Low';
}

function contextWasteRiskClass(score: number | null) {
  if (score === null) return 'border-warning/60 text-warning';
  if (score >= 75) return 'border-destructive/70 text-destructive';
  if (score >= 50) return 'border-warning/80 text-warning';
  if (score >= 25) return 'border-accent/70 text-accent';
  return 'border-success/50 text-success';
}

function dimensionQualityLabel(score: number | null) {
  if (score === null) return 'Unavailable';
  if (score >= 85) return 'Strong';
  if (score >= 70) return 'Workable';
  if (score >= 50) return 'Needs focus';
  return 'Weak';
}

function dimensionQualityClass(score: number | null) {
  if (score === null) return 'border-warning/60 text-warning';
  if (score >= 85) return 'border-success/50 text-success';
  if (score >= 70) return 'border-primary/45 text-primary-glow';
  if (score >= 50) return 'border-warning/70 text-warning';
  return 'border-destructive/60 text-destructive';
}

function repositoryHealthStatusClass(status: RepositoryHealth['overall']['status']) {
  if (status === 'AI-ready workspace') return 'border-success/50 text-success';
  if (status === 'Workable with optimization') return 'border-primary/45 text-primary-glow';
  if (status === 'Fragmented workspace') return 'border-warning/70 text-warning';
  if (status === 'High agent friction' || status === 'Blocked') return 'border-destructive/70 text-destructive';
  return 'border-warning/60 text-warning';
}

function dimensionLabel(dimension: string) {
  if (dimension === 'repositoryIntelligence') return 'Repository Intelligence';
  if (dimension === 'contextWaste') return 'Context Waste Risk';
  if (dimension === 'aiDevelopmentReadiness') return 'AI Development Readiness';
  if (dimension === 'agentRouting') return 'Agent Routing';
  if (dimension === 'deliveryConfidence') return 'Delivery Confidence';
  return dimension;
}

function severityClass(severity: MCPRiskSeverity) {
  if (severity === 'Critical') return 'ml-auto border-destructive/60 text-destructive text-[10px]';
  if (severity === 'High') return 'ml-auto border-warning/70 text-warning text-[10px]';
  if (severity === 'Medium') return 'ml-auto border-accent/60 text-accent text-[10px]';
  return 'ml-auto border-success/60 text-success text-[10px]';
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-secondary/25 px-3 py-3 min-w-0">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold truncate">{value}</div>
    </div>
  );
}

function ProjectPackageSummary({
  packageLabel,
  outputCount,
  packageSummary,
  hasContextCompressionPack,
  hasFolderAgentSuggestions,
  hasSpecializedContextPacks,
  hasToolingRecommendations,
  skillRecommendationCount,
  mcpRecommendationCount,
}: {
  packageLabel: string;
  outputCount: number;
  packageSummary: string;
  hasContextCompressionPack: boolean;
  hasFolderAgentSuggestions: boolean;
  hasSpecializedContextPacks: boolean;
  hasToolingRecommendations: boolean;
  skillRecommendationCount: number;
  mcpRecommendationCount: number;
}) {
  return (
    <div className="mt-3 rounded-2xl border border-primary/25 bg-primary/10 px-4 py-4 shadow-sm shadow-primary/5">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Project package</div>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 text-base font-semibold leading-snug text-foreground sm:text-lg">
          {packageLabel}
        </div>
        <Badge variant="outline" className="w-fit shrink-0 border-primary/50 bg-primary/15 text-primary-glow">
          {outputCount} outputs
        </Badge>
      </div>
      {packageSummary && (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
          {packageSummary}
        </p>
      )}
      {hasContextCompressionPack && (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
          <span className="font-semibold text-foreground">Context Compression Pack generated.</span> ShipSeal generated compact project memory files to help AI coding agents avoid unnecessary full-repo scans.
        </p>
      )}
      {hasFolderAgentSuggestions && (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
          <span className="font-semibold text-foreground">Folder-level AGENTS suggestions generated.</span> These local instructions help AI coding agents use the right context for each part of the project.
        </p>
      )}
      {hasSpecializedContextPacks && (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
          <span className="font-semibold text-foreground">Specialized context packs generated.</span> ShipSeal generated role-specific context files for QA, security, docs, and MCP/tooling agents.
        </p>
      )}
      {hasToolingRecommendations && (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
          <span className="font-semibold text-foreground">Tooling recommendations generated.</span> Recommended skills: {skillRecommendationCount}. Recommended MCP tools: {mcpRecommendationCount}.
        </p>
      )}
    </div>
  );
}

function AgentOperatingModeSummary({
  modeLabel,
  expectedTokenUsage,
  confidence,
  summary,
}: {
  modeLabel: string;
  expectedTokenUsage: string;
  confidence: string;
  summary: string;
}) {
  return (
    <div className="mt-3 rounded-2xl border border-accent/25 bg-accent/10 px-4 py-4">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Recommended operating mode</div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <div className="text-base font-semibold text-foreground">{modeLabel}</div>
        <Badge variant="outline" className="border-accent/45 bg-background/25 text-[10px] text-accent">
          {expectedTokenUsage}
        </Badge>
        <Badge variant="outline" className="border-border/70 bg-background/25 text-[10px]">
          {confidence}
        </Badge>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">{summary}</p>
    </div>
  );
}

function ScanEvidencePanel({ report }: { report: ReadinessReport }) {
  const evidence = report.scanEvidence;
  const keySignals = keyFileSignals(evidence.keyFilesFound);
  const stack = [
    ...evidence.topFrameworks,
    ...evidence.topLanguages.filter(language => !evidence.topFrameworks.includes(language)),
  ].slice(0, 5);

  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex flex-wrap items-start gap-3">
        <ShieldCheck className={evidence.limitedScan ? 'mt-1 h-5 w-5 text-warning' : 'mt-1 h-5 w-5 text-success'} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display font-semibold">Scan evidence</h3>
            <Badge variant="outline" className={evidence.limitedScan ? 'border-warning/60 text-warning' : 'border-success/40 text-success'}>
              {evidence.limitedScan ? 'Limited scan' : 'Full archive scan'}
            </Badge>
            <Badge variant="outline" className="border-primary/40 text-primary-glow">
              {displayEvidenceSource(evidence.sourceType)}
            </Badge>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Static scan complete: ShipSeal read repository structure and key project files without executing code.
          </p>
        </div>
      </div>

      <div className="mt-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <SafetyMetric label="Repository" value={evidence.repositoryFullName} />
        <SafetyMetric label="Branch / ref" value={evidence.branchOrRef || 'default'} />
        <SafetyMetric label="Scanned at" value={new Date(report.scannedAt).toLocaleString()} />
        <SafetyMetric label="Archive size" value={evidence.approximateArchiveSizeBytes ? formatFileSize(evidence.approximateArchiveSizeBytes) : 'Not reported'} />
        <SafetyMetric label="Files discovered" value={evidence.discoveredFileCount.toLocaleString()} />
        <SafetyMetric label="Files analyzed" value={evidence.analyzedFileCount.toLocaleString()} />
        <SafetyMetric label="Files ignored" value={evidence.ignoredFileCount.toLocaleString()} />
        <SafetyMetric label="Generated/vendor ignored" value={evidence.generatedOrVendorFileCount.toLocaleString()} />
      </div>

      <div className="mt-5 grid lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
          <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">Detected stack</div>
          <div className="flex flex-wrap gap-2">
            {(stack.length ? stack : ['Not detected']).map(item => (
              <Badge key={item} variant="outline" className="border-border/70 bg-background/25 text-foreground">
                {item}
              </Badge>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
          <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">Key files found</div>
          <div className="flex flex-wrap gap-2">
            {keySignals.map(signal => (
              <Badge key={signal.label} variant="outline" className={signal.found ? 'border-success/40 text-success' : 'border-border/60 text-muted-foreground'}>
                {signal.found ? 'Found' : 'Missing'}: {signal.label}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {evidence.limitedScan && evidence.limitationReason && (
        <div className="mt-4 rounded-lg border border-warning/35 bg-warning/10 px-4 py-3 text-sm text-warning">
          {evidence.limitationReason}
        </div>
      )}
    </div>
  );
}

function keyFileSignals(keyFiles: ReadinessReport['scanEvidence']['keyFilesFound']) {
  return [
    { label: 'README', found: keyFiles.readme },
    { label: 'package.json', found: keyFiles.packageJson },
    { label: 'tests', found: keyFiles.tests },
    { label: 'CI workflow', found: keyFiles.ciConfig },
    { label: '.env example', found: keyFiles.envExample },
    { label: '.gitignore', found: keyFiles.gitignore },
    { label: 'AGENTS', found: keyFiles.agentInstructions },
    { label: 'CLAUDE', found: keyFiles.claudeInstructions },
  ];
}

function displayEvidenceSource(sourceType: ReadinessReport['scanEvidence']['sourceType']) {
  if (sourceType === 'github-app') return 'GitHub App';
  if (sourceType === 'public-github') return 'Public GitHub';
  return 'ZIP upload';
}

function Disclosure({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen || undefined} className="mb-8 rounded-2xl border border-border/60 bg-secondary/15 p-4">
      <summary className="cursor-pointer select-none font-display font-semibold text-foreground">
        {title}
      </summary>
      <div className="mt-5">
        {children}
      </div>
    </details>
  );
}

function ProjectContextPanel({
  appliedIntake,
  draftIntake,
  skipped,
  dirty,
  onDraftChange,
  onRegenerate,
  onClear,
}: {
  appliedIntake: ProjectIntake;
  draftIntake: ProjectIntake;
  skipped: boolean;
  dirty: boolean;
  onDraftChange: (value: ProjectIntake) => void;
  onRegenerate: () => void;
  onClear: () => void;
}) {
  return (
    <div className="rounded-2xl p-2">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <FileArchive className="h-4 w-4 text-primary-glow" />
        <Badge variant="outline" className={skipped ? 'border-warning/60 text-warning' : 'border-success/40 text-success'}>
          {skipped ? 'Intake skipped' : 'Context applied'}
        </Badge>
      </div>
      {skipped && (
        <div className="mb-4 rounded-lg border border-warning/35 bg-warning/10 px-4 py-3 text-sm text-warning">
          Client report quality is limited because project intake was skipped.
        </div>
      )}
      {dirty && (
        <div className="mb-4 rounded-lg border border-accent/35 bg-accent/10 px-4 py-3 text-sm text-accent">
          Project context was edited. Regenerate the report to update Delivery Pack outputs.
        </div>
      )}
      <div className="space-y-2 text-sm">
        <Row label="Project" value={appliedIntake.projectName || 'Not provided'} />
        <Row label="Client" value={appliedIntake.clientName || 'Not provided'} />
        <Row label="Agency" value={appliedIntake.agencyName || 'Not provided'} />
        <Row label="AI use case" value={appliedIntake.aiUseCase || 'Not provided'} />
        <Row label="EU / personal data" value={`${appliedIntake.usedInEU ? 'EU use' : 'EU unknown'} / ${appliedIntake.handlesPersonalData ? 'personal data' : 'personal data unknown'}`} />
      </div>
      <details className="mt-5 rounded-lg border border-border/60 bg-secondary/20 p-3">
        <summary className="cursor-pointer select-none text-sm font-medium">Edit project context</summary>
        <div className="mt-4">
          <ProjectIntakeForm value={draftIntake} onChange={onDraftChange} />
          <div className="flex flex-col sm:flex-row justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onClear}>Clear intake</Button>
            <Button type="button" disabled={!dirty} onClick={onRegenerate} className="bg-gradient-primary border-0 shadow-glow hover:opacity-90">
              Regenerate report with updated intake
            </Button>
          </div>
        </div>
      </details>
    </div>
  );
}

function DecisionSummary({ report, ready, nextActions }: { report: ReadinessReport; ready: boolean; nextActions: string[] }) {
  const risks = report.blockers.slice(0, 3).map(blocker => blocker.title || 'Critical blocker');
  const fallbackRisks = report.improvements.slice(0, 3).map(improvement => improvement.title || improvement.category);
  const visibleRisks = risks.length ? risks : fallbackRisks.length ? fallbackRisks : ['No major delivery risks detected from available scan data'];
  const visibleActions = nextActions.length ? nextActions : ['Review the Delivery Pack with the client', 'Complete project intake fields', 'Run test and build commands before handoff'];

  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <CheckCircle2 className={ready ? 'h-4 w-4 text-success' : 'h-4 w-4 text-warning'} />
        <h3 className="font-display font-semibold">Handoff decision summary</h3>
        <Badge variant="outline" className={ready ? 'ml-auto border-success/40 text-success' : 'ml-auto border-warning/60 text-warning'}>
          {ready ? 'Go / review' : 'Needs remediation'}
        </Badge>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">Top risks</div>
          <ul className="space-y-2 text-sm text-foreground/90">
            {visibleRisks.map(risk => (
              <li key={risk} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-warning shrink-0" />
                <span>{risk}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">Next 3 actions</div>
          <ol className="space-y-2 text-sm text-foreground/90 list-decimal list-inside">
            {visibleActions.slice(0, 3).map(action => <li key={action}>{action}</li>)}
          </ol>
        </div>
      </div>
    </div>
  );
}

function sameIntake(a: ProjectIntake, b: ProjectIntake) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function SafetyMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-secondary/25 px-3 py-2">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-semibold text-foreground/90 truncate">{value}</div>
    </div>
  );
}

function NarrativePanel({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-secondary/25 p-4">
      <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">{title}</div>
      <p className="text-sm text-foreground/90 leading-relaxed">{text}</p>
    </div>
  );
}

function NarrativeList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-border/60 bg-secondary/25 p-4">
      <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">{title}</div>
      <ul className="space-y-2 text-sm text-foreground/90">
        {items.map(item => (
          <li key={item} className="flex gap-2">
            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary-glow shrink-0" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RecentScans({ history, onClear }: { history: ScanHistoryItem[]; onClear: () => void }) {
  return (
    <div className="glass rounded-2xl p-6 mb-8">
      <div className="flex items-center gap-3 mb-4">
        <RefreshCw className="h-4 w-4 text-primary-glow" />
        <h3 className="font-display font-semibold">Recent scans</h3>
        {history.length > 0 && (
          <Button variant="ghost" size="sm" onClick={onClear} className="ml-auto text-muted-foreground hover:text-foreground">
            <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Clear history
          </Button>
        )}
      </div>
      {history.length === 0 ? (
        <div className="text-sm text-muted-foreground">No previous scans on this device.</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2">
          {history.map(item => (
            <div key={`${item.repositoryName}-${item.timestamp}`} className="rounded-lg border border-border/60 bg-secondary/30 px-3 py-2">
              <div className="text-xs font-medium truncate">{item.repositoryName}</div>
              <div className="mt-1 text-[11px] text-muted-foreground">{new Date(item.timestamp).toLocaleString()}</div>
              <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                <span className="font-mono">{item.score}/100</span>
                <span className="text-muted-foreground truncate">{displayReadinessLevel(item.status)}</span>
                <span className={item.criticalBlockerCount ? 'text-destructive' : 'text-success'}>{item.criticalBlockerCount}</span>
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground truncate">
                {isGitHubSource(item.sourceType) ? `GitHub ${item.githubOwner}/${item.githubRepo}${item.githubBranch ? ` @ ${item.githubBranch}` : ''}` : 'ZIP upload'}
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                <span>MCP</span>
                <span className="font-mono">{item.mcpScore}/100</span>
                <span className="truncate">{displayMcpReadiness(item.mcpStatus)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function displayMcpReadiness(status?: string) {
  if (!status) return 'Not detected';
  if (/Enterprise MCP Ready/i.test(status)) return 'MCP Governance Ready';
  if (/MCP Ready/i.test(status)) return 'Strong MCP readiness signal';
  return status;
}

function mcpGovernanceSummary(report: ReadinessReport) {
  const base = report.mcpReadiness.aiNarrative?.mcpSummary || report.mcpReadiness.summary;
  return `${base} MCP readiness is separate from the main ShipSeal score; it does not mean production-ready status, and high-risk MCP tool categories require human approval.`;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground/90 text-right truncate">{value}</span>
    </div>
  );
}

function isGitHubSource(sourceType?: string) {
  return sourceType === 'github-app' || sourceType === 'github-url' || sourceType === 'github-public';
}
