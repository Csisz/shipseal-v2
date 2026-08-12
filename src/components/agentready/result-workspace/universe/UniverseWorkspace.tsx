import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import type { ReactNode } from 'react';
import { useTheme } from 'next-themes';
import { AlertOctagon, ArrowLeft, Check, CheckCircle2, Copy, Crosshair, Download, FileArchive, HelpCircle, Layers, Lightbulb, Maximize2, Minimize2, MoreHorizontal, PanelRightClose, PanelRightOpen, RefreshCw, Search, ShieldCheck, Sparkles, Trash2, ZoomIn, ZoomOut } from 'lucide-react';
import type { AgentOperatingModeId, AgentPackFile, MCPRiskSeverity, ReadinessReport, ScanHistoryItem } from '@/lib/types';
import { evaluateReadiness } from '@/lib/scoring';
import { ScoreGauge } from '@/components/agentready/ScoreGauge';
import { ReadinessBadge } from '@/components/agentready/ReadinessBadge';
import { CategoryBreakdown } from '@/components/agentready/CategoryBreakdown';
import { AgentPackTabs } from '@/components/agentready/AgentPackTabs';
import { ProjectIntakeForm } from '@/components/agentready/ProjectIntakeForm';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { buildRepoContextPackJson, buildScoreJson, downloadJsonFile, downloadTextFile } from '@/lib/exports';
import { formatFileSize } from '@/lib/uploadValidation';
import { criticalBlockersEmptyStateText, displayReadinessLevel, readinessStatusMessageForPackage } from '@/lib/uiCopy';
import type { ProjectIntake } from '@/lib/intake';
import { createDefaultProjectIntake, normalizeProjectIntake } from '@/lib/intake';
import { FULL_PACKAGE_ID, getShipSealPackage, resolveSelectedPackages } from '@/lib/packages';
import { resolveDeliveryPackFocus } from '@/lib/deliveryPack';
import { getFolderAgentSuggestionPaths } from '@/lib/deliveryPack/folderAgents';
import { buildGitHubConnectionFromReport, type GitHubConnectionState } from '@/lib/githubConnection/types';
import {
  OptimizationPrClientError,
  submitOptimizationPrRequest,
  type OptimizationPrApplyResponse,
  type OptimizationPrPreviewResponse,
} from '@/lib/github/write';
import { DEFAULT_AGENT_OPERATING_MODE, applyAgentOperatingModeToFiles, getAgentOperatingMode, resolveAgentOperatingMode, selectionUsesAgentDevelopment } from '@/lib/agentOperatingMode';
import { buildToolingRecommendationBundle, recommendationCounts } from '@/lib/toolingRecommendations';
import {
  buildRepositoryAgentFlightPath,
  buildOptimizationPackZipBlob,
  buildOptimizationPackZipFilename,
  buildOptimizationGithubPreparedSnapshot,
  buildRepositoryAtlasModel,
  buildRepositoryOptimizationPlan,
  prepareRepositoryOptimizationPlan,
  validateRepositoryOptimizationPlan,
  buildRepositoryTransformationProposalModel,
  buildRepositoryVerificationBaseline,
  buildRepositoryVerificationResult,
  buildWorkspaceStory,
  chapterForDnaDimension,
  chapterForMentalModelNode,
  repositoryUniverseEdgeVisible,
  repositoryUniverseFilterCounts,
  repositoryUniverseVisibleNodeIds,
  repositoryTransformationDomainCounts,
  serializeRepositoryOptimizationManifest,
  OPTIMIZATION_GITHUB_APPLY_VERSION,
  transformationDomainLabel,
  type RepositoryAtlasModel,
  type RepositoryAtlasNode,
  type RepositoryAgentFlightPath,
  type OptimizationApplyPlan,
  type OptimizationGithubApplyProgress,
  type OptimizationGithubApplyPlanFile,
  type RepositoryVerificationBaseline,
  type RepositoryVerificationResult,
  type VerificationBaselineMethod,
  type VerifiedArtifactMatch,
  type RepositoryOptimizationPlan,
  type RepositoryOptimizationPlanItem,
  type RepositoryOptimizationReadiness,
  type RepositoryOptimizationPlanValidation,
  type PreparedRepositoryOptimizationPlan,
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
import { repositoryUniverseClusterLegend, repositoryUniverseFocusCameraState } from '@/lib/workspace/repositoryUniverseVisual';
import type { RepositoryVerificationNodeOverlayState, UniverseCameraState, UniverseProjectedNodePosition } from '@/components/agentready/RepositoryUniverse3D';
import type { RepositoryIntelligenceReviewUiSession } from '@/components/agentready/RepositoryIntelligenceReviewPanel';
import type { RepositoryIntelligenceProviderStatus, RepositoryIntelligenceVerificationBaseline, RepositoryIntelligenceVerificationResult } from '@/lib/repositoryIntelligence';
import type { RepositoryFutureStageOverlay } from '../futures/futurePathwaysPresentation';
import { repositoryFutureProjectionToTransformationModel } from '@/lib/workspace/repositoryFutures';
import { buildFutureFieldLayout, futureImpulseEvent, futureRoutePath, type FutureEvidenceProjection } from '../futures/futurePathwaysLayout';
import { PostScanOverview } from '@/components/agentready/result-dashboard/PostScanOverview';
import { ResultChapterNav } from '@/components/agentready/result-dashboard/ResultChapterNav';
import { ResultChapterShell } from '@/components/agentready/result-dashboard/ResultChapterShell';
import { ResultChapterLoadBoundary, ResultChapterLoading } from '@/components/agentready/result-dashboard/ResultChapterLoadBoundary';
import { getResultChapterStatuses, workspaceInsights } from '@/components/agentready/result-dashboard/chapterState';
import { buildVerifyPresentation } from '@/components/agentready/result-dashboard/verifyPresentation';
import { VerificationJourney } from '@/components/agentready/result-dashboard/VerificationJourney';
import { selectRepositoryFrictions } from '@/components/agentready/result-dashboard/repositoryFrictions';
import type { ResultChapterId } from '@/components/agentready/result-dashboard/types';
import {
  Row,
  SummaryTile,
} from '../deliver/DeliveryWorkspaceSupport';
import {
  displayEvidenceSource,
  isGitHubSource,
  severityClass,
} from '../model/deliveryWorkspaceSelectors';

type RepositoryHealth = ReadinessReport['repositoryHealth'];
type RepositoryHealthSignal = RepositoryHealth['dimensions']['repositoryIntelligence']['signals'][number];

const RepositoryUniverse3D = lazy(() => import('@/components/agentready/RepositoryUniverse3D'));

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

export function AiWorkspaceHero({
  report,
  universeModel,
  limitationReason,
  story,
  activeStoryChapter,
  onActiveStoryChapterChange,
  activeResultChapter,
  onResultChapterChange,
  repositoryContextOverlay,
  chapterNavOverlay,
  flightPathRequested,
  onFlightPathRequested,
  onPlanReviewed,
  onPackagePrepared,
  onPrCreated,
  githubConnection,
  verificationBaseline,
  intelligenceVerificationBaseline,
  intelligenceVerificationResult,
  intelligenceVerificationStatus,
  onRescan,
  onSaveVerificationBaseline,
  onDiscardVerificationBaseline,
}: {
  report: ReadinessReport;
  universeModel: RepositoryUniverseModel;
  limitationReason?: string;
  story: WorkspaceStory;
  activeStoryChapter: WorkspaceStoryChapter | null;
  onActiveStoryChapterChange?: (chapterId: WorkspaceStoryChapterId | null) => void;
  activeResultChapter: ResultChapterId;
  onResultChapterChange: (chapter: ResultChapterId) => void;
  repositoryContextOverlay: ReactNode;
  chapterNavOverlay: ReactNode;
  flightPathRequested: boolean;
  onFlightPathRequested: () => void;
  onPlanReviewed: () => void;
  onPackagePrepared: () => void;
  onPrCreated: () => void;
  githubConnection?: GitHubConnectionState;
  verificationBaseline?: RepositoryVerificationBaseline | null;
  intelligenceVerificationBaseline?: RepositoryIntelligenceVerificationBaseline | null;
  intelligenceVerificationResult?: RepositoryIntelligenceVerificationResult | null;
  intelligenceVerificationStatus?: 'idle' | 'scanning' | 'completed' | 'failed';
  onRescan?: () => void;
  onSaveVerificationBaseline?: (baseline: RepositoryVerificationBaseline) => void;
  onDiscardVerificationBaseline?: () => void;
}) {
  const health = report.repositoryHealth;
  const unavailable = health.overall.score === null;

  const selectStoryChapter = (chapterId: WorkspaceStoryChapterId) => {
    const chapter = story.chapters.find(item => item.id === chapterId);
    if (!chapter) return;
    onActiveStoryChapterChange?.(chapterId);
  };

  return (
    <section className={activeResultChapter === 'understand'
      ? 'mb-6 overflow-hidden border-y border-primary/25 bg-canvas shadow-glow animate-fade-in-up'
      : 'mb-6 overflow-hidden rounded-[2rem] border border-primary/25 bg-canvas p-3 shadow-glow md:p-5 animate-fade-in-up'} aria-label="Repository Intelligence">
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
              universeModel={universeModel}
              story={story}
              activeChapter={activeStoryChapter}
              onSelectChapter={selectStoryChapter}
              activeResultChapter={activeResultChapter}
              onResultChapterChange={onResultChapterChange}
              repositoryContextOverlay={repositoryContextOverlay}
              chapterNavOverlay={chapterNavOverlay}
              flightPathRequested={flightPathRequested}
              onFlightPathRequested={onFlightPathRequested}
              onPlanReviewed={onPlanReviewed}
              onPackagePrepared={onPackagePrepared}
              onPrCreated={onPrCreated}
              githubConnection={githubConnection}
              verificationBaseline={verificationBaseline}
              intelligenceVerificationBaseline={intelligenceVerificationBaseline}
              intelligenceVerificationResult={intelligenceVerificationResult}
              intelligenceVerificationStatus={intelligenceVerificationStatus}
              onRescan={onRescan}
              onSaveVerificationBaseline={onSaveVerificationBaseline}
              onDiscardVerificationBaseline={onDiscardVerificationBaseline}
            />
          </>
        )}
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

type ContextualInspectorTab = 'overview' | 'evidence' | 'relationships' | 'agent-impact' | 'story' | 'dna' | 'mental-model';

export function FutureStageComposer({ overlay }: { overlay: RepositoryFutureStageOverlay }) {
  const primary = overlay.candidates.find(candidate => candidate.role === 'primary');
  const supports = overlay.candidates.filter(candidate => candidate.role === 'supporting');
  if (overlay.productIntelligenceState === 'analysing') {
    return <div data-testid="future-stage-composer" role="status" className="pointer-events-auto flex items-center gap-3 text-foreground"><span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_16px_hsl(var(--primary)/0.7)] motion-safe:animate-pulse" /><div><div className="text-[9px] font-mono uppercase tracking-[0.18em] text-primary">Current map → future pathways</div><div className="mt-1 text-sm font-semibold">Product directions are forming</div></div></div>;
  }
  return (
    <div data-testid="future-stage-composer" className="pointer-events-auto text-foreground drop-shadow-[0_1px_8px_hsl(var(--universe-stage-bg))]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><div className="text-[9px] font-mono uppercase tracking-[0.18em] text-primary">Current map → future pathways</div><div className="mt-1 truncate text-sm font-semibold">{primary?.title || 'Choose a primary direction'}</div></div>
        <div role="group" aria-label="Future Pathways stage mode" className="flex rounded-full border border-border/45 bg-[hsl(var(--universe-surface)/0.68)] p-0.5 backdrop-blur-sm">
          {(['quick', 'deep'] as const).map(mode => <button key={mode} type="button" aria-pressed={overlay.mode === mode} onClick={() => overlay.onModeChange(mode)} className={`min-h-9 rounded-md px-2 text-[11px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${overlay.mode === mode ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>{mode === 'quick' ? 'Quick' : 'Deep'}</button>)}
        </div>
      </div>
      <div data-testid="future-selected-path-summary" className="mt-2 flex flex-wrap gap-1.5 text-[9px] text-muted-foreground"><span className="rounded-full border border-primary/25 bg-primary/[0.06] px-2 py-1">{primary ? 'Primary selected' : `${overlay.candidates.length} directions`}</span><span className="rounded-full border border-border/40 px-2 py-1">{supports.length}/2 supports</span><span className="rounded-full border border-border/40 px-2 py-1">{overlay.dependencies.length} automatic</span></div>
      {overlay.tracePinned && overlay.onTraceClear && <button type="button" onClick={overlay.onTraceClear} className="mt-1 min-h-9 rounded-full border border-border/45 bg-[hsl(var(--universe-surface)/0.6)] px-2.5 text-[10px] text-muted-foreground backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Clear trace</button>}
    </div>
  );
}

export function FutureContextInspector({ overlay }: { overlay: RepositoryFutureStageOverlay }) {
  const activeId = overlay.activeTraceId || overlay.focusedId;
  const candidate = overlay.candidates.find(item => item.goalId === activeId);
  const dependency = overlay.dependencies.find(item => item.id === activeId);
  if (!candidate && !dependency) return null;
  const title = candidate?.title || dependency!.title;
  const role = candidate?.role || 'required dependency';
  const rationale = candidate?.rationale || dependency?.rationale || 'This step is derived from the current deterministic Future Graph.';
  const evidence = candidate?.evidencePaths || dependency?.evidencePaths || [];
  const limitations = candidate?.limitations || dependency?.limitations || [];
  return (
    <aside data-testid="future-context-inspector" aria-label="Selected Future Pathways inspector" className="pointer-events-auto absolute bottom-4 right-3 top-[5.5rem] z-[var(--layer-inspector)] hidden w-[min(21rem,28vw)] overflow-y-auto rounded-[1.4rem] border border-primary/20 bg-[hsl(var(--universe-surface-raised)/0.94)] shadow-[var(--shadow-floating-panel)] backdrop-blur-xl lg:block">
      <div className="sticky top-0 border-b border-border/50 bg-[hsl(var(--universe-surface-raised)/0.96)] px-4 py-3">
        <div className="flex items-start justify-between gap-3"><div><div className="text-[9px] font-mono uppercase tracking-[0.17em] text-primary">{role}</div><h3 className="mt-1 text-sm font-semibold leading-snug">{title}</h3></div>{overlay.onTraceClear && <button type="button" onClick={overlay.onTraceClear} className="min-h-9 shrink-0 rounded-full border border-border/50 px-2.5 text-[10px] text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Clear</button>}</div>
      </div>
      <div className="space-y-4 p-4 text-xs">
        <p className="leading-relaxed text-foreground">{rationale}</p>
        {candidate && <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-[11px]"><dt className="text-muted-foreground">Direction</dt><dd>{candidate.capabilityTitle || candidate.title}</dd><dt className="text-muted-foreground">Fit</dt><dd>{candidate.fit}</dd><dt className="text-muted-foreground">Origin</dt><dd>{candidate.origin}</dd><dt className="text-muted-foreground">Confidence</dt><dd className="capitalize">{candidate.confidence}</dd><dt className="text-muted-foreground">Compatibility</dt><dd className="capitalize">{candidate.compatibility.replace(/-/g, ' ')}</dd>{candidate.humanReviewRequired && <><dt className="text-muted-foreground">Gate</dt><dd>Human review required</dd></>}</dl>}
        {dependency && <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-[11px]"><dt className="text-muted-foreground">Order</dt><dd>{dependency.executionOrder + 1}</dd><dt className="text-muted-foreground">State</dt><dd className="capitalize">{dependency.state.replace(/-/g, ' ')}</dd><dt className="text-muted-foreground">Required by</dt><dd>{dependency.dependentCount} selected {dependency.dependentCount === 1 ? 'goal' : 'goals'}</dd>{dependency.humanReviewRequired && <><dt className="text-muted-foreground">Gate</dt><dd>Human review required</dd></>}</dl>}
        {candidate?.artifactLabels?.length ? <div><h4 className="text-[9px] font-mono uppercase tracking-[0.14em] text-muted-foreground">Expected artifacts</h4><ul className="mt-2 space-y-1.5">{candidate.artifactLabels.slice(0, 4).map(label => <li key={label} className="break-all rounded-lg bg-background/35 px-2.5 py-2">{label}</li>)}</ul></div> : null}
        {evidence.length ? <details><summary className="cursor-pointer text-[10px] font-medium text-primary">Evidence references</summary><ul className="mt-2 space-y-1 text-[10px] text-muted-foreground">{evidence.slice(0, 6).map(item => <li key={item} className="break-all">{item}</li>)}</ul></details> : null}
        {limitations.length ? <details><summary className="cursor-pointer text-[10px] font-medium text-warning">Limitations</summary><ul className="mt-2 space-y-1 text-[10px] text-muted-foreground">{limitations.slice(0, 5).map(item => <li key={item}>{item}</li>)}</ul></details> : null}
        {candidate?.role === 'candidate' && <button type="button" onClick={() => overlay.onCandidateSelect(candidate.goalId)} className="min-h-11 w-full rounded-xl bg-primary px-3 text-sm font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Choose as primary</button>}
      </div>
    </aside>
  );
}

export function FutureNeuralField({ overlay, mobile, reducedMotion, evidenceProjections }: { overlay: RepositoryFutureStageOverlay; mobile: boolean; reducedMotion: boolean; evidenceProjections: FutureEvidenceProjection }) {
  if (overlay.productIntelligenceState === 'analysing') {
    return <div data-testid="future-neural-field" data-future-phase={overlay.phase} data-future-direction={mobile ? 'top-to-bottom' : 'left-to-right'} data-reduced-motion-contract={reducedMotion ? 'static' : 'one-shot'} className="pointer-events-none absolute inset-0 z-[var(--layer-graph-overlay)] bg-[linear-gradient(90deg,transparent,hsl(var(--primary)/0.035))]" aria-hidden="true" />;
  }
  if (mobile) {
    const primary = overlay.candidates.find(candidate => candidate.role === 'primary');
    const dependencies = overlay.dependencies.slice().sort((left, right) => left.executionOrder - right.executionOrder).slice(0, 3);
    return (
      <div data-testid="future-neural-field" data-future-phase={overlay.phase} data-mobile-dom-sequence="true" className="pointer-events-none absolute inset-0 z-[var(--layer-graph-overlay)] flex items-end bg-[hsl(var(--universe-stage-bg)/0.28)] px-3 pb-24">
        <div className="pointer-events-auto w-full rounded-[1.35rem] border border-primary/20 bg-[hsl(var(--universe-surface)/0.94)] p-4 shadow-[var(--shadow-floating-panel)] backdrop-blur-xl">
          <div className="text-[9px] font-mono uppercase tracking-[0.17em] text-primary">Current → intervention → future</div><div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]"><span className="rounded-full border border-accent/35 px-2 py-1">Repository evidence</span><span aria-hidden="true">→</span>{dependencies.map(dependency => <span key={dependency.id} className="rounded-full border border-border/50 px-2 py-1">{dependency.title}</span>)}<span aria-hidden="true">→</span><strong className="rounded-full border border-primary/40 bg-primary/10 px-2 py-1">{primary?.title || 'Choose a primary future'}</strong></div><button type="button" onClick={overlay.onOpenDomControls} className="mt-3 min-h-11 w-full rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Open path details</button>
        </div>
      </div>
    );
  }
  const layout = buildFutureFieldLayout(overlay, evidenceProjections);
  const impulse = futureImpulseEvent(overlay, reducedMotion);
  return (
    <div data-testid="future-neural-field" data-future-phase={overlay.phase} data-future-direction="left-to-right" data-reduced-motion-contract={reducedMotion ? 'static' : 'one-shot'} className="pointer-events-none absolute inset-0 z-[var(--layer-graph-overlay)] overflow-hidden bg-[linear-gradient(90deg,transparent_0%,hsl(var(--universe-stage-bg)/0.07)_35%,hsl(var(--primary)/0.04)_100%)] motion-safe:animate-fade-in">
      {layout.zones.map(zone => <div key={zone.id} data-future-zone={zone.id} aria-hidden="true" className="absolute bottom-5 top-[12%] w-[16%] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.025),transparent_70%)]" style={{ left: `${zone.x}%` }}><span className="absolute left-1/2 top-0 w-max -translate-x-1/2 text-[8px] font-mono uppercase tracking-[0.16em] text-muted-foreground/55">{zone.label}</span></div>)}
      <div aria-hidden="true" className="absolute inset-y-[7%] w-24 -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.07),transparent_70%)] opacity-60 blur-xl" style={{ left: `${layout.horizonX}%` }} />
      <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
        <defs>
          <linearGradient id="future-path-gradient" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="hsl(var(--accent))" stopOpacity=".22" /><stop offset="1" stopColor="hsl(var(--primary))" stopOpacity=".92" /></linearGradient>
          <filter id="future-path-glow"><feGaussianBlur stdDeviation="0.42" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        {layout.routes.map(path => <path key={path.id} data-future-route={path.kind} data-route-broken={path.broken || undefined} d={futureRoutePath(path)} fill="none" stroke={path.kind === 'conflict' ? 'hsl(var(--warning))' : ['execution', 'support', 'capability'].includes(path.kind) ? 'url(#future-path-gradient)' : 'hsl(var(--muted-foreground))'} strokeWidth={path.kind === 'execution' ? 0.62 : path.kind === 'support' || path.kind === 'capability' ? 0.42 : 0.22} strokeDasharray={path.broken ? '2.3 2.8' : !path.deterministic || path.kind === 'saved' ? '1.1 1.15' : undefined} opacity={path.opacity} vectorEffect="non-scaling-stroke" filter={path.kind === 'execution' || path.kind === 'support' ? 'url(#future-path-glow)' : undefined} className="transition-opacity duration-200 motion-reduce:transition-none" />)}
      </svg>
      {layout.nodes.filter(node => node.kind === 'evidence').map(node => <span key={node.id} data-future-node="evidence" data-source-universe-node={node.sourceUniverseNodeId} aria-hidden="true" className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-accent/60 bg-accent/15 shadow-[0_0_16px_hsl(var(--accent)/0.22)] transition-opacity duration-200 motion-reduce:transition-none" style={{ left: `${node.x}%`, top: `${node.y}%`, opacity: node.opacity }} />)}
      {layout.nodes.filter(node => node.kind === 'bundle').map(node => <span key={node.id} data-future-node="bundle" aria-hidden="true" className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-accent/50 bg-[hsl(var(--universe-surface)/0.6)] shadow-[0_0_22px_hsl(var(--accent)/0.2)] transition-opacity duration-200 motion-reduce:transition-none" style={{ left: `${node.x}%`, top: `${node.y}%`, opacity: node.opacity }}><span className="absolute inset-[3px] rounded-full bg-accent/45" /></span>)}
      {layout.nodes.filter(node => node.kind === 'intervention').map(node => <button key={node.id} type="button" data-future-node="intervention" onMouseEnter={() => overlay.onTracePreview?.(node.pathGoalIds[0])} onMouseLeave={() => overlay.onTracePreview?.()} onFocus={() => overlay.onTracePreview?.(node.pathGoalIds[0])} onBlur={() => overlay.onTracePreview?.()} onClick={() => overlay.onTracePin?.(node.pathGoalIds[0])} className="pointer-events-auto absolute min-h-11 -translate-x-1/2 -translate-y-1/2 rounded-full px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" style={{ left: `${node.x}%`, top: `${node.y}%`, opacity: node.opacity }} aria-label={`${node.label}. Intervention capability. Activate to pin its path.`}><span className="block h-5 w-5 rounded-md border border-primary/55 bg-primary/10 shadow-[0_0_20px_hsl(var(--primary)/0.2)]" /><span className="absolute left-1/2 top-[calc(50%+1rem)] w-max max-w-[7rem] -translate-x-1/2 text-[8px] font-medium leading-tight text-muted-foreground">{node.label}</span></button>)}
      {layout.nodes.filter(node => node.kind === 'dependency').map(node => {
        const shared = node.pathGoalIds.length > 1;
        return <div key={node.id} className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${node.x}%`, top: `${node.y}%`, opacity: node.opacity }}>
          <button type="button" data-future-node="dependency" data-dependency-state={node.state} data-review-required={node.reviewRequired || undefined} data-convergent-paths={shared ? node.pathGoalIds.length : undefined} onMouseEnter={() => overlay.onTracePreview?.(node.id)} onMouseLeave={() => overlay.onTracePreview?.()} onFocus={() => overlay.onTracePreview?.(node.id)} onBlur={() => overlay.onTracePreview?.()} onClick={() => { overlay.onDependencyFocus(node.id); overlay.onTracePin?.(node.id); }} className={`pointer-events-auto grid h-9 w-9 rotate-45 place-items-center border bg-[hsl(var(--universe-surface-raised)/0.9)] transition-transform duration-200 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${shared ? 'shadow-[0_0_34px_hsl(var(--primary)/0.38)]' : 'shadow-[0_0_24px_hsl(var(--accent)/0.16)]'} ${node.state === 'satisfied' ? 'rounded-full border-solid border-accent/45' : node.reviewRequired || node.state === 'review-required' ? 'rounded-[0.35rem] border-double border-warning/70' : node.state === 'blocked' ? 'rounded-none border-dashed border-warning/65' : 'rounded-[0.35rem] border-accent/65'}`} aria-label={`${node.label}. Required dependency. ${shared ? `Shared by ${node.pathGoalIds.length} selected directions. ` : ''}${node.state}. Execution order ${(node.order || 0) + 1}.${node.reviewRequired ? ' Human review required.' : ''}`}><span className="-rotate-45 text-[9px] font-bold text-accent">{node.state === 'satisfied' ? '✓' : node.reviewRequired || node.state === 'review-required' ? '!' : node.state === 'blocked' ? '×' : (node.order || 0) + 1}</span></button>
          <span aria-hidden="true" className="absolute left-1/2 top-[calc(50%+1.7rem)] w-max max-w-[7rem] -translate-x-1/2 text-center text-[8px] font-medium leading-tight text-muted-foreground"><span className="block text-foreground">{node.label}</span>{shared && <span className="font-mono uppercase tracking-[0.12em] text-primary">shared path</span>}</span>
        </div>;
      })}
      {layout.nodes.filter(node => node.kind === 'goal').map(node => {
        const candidate = overlay.candidates.find(item => item.goalId === node.id)!;
        const selectable = candidate.role === 'candidate';
        const primary = candidate.role === 'primary';
        const activePrimary = overlay.candidates.some(item => item.role === 'primary');
        const actionLabel = selectable ? activePrimary ? 'attach as a supporting direction' : 'choose as primary' : 'pin its path';
        return <button key={node.id} type="button" data-future-node="goal" data-future-role={candidate.role} onFocus={() => overlay.onTracePreview?.(candidate.goalId)} onBlur={() => overlay.onTracePreview?.()} onMouseEnter={() => overlay.onTracePreview?.(candidate.goalId)} onMouseLeave={() => overlay.onTracePreview?.()} onClick={() => selectable ? activePrimary ? overlay.onCandidateAddSupport(candidate.goalId) : overlay.onCandidateSelect(candidate.goalId) : overlay.onTracePin?.(candidate.goalId)} className="group pointer-events-auto absolute min-h-11 min-w-11 -translate-x-1/2 -translate-y-1/2 rounded-full transition-opacity duration-200 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" style={{ left: `${node.x}%`, top: `${node.y}%`, opacity: node.opacity, transform: `translate(-50%, -50%) scale(${node.scale})` }} aria-label={`${candidate.title}. ${candidate.fit}. ${candidate.role}. ${candidate.origin}. Activate to ${actionLabel}.`}><span aria-hidden="true" className={`absolute left-1/2 top-1/2 block -translate-x-1/2 -translate-y-1/2 rounded-full border ${primary ? 'h-10 w-10 border-primary/90 bg-primary/20 shadow-[0_0_38px_hsl(var(--primary)/0.42)]' : candidate.role === 'supporting' ? 'h-7 w-7 border-accent/80 bg-accent/20 shadow-[0_0_25px_hsl(var(--accent)/0.28)]' : candidate.role === 'saved' ? 'h-4 w-4 border-dashed border-muted-foreground/55 bg-background/25' : candidate.role === 'blocked' ? 'h-5 w-5 border-dashed border-warning/60 bg-warning/10' : 'h-6 w-6 border-primary/45 bg-primary/10 shadow-[0_0_18px_hsl(var(--primary)/0.16)] group-hover:border-primary/80'}`} /><span className={`absolute left-1/2 top-[calc(50%+1.55rem)] w-max max-w-[9rem] -translate-x-1/2 text-center leading-tight text-foreground drop-shadow-[0_1px_4px_hsl(var(--universe-stage-bg))] ${primary ? 'text-xs font-semibold' : 'text-[10px] font-medium'}`}><span className="block text-[8px] font-mono uppercase tracking-[0.13em] text-muted-foreground">{candidate.role === 'candidate' ? activePrimary ? 'add support' : candidate.fit : candidate.role}</span>{candidate.title}</span></button>;
      })}
      {impulse && <span key={overlay.draftFingerprint || overlay.activeTraceId || overlay.focusedId} data-semantic-impulse={impulse} aria-hidden="true" className="future-semantic-impulse absolute h-2 w-2 rounded-full bg-primary shadow-[0_0_18px_hsl(var(--primary)/0.8)]" style={{ left: `${layout.horizonX}%`, top: '50%' }} />}
      <div className="absolute bottom-4 left-[42%] -translate-x-1/2 rounded-full bg-[hsl(var(--universe-stage-bg)/0.7)] px-3 py-1.5 text-[9px] text-muted-foreground backdrop-blur-sm">Solid = evidence-backed · dashed = inferred or saved · diamond = required · broken = conflict</div>
    </div>
  );
}

function RepositoryAtlasVisualization({
  report,
  universeModel,
  story,
  activeChapter,
  onSelectChapter,
  activeResultChapter,
  onResultChapterChange,
  repositoryContextOverlay,
  chapterNavOverlay,
  flightPathRequested,
  onFlightPathRequested,
  onPlanReviewed,
  onPackagePrepared,
  onPrCreated,
  githubConnection,
  verificationBaseline,
  intelligenceVerificationBaseline,
  intelligenceVerificationResult,
  intelligenceVerificationStatus,
  onRescan,
  onSaveVerificationBaseline,
  onDiscardVerificationBaseline,
  futureStageOverlay,
}: {
  report: ReadinessReport;
  universeModel: RepositoryUniverseModel;
  story: WorkspaceStory;
  activeChapter: WorkspaceStoryChapter | null;
  onSelectChapter: (chapterId: WorkspaceStoryChapterId) => void;
  activeResultChapter: ResultChapterId;
  onResultChapterChange: (chapter: ResultChapterId) => void;
  repositoryContextOverlay: ReactNode;
  chapterNavOverlay: ReactNode;
  flightPathRequested: boolean;
  onFlightPathRequested: () => void;
  onPlanReviewed: () => void;
  onPackagePrepared: () => void;
  onPrCreated: () => void;
  githubConnection?: GitHubConnectionState;
  verificationBaseline?: RepositoryVerificationBaseline | null;
  intelligenceVerificationBaseline?: RepositoryIntelligenceVerificationBaseline | null;
  intelligenceVerificationResult?: RepositoryIntelligenceVerificationResult | null;
  intelligenceVerificationStatus?: 'idle' | 'scanning' | 'completed' | 'failed';
  onRescan?: () => void;
  onSaveVerificationBaseline?: (baseline: RepositoryVerificationBaseline) => void;
  onDiscardVerificationBaseline?: () => void;
  futureStageOverlay?: RepositoryFutureStageOverlay | null;
}) {
  const { resolvedTheme } = useTheme();
  const isMobile = useIsMobile();
  const universeTheme = resolvedTheme === 'light' ? 'light' : 'dark';
  const atlas = useMemo(() => buildRepositoryAtlasModel(report), [report]);
  const universe = universeModel;
  const transformation = useMemo(() => buildRepositoryTransformationProposalModel(report, universe, atlas), [report, universe, atlas]);
  const connection = useMemo(() => githubConnection || buildGitHubConnectionFromReport(report), [githubConnection, report]);
  const initialUniverseCamera = useMemo(() => initialUniverseCameraState(universe), [universe]);
  const prefersReducedMotion = usePrefersReducedMotion();
  const atlasRootRef = useRef<HTMLElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const inspectorSheetRef = useRef<HTMLElement | null>(null);
  const fullscreenLayerRef = useRef<HTMLDivElement | null>(null);
  const fullscreenButtonRef = useRef<HTMLButtonElement | null>(null);
  const exitFullscreenButtonRef = useRef<HTMLButtonElement | null>(null);
  const fullscreenWasOpenRef = useRef(false);
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
  const [futureImpactMode, setFutureImpactMode] = useState<'current' | 'selected-path'>('current');
  const [legacyImprovementPreviewActive, setLegacyImprovementPreviewActive] = useState(false);
  const [transformationDomain, setTransformationDomain] = useState<RepositoryTransformationDomainFilter>('all');
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null);
  const [excludedProposalIds, setExcludedProposalIds] = useState<Set<string>>(() => new Set());
  const [optimizationPlanOpen, setOptimizationPlanOpen] = useState(false);
  const optimizationPlanTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [selectedOptimizationItemId, setSelectedOptimizationItemId] = useState<string | null>(null);
  const [preparedOptimizationPlan, setPreparedOptimizationPlan] = useState<PreparedRepositoryOptimizationPlan | null>(null);
  const [planPreparationNotice, setPlanPreparationNotice] = useState('');
  const [selectedUniverseNodeId, setSelectedUniverseNodeId] = useState(universe.rootNodeId);
  const [universeCamera, setUniverseCamera] = useState<UniverseCameraState>(initialUniverseCamera);
  const [universeFocusRequest, setUniverseFocusRequest] = useState({ nodeId: universe.rootNodeId, sequence: 0 });
  const [universeRotationPaused, setUniverseRotationPaused] = useState(prefersReducedMotion);
  const [universeSceneSettled, setUniverseSceneSettled] = useState(prefersReducedMotion);
  const [universeRetryKey, setUniverseRetryKey] = useState(0);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string; detail: string } | null>(null);
  const [atlasReady, setAtlasReady] = useState(prefersReducedMotion);
  const [navigationActive, setNavigationActive] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [inspectorScrollActive, setInspectorScrollActive] = useState(false);
  const [inspectorDismissed, setInspectorDismissed] = useState(false);
  const [mobileInspectorExpanded, setMobileInspectorExpanded] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileControlsOpen, setMobileControlsOpen] = useState(false);
  const [repositoryProfileOpen, setRepositoryProfileOpen] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<ContextualInspectorTab>('overview');
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
  const selectedPathTransformation = useMemo(
    () => repositoryFutureProjectionToTransformationModel(universe, futureStageOverlay?.universeProjection),
    [futureStageOverlay?.universeProjection, universe],
  );
  const selectedPathProjectionActive = Boolean(futureStageOverlay && !legacyImprovementPreviewActive);
  const renderedTransformation = selectedPathProjectionActive ? selectedPathTransformation : transformation;
  const renderedTransformationMode: RepositoryTransformationMode = selectedPathProjectionActive
    ? futureImpactMode === 'selected-path' ? 'with-shipseal' : 'current'
    : transformationMode === 'after-rescan' ? 'current' : transformationMode;
  const selectedProposal = selectedProposalId ? renderedTransformation.proposals.find(proposal => proposal.id === selectedProposalId) || null : null;
  useEffect(() => {
    if (futureStageOverlay && !futureStageOverlay.universeProjection && futureImpactMode === 'selected-path') setFutureImpactMode('current');
  }, [futureImpactMode, futureStageOverlay]);
  useEffect(() => {
    if (selectedProposalId && !renderedTransformation.proposals.some(proposal => proposal.id === selectedProposalId)) setSelectedProposalId(null);
  }, [renderedTransformation.proposals, selectedProposalId]);
  const domainCounts = useMemo(() => repositoryTransformationDomainCounts(transformation.proposals), [transformation.proposals]);
  const visibleTransformationProposals = useMemo(() => transformation.proposals.filter(proposal => transformationDomain === 'all' || proposal.domain === transformationDomain), [transformation.proposals, transformationDomain]);
  const renderedTransformationProposals = selectedPathProjectionActive ? selectedPathTransformation.proposals : visibleTransformationProposals;
  const visibleIncludedTransformationProposals = useMemo(
    () => visibleTransformationProposals.filter(proposal => !excludedProposalIds.has(proposal.id)),
    [excludedProposalIds, visibleTransformationProposals],
  );
  const visibleTransformationArtifactCount = useMemo(
    () => new Set(visibleIncludedTransformationProposals.flatMap(proposal => proposal.artifactActions.map(action => action.path))).size,
    [visibleIncludedTransformationProposals],
  );
  const visibleTransformationRelationshipCount = useMemo(
    () => visibleIncludedTransformationProposals.reduce((count, proposal) => count + proposal.graphChanges.proposedEdges.length, 0),
    [visibleIncludedTransformationProposals],
  );
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
  const optimizationPlanValidation = useMemo(
    () => optimizationPlan ? validateRepositoryOptimizationPlan(optimizationPlan) : null,
    [optimizationPlan],
  );
  const activePreparedOptimizationPlan = optimizationPlan
    && preparedOptimizationPlan?.sourcePlanId === optimizationPlan.id
    ? preparedOptimizationPlan
    : null;
  const optimizationApplyPlan = activePreparedOptimizationPlan?.applyPlan || null;
  const verificationResult = useMemo(() => verificationBaseline
    ? buildRepositoryVerificationResult({ baseline: verificationBaseline, currentReport: report })
    : null, [report, verificationBaseline]);
  const intelligenceVerifiedCount = intelligenceVerificationResult
    ? intelligenceVerificationResult.counts['verified-exact']
      + intelligenceVerificationResult.counts['verified-present-with-modifications']
      + intelligenceVerificationResult.counts['verified-strengthened']
    : 0;
  const intelligenceUnresolvedCount = intelligenceVerificationResult
    ? intelligenceVerificationResult.counts.missing
      + intelligenceVerificationResult.counts.conflicting
      + intelligenceVerificationResult.counts['partially-verified']
      + intelligenceVerificationResult.counts['requires-human-review']
      + intelligenceVerificationResult.counts.unavailable
    : 0;
  const optimizationVerifiedCount = verificationResult?.status === 'matched-rescan'
    ? verificationResult.counts.detected + verificationResult.counts.contentMatched
    : 0;
  const optimizationUnresolvedCount = verificationResult?.status === 'matched-rescan'
    ? verificationResult.counts.needsReview + verificationResult.counts.missing + verificationResult.counts.notVerifiable + verificationResult.counts.blocked
    : 0;
  const hasVerificationEvidence = Boolean(intelligenceVerificationResult || verificationResult?.status === 'matched-rescan');
  const verifyPresentation = buildVerifyPresentation({
    selectedProposalCount: includedProposalCount,
    preparedArtifactCount: preparedOptimizationPlan?.applyPlan.summary.selectedArtifactCount || 0,
    appliedArtifactCount: Math.max(
      verificationBaseline && verificationBaseline.applyMethod !== 'manual-baseline' ? verificationBaseline.artifacts.length : 0,
      intelligenceVerificationBaseline?.artifacts.length || 0,
    ),
    verifiedItemCount: intelligenceVerificationResult ? intelligenceVerifiedCount : optimizationVerifiedCount,
    unresolvedItemCount: intelligenceVerificationResult ? intelligenceUnresolvedCount : optimizationUnresolvedCount,
    hasVerificationEvidence,
  });
  const selectedOptimizationItem = selectedOptimizationItemId
    ? optimizationPlan?.items.find(item => item.id === selectedOptimizationItemId) || null
    : optimizationPlan?.items[0] || null;
  const relatedNodeIds = useMemo(() => relatedAtlasNodeIds(atlas, selectedNode?.id, activeChapterNodeId, focusedClusterId), [atlas, selectedNode?.id, activeChapterNodeId, focusedClusterId]);
  const searchMatches = useMemo(() => matchingAtlasNodeIds(atlas, query), [atlas, query]);
  const universeSearchMatches = useMemo(() => matchingUniverseNodeIds(universe, query), [universe, query]);
  const universeFilterCounts = useMemo(() => repositoryUniverseFilterCounts(universe), [universe]);
  const universeClusterLegend = useMemo(() => repositoryUniverseClusterLegend(universe.clusters), [universe.clusters]);
  const hasVerifiedRescanComparison = verificationResult?.status === 'matched-rescan' || Boolean(intelligenceVerificationResult);
  const verificationPathStates = useMemo(() => {
    const states = new Map<string, RepositoryVerificationNodeOverlayState>();
    for (const artifact of verificationResult?.artifacts || []) {
      const state: RepositoryVerificationNodeOverlayState = artifact.state === 'verified-file-presence' || artifact.state === 'verified-content-match'
        ? 'verified-change' : artifact.state === 'needs-human-review' ? 'partially-verified'
          : artifact.state === 'missing-after-rescan' ? 'regressed' : 'unresolved';
      states.set(normalizeWorkspacePath(artifact.destinationPath), state);
    }
    for (const artifact of intelligenceVerificationResult?.artifacts || []) {
      const state: RepositoryVerificationNodeOverlayState = artifact.state === 'verified-exact' || artifact.state === 'verified-strengthened'
        ? 'verified-change' : artifact.state === 'verified-present-with-modifications' || artifact.state === 'partially-verified' || artifact.state === 'requires-human-review'
          ? 'partially-verified' : artifact.state === 'conflicting' || artifact.state === 'stale'
            ? 'regressed' : artifact.state === 'missing' || artifact.state === 'unavailable' ? 'unresolved' : 'unchanged';
      states.set(normalizeWorkspacePath(artifact.targetPath), state);
    }
    return states;
  }, [intelligenceVerificationResult?.artifacts, verificationResult?.artifacts]);
  const verificationUniverseNodeStates = useMemo(() => Object.fromEntries(universe.nodes.flatMap(node => {
    const state = node.path ? verificationPathStates.get(normalizeWorkspacePath(node.path)) : undefined;
    return state ? [[node.id, state]] : [];
  })), [universe.nodes, verificationPathStates]);
  const verificationOverlayCounts = useMemo(() => ({
    verified: [...verificationPathStates.values()].filter(state => state === 'verified-change').length,
    partial: [...verificationPathStates.values()].filter(state => state === 'partially-verified').length,
    unresolved: [...verificationPathStates.values()].filter(state => state === 'unresolved').length,
    regressed: [...verificationPathStates.values()].filter(state => state === 'regressed').length,
  }), [verificationPathStates]);
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
    if (renderedTransformationMode !== 'with-shipseal') return ids;
    for (const proposal of renderedTransformationProposals) {
      for (const universeNodeId of proposal.graphChanges.affectedExistingNodeIds) {
        const atlasNode = atlasNodeForUniverseNodeId(universeNodeId, universe, atlas);
        if (atlasNode) ids.add(atlasNode.id);
      }
    }
    return ids;
  }, [atlas, renderedTransformationMode, renderedTransformationProposals, universe]);
  const searchResults = query.trim()
    ? (viewMode === 'universe3d'
      ? universe.nodes.filter(node => universeSearchMatches.has(node.id) && visibleUniverseNodeIds.has(node.id)).slice(0, 8)
      : atlas.nodes.filter(node => searchMatches.has(node.id)).slice(0, 5))
    : [];
  const atlasNavigationActive = navigationActive || fullscreen;
  const planReadyForChapter = activeResultChapter === 'verify';
  const flightPathUniverseNodeIds = useMemo(() => agentFlightPath?.routeNodeIds.universeNodeIds || [], [agentFlightPath]);
  const inspectorVisible = !inspectorDismissed && (viewMode === 'universe3d'
    ? repositoryProfileOpen || selectedUniverseNode?.id !== universe.rootNodeId || flightPathUniverseNodeIds.length > 0
    : selectedNode?.id !== atlas.rootNodeId);
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
    setUniverseFocusRequest({ nodeId: universe.rootNodeId, sequence: 0 });
    setUniverseSceneSettled(prefersReducedMotion);
    setTransformationMode('current');
    setTransformationDomain('all');
    setSelectedProposalId(null);
    setExcludedProposalIds(new Set());
    setOptimizationPlanOpen(false);
    setSelectedOptimizationItemId(null);
    setInspectorDismissed(false);
    setMobileInspectorExpanded(false);
    setMobileSearchOpen(false);
    setMobileControlsOpen(false);
    setRepositoryProfileOpen(false);
    setInspectorTab('overview');
    setAgentFlightPathTask('');
    setAgentFlightPath(null);
    setAgentFlightPathCopied(false);
  }, [report.repoName, report.scannedAt, initialUniverseCamera, prefersReducedMotion, universe.rootNodeId]);

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
    setOptimizationPlanOpen(false);
  }, [planReadyForChapter, transformation.proposals.length]);

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
      if (mobileControlsOpen) {
        setMobileControlsOpen(false);
        return;
      }
      if (tooltip) {
        setTooltip(null);
        return;
      }
      if (fullscreen) {
        exitFullscreen();
        return;
      }
      if (isMobile && inspectorVisible) {
        setInspectorDismissed(true);
        setMobileInspectorExpanded(false);
        return;
      }
      if (navigationActive) {
        setNavigationActive(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [exitFullscreen, fullscreen, inspectorVisible, isMobile, mobileControlsOpen, navigationActive, tooltip]);

  useEffect(() => {
    if (!isMobile || !inspectorVisible || fullscreen) return;
    const frame = requestAnimationFrame(() => inspectorSheetRef.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [fullscreen, inspectorVisible, isMobile, selectedNodeId, selectedProposalId, selectedUniverseNodeId]);

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
    if (fullscreen) {
      fullscreenWasOpenRef.current = true;
      return;
    }
    if (!fullscreenWasOpenRef.current) return;
    fullscreenWasOpenRef.current = false;
    fullscreenButtonRef.current?.focus();
  }, [fullscreen]);

  const selectNode = useCallback((node: RepositoryAtlasNode) => {
    setSelectedNodeId(node.id);
    setInspectorDismissed(false);
    setMobileInspectorExpanded(false);
    setRepositoryProfileOpen(node.id === atlas.rootNodeId || node.kind === 'repository');
    setInspectorTab(node.evidenceItems.length ? 'evidence' : 'overview');
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
  }, [atlas.rootNodeId, onSelectChapter, story.chapters, universe.nodes]);

  const focusUniverseNode = useCallback((node: RepositoryUniverseNode) => {
    setUniverseSceneSettled(true);
    setUniverseCamera(current => repositoryUniverseFocusCameraState(current, node, universe.rootNodeId));
    setUniverseFocusRequest(current => ({ nodeId: node.id, sequence: current.sequence + 1 }));
  }, [universe.rootNodeId]);

  const selectUniverseNode = useCallback((node: RepositoryUniverseNode) => {
    setSelectedUniverseNodeId(node.id);
    setInspectorDismissed(false);
    setMobileInspectorExpanded(false);
    setRepositoryProfileOpen(node.id === universe.rootNodeId || node.kind === 'repository');
    setInspectorTab(node.evidenceItems.length ? 'evidence' : 'overview');
    if (node.clusterId) setFocusedClusterId(node.clusterId);
    if (node.metadata.atlasNodeId) setSelectedNodeId(node.metadata.atlasNodeId);
    focusUniverseNode(node);
    const chapterId = typeof node.metadata.storyChapterId === 'string' ? node.metadata.storyChapterId as WorkspaceStoryChapterId : null;
    if (chapterId && story.chapters.some(chapter => chapter.id === chapterId)) {
      onSelectChapter(chapterId);
    }
  }, [focusUniverseNode, onSelectChapter, story.chapters, universe.rootNodeId]);

  const changeViewMode = (mode: 'universe3d' | 'atlas2d') => {
    if (mode === viewMode) return;
    setUniverseSceneSettled(true);
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

  const handleOptimizationPlanOpenChange = (open: boolean) => {
    setOptimizationPlanOpen(open);
    if (!open) {
      window.setTimeout(() => optimizationPlanTriggerRef.current?.focus(), 0);
    }
  };

  const selectProposal = useCallback((proposal: RepositoryTransformationProposal) => {
    setTransformationMode('with-shipseal');
    setSelectedProposalId(proposal.id);
    setInspectorDismissed(false);
    setMobileInspectorExpanded(false);
    setRepositoryProfileOpen(false);
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
      focusUniverseNode(universeNode);
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
  }, [agentFlightPath, atlas.nodes, focusUniverseNode, universe.nodes]);

  const toggleProposalIncluded = (proposalId: string) => {
    if (preparedOptimizationPlan) {
      setPreparedOptimizationPlan(null);
      setPlanPreparationNotice('Selection changed. Review the updated artifacts and prepare the plan again.');
    }
    setExcludedProposalIds(current => {
      const next = new Set(current);
      if (next.has(proposalId)) next.delete(proposalId);
      else next.add(proposalId);
      return next;
    });
  };

  const prepareOptimizationPlan = () => {
    if (!optimizationPlan) return;
    const result = prepareRepositoryOptimizationPlan(optimizationPlan, {
      githubAvailable: connection.canCreatePullRequest && Boolean(connection.installationId && connection.owner && connection.repo),
      githubUnavailableReason: githubUnavailableReason(connection),
    });
    if (result.status === 'blocked') {
      setPreparedOptimizationPlan(null);
      setPlanPreparationNotice('Preparation is blocked. Resolve the validation issues below and try again.');
      return;
    }
    setPreparedOptimizationPlan(result.prepared);
    setPlanPreparationNotice('Prepared successfully. ZIP and PR now use this exact validated plan.');
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
    setUniverseSceneSettled(true);
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

  const openRepositoryContext = (tab: ContextualInspectorTab) => {
    setSelectedUniverseNodeId(universe.rootNodeId);
    setSelectedNodeId(atlas.rootNodeId);
    setSelectedProposalId(null);
    setRepositoryProfileOpen(true);
    setInspectorDismissed(false);
    setMobileInspectorExpanded(false);
    setInspectorTab(tab);
  };

  const atlasToolbar = (
    isMobile ? (!fullscreen ? (
      <div className="relative flex min-w-0 items-center gap-1.5" data-mobile-toolbar="true">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-10 w-10 shrink-0 rounded-full"
          aria-label={mobileSearchOpen ? 'Close repository search' : 'Search repository'}
          aria-expanded={mobileSearchOpen}
          onClick={() => setMobileSearchOpen(current => !current)}
        >
          <Search className="h-4 w-4" />
        </Button>
        <div className="flex shrink-0 rounded-full border border-primary/15 bg-background/15 p-1" aria-label="Repository view selector">
          <button
            type="button"
            aria-label="Universe 3D"
            aria-pressed={viewMode === 'universe3d'}
            onClick={() => changeViewMode('universe3d')}
            className={`min-h-8 rounded-full px-3 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${viewMode === 'universe3d' ? 'bg-[linear-gradient(135deg,hsl(var(--primary)/0.2),hsl(var(--accent)/0.12))] text-foreground shadow-[0_0_22px_hsl(var(--accent)/0.08)]' : 'text-muted-foreground hover:text-foreground'}`}
          >
            3D
          </button>
          <button
            type="button"
            aria-label="Atlas 2D"
            aria-pressed={viewMode === 'atlas2d'}
            onClick={() => changeViewMode('atlas2d')}
            className={`min-h-8 rounded-full px-3 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${viewMode === 'atlas2d' ? 'bg-[linear-gradient(135deg,hsl(var(--primary)/0.2),hsl(var(--accent)/0.12))] text-foreground shadow-[0_0_22px_hsl(var(--accent)/0.08)]' : 'text-muted-foreground hover:text-foreground'}`}
          >
            2D
          </button>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10 shrink-0 rounded-full border-primary/15 bg-floating/75 px-3 text-xs"
          aria-label="More Universe controls"
          aria-expanded={mobileControlsOpen}
          onClick={() => setMobileControlsOpen(true)}
        >
          <MoreHorizontal className="mr-1 h-4 w-4" /> More
        </Button>
        {mobileSearchOpen && (
          <label className="absolute right-0 top-[calc(100%+0.5rem)] w-[min(21rem,calc(100vw-1rem))] rounded-2xl border border-primary/15 bg-[hsl(var(--universe-surface)/0.94)] p-2 shadow-[var(--shadow-floating-panel)] backdrop-blur-xl">
            <span className="sr-only">Search repository atlas or universe</span>
            <Search className="pointer-events-none absolute left-5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={event => setQuery(event.target.value)}
              onFocus={() => setNavigationActive(true)}
              className="h-10 w-full rounded-full border border-primary/15 bg-background/30 pl-9 pr-3 text-sm outline-none transition focus:border-accent/45 focus:ring-2 focus:ring-accent/15"
              placeholder="Search files, paths, roles"
            />
          </label>
        )}
      </div>
    ) : (
      <div className="flex min-w-0 items-center justify-end gap-2" data-mobile-toolbar="fullscreen">
        <Button type="button" variant="outline" size="sm" onClick={() => setInspectorCollapsed(current => !current)} className="h-10 rounded-full border-border/60 bg-background/25 px-3 text-xs">
          {inspectorCollapsed ? <PanelRightOpen className="mr-1.5 h-3.5 w-3.5" /> : <PanelRightClose className="mr-1.5 h-3.5 w-3.5" />}
          {inspectorCollapsed ? 'Show inspector' : 'Hide inspector'}
        </Button>
        <Button ref={exitFullscreenButtonRef} type="button" variant="outline" size="sm" onClick={exitFullscreen} className="h-10 rounded-full border-primary/45 bg-primary/10 px-3 text-xs text-primary-glow hover:text-primary-glow">
          <Minimize2 className="mr-1.5 h-3.5 w-3.5" /> Exit
        </Button>
      </div>
    )) : (
      <div className="flex min-w-0 flex-nowrap items-center gap-1.5 overflow-x-auto pb-1 md:overflow-visible md:pb-0">
        <label className="relative min-w-[180px] flex-1 xl:w-[220px] xl:flex-none">
          <span className="sr-only">Search repository atlas or universe</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            onFocus={() => setNavigationActive(true)}
            className="h-9 w-full rounded-full border border-primary/15 bg-background/20 pl-8 pr-3 text-sm outline-none transition hover:border-primary/25 focus:border-accent/45 focus:ring-2 focus:ring-accent/15"
            placeholder="Search files, paths, roles"
          />
        </label>
        <div className="flex rounded-full border border-primary/15 bg-background/15 p-1" aria-label="Repository view selector">
          <button type="button" aria-pressed={viewMode === 'universe3d'} onClick={() => changeViewMode('universe3d')} className={`rounded-full px-3 py-1.5 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${viewMode === 'universe3d' ? 'bg-[linear-gradient(135deg,hsl(var(--primary)/0.2),hsl(var(--accent)/0.12))] text-foreground shadow-[0_0_22px_hsl(var(--accent)/0.08)]' : 'text-muted-foreground hover:text-foreground'}`}>Universe 3D</button>
          <button type="button" aria-pressed={viewMode === 'atlas2d'} onClick={() => changeViewMode('atlas2d')} className={`rounded-full px-3 py-1.5 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${viewMode === 'atlas2d' ? 'bg-[linear-gradient(135deg,hsl(var(--primary)/0.2),hsl(var(--accent)/0.12))] text-foreground shadow-[0_0_22px_hsl(var(--accent)/0.08)]' : 'text-muted-foreground hover:text-foreground'}`}>Atlas 2D</button>
        </div>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="shrink-0 rounded-full border-primary/15 bg-floating/75 text-xs" aria-label="More Universe controls">More controls</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="bottom" sideOffset={8} collisionPadding={12} className="max-h-[min(22rem,calc(100dvh-1.5rem))] w-48 overflow-y-auto p-2" data-testid="universe-more-controls-menu" data-overlay-layer="popover">
            {activeResultChapter === 'understand' && (
              <>
                <DropdownMenuItem onSelect={() => openRepositoryContext('story')}>Open repository story</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => openRepositoryContext('dna')}>Repository DNA</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => openRepositoryContext('mental-model')}>Semantic relationships</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setFlightPathOpen(true)}>Agent Journey</DropdownMenuItem>
              </>
            )}
            {viewMode === 'universe3d' && <DropdownMenuItem onSelect={() => setUniverseRotationPaused(current => !current)}>{universeRotationPaused || prefersReducedMotion ? 'Resume rotation' : 'Pause rotation'}</DropdownMenuItem>}
            <DropdownMenuItem onSelect={() => viewMode === 'universe3d' ? setUniverseCamera(current => ({ ...current, radius: Math.max(80, current.radius - 80) })) : setScale(view.scale + 0.14)}><ZoomIn className="mr-1.5 h-3.5 w-3.5" /> Zoom in</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => viewMode === 'universe3d' ? setUniverseCamera(current => ({ ...current, radius: Math.min(1500, current.radius + 80) })) : setScale(view.scale - 0.14)}><ZoomOut className="mr-1.5 h-3.5 w-3.5" /> Zoom out</DropdownMenuItem>
            <DropdownMenuItem onSelect={resetAtlas}><Crosshair className="mr-1.5 h-3.5 w-3.5" /> Reset view</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {!fullscreen && <Button ref={fullscreenButtonRef} type="button" variant="outline" size="sm" onClick={enterFullscreen} className="rounded-full border-accent/25 bg-accent/5 text-accent hover:border-accent/40 hover:bg-accent/10 hover:text-accent"><Maximize2 className="mr-1.5 h-3.5 w-3.5" /> Fullscreen</Button>}
        {fullscreen && (
          <>
            <Button type="button" variant="outline" size="sm" onClick={() => setInspectorCollapsed(current => !current)} className="border-border/60 bg-background/25">
              {inspectorCollapsed ? <PanelRightOpen className="mr-1.5 h-3.5 w-3.5" /> : <PanelRightClose className="mr-1.5 h-3.5 w-3.5" />}
              {inspectorCollapsed ? 'Expand inspector' : 'Collapse inspector'}
            </Button>
            <Button ref={exitFullscreenButtonRef} type="button" variant="outline" size="sm" onClick={exitFullscreen} className="border-primary/45 bg-primary/10 text-primary-glow hover:text-primary-glow"><Minimize2 className="mr-1.5 h-3.5 w-3.5" /> Exit fullscreen</Button>
          </>
        )}
      </div>
    )
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

  const transformationDomainSummary = transformationDomain === 'all' ? 'All improvements' : transformationDomainLabel(transformationDomain);
  const transformationViewSummary = transformationMode === 'current'
    ? 'Current repository baseline'
    : transformationMode === 'after-rescan'
      ? 'Verified rescan comparison'
      : `With ShipSeal · ${transformationDomainSummary}`;
  const transformationControls = isMobile ? (
    <section
      data-testid="improve-universe-control-dock"
      data-mobile-layout="compact"
      className="pointer-events-auto flex min-w-0 flex-col gap-2 rounded-[1.35rem] border border-accent/20 bg-[linear-gradient(155deg,hsl(var(--universe-surface-raised)/0.92),hsl(var(--universe-stage-bg)/0.76))] p-3 shadow-[0_22px_64px_hsl(var(--universe-stage-bg)/0.62)] backdrop-blur-xl"
      aria-labelledby="improve-universe-control-heading"
    >
      <header className="flex min-w-0 items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-accent/80">Universe comparison</div>
          <h3 id="improve-universe-control-heading" className="sr-only">Improve the repository universe</h3>
        </div>
        <div className="shrink-0 rounded-full border border-accent/20 bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent" aria-live="polite">
          {transformationMode === 'current' ? 'Current' : transformationMode === 'after-rescan' ? 'After rescan' : 'With ShipSeal'}
        </div>
      </header>
      <div className="flex rounded-xl border border-primary/15 bg-background/20 p-1" aria-label="Repository transformation preview mode">
        <button type="button" aria-pressed={transformationMode === 'current'} onClick={() => changeTransformationMode('current')} className={`min-h-9 flex-1 rounded-lg px-2 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${transformationMode === 'current' ? 'bg-[linear-gradient(135deg,hsl(var(--primary)/0.24),hsl(var(--accent)/0.12))] text-foreground' : 'text-muted-foreground'}`}>Current</button>
        <button type="button" aria-pressed={transformationMode === 'with-shipseal'} disabled={transformation.proposals.length === 0} onClick={() => changeTransformationMode('with-shipseal')} className={`min-h-9 flex-1 rounded-lg px-2 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-45 ${transformationMode === 'with-shipseal' ? 'bg-[linear-gradient(135deg,hsl(var(--primary)/0.24),hsl(var(--accent)/0.12))] text-foreground' : 'text-muted-foreground'}`}>With ShipSeal</button>
        {hasVerificationEvidence && <button type="button" aria-pressed={transformationMode === 'after-rescan'} disabled={!hasVerifiedRescanComparison} onClick={() => changeTransformationMode('after-rescan')} className={`min-h-9 flex-1 rounded-lg px-2 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-45 ${transformationMode === 'after-rescan' ? 'bg-[linear-gradient(135deg,hsl(var(--primary)/0.24),hsl(var(--accent)/0.12))] text-foreground' : 'text-muted-foreground'}`}>Verify</button>}
      </div>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1 truncate text-[10px] text-muted-foreground" aria-live="polite">
          {transformationMode === 'current'
            ? `${transformation.summary.currentFiles.toLocaleString()} files · ${transformation.summary.currentClusters.toLocaleString()} clusters`
            : transformationMode === 'after-rescan'
              ? `${verificationOverlayCounts.verified} verified · ${verificationOverlayCounts.unresolved + verificationOverlayCounts.regressed} unresolved`
              : `${visibleIncludedTransformationProposals.length.toLocaleString()} proposals · ${visibleTransformationArtifactCount.toLocaleString()} artifacts`}
        </div>
        <Button type="button" size="sm" onClick={openOptimizationPlan} disabled={activeTransformationArtifactCount === 0} className="h-9 shrink-0 rounded-full bg-primary px-3 text-[11px] text-primary-foreground hover:bg-primary/90" data-mobile-primary-action="true">
          Review plan
        </Button>
      </div>
      {transformation.proposals.length > 0 && (
        <details className="rounded-xl border border-primary/10 bg-background/20 px-2.5 py-2 text-[10px]">
          <summary className="cursor-pointer font-medium text-foreground">Proposal filters and counts</summary>
          <div className="mt-2 grid grid-cols-3 gap-2 text-muted-foreground" aria-live="polite">
            <span><strong className="block text-foreground">{visibleIncludedTransformationProposals.length.toLocaleString()}</strong>proposals</span>
            <span><strong className="block text-foreground">{visibleTransformationArtifactCount.toLocaleString()}</strong>artifacts</span>
            <span><strong className="block text-foreground">{visibleTransformationRelationshipCount.toLocaleString()}</strong>relationships</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Transformation domains">
            <TransformationDomainButton label="All improvements" count={transformation.proposals.length} active={transformationDomain === 'all'} onClick={() => setTransformationDomain('all')} />
            {(['project-memory', 'agent-routing', 'verification-path'] as RepositoryTransformationDomain[]).filter(domain => domainCounts[domain] > 0).map(domain => (
              <TransformationDomainButton key={domain} label={transformationDomainLabel(domain)} count={domainCounts[domain]} active={transformationDomain === domain} onClick={() => setTransformationDomain(domain)} />
            ))}
          </div>
        </details>
      )}
    </section>
  ) : (
    <section
      data-testid="improve-universe-control-dock"
      className="pointer-events-auto flex min-w-0 flex-col gap-3 rounded-[1.35rem] border border-accent/20 bg-[linear-gradient(155deg,hsl(var(--universe-surface-raised)/0.9),hsl(var(--universe-stage-bg)/0.72))] p-3.5 shadow-[0_22px_64px_hsl(var(--universe-stage-bg)/0.62),0_0_32px_hsl(var(--accent)/0.05)] backdrop-blur-xl motion-safe:animate-fade-in"
      aria-labelledby="improve-universe-control-heading"
    >
      <header className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-accent/80">Universe comparison</div>
          <h3 id="improve-universe-control-heading" className="mt-1 font-display text-base font-semibold text-foreground">Improve the repository universe</h3>
        </div>
        <div className="shrink-0 rounded-full border border-accent/20 bg-accent/10 px-2.5 py-1 text-[10px] font-medium text-accent" aria-live="polite">
          {transformationMode === 'current' ? 'Current' : transformationMode === 'after-rescan' ? 'After rescan' : 'With ShipSeal'}
        </div>
      </header>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Compare the graph and focus the proposal impact shown in the Universe.
      </p>

      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Comparison</span>
          <span className="truncate text-[10px] text-foreground/75" aria-live="polite">{transformationViewSummary}</span>
        </div>
        <div className="flex rounded-xl border border-primary/15 bg-background/20 p-1" aria-label="Repository transformation preview mode">
          <button
            type="button"
            aria-pressed={transformationMode === 'current'}
            onClick={() => changeTransformationMode('current')}
            className={`min-h-9 flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${transformationMode === 'current' ? 'bg-[linear-gradient(135deg,hsl(var(--primary)/0.24),hsl(var(--accent)/0.12))] text-foreground shadow-[0_0_20px_hsl(var(--accent)/0.08)]' : 'text-muted-foreground hover:bg-background/20 hover:text-foreground'}`}
          >
            Current
          </button>
          <button
            type="button"
            aria-pressed={transformationMode === 'with-shipseal'}
            disabled={transformation.proposals.length === 0}
            onClick={() => changeTransformationMode('with-shipseal')}
            className={`min-h-9 flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-45 ${transformationMode === 'with-shipseal' ? 'bg-[linear-gradient(135deg,hsl(var(--primary)/0.24),hsl(var(--accent)/0.12))] text-foreground shadow-[0_0_20px_hsl(var(--accent)/0.08)]' : 'text-muted-foreground hover:bg-background/20 hover:text-foreground'}`}
          >
            With ShipSeal
          </button>
          {hasVerificationEvidence && (
            <button
              type="button"
              aria-pressed={transformationMode === 'after-rescan'}
              disabled={!hasVerifiedRescanComparison}
              onClick={() => changeTransformationMode('after-rescan')}
              className={`min-h-9 flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-45 ${transformationMode === 'after-rescan' ? 'bg-[linear-gradient(135deg,hsl(var(--primary)/0.24),hsl(var(--accent)/0.12))] text-foreground shadow-[0_0_20px_hsl(var(--accent)/0.08)]' : 'text-muted-foreground hover:bg-background/20 hover:text-foreground'}`}
            >
              After rescan
            </button>
          )}
        </div>
        <div className="mt-1.5 text-[10px] text-muted-foreground" aria-live="polite">
          {transformationMode === 'current'
            ? `${transformation.summary.currentFiles.toLocaleString()} current files - ${transformation.summary.currentClusters.toLocaleString()} knowledge clusters`
            : transformationMode === 'after-rescan'
              ? `${verificationOverlayCounts.verified} verified - ${verificationOverlayCounts.partial} partial - ${verificationOverlayCounts.unresolved + verificationOverlayCounts.regressed} unresolved`
              : `${visibleTransformationArtifactCount.toLocaleString()} proposed artifacts - ${visibleTransformationRelationshipCount.toLocaleString()} proposed relationships`}
        </div>
        {transformationMode === 'after-rescan' && <details className="mt-2 rounded-lg border border-border/45 bg-background/20 px-2.5 py-2 text-[10px]" aria-label="Verification overlay legend">
          <summary className="cursor-pointer font-medium text-foreground">Verification lens legend</summary>
          <div className="mt-2 flex flex-wrap gap-2 text-muted-foreground"><span className="text-success">Verified change</span><span className="text-primary-glow">Partially verified</span><span className="text-warning">Unresolved</span><span className="text-destructive">Regressed</span><span className="text-accent">Newly detected</span><span>Unchanged</span></div>
        </details>}
      </div>

      {transformation.proposals.length > 0 && (
        <details className="rounded-xl border border-primary/10 bg-background/20 px-2.5 py-2 text-[10px]">
          <summary className="cursor-pointer font-medium text-foreground">Proposal summary</summary>
          <div className="mt-2 grid grid-cols-3 gap-2 text-muted-foreground" aria-live="polite">
            <span><strong className="block text-foreground">{visibleIncludedTransformationProposals.length.toLocaleString()}</strong>proposals</span>
            <span><strong className="block text-foreground">{visibleTransformationArtifactCount.toLocaleString()}</strong>artifacts</span>
            <span><strong className="block text-foreground">{visibleTransformationRelationshipCount.toLocaleString()}</strong>relationships</span>
          </div>
        </details>
      )}

      {transformation.proposals.length > 0 ? (
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Proposal focus</span>
            <span className="text-[10px] text-foreground/75">{transformationDomainSummary}</span>
          </div>
          <div className="flex flex-wrap gap-1.5" aria-label="Transformation domains">
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
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">ShipSeal did not find a supported transformation to preview from this scan.</p>
      )}

      {transformation.proposals.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-primary/10 pt-2.5">
          <div className="min-w-0 flex-1 text-[10px] text-muted-foreground">
            {includedProposalCount.toLocaleString()} proposed improvements selected
            {optimizationPlan ? ` · ${optimizationPlan.summary.readyItemCount.toLocaleString()} ready` : ''}
          </div>
          <Button
            ref={optimizationPlanTriggerRef}
            type="button"
            variant="outline"
            size="sm"
            onClick={openOptimizationPlan}
            disabled={activeTransformationArtifactCount === 0}
            className="h-8 shrink-0 rounded-full border-accent/25 bg-accent/10 px-3 text-[11px] text-accent hover:border-accent/40 hover:bg-accent/20 hover:text-accent"
          >
            Review optimization plan
          </Button>
        </div>
      )}
      {transformation.summary.limitedScan && (
        <p className="text-xs text-warning">Limited scan: preview confidence is cautious and based on the available scan boundary.</p>
      )}
    </section>
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

  const mobileControlsSheet = isMobile && (
    <Sheet open={mobileControlsOpen} onOpenChange={setMobileControlsOpen}>
      <SheetContent
        side="bottom"
        className="max-h-[min(78dvh,42rem)] overflow-y-auto overscroll-y-contain rounded-t-[1.75rem] px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5"
        data-testid="mobile-universe-controls-sheet"
      >
        <SheetHeader className="pr-9 text-left">
          <SheetTitle>Universe controls</SheetTitle>
          <SheetDescription>View, navigation, layers, filters, and contextual repository tools.</SheetDescription>
        </SheetHeader>
        <div className="mt-4 grid grid-cols-2 gap-2" aria-label="Mobile Universe actions">
          <Button type="button" variant="outline" size="sm" onClick={() => { setMobileControlsOpen(false); enterFullscreen(); }} className="justify-start">
            <Maximize2 className="mr-2 h-4 w-4" /> Fullscreen
          </Button>
          {viewMode === 'universe3d' && (
            <Button type="button" variant="outline" size="sm" onClick={() => setUniverseRotationPaused(current => !current)} className="justify-start">
              {universeRotationPaused || prefersReducedMotion ? 'Resume rotation' : 'Pause rotation'}
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" onClick={() => viewMode === 'universe3d' ? setUniverseCamera(current => ({ ...current, radius: Math.max(80, current.radius - 80) })) : setScale(view.scale + 0.14)} className="justify-start">
            <ZoomIn className="mr-2 h-4 w-4" /> Zoom in
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => viewMode === 'universe3d' ? setUniverseCamera(current => ({ ...current, radius: Math.min(1500, current.radius + 80) })) : setScale(view.scale - 0.14)} className="justify-start">
            <ZoomOut className="mr-2 h-4 w-4" /> Zoom out
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={resetAtlas} className="col-span-2 justify-start" data-testid="mobile-reset-universe-view">
            <Crosshair className="mr-2 h-4 w-4" /> Reset view
          </Button>
        </div>
        {activeResultChapter === 'understand' && (
          <div className="mt-4 grid gap-2 border-t border-border/60 pt-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Repository context</div>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => { setMobileControlsOpen(false); openRepositoryContext('story'); }} className="justify-start">Story</Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => { setMobileControlsOpen(false); openRepositoryContext('dna'); }} className="justify-start">DNA</Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => { setMobileControlsOpen(false); openRepositoryContext('mental-model'); }} className="justify-start">Mental model</Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => { setMobileControlsOpen(false); setFlightPathOpen(true); }} className="justify-start">Agent Journey</Button>
            </div>
          </div>
        )}
        <section className="mt-4 border-t border-border/60 pt-4" aria-labelledby="mobile-universe-layers-heading">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary-glow" />
            <h3 id="mobile-universe-layers-heading" className="text-sm font-semibold">Layers and filters</h3>
          </div>
          <div className="mt-3">{atlasFilters}</div>
        </section>
        {clusterLegend && <div className="mt-4">{clusterLegend}</div>}
        <section className="mt-4 rounded-2xl border border-border/55 bg-background/25 p-3 text-xs leading-relaxed text-muted-foreground" aria-label="Universe interaction help">
          <div className="flex items-center gap-2 font-semibold text-foreground"><HelpCircle className="h-4 w-4" /> Interaction help</div>
          <p className="mt-2">Drag or orbit the graph, select a node for evidence, and use the controls above for precise zoom or reset. Close this sheet to resume graph gestures.</p>
        </section>
      </SheetContent>
    </Sheet>
  );

  const optimizationPlanReview = optimizationPlanOpen && optimizationPlan && (
    <OptimizationPlanReview
      report={report}
      plan={optimizationPlan}
      applyPlan={optimizationApplyPlan}
      validation={optimizationPlanValidation}
      prepared={activePreparedOptimizationPlan}
      preparationNotice={planPreparationNotice}
      connection={connection}
      proposals={transformation.proposals}
      excludedProposalIds={excludedProposalIds}
      verificationBaseline={verificationBaseline}
      verificationResult={verificationResult}
      selectedItem={selectedOptimizationItem}
      onSelectItem={item => setSelectedOptimizationItemId(item.id)}
      onToggleProposalIncluded={toggleProposalIncluded}
      onPrepare={prepareOptimizationPlan}
      onSaveVerificationBaseline={onSaveVerificationBaseline}
      onDiscardVerificationBaseline={onDiscardVerificationBaseline}
      onPackDownloaded={onPackagePrepared}
      onPrCreated={onPrCreated}
      mobile={isMobile}
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
      className={`relative overflow-hidden bg-[radial-gradient(circle_at_50%_48%,hsl(var(--primary)/0.16),transparent_34%),linear-gradient(180deg,hsl(var(--universe-stage-bg)/0.2),hsl(var(--universe-stage-bg)/0.08))] select-none ${fullscreen ? 'min-h-0 flex-1 rounded-[1.5rem] border border-primary/15' : 'h-full min-h-[560px] border-0'} ${atlasNavigationActive ? 'touch-none overscroll-contain cursor-grab' : 'touch-pan-y cursor-default'}`}
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
          const verificationOverlayState = transformationMode === 'after-rescan' && node.path ? verificationPathStates.get(normalizeWorkspacePath(node.path)) : undefined;
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
              data-verification-state={verificationOverlayState || 'unchanged'}
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
              } ${matched ? 'ring-2 ring-accent/55' : ''} ${routeHighlighted ? 'ring-2 ring-primary/55 shadow-sm shadow-primary/20' : ''} ${transformationAffected ? 'ring-2 ring-primary/30' : ''} ${verificationOverlayState === 'verified-change' ? 'ring-2 ring-success/60' : verificationOverlayState === 'partially-verified' ? 'ring-2 ring-primary/55' : verificationOverlayState === 'regressed' ? 'ring-2 ring-destructive/70' : verificationOverlayState === 'unresolved' ? 'ring-2 ring-warning/65' : verificationOverlayState === 'newly-detected' ? 'ring-2 ring-accent/60' : ''} ${dimmed ? 'opacity-28' : 'opacity-100'} ${!atlasReady && node.kind !== 'repository' && !prefersReducedMotion ? 'scale-50 opacity-0' : 'scale-100'}`}
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

        {renderedTransformationMode === 'with-shipseal' && renderedTransformationProposals.flatMap(proposal => (
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
                  strokeOpacity={!selectedPathProjectionActive && excludedProposalIds.has(proposal.id) ? 0.08 : selectedProposalId === proposal.id ? 0.62 : selectedProposalId ? 0.1 : 0.22}
                  strokeDasharray="7 8"
                  className="transition-all duration-500"
                />
              </svg>
            );
          })
        ))}

        {renderedTransformationMode === 'with-shipseal' && renderedTransformationProposals.flatMap((proposal, proposalIndex) => (
          proposal.graphChanges.proposedNodes.map(node => {
            const selected = selectedProposalId === proposal.id;
            const excluded = !selectedPathProjectionActive && excludedProposalIds.has(proposal.id);
            const showLabel = selected || transformationDomain !== 'all' || proposalIndex % 2 === 0;
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
                } ${excluded ? 'opacity-25' : selectedProposalId && !selected ? 'opacity-40' : 'opacity-100'}`}
                style={{
                  left: node.x + 460,
                  top: node.y + 320,
                  width: selected ? 52 : 40,
                  height: selected ? 52 : 40,
                }}
              >
                <span className="h-3 w-3 rounded-full border border-primary/60 bg-primary/15" />
                {showLabel && (
                  <span className="pointer-events-none absolute left-1/2 top-[calc(100%+5px)] w-max max-w-[170px] -translate-x-1/2 rounded-xl border border-primary/30 bg-background/88 px-2 py-1 text-[10px] font-medium leading-tight text-primary-glow shadow-sm">
                    <span className="block truncate">{node.label}</span>
                    <span className="block text-[9px] font-normal text-muted-foreground">Proposed</span>
                  </span>
                )}
              </button>
            );
          })
        ))}
      </div>

      {tooltip && (
        <div
          role="tooltip"
          className="pointer-events-none fixed z-[var(--layer-tooltip)] max-w-[220px] rounded-xl border border-border/70 bg-tooltip px-3 py-2 text-xs text-background shadow-[var(--shadow-md-semantic)]"
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
            theme={universeTheme}
            transformation={renderedTransformation}
            verificationNodeStates={transformationMode === 'after-rescan' ? verificationUniverseNodeStates : {}}
            transformationMode={renderedTransformationMode}
            transformationDomain={selectedPathProjectionActive ? 'all' : transformationDomain}
            selectedProposalId={selectedProposalId}
            excludedProposalIds={selectedPathProjectionActive ? [] : excludedProposalIdList}
            onCameraStateChange={setUniverseCamera}
            onSelectNode={handleUniverseSelectNode}
            onSelectProposal={handleUniverseSelectProposal}
            onSceneSettled={handleUniverseSceneSettled}
            focusRequest={universeFocusRequest}
          />
        </Suspense>
      </RepositoryUniverseErrorBoundary>
    </div>
  );

  const inspector = (
    selectedProposal && renderedTransformationMode === 'with-shipseal'
      ? (
        <TransformationInspector
          proposal={selectedProposal}
          included={!excludedProposalIds.has(selectedProposal.id)}
          allowInclusionToggle={!selectedPathProjectionActive}
          collapsed={fullscreen && inspectorCollapsed}
          onToggleCollapsed={() => setInspectorCollapsed(current => !current)}
          onToggleIncluded={() => selectedPathProjectionActive ? undefined : toggleProposalIncluded(selectedProposal.id)}
          onClear={() => setSelectedProposalId(null)}
        />
      )
      : (
        <UniverseInspector
          report={report}
          story={story}
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
          activeTab={inspectorTab}
          collapsed={fullscreen && inspectorCollapsed}
          onToggleCollapsed={() => setInspectorCollapsed(current => !current)}
          onTabChange={setInspectorTab}
          onClose={() => {
            setInspectorDismissed(true);
            setMobileInspectorExpanded(false);
          }}
          onFocusNode={() => selectedUniverseNode && focusUniverseNode(selectedUniverseNode)}
          onFocusCluster={() => selectedUniverseNode?.clusterId && setFocusedClusterId(selectedUniverseNode.clusterId)}
          onClearFocus={() => setFocusedClusterId(null)}
          onReturnRepository={() => {
            setSelectedUniverseNodeId(universe.rootNodeId);
            setRepositoryProfileOpen(true);
            setInspectorTab('overview');
          }}
          onOpenAtlas={viewMode === 'universe3d' ? () => changeViewMode('atlas2d') : undefined}
          onSelectNode={selectUniverseNode}
          onSelectChapter={onSelectChapter}
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
  const focusVerifyTechnicalDetails = () => {
    const target = document.querySelector<HTMLElement>('[data-verify-technical-details]');
    const disclosure = target?.querySelector<HTMLDetailsElement>('details');
    if (disclosure && !disclosure.open) disclosure.querySelector<HTMLElement>('summary')?.click();
    if (typeof target?.scrollIntoView === 'function') {
      target.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
    }
    target?.focus({ preventScroll: true });
  };
  const handleVerifyPrimaryAction = () => {
    if (verifyPresentation.primaryAction === 'improve') {
      onResultChapterChange('improve');
      return;
    }
    if (verifyPresentation.primaryAction === 'apply') {
      openOptimizationPlan();
      return;
    }
    if (verifyPresentation.primaryAction === 'rescan') {
      onRescan?.();
      return;
    }
    focusVerifyTechnicalDetails();
  };
  const verifySummary = activeResultChapter === 'verify' && (
    <VerificationJourney
      presentation={verifyPresentation}
      primaryActionDisabled={verifyPresentation.primaryAction === 'rescan' && (!onRescan || intelligenceVerificationStatus === 'scanning')}
      primaryActionPending={intelligenceVerificationStatus === 'scanning' && verifyPresentation.primaryAction === 'rescan'}
      showArtifactReview={activeTransformationArtifactCount > 0}
      onPrimaryAction={handleVerifyPrimaryAction}
      onReviewArtifacts={openOptimizationPlan}
      onViewTechnicalEvidence={focusVerifyTechnicalDetails}
    />
  );

  return (
    <section ref={atlasRootRef} className={`relative border-y border-primary/15 bg-[hsl(var(--universe-stage-bg))] ${activeResultChapter === 'understand' || activeResultChapter === 'improve' ? '' : 'px-2 py-2 md:px-3'}`} aria-labelledby="repository-atlas-heading">
      {activeResultChapter !== 'improve' && (
        <div className={activeResultChapter === 'understand' ? 'sr-only' : 'mb-2 flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between'}>
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{resultChapterEyebrow}</div>
            <h2 id="repository-atlas-heading" className="font-display text-lg font-semibold">{resultChapterTitle}</h2>
            <p className="hidden text-sm text-muted-foreground xl:block">
              {resultChapterSummary}
            </p>
          </div>
        </div>
      )}

      {!fullscreen && (
        <>
          {activeResultChapter === 'understand' && (
            <div id="repository-atlas-navigation-status" className={activeResultChapter === 'understand' ? 'sr-only' : 'mb-2 text-xs text-muted-foreground'} aria-live="polite">
              {atlasNavigationActive ? `${viewMode === 'universe3d' ? 'Universe' : 'Atlas'} navigation active - Press Esc to release` : 'Click to explore - Scroll to zoom - Drag to move'}
            </div>
          )}

          {verifySummary}
        </>
      )}

      {!fullscreen && showUniverseWorkspace && (
        <div
          data-testid="repository-universe-workspace-stage"
          data-universe-theme={universeTheme}
          data-mobile-viewport-contract="safe-dynamic"
          className="relative h-[calc(100dvh-4rem)] min-h-[calc(100svh-4rem)] max-w-full overflow-hidden bg-[hsl(var(--universe-stage-bg))] md:h-auto md:min-h-[calc(100dvh-9rem)]"
        >
          <div className="absolute inset-0 z-[var(--layer-canvas)] [&>*]:h-full">{viewMode === 'universe3d' ? universeCanvas : atlasCanvas}</div>
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[var(--layer-graph-overlay)] bg-[radial-gradient(circle_at_50%_44%,transparent_36%,hsl(var(--universe-stage-bg)/0.12)_68%,hsl(var(--universe-stage-bg)/0.42)_100%)]" />
          {futureStageOverlay && <FutureNeuralField overlay={futureStageOverlay} mobile={isMobile} reducedMotion={prefersReducedMotion} evidenceProjections={{}} />}
          {futureStageOverlay && !isMobile && (
            <div className="pointer-events-none absolute left-1/2 top-20 z-[var(--layer-context)] w-[min(23rem,38vw)] -translate-x-1/2 rounded-2xl border border-primary/15 bg-[hsl(var(--universe-surface)/0.68)] p-3 shadow-[var(--shadow-floating-panel)] backdrop-blur-xl">
              <FutureStageComposer overlay={futureStageOverlay} />
            </div>
          )}
          <div
            className="pointer-events-none absolute inset-x-2 top-2 z-[var(--layer-context)] grid min-w-0 gap-2 sm:grid-cols-[minmax(18rem,23rem)_minmax(0,1fr)] sm:items-start"
            onPointerDownCapture={() => setUniverseSceneSettled(true)}
            onFocusCapture={() => setUniverseSceneSettled(true)}
          >
            <div data-testid="repository-context-overlay" className={activeResultChapter === 'understand' ? 'w-full min-w-0 max-w-[23rem]' : 'hidden'}>
              {activeResultChapter === 'understand' ? repositoryContextOverlay : null}
            </div>
            {showTransformationPanel && (
              <div className="min-w-0 sm:col-start-1 sm:row-start-1 sm:w-full sm:max-w-[23rem]">
                {futureStageOverlay ? (
                  <div data-testid="future-impact-mode-control" className="pointer-events-auto rounded-2xl border border-primary/20 bg-[hsl(var(--universe-surface)/0.88)] p-3 shadow-[var(--shadow-floating-panel)] backdrop-blur-xl">
                    <div className="flex items-center justify-between gap-3">
                      <div><div className="text-[9px] font-mono uppercase tracking-[0.16em] text-primary">Selected path impact</div><div className="mt-1 text-xs text-muted-foreground">One authoritative Universe · proposed overlay</div></div>
                      {futureImpactMode === 'selected-path' && <span className="rounded-full border border-primary/35 px-2 py-1 text-[9px] font-medium text-primary">Proposed</span>}
                    </div>
                    <div role="group" aria-label="Repository future impact mode" className="mt-3 grid grid-cols-2 rounded-xl border border-border/50 bg-background/30 p-1">
                      <button type="button" aria-pressed={!legacyImprovementPreviewActive && futureImpactMode === 'current'} onClick={() => { setLegacyImprovementPreviewActive(false); setFutureImpactMode('current'); }} className={`min-h-11 rounded-lg px-2 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${!legacyImprovementPreviewActive && futureImpactMode === 'current' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>Current repository</button>
                      <button type="button" aria-pressed={!legacyImprovementPreviewActive && futureImpactMode === 'selected-path'} disabled={!futureStageOverlay.universeProjection} aria-describedby={!futureStageOverlay.universeProjection ? 'future-impact-empty-reason' : undefined} onClick={() => { setLegacyImprovementPreviewActive(false); setFutureImpactMode('selected-path'); }} className={`min-h-11 rounded-lg px-2 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-45 ${!legacyImprovementPreviewActive && futureImpactMode === 'selected-path' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>With this path</button>
                    </div>
                    <p id="future-impact-empty-reason" className="mt-2 text-[10px] leading-relaxed text-muted-foreground">{futureStageOverlay.universeProjection ? `${futureStageOverlay.universeProjection.proposedNodes.length} proposed entities · ${futureStageOverlay.universeProjection.affectedCurrentNodeIds.length} affected current entities` : 'Choose a primary Future Path to preview its proposed repository impact.'}</p>
                  </div>
                ) : transformationControls}
              </div>
            )}
            <div data-testid="repository-toolbar-overlay" className="pointer-events-auto relative z-[var(--layer-toolbar)] min-w-0 max-w-full justify-self-end rounded-2xl border border-primary/15 bg-[hsl(var(--universe-surface)/0.82)] p-1.5 shadow-[var(--shadow-floating-panel)] backdrop-blur-xl motion-safe:animate-fade-in sm:col-start-2 sm:row-start-1">
              {atlasToolbar}
            </div>
            {!isMobile && (
              <div data-testid="result-chapter-rail-overlay" className="min-w-0 sm:col-start-1 sm:row-start-2 sm:w-full sm:max-w-[23rem] sm:justify-self-start lg:col-start-1 lg:max-w-[23rem]">
                {chapterNavOverlay}
              </div>
            )}
          </div>
          {isMobile && (
            <div
              data-testid="result-chapter-rail-overlay"
              className="pointer-events-none absolute inset-x-2 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-[var(--layer-context)]"
            >
              {chapterNavOverlay}
            </div>
          )}
          {inspectorVisible
            ? (
              <aside
                ref={inspectorSheetRef}
                role="region"
                aria-label="Selected entity inspector. Focus or click to scroll details."
                tabIndex={0}
                data-testid="repository-inspector-scroll-region"
                data-mobile-sheet={isMobile ? 'true' : 'false'}
                data-mobile-expanded={isMobile && mobileInspectorExpanded ? 'true' : 'false'}
                data-scroll-mode={inspectorScrollActive ? 'inspector' : 'page'}
                onPointerDownCapture={() => setInspectorScrollActive(true)}
                onFocusCapture={() => setInspectorScrollActive(true)}
                onBlurCapture={event => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setInspectorScrollActive(false);
                }}
                onPointerLeave={event => {
                  if (!event.currentTarget.contains(document.activeElement)) setInspectorScrollActive(false);
                }}
                className={`absolute bottom-[max(0.5rem,env(safe-area-inset-bottom))] left-2 right-2 z-[var(--layer-inspector)] w-auto overscroll-y-contain rounded-[1.6rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-safe:animate-scale-in sm:left-auto sm:right-3 sm:w-[min(22rem,calc(100%-1.5rem))] sm:max-h-[70dvh] lg:bottom-auto ${mobileInspectorExpanded ? 'max-h-[82dvh]' : 'max-h-[52dvh]'} ${inspectorScrollActive ? 'overflow-y-auto' : 'overflow-hidden'} ${activeResultChapter === 'understand' ? 'lg:top-[5.5rem] lg:max-h-[calc(100%-6.5rem)]' : 'lg:top-[7rem] lg:max-h-[calc(100%-8rem)]'}`}
              >
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/55 bg-[hsl(var(--universe-surface-raised)/0.96)] px-4 py-2 backdrop-blur-xl sm:hidden">
                  <span className="h-1.5 w-10 rounded-full bg-border" aria-hidden="true" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setMobileInspectorExpanded(current => !current)}
                    aria-expanded={mobileInspectorExpanded}
                    className="h-8 text-xs"
                  >
                    {mobileInspectorExpanded ? <Minimize2 className="mr-1.5 h-3.5 w-3.5" /> : <Maximize2 className="mr-1.5 h-3.5 w-3.5" />}
                    {mobileInspectorExpanded ? 'Medium view' : 'Expand details'}
                  </Button>
                </div>
                {inspector}
                {!inspectorScrollActive && (
                  <div className="pointer-events-none sticky bottom-2 ml-auto mr-2 mt-[-2.25rem] w-fit rounded-full border border-border/60 bg-floating/90 px-2.5 py-1 text-[10px] font-medium text-muted-foreground shadow-sm backdrop-blur">
                    Focus to scroll details
                  </div>
                )}
              </aside>
            )
            : !futureStageOverlay ? <div className="pointer-events-none absolute bottom-[7.5rem] left-1/2 z-[var(--layer-graph-overlay)] flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full border border-primary/15 bg-[hsl(var(--universe-surface)/0.72)] px-2.5 py-1 text-[10px] text-muted-foreground shadow-[var(--shadow-md-semantic)] backdrop-blur-xl sm:bottom-4 sm:left-auto sm:right-4 sm:translate-x-0 sm:px-3 sm:py-1.5 sm:text-xs"><span className="h-1.5 w-1.5 rounded-full bg-accent/70 shadow-[0_0_12px_hsl(var(--accent)/0.55)]" /><span>{viewMode === 'universe3d' ? visibleUniverseNodeIds.size : visibleNodes.length} entities</span><span aria-hidden="true">·</span><span className="sm:hidden">Select node</span><span className="hidden sm:inline">Select a node to inspect evidence</span></div> : null}
        </div>
      )}

      {mobileControlsSheet}

      {!fullscreen && showUniverseWorkspace && (
        <div className="mt-4 space-y-3">
          {searchResultList}
          {!isMobile && (
            <>
              <details className="rounded-2xl border border-border/45 bg-background/20 px-3 py-2">
                <summary className="cursor-pointer text-sm font-medium text-foreground">Layers and filters</summary>
                <div className="mt-3">{atlasFilters}</div>
              </details>
              {clusterLegend}
            </>
          )}
          {activeResultChapter === 'understand' && (
            <details open={flightPathOpen} onToggle={event => setFlightPathOpen(event.currentTarget.open)} className="rounded-2xl border border-border/45 bg-background/20 p-3">
              <summary className="cursor-pointer text-sm font-medium text-foreground">Plan an agent task</summary>
              {flightPathOpen && <div className="mt-3">
                <AgentFlightPathPanel
                  report={report}
                  task={agentFlightPathTask}
                  flightPath={agentFlightPath}
                  copied={agentFlightPathCopied}
                  onTaskChange={setAgentFlightPathTask}
                  onGenerate={generateAgentFlightPath}
                  onCopyPrompt={copyAgentFlightPathPrompt}
                  onFocusRoute={focusAgentFlightPathRoute}
                  onClearRoute={() => {
                    setAgentFlightPath(null);
                    setAgentFlightPathCopied(false);
                  }}
                />
              </div>}
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

      {!fullscreen && futureStageOverlay && (
        <section aria-labelledby="other-improvements-heading" className="mt-8 rounded-[2rem] border border-border/55 bg-background/20 p-5 md:p-7">
          <div className="text-xs font-mono uppercase tracking-[0.16em] text-muted-foreground">3 · Continue improving</div>
          <div className="mt-2">
            <div className="max-w-3xl"><h2 id="other-improvements-heading" className="font-display text-2xl font-semibold">Other improvements</h2><p className="mt-2 text-sm text-muted-foreground">The existing Optimization Plan and Repository Intelligence workflows remain available below the selected-path experience.</p></div>
          </div>
          <details className="mt-5 rounded-2xl border border-border/45 bg-background/20 p-3" onToggle={event => setLegacyImprovementPreviewActive(event.currentTarget.open)}>
            <summary className="cursor-pointer text-sm font-medium text-foreground">Legacy proposal comparison controls</summary>
            <p className="mt-2 text-xs text-muted-foreground">Opening this review temporarily previews the existing generic ShipSeal proposal set in the same Universe. Close it, or choose Current repository / With this path above, to return to the selected Future Path comparison.</p>
            <div className="mt-3">{transformationControls}</div>
          </details>
        </section>
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
          className="fixed inset-0 z-[var(--layer-dialog)] flex flex-col bg-workspace p-4 text-foreground md:p-6"
        >
          <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{viewMode === 'universe3d' ? 'Repository Universe' : 'Repository Atlas'}</div>
              <h2 className="mt-1 font-display text-2xl font-semibold">Fullscreen exploration</h2>
              <p className="mt-1 text-sm text-muted-foreground">{viewMode === 'universe3d' ? 'Universe' : 'Atlas'} navigation active - Press Esc to exit fullscreen</p>
            </div>
            {atlasToolbar}
          </div>
          {showTransformationPanel && !futureStageOverlay && <div className="mb-4">{transformationControls}</div>}
          <div className="mb-4">{atlasFilters}</div>
          {clusterLegend && <div className="mb-4">{clusterLegend}</div>}
          {searchResultList && <div className="mb-4">{searchResultList}</div>}
          <div className={`grid min-h-0 flex-1 gap-4 ${inspectorCollapsed ? 'xl:grid-cols-[minmax(0,1fr)_220px]' : 'xl:grid-cols-[minmax(0,1fr)_360px]'}`}>
            {viewMode === 'universe3d' ? universeCanvas : atlasCanvas}
            <div
              className="min-h-0 overflow-y-auto overscroll-y-contain rounded-[1.6rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              role="region"
              tabIndex={0}
              aria-label="Fullscreen selected entity inspector"
              data-testid="fullscreen-inspector-scroll-region"
            >
              {inspector}
            </div>
          </div>
        </div>
      )}

      <Sheet open={optimizationPlanOpen} onOpenChange={handleOptimizationPlanOpenChange}>
        <SheetContent
          side="bottom"
          className={isMobile
            ? 'inset-0 h-dvh max-h-none w-full max-w-none overflow-hidden rounded-none border-0 p-0 pb-[env(safe-area-inset-bottom)]'
            : 'inset-x-[2vw] bottom-[2dvh] mx-auto h-[96dvh] max-h-[96dvh] w-[96vw] max-w-[1440px] overflow-hidden rounded-[1.75rem] border border-primary/20 p-0 shadow-2xl'}
          data-testid="optimization-artifact-review-sheet"
          data-review-presentation={isMobile ? 'mobile-fullscreen' : 'desktop-workspace'}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Review prepared artifacts</SheetTitle>
            <SheetDescription>Review selected artifacts, their evidence, package preparation, and pull request preview.</SheetDescription>
          </SheetHeader>
          {optimizationPlanReview}
        </SheetContent>
      </Sheet>
    </section>
  );
}

function AgentFlightPathPanel({
  report,
  task,
  flightPath,
  copied,
  onTaskChange,
  onGenerate,
  onCopyPrompt,
  onFocusRoute,
  onClearRoute,
}: {
  report: ReadinessReport;
  task: string;
  flightPath: RepositoryAgentFlightPath | null;
  copied: boolean;
  onTaskChange: (task: string) => void;
  onGenerate: () => void;
  onCopyPrompt: () => void;
  onFocusRoute: () => void;
  onClearRoute: () => void;
}) {
  const routeNodeCount = flightPath?.metadata.routeNodeCount || 0;
  const defaultJourney = buildAgentSimulatorPlan(report);

  return (
    <section className="rounded-[1.35rem] border border-primary/20 bg-[linear-gradient(135deg,hsl(var(--primary)/0.08),hsl(var(--background)/0.24)_42%,hsl(var(--accent)/0.06))] p-4 shadow-sm shadow-primary/10" aria-label="Agent Journey">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <div className="text-xs font-mono uppercase tracking-wider text-primary-glow/80">Agent Journey</div>
          <h3 id="agent-journey-heading" className="mt-1 font-display text-xl font-semibold text-foreground">Plan the first pass.</h3>
          <p className="mt-1 text-sm text-muted-foreground">A repository-evidence route, not model chain-of-thought or a productivity prediction.</p>
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

      {!flightPath && (
        <div className="mt-4 grid gap-2 md:grid-cols-3" aria-label="Default Agent Journey">
          <div className="rounded-2xl border border-border/50 bg-background/20 p-3">
            <div className="text-xs font-semibold text-foreground">Likely entry</div>
            <p className="mt-1 text-xs text-muted-foreground">{defaultJourney.likelyFirstFiles[0]?.label || defaultJourney.steps[0]?.title || 'Repository root'}</p>
          </div>
          <div className="rounded-2xl border border-border/50 bg-background/20 p-3">
            <div className="text-xs font-semibold text-foreground">Likely skipped</div>
            <p className="mt-1 text-xs text-muted-foreground">{defaultJourney.likelyIgnoredFolders[0]?.label || 'Generated and vendor areas'}</p>
          </div>
          <div className="rounded-2xl border border-border/50 bg-background/20 p-3">
            <div className="text-xs font-semibold text-foreground">Verification path</div>
            <p className="mt-1 text-xs text-muted-foreground">{defaultJourney.steps.at(-1)?.title || 'Review and verify'}</p>
          </div>
        </div>
      )}

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
          Generate task journey
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
                <Button type="button" variant="ghost" size="sm" onClick={onClearRoute}>
                  Clear route
                </Button>
              </div>
            </div>

            <ol className="mt-4 grid gap-2" aria-label="Agent Journey route steps">
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
  validation,
  prepared,
  preparationNotice,
  connection,
  proposals,
  excludedProposalIds,
  verificationBaseline,
  verificationResult,
  selectedItem,
  onSelectItem,
  onToggleProposalIncluded,
  onPrepare,
  onSaveVerificationBaseline,
  onDiscardVerificationBaseline,
  onPackDownloaded,
  onPrCreated,
  mobile,
}: {
  report: ReadinessReport;
  plan: RepositoryOptimizationPlan;
  applyPlan: OptimizationApplyPlan | null;
  validation: RepositoryOptimizationPlanValidation | null;
  prepared: PreparedRepositoryOptimizationPlan | null;
  preparationNotice: string;
  connection: GitHubConnectionState;
  proposals: RepositoryTransformationProposal[];
  excludedProposalIds: Set<string>;
  verificationBaseline?: RepositoryVerificationBaseline | null;
  verificationResult?: RepositoryVerificationResult | null;
  selectedItem: RepositoryOptimizationPlanItem | null;
  onSelectItem: (item: RepositoryOptimizationPlanItem) => void;
  onToggleProposalIncluded: (proposalId: string) => void;
  onPrepare: () => void;
  onSaveVerificationBaseline?: (baseline: RepositoryVerificationBaseline) => void;
  onDiscardVerificationBaseline?: () => void;
  onPackDownloaded?: () => void;
  onPrCreated?: () => void;
  mobile: boolean;
}) {
  const manifestPreview = serializeRepositoryOptimizationManifest(plan.manifest);
  const [packState, setPackState] = useState<'idle' | 'building' | 'downloaded' | 'error'>('idle');
  const [packError, setPackError] = useState('');
  const [prConfirmed, setPrConfirmed] = useState(false);
  const [prState, setPrState] = useState<'idle' | 'previewing' | 'preview-ready' | 'applying' | 'created' | 'error'>('idle');
  const [prPreviewResult, setPrPreviewResult] = useState<OptimizationPrPreviewResponse['plan'] | null>(null);
  const [prError, setPrError] = useState<{ message: string; nextAction: string; progress?: OptimizationGithubApplyProgress } | null>(null);
  const [prResult, setPrResult] = useState<OptimizationPrApplyResponse | null>(null);
  const [mobileReviewView, setMobileReviewView] = useState<'artifacts' | 'detail'>('artifacts');
  const artifactButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const prSubmissionRef = useRef(false);
  const baselineSavedForCurrentPlan = Boolean(verificationBaseline && applyPlan && verificationBaseline.applyPlanId === applyPlan.id);
  const preparedSnapshot = useMemo(() => prepared ? buildOptimizationGithubPreparedSnapshot(prepared) : null, [prepared]);

  useEffect(() => {
    setPrConfirmed(false);
    setPrState('idle');
    setPrPreviewResult(null);
    setPrError(null);
    setPrResult(null);
  }, [connection.defaultBranch, connection.installationId, connection.owner, connection.repo, preparedSnapshot?.fingerprint]);

  const selectReviewItem = (item: RepositoryOptimizationPlanItem) => {
    onSelectItem(item);
    if (mobile) setMobileReviewView('detail');
  };

  const moveArtifactFocus = (index: number, direction: 'next' | 'previous' | 'first' | 'last') => {
    const nextIndex = direction === 'first'
      ? 0
      : direction === 'last'
        ? plan.items.length - 1
        : direction === 'next'
          ? Math.min(index + 1, plan.items.length - 1)
          : Math.max(index - 1, 0);
    const nextItem = plan.items[nextIndex];
    if (!nextItem) return;
    onSelectItem(nextItem);
    artifactButtonRefs.current.get(nextItem.id)?.focus();
  };

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

  const optimizationPrRequest = (mode: 'preview' | 'apply') => {
    const baseBranch = connection.defaultBranch || preparedSnapshot?.repository.ref;
    if (!preparedSnapshot || !connection.installationId || !connection.owner || !connection.repo || !baseBranch) return null;
    return {
      version: OPTIMIZATION_GITHUB_APPLY_VERSION,
      mode,
      installationId: connection.installationId,
      owner: connection.owner,
      repo: connection.repo,
      baseBranch,
      prepared: preparedSnapshot,
      confirmed: mode === 'apply',
      ...(mode === 'apply' && prPreviewResult ? {
        expectedPreviewFingerprint: prPreviewResult.fingerprint,
        expectedBaseCommit: prPreviewResult.repository.baseCommit,
      } : {}),
    } as const;
  };

  const handlePreviewPr = async () => {
    const request = optimizationPrRequest('preview');
    if (!request || prSubmissionRef.current) return;
    prSubmissionRef.current = true;
    setPrState('previewing');
    setPrError(null);
    setPrPreviewResult(null);
    setPrResult(null);
    setPrConfirmed(false);
    try {
      const result = await submitOptimizationPrRequest(request);
      if (result.mode !== 'preview') throw new Error('Expected an Optimization PR preview.');
      setPrPreviewResult(result.plan);
      setPrState('preview-ready');
    } catch (error) {
      setPrState('error');
      setPrError(optimizationPrFailure(error));
    } finally {
      prSubmissionRef.current = false;
    }
  };

  const handleCreatePr = async () => {
    const request = optimizationPrRequest('apply');
    if (!request || !applyPlan?.prPreview.canUseGitHubApp || !prConfirmed || !prPreviewResult?.applyReady || prSubmissionRef.current) return;
    prSubmissionRef.current = true;
    setPrState('applying');
    setPrError(null);
    setPrResult(null);
    try {
      const result = await submitOptimizationPrRequest(request);
      if (result.mode !== 'apply') throw new Error('Expected an Optimization PR apply result.');
      setPrState('created');
      setPrResult(result);
      saveVerificationBaseline('github-pr-created');
      onPrCreated?.();
    } catch (error) {
      setPrState('error');
      setPrError(optimizationPrFailure(error));
    } finally {
      prSubmissionRef.current = false;
    }
  };

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden bg-[hsl(var(--universe-stage-bg))]" aria-labelledby="optimization-plan-heading">
      <header className="flex-none border-b border-border/50 bg-background/80 px-4 py-3 pr-12 backdrop-blur-xl sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-mono uppercase tracking-[0.16em] text-muted-foreground">Prepared plan review</div>
            <h3 id="optimization-plan-heading" className="mt-0.5 font-display text-xl font-semibold">Review generated artifacts</h3>
            <p className="mt-1 max-w-3xl text-xs text-muted-foreground sm:text-sm">Reviewing and preparing this snapshot does not change repository files.</p>
          </div>
          <Badge variant="outline" className={prepared ? 'border-success/40 text-success' : 'border-primary/40 text-primary-glow'}>
            {prepared ? 'Prepared' : 'Proposed'}
          </Badge>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2" aria-label="Optimization plan summary">
          <OptimizationPlanMetric compact label="Proposals" value={plan.summary.selectedProposalCount} />
          <OptimizationPlanMetric compact label="Artifacts" value={plan.summary.artifactCount} />
          {plan.summary.actionCounts.create > 0 && <OptimizationPlanMetric compact label="Create" value={plan.summary.actionCounts.create} />}
          {plan.summary.actionCounts.update > 0 && <OptimizationPlanMetric compact label="Update" value={plan.summary.actionCounts.update} />}
          {plan.summary.actionCounts.strengthen > 0 && <OptimizationPlanMetric compact label="Strengthen" value={plan.summary.actionCounts.strengthen} />}
          <span className="mx-1 hidden h-5 w-px bg-border/60 sm:block" aria-hidden="true" />
          {plan.summary.selectedDomains.map(domain => (
            <Badge key={domain} variant="outline" className="border-border/60 text-muted-foreground">{transformationDomainLabel(domain)}</Badge>
          ))}
        </div>

        {validation && (
          <section className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/55 bg-secondary/15 px-3 py-2.5" aria-label="Plan validation">
            <div className="min-w-0 text-xs">
              <span className="font-semibold text-foreground">{prepared ? 'Prepared snapshot' : 'Validation ready'}</span>
              <span className="ml-2 text-muted-foreground">
                {validation.summary.validatedArtifactCount} validated · {validation.summary.reviewRequiredCount} review · {validation.summary.blockingCount} blocking
              </span>
              {prepared && <span className="ml-2 text-success">Manifest matches {applyPlan?.summary.selectedArtifactCount || 0} selected artifacts.</span>}
            </div>
            {!prepared && (
              <Button type="button" size="sm" onClick={onPrepare} disabled={!validation.canPrepare} className="bg-primary text-primary-foreground hover:bg-primary/90">
                Prepare selected plan
              </Button>
            )}
            {preparationNotice && <p className="basis-full text-xs text-muted-foreground" aria-live="polite">{preparationNotice}</p>}
            {validation.issues.length > 0 && (
              <details className="basis-full rounded-lg border border-border/45 bg-background/25 px-3 py-2">
                <summary className="cursor-pointer text-xs font-semibold">Review {validation.issues.length} validation issue{validation.issues.length === 1 ? '' : 's'}</summary>
                <ul className="mt-2 space-y-2">
                  {validation.issues.map(issue => (
                    <li key={issue.id} className="text-xs">
                      <span className={issue.severity === 'blocking' ? 'font-semibold text-warning' : 'font-semibold text-primary-glow'}>{issue.title}:</span>{' '}
                      <span className="text-muted-foreground">{issue.explanation} {issue.recovery}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        )}
      </header>

      {plan.items.length === 0 ? (
        <div className="m-4 rounded-2xl border border-border/55 bg-secondary/15 p-4 text-sm text-muted-foreground">
          No selected proposals are active. Re-include a proposed improvement to restore its deterministic plan item.
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto xl:grid xl:grid-cols-[minmax(20rem,0.38fr)_minmax(0,0.62fr)] xl:overflow-hidden" data-review-layout={mobile ? 'single-pane' : 'master-detail'}>
          <section
            className={`${mobile && mobileReviewView === 'detail' ? 'hidden' : 'block'} border-border/50 bg-background/30 p-3 sm:p-4 xl:min-h-0 xl:overflow-y-auto xl:border-r`}
            aria-label="Optimization Plan artifacts"
            data-review-pane="artifact-list"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h4 className="font-display text-base font-semibold">Artifacts</h4>
                <p className="text-xs text-muted-foreground">{plan.items.length} generated file{plan.items.length === 1 ? '' : 's'}</p>
              </div>
            </div>
            <div className="space-y-2" role="listbox" aria-label="Prepared plan artifact list">
              {plan.items.map((item, index) => (
                <button
                  key={item.id}
                  ref={node => {
                    if (node) artifactButtonRefs.current.set(item.id, node);
                    else artifactButtonRefs.current.delete(item.id);
                  }}
                  type="button"
                  role="option"
                  aria-selected={selectedItem?.id === item.id}
                  title={item.artifact.path}
                  onClick={() => selectReviewItem(item)}
                  onKeyDown={event => {
                    const direction = event.key === 'ArrowDown' ? 'next' : event.key === 'ArrowUp' ? 'previous' : event.key === 'Home' ? 'first' : event.key === 'End' ? 'last' : null;
                    if (!direction) return;
                    event.preventDefault();
                    moveArtifactFocus(index, direction);
                  }}
                  className={`block w-full rounded-xl border px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selectedItem?.id === item.id ? 'border-primary/55 bg-primary/10 shadow-sm shadow-primary/10' : 'border-border/50 bg-background/20 hover:border-primary/35'}`}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{item.artifact.path}</span>
                    {item.readiness !== 'ready' && <Badge variant="outline" className={optimizationReadinessClass(item.readiness)}>{optimizationReadinessLabel(item.readiness)}</Badge>}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                    <span className="font-medium text-foreground/80">{optimizationActionLabel(item.artifact.action)}</span>
                    <span>{transformationDomainLabel(item.domains[0])}</span>
                    <span>{item.proposalIds.length} proposal{item.proposalIds.length === 1 ? '' : 's'}</span>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section
            className={`${mobile && mobileReviewView === 'artifacts' ? 'hidden' : 'block'} min-w-0 p-3 sm:p-4 xl:min-h-0 xl:overflow-y-auto`}
            data-review-pane="artifact-detail"
          >
            {mobile && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setMobileReviewView('artifacts')} className="mb-3">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to artifacts
              </Button>
            )}
            <OptimizationPlanArtifactDetail item={selectedItem} proposals={proposals} excludedProposalIds={excludedProposalIds} onToggleProposalIncluded={onToggleProposalIncluded} />

            {prepared && (
              <OptimizationApplyFlow
                applyPlan={applyPlan}
                connection={connection}
                packState={packState}
                packError={packError}
                prConfirmed={prConfirmed}
                prState={prState}
                prError={prError}
                prPreviewResult={prPreviewResult}
                prResult={prResult}
                manifestPreview={manifestPreview}
                baseline={verificationBaseline}
                verificationResult={verificationResult}
                baselineSavedForCurrentPlan={baselineSavedForCurrentPlan}
                onDownloadPack={handleDownloadPack}
                onSaveBaseline={() => saveVerificationBaseline('manual-baseline')}
                onDiscardBaseline={onDiscardVerificationBaseline}
                onPrConfirmedChange={setPrConfirmed}
                onPreviewPr={handlePreviewPr}
                onCreatePr={handleCreatePr}
              />
            )}
            {!prepared && verificationBaseline && (
              <details className="mt-4 rounded-2xl border border-border/55 bg-secondary/15 p-4">
                <summary className="cursor-pointer text-sm font-semibold">Verification baseline details</summary>
                <div className="mt-3">
                  <RepositoryVerificationPanel baseline={verificationBaseline} verificationResult={verificationResult} baselineSavedForCurrentPlan={false} onSaveBaseline={() => undefined} onDiscardBaseline={onDiscardVerificationBaseline} />
                </div>
              </details>
            )}
          </section>
        </div>
      )}
    </section>
  );
}

function OptimizationPlanMetric({ label, value, compact = false }: { label: string; value: number; compact?: boolean }) {
  return (
    <div className={compact ? 'inline-flex items-baseline gap-1.5 rounded-full border border-border/50 bg-secondary/15 px-2.5 py-1' : 'rounded-2xl border border-border/50 bg-secondary/15 p-3'}>
      <div className={compact ? 'font-display text-sm font-semibold text-foreground' : 'mt-1 font-display text-2xl font-semibold text-foreground'}>{value.toLocaleString()}</div>
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</div>
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
  prPreviewResult,
  prResult,
  manifestPreview,
  baseline,
  verificationResult,
  baselineSavedForCurrentPlan,
  onDownloadPack,
  onSaveBaseline,
  onDiscardBaseline,
  onPrConfirmedChange,
  onPreviewPr,
  onCreatePr,
}: {
  applyPlan: OptimizationApplyPlan | null;
  connection: GitHubConnectionState;
  packState: 'idle' | 'building' | 'downloaded' | 'error';
  packError: string;
  prConfirmed: boolean;
  prState: 'idle' | 'previewing' | 'preview-ready' | 'applying' | 'created' | 'error';
  prError: { message: string; nextAction: string; progress?: OptimizationGithubApplyProgress } | null;
  prPreviewResult: OptimizationPrPreviewResponse['plan'] | null;
  prResult: OptimizationPrApplyResponse | null;
  manifestPreview: string;
  baseline?: RepositoryVerificationBaseline | null;
  verificationResult?: RepositoryVerificationResult | null;
  baselineSavedForCurrentPlan: boolean;
  onDownloadPack: () => void;
  onSaveBaseline: () => void;
  onDiscardBaseline?: () => void;
  onPrConfirmedChange: (confirmed: boolean) => void;
  onPreviewPr: () => void;
  onCreatePr: () => void;
}) {
  const [prPreviewOpen, setPrPreviewOpen] = useState(false);
  if (!applyPlan) return null;
  const prPreview = applyPlan.prPreview;
  const canCreatePr = prPreview.canUseGitHubApp && prConfirmed && prPreviewResult?.applyReady && prState !== 'applying';
  const reviewCount = applyPlan.summary.reviewRequiredCount;
  const blockedCount = applyPlan.summary.blockedCount;
  const openPrPreview = () => {
    setPrPreviewOpen(true);
    if (prPreview.canUseGitHubApp) onPreviewPr();
  };

  return (
    <div className="mt-4 grid gap-3 lg:grid-cols-2" aria-label="Optimization Apply Flow">
      <section className="rounded-2xl border border-primary/20 bg-background/20 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Export package</div>
            <h4 className="mt-1 font-display text-lg font-semibold">Download Optimization Package</h4>
          </div>
          <Badge variant="outline" className={blockedCount > 0 ? 'border-warning/50 text-warning' : reviewCount > 0 ? 'border-primary/35 text-primary-glow' : 'border-success/40 text-success'}>
            {applyPlan.summary.zipFileCount} files
          </Badge>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Includes the prepared artifacts, manifest, apply instructions, and review notes. Downloading does not modify the repository.
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
            <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">GitHub</div>
            <h4 className="mt-1 font-display text-lg font-semibold">Preview pull request</h4>
          </div>
          <Badge variant="outline" className={prPreview.canUseGitHubApp ? 'border-success/40 text-success' : 'border-border/60 text-muted-foreground'}>
            {prPreview.canUseGitHubApp ? 'Available' : 'Manual fallback'}
          </Badge>
        </div>

        <p className="mt-4 text-sm text-muted-foreground">
          Review {prPreview.files.length} file action{prPreview.files.length === 1 ? '' : 's'}, branch, title, and diff before confirmation. Opening the preview does not mutate GitHub.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {!prPreviewOpen ? (
            <Button type="button" variant="outline" size="sm" onClick={openPrPreview} className="border-primary/35 bg-primary/10 text-primary-glow hover:text-primary-glow">Preview GitHub PR</Button>
          ) : (
            <Button type="button" variant="ghost" size="sm" onClick={() => setPrPreviewOpen(false)}>Close GitHub PR preview</Button>
          )}
          {prPreviewOpen && prPreview.canUseGitHubApp && prState !== 'previewing' && (
            <Button type="button" variant="outline" size="sm" onClick={onPreviewPr}><RefreshCw className="mr-2 h-3.5 w-3.5" />Refresh repository state</Button>
          )}
        </div>

        {prPreviewOpen && (
          <div className="mt-4 space-y-3 rounded-xl border border-border/55 bg-secondary/10 p-3" aria-label="GitHub PR confirmation preview">
            {!prPreview.canUseGitHubApp ? (
              <div className="rounded-2xl border border-border/55 bg-secondary/15 p-3 text-sm text-muted-foreground">
                <p>{prPreview.unavailableReason}</p>
                <p className="mt-2">Use the Optimization Pack ZIP and manual git flow, or reconnect with the GitHub App and rescan the selected repository.</p>
              </div>
            ) : prState === 'previewing' ? (
              <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 text-sm" aria-live="polite">
                <div className="font-semibold">Validating repository</div>
                <p className="mt-1 text-muted-foreground">Checking the base ref, target files, branch state, permissions, and matching pull requests. No repository changes are being made.</p>
              </div>
            ) : prPreviewResult ? (
              <>
                <section className="rounded-xl border border-border/55 bg-background/20 p-3" aria-label="Repository target">
                  <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Repository target</div>
                  <div className="mt-2 grid gap-2 text-sm">
                    <Row label="Repository" value={`${prPreviewResult.repository.owner}/${prPreviewResult.repository.repo}`} />
                    <Row label="Base branch" value={prPreviewResult.repository.baseBranch} />
                    <Row label="Base commit" value={prPreviewResult.repository.baseCommit.slice(0, 12)} />
                    <Row label="Proposed branch" value={prPreviewResult.branch.suggestedName} />
                    <Row label="Branch state" value={optimizationBranchStateLabel(prPreviewResult.branch.existingState)} />
                    <Row label="GitHub App" value={connection.connectionStatus === 'connected' ? 'Connected' : connection.connectionStatus} />
                  </div>
                </section>

                <section className="rounded-xl border border-border/55 bg-background/20 p-3" aria-label="Pull request file summary">
                  <div className="flex flex-wrap gap-2">
                    <OptimizationPlanMetric compact label="Files" value={prPreviewResult.summary.totalFiles} />
                    {prPreviewResult.summary.createCount > 0 && <OptimizationPlanMetric compact label="Create" value={prPreviewResult.summary.createCount} />}
                    {prPreviewResult.summary.updateCount > 0 && <OptimizationPlanMetric compact label="Update" value={prPreviewResult.summary.updateCount} />}
                    {prPreviewResult.summary.strengthenCount > 0 && <OptimizationPlanMetric compact label="Strengthen" value={prPreviewResult.summary.strengthenCount} />}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{formatFileSize(prPreviewResult.summary.totalBytes)} reviewed payload · {prPreviewResult.validation.blockingIssues.length} blocking · {prPreviewResult.validation.warnings.length} warnings</p>
                </section>

                {prPreviewResult.validation.blockingIssues.length > 0 && (
                  <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm text-warning" role="alert">
                    <div className="font-semibold">Confirmation blocked</div>
                    {prPreviewResult.validation.blockingIssues.map(issue => <p key={`${issue.code}:${issue.path || ''}`} className="mt-1">{issue.path ? `${issue.path}: ` : ''}{issue.message} {issue.nextAction}</p>)}
                  </div>
                )}

                <details open className="rounded-xl border border-border/55 bg-secondary/15 p-3">
                  <summary className="cursor-pointer text-sm font-semibold">Reviewed files and diffs</summary>
                  <div className="mt-3 space-y-2">
                    {prPreviewResult.files.map(file => <OptimizationGithubPrFilePreview key={file.path} file={file} />)}
                  </div>
                </details>

                <details className="rounded-xl border border-border/55 bg-secondary/15 p-3">
                  <summary className="cursor-pointer text-sm font-semibold">Pull request metadata</summary>
                  <div className="mt-3 grid gap-2 text-sm">
                    <Row label="Title" value={prPreviewResult.pullRequest.title} />
                    <Row label="Base" value={prPreviewResult.repository.baseBranch} />
                    <Row label="Head" value={prPreviewResult.branch.suggestedName} />
                  </div>
                  <pre className="mt-3 max-h-60 overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words rounded-lg bg-inset p-3 text-[11px] text-muted-foreground">{prPreviewResult.pullRequest.body}</pre>
                </details>

                <div className="rounded-xl border border-primary/25 bg-primary/5 p-3 text-xs text-muted-foreground">
                  No repository change has happened yet. Confirmation creates or resumes only the reviewed ShipSeal branch, writes the reviewed files, and opens the pull request. ShipSeal does not push directly to the default or protected branch. Verification still requires a later scan.
                </div>

                {prPreviewResult.existingPullRequest?.matching ? (
                  <div className="rounded-xl border border-success/35 bg-success/10 p-3 text-sm text-success">
                    A matching pull request already exists. Confirmation returns that PR without creating a duplicate.
                  </div>
                ) : null}

                <label className="flex gap-3 rounded-xl border border-border/55 bg-secondary/15 p-3 text-sm">
                  <input type="checkbox" checked={prConfirmed} onChange={event => onPrConfirmedChange(event.target.checked)} disabled={!prPreviewResult.applyReady || prState === 'applying'} className="mt-1 h-4 w-4 accent-primary" />
                  <span>Create the reviewed ShipSeal branch and open this pull request. The payload, base commit, file actions, and diffs shown above must still match at confirmation time.</span>
                </label>
                <Button type="button" size="sm" onClick={onCreatePr} disabled={!canCreatePr} className="bg-primary text-primary-foreground hover:bg-primary/90">
                  {prState === 'applying' ? 'Validating and applying reviewed plan' : 'Create reviewed branch and pull request'}
                </Button>
              </>
            ) : null}

            {prState === 'error' && prError && (
              <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm" role="alert" aria-live="assertive">
                <div className="font-semibold text-warning">{prError.message}</div>
                <p className="mt-1 text-muted-foreground">{prError.nextAction}</p>
                {prError.progress && <OptimizationPrProgress progress={prError.progress} />}
                <div className="mt-3 flex flex-wrap gap-2">
                  {prError.progress?.branchUrl && <a href={prError.progress.branchUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold underline underline-offset-4">Open existing branch</a>}
                  <button type="button" onClick={prPreviewResult ? onCreatePr : onPreviewPr} className="text-xs font-semibold underline underline-offset-4">{prPreviewResult ? 'Retry reviewed step' : 'Retry repository preview'}</button>
                </div>
              </div>
            )}

            {prState === 'created' && prResult && (
              <div className="rounded-xl border border-success/40 bg-success/10 p-3 text-sm text-success" aria-live="polite">
                <div className="font-semibold">{prResult.existing ? 'Existing matching pull request found' : 'Pull request created'}</div>
                <p className="mt-1">{prResult.fileCount} reviewed files on <code>{prResult.branchName}</code>. Lifecycle is Applied, not Verified.</p>
                <a href={prResult.prUrl} className="mt-2 inline-block font-semibold underline underline-offset-4" target="_blank" rel="noreferrer">Open pull request</a>
              </div>
            )}
          </div>
        )}
      </section>

      <details className="lg:col-span-2 rounded-2xl border border-border/55 bg-secondary/15 p-4">
        <summary className="cursor-pointer select-none text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">After applying changes · verification baseline</summary>
        <p className="mt-2 text-sm text-muted-foreground">Run a later scan to verify the prepared artifacts. Verify remains the primary lifecycle surface.</p>
        <div className="mt-3">
          <RepositoryVerificationPanel applyPlan={applyPlan} baseline={baseline} verificationResult={verificationResult} baselineSavedForCurrentPlan={baselineSavedForCurrentPlan} onSaveBaseline={onSaveBaseline} onDiscardBaseline={onDiscardBaseline} />
        </div>
      </details>

      <details className="xl:col-span-2 rounded-2xl border border-border/55 bg-secondary/15 p-4">
        <summary className="cursor-pointer select-none text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Manifest and apply instructions
        </summary>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-inset p-3 text-[11px] leading-relaxed text-muted-foreground">
            {JSON.stringify(applyPlan.manifest, null, 2)}
          </pre>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-inset p-3 text-[11px] leading-relaxed text-muted-foreground">
            {applyPlan.applyInstructions}
          </pre>
        </div>
        <details className="mt-3 rounded-xl border border-border/45 bg-background/20 p-3">
          <summary className="cursor-pointer select-none text-xs font-semibold text-muted-foreground">Source Optimization Plan manifest</summary>
          <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap rounded-xl bg-inset p-3 text-[11px] leading-relaxed text-muted-foreground">
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
  applyPlan?: OptimizationApplyPlan;
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

      {applyPlan?.summary.selectedArtifactCount === 0 && (
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

function OptimizationGithubPrFilePreview({ file }: { file: OptimizationGithubApplyPlanFile }) {
  const [diffCopied, setDiffCopied] = useState(false);
  const copyDiff = async () => {
    try {
      await navigator.clipboard.writeText(file.diff);
      setDiffCopied(true);
    } catch {
      setDiffCopied(false);
    }
  };
  return (
    <article className="rounded-xl border border-border/45 bg-background/20 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 flex-1 break-words text-sm font-medium" title={file.path}>{file.path}</span>
        <Badge variant="outline" className="border-border/60 text-muted-foreground">
          {optimizationActionLabel(file.action)}
        </Badge>
        <Badge variant="outline" className={file.status === 'blocked' ? 'border-warning/50 text-warning' : file.status === 'already-applied' ? 'border-success/40 text-success' : 'border-primary/35 text-primary-glow'}>
          {file.status === 'already-applied' ? 'Already on branch' : file.status === 'blocked' ? 'Blocked' : 'Validated'}
        </Badge>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span>{formatFileSize(file.sizeBytes)}</span>
        <span>+{file.addedLines} / -{file.removedLines} lines</span>
        {file.previousSha && <span>Previous SHA {file.previousSha.slice(0, 12)}</span>}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{file.validationMessage}</p>
      <details className="mt-2 rounded-lg border border-border/45 bg-secondary/10 p-2">
        <summary className="cursor-pointer text-xs font-semibold">Diff preview</summary>
        <div className="mt-2 flex justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={copyDiff} className="h-7 px-2 text-[11px]"><Copy className="mr-1.5 h-3 w-3" />{diffCopied ? 'Copied' : 'Copy diff'}</Button>
        </div>
        <pre className="max-h-72 overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words rounded-lg bg-inset p-2 text-[11px] text-muted-foreground">{file.diff}</pre>
        {file.diffTruncated && <p className="mt-2 text-[11px] text-warning">The rendered diff is bounded; the reviewed full content remains the write payload.</p>}
      </details>
      {file.previousContent !== undefined && (
        <details className="mt-2 rounded-lg border border-border/45 bg-secondary/10 p-2">
          <summary className="cursor-pointer text-xs font-semibold">Current repository content</summary>
          <pre className="mt-2 max-h-56 overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words rounded-lg bg-inset p-2 text-[11px] text-muted-foreground">{file.previousContent}</pre>
        </details>
      )}
      <details className="mt-2 rounded-lg border border-border/45 bg-secondary/10 p-2">
        <summary className="cursor-pointer text-xs font-semibold">Prepared next content</summary>
        <pre className="mt-2 max-h-56 overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words rounded-lg bg-inset p-2 text-[11px] text-muted-foreground">{file.nextContent}</pre>
      </details>
    </article>
  );
}

function OptimizationPrProgress({ progress }: { progress: OptimizationGithubApplyProgress }) {
  return (
    <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
      <span>Completed: {progress.completedSteps.length ? progress.completedSteps.map(step => step.replace(/-/g, ' ')).join(', ') : 'No repository mutation step completed'}</span>
      {progress.failedStep && <span>Failed stage: {progress.failedStep.replace(/-/g, ' ')}</span>}
      <span>Files present on branch: {progress.writtenFileCount}/{progress.totalFileCount}</span>
      {progress.branchName && <span>Branch: {progress.branchName}</span>}
    </div>
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
  const [contentCopied, setContentCopied] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  useEffect(() => {
    setContentCopied(false);
    setEvidenceOpen(false);
  }, [item?.id]);

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
  const decisionProposal = activeRelatedProposals[0] || excludedRelatedProposals[0];
  const decisionIncluded = decisionProposal ? !excludedProposalIds.has(decisionProposal.id) : false;

  const copyGeneratedContent = async () => {
    try {
      await navigator.clipboard.writeText(item.artifact.content);
      setContentCopied(true);
    } catch {
      setContentCopied(false);
    }
  };

  return (
    <aside className="min-w-0 rounded-2xl border border-primary/15 bg-background/25 p-4 sm:p-5" aria-labelledby="optimization-artifact-heading">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={optimizationReadinessClass(item.readiness)}>
          {optimizationReadinessLabel(item.readiness)}
        </Badge>
        <Badge variant="outline" className="border-border/60 text-muted-foreground">{optimizationActionLabel(item.artifact.action)}</Badge>
        <Badge variant="outline" className={item.confidence === 'low' ? 'border-warning/45 text-warning' : 'border-primary/30 text-muted-foreground'}>
          {item.confidence} confidence
        </Badge>
      </div>

      <h4 id="optimization-artifact-heading" className="mt-3 break-words font-display text-xl font-semibold">{item.title}</h4>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.purpose}</p>

      <div className="mt-4 grid gap-2 rounded-xl border border-border/50 bg-secondary/10 p-3 text-sm">
        <Row label="Generated path" value={item.artifact.path} />
        <Row label="Future destination" value={item.artifact.repositoryDestinationPath} />
        <Row label="Action" value={optimizationActionLabel(item.artifact.action)} />
        <Row label="Domain" value={item.domains.map(transformationDomainLabel).join(', ')} />
      </div>

      {decisionProposal && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/25 bg-primary/5 p-3">
          <div className="min-w-0">
            <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Plan decision</div>
            <div className="mt-1 truncate text-sm font-medium" title={decisionProposal.title}>{decisionProposal.title}</div>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => onToggleProposalIncluded(decisionProposal.id)} className={decisionIncluded ? 'border-border/60 bg-background/25' : 'border-primary/35 bg-primary/10 text-primary-glow hover:text-primary-glow'}>
            {decisionIncluded ? 'Remove from plan' : 'Include in plan'}
          </Button>
        </div>
      )}

      <section className="mt-4 rounded-2xl border border-border/55 bg-secondary/15 p-4" aria-label="Generated content preview">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Generated content</div>
            <h5 className="mt-1 text-sm font-semibold">Prepared artifact preview</h5>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={copyGeneratedContent} className="border-border/60 bg-background/25">
            <Copy className="mr-2 h-3.5 w-3.5" /> {contentCopied ? 'Copied' : 'Copy content'}
          </Button>
        </div>
        <pre className="mt-3 max-h-[24rem] overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words rounded-xl bg-inset p-3 font-mono text-[11px] leading-relaxed text-muted-foreground" tabIndex={0}>
          {item.artifact.content || 'Generated content could not be prepared for this artifact.'}
        </pre>
      </section>

      <details className="mt-4 rounded-2xl border border-border/55 bg-secondary/15 p-4">
        <summary className="cursor-pointer select-none text-sm font-semibold">Contributing proposals</summary>
        <div className="mt-3 space-y-2">
          {activeRelatedProposals.map(proposal => (
            <div key={proposal.id} className="rounded-xl border border-border/45 bg-background/20 px-3 py-2">
              <div className="min-w-0">
                <div className="break-words text-sm font-medium text-foreground">{proposal.title}</div>
                <div className="text-xs text-muted-foreground">{transformationDomainLabel(proposal.domain)}</div>
              </div>
            </div>
          ))}
          {excludedRelatedProposals.map(proposal => (
            <div key={proposal.id} className="rounded-xl border border-border/45 bg-background/10 px-3 py-2 opacity-85">
              <div className="min-w-0">
                <div className="break-words text-sm font-medium text-muted-foreground">{proposal.title}</div>
                <div className="text-xs text-muted-foreground">Excluded from current plan</div>
              </div>
            </div>
          ))}
        </div>
      </details>

      <details className="mt-3 rounded-2xl border border-border/55 bg-secondary/15 p-4" onToggle={event => setEvidenceOpen(event.currentTarget.open)}>
        <summary className="cursor-pointer select-none text-sm font-semibold">Complete scan evidence</summary>
        {evidenceOpen && (
          <ul className="mt-3 space-y-2">
            {item.evidenceReferences.slice(0, 6).map(evidence => (
              <li key={`${evidence.state}:${evidence.label}:${evidence.detail || ''}`} className="rounded-xl border border-border/45 bg-background/20 px-3 py-2">
                <div className="text-sm font-medium text-foreground">{evidence.label}</div>
                {evidence.detail && <div className="mt-1 text-xs text-muted-foreground">{evidence.detail}</div>}
              </li>
            ))}
          </ul>
        )}
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
        <summary className="cursor-pointer select-none text-sm font-semibold">Verification expectation</summary>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          {item.expectedAgentBehavior.map(text => <li key={text}>{text}</li>)}
        </ul>
      </details>

      <details className="mt-3 rounded-2xl border border-border/55 bg-secondary/15 p-4">
        <summary className="cursor-pointer select-none text-sm font-semibold">Advanced generator metadata</summary>
        <div className="mt-3 grid gap-2 text-sm">
          <Row label="Generator" value={item.artifact.generatorId} />
          <Row label="Contributors" value={item.proposalIds.join(', ')} />
        </div>
        <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
          {item.artifact.outline.map(line => <li key={line} className="break-words">{line}</li>)}
        </ul>
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
  allowInclusionToggle = true,
  collapsed = false,
  onToggleCollapsed,
  onToggleIncluded,
  onClear,
}: {
  proposal: RepositoryTransformationProposal;
  included: boolean;
  allowInclusionToggle?: boolean;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  onToggleIncluded: () => void;
  onClear: () => void;
}) {
  if (collapsed) {
    return (
      <aside className="rounded-[1.6rem] border border-primary/15 bg-[hsl(var(--universe-surface-raised)/0.82)] p-4 shadow-[0_24px_75px_hsl(var(--universe-stage-bg)/0.58)] backdrop-blur-xl motion-safe:animate-fade-in" aria-labelledby="transformation-inspector-collapsed">
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
    <aside className="rounded-[1.6rem] border border-primary/15 bg-[linear-gradient(155deg,hsl(var(--universe-surface-raised)/0.9),hsl(var(--universe-stage-bg)/0.76))] p-5 shadow-[0_24px_75px_hsl(var(--universe-stage-bg)/0.62),0_0_36px_hsl(var(--primary)/0.05)] backdrop-blur-xl motion-safe:animate-fade-in" aria-labelledby="transformation-inspector-heading">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="border-primary/45 text-primary-glow">Proposed</Badge>
        <Badge variant="outline" className="border-border/60 text-muted-foreground">{transformationDomainLabel(proposal.domain)}</Badge>
        <Badge variant="outline" className={proposal.confidence === 'low' ? 'border-warning/45 text-warning' : 'border-primary/30 text-muted-foreground'}>
          {proposal.confidence} confidence
        </Badge>
        <Badge variant="outline" className={proposal.evidenceType === 'heuristic' ? 'border-warning/45 text-warning' : 'border-success/35 text-success'}>
          {proposal.evidenceType === 'heuristic' ? 'Heuristic' : 'Evidence-backed'}
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
      <dl className="mt-4 grid gap-2 rounded-2xl border border-border/45 bg-background/20 p-3 text-xs sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Intended change</dt>
          <dd className="mt-1 font-medium text-foreground">{proposal.title}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Generated destination</dt>
          <dd className="mt-1 break-all font-medium text-foreground">{proposal.artifactActions.map(action => action.path).join(', ')}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Affected repository area</dt>
          <dd className="mt-1 font-medium text-foreground">{proposal.graphChanges.affectedExistingNodeIds.length.toLocaleString()} connected entities</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Relationship</dt>
          <dd className="mt-1 font-medium text-foreground">{proposal.graphChanges.proposedEdges[0]?.relationship.replace(/-/g, ' ') || 'Proposed relationship'}</dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        {allowInclusionToggle && <Button type="button" variant="outline" size="sm" onClick={onToggleIncluded} className="border-primary/35 bg-primary/10 text-primary-glow hover:text-primary-glow">
          {included ? 'Remove from plan' : 'Include in plan'}
        </Button>}
        <Button type="button" variant="ghost" size="sm" onClick={onClear}>
          Return to repository entity
        </Button>
      </div>

      <div className="mt-5 space-y-4 text-sm">
        <details className="rounded-xl border border-border/45 bg-background/20 p-3">
          <summary className="cursor-pointer font-medium text-foreground">Evidence and confidence</summary>
          <ul className="mt-2 space-y-2">
            {proposal.sourceEvidence.map(item => (
              <li key={`${item.label}:${item.detail}`} className="rounded-2xl border border-border/45 bg-background/25 px-3 py-2">
                <div className="font-medium text-foreground">{item.label}</div>
                {item.detail && <div className="mt-1 text-xs text-muted-foreground">{item.detail}</div>}
              </li>
            ))}
          </ul>
        </details>

        <details className="rounded-xl border border-border/45 bg-background/20 p-3">
          <summary className="cursor-pointer font-medium text-foreground">Artifact preview</summary>
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
                    <pre className="mt-3 max-h-44 overflow-auto whitespace-pre-wrap rounded-lg bg-inset p-3 text-[11px] leading-relaxed text-muted-foreground">{action.preview.excerpt}</pre>
                  </div>
                )}
              </details>
            ))}
          </div>
        </details>

        <details className="rounded-xl border border-border/45 bg-background/20 p-3">
          <summary className="cursor-pointer font-medium text-foreground">Affected areas</summary>
          <p className="mt-2 text-muted-foreground">{proposal.graphChanges.affectedExistingNodeIds.length.toLocaleString()} current repository entities are connected by proposed relationships.</p>
        </details>

        <details className="rounded-xl border border-border/45 bg-background/20 p-3">
          <summary className="cursor-pointer font-medium text-foreground">Verification expectation</summary>
          <p className="mt-2 text-muted-foreground">{proposal.expectedEffect.agentBehavior}</p>
          <p className="mt-2 text-muted-foreground">{proposal.expectedEffect.repositoryMeaning}</p>
        </details>
      </div>
    </aside>
  );
}

function RepositoryUniverseLoading({ onOpenAtlas }: { onOpenAtlas: () => void }) {
  return (
    <div className="grid h-full min-h-[560px] place-items-center rounded-[1.5rem] border border-primary/15 bg-canvas p-8 text-center">
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
    <div className="grid h-full min-h-[560px] place-items-center rounded-[1.5rem] border border-primary/15 bg-canvas p-8 text-center">
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
  report,
  story,
  universe,
  node,
  nodeHiddenByFilters = false,
  cluster,
  activeChapter,
  repositoryName,
  scanSummary,
  rootNodeId,
  activeTab,
  collapsed = false,
  onToggleCollapsed,
  onTabChange,
  onClose,
  onFocusNode,
  onFocusCluster,
  onClearFocus,
  onReturnRepository,
  onOpenAtlas,
  onSelectNode,
  onSelectChapter,
}: {
  report: ReadinessReport;
  story: WorkspaceStory;
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
  activeTab: ContextualInspectorTab;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  onTabChange: (tab: ContextualInspectorTab) => void;
  onClose: () => void;
  onFocusNode: () => void;
  onFocusCluster: () => void;
  onClearFocus: () => void;
  onReturnRepository: () => void;
  onOpenAtlas?: () => void;
  onSelectNode: (node: RepositoryUniverseNode) => void;
  onSelectChapter: (chapterId: WorkspaceStoryChapterId) => void;
}) {
  const isRepository = !node || node.id === rootNodeId || node.kind === 'repository';
  const evidenceItems = node?.evidenceItems || [];
  const relationships = node ? universe.edges.filter(edge => edge.source === node.id || edge.target === node.id) : [];
  const relatedNodes = relationships
    .map(edge => universe.nodes.find(item => item.id === (edge.source === node?.id ? edge.target : edge.source)))
    .filter(Boolean) as RepositoryUniverseNode[];
  const repositoryDna = isRepository ? buildRepositoryDna(report) : [];
  const mentalModel = isRepository ? buildMentalModel(report) : null;
  const availableTabs: Array<{ id: ContextualInspectorTab; label: string }> = [
    { id: 'overview', label: 'Overview' },
    ...(evidenceItems.length || activeChapter?.evidenceItems.length ? [{ id: 'evidence' as const, label: 'Evidence' }] : []),
    ...(relationships.length ? [{ id: 'relationships' as const, label: 'Relationships' }] : []),
    ...(node?.metadata.agentRelevance || activeChapter?.agentUse ? [{ id: 'agent-impact' as const, label: 'Agent impact' }] : []),
    ...(story.chapters.length && (isRepository || activeChapter) ? [{ id: 'story' as const, label: 'Story' }] : []),
    ...(isRepository && repositoryDna.length ? [{ id: 'dna' as const, label: 'DNA' }] : []),
    ...(isRepository && mentalModel?.nodes.length ? [{ id: 'mental-model' as const, label: 'Mental Model' }] : []),
  ];
  const selectedTab = availableTabs.some(tab => tab.id === activeTab) ? activeTab : availableTabs[0].id;

  if (collapsed) {
    return (
      <aside className="rounded-[1.6rem] border border-primary/15 bg-[hsl(var(--universe-surface-raised)/0.82)] p-4 shadow-[0_24px_75px_hsl(var(--universe-stage-bg)/0.58)] backdrop-blur-xl" aria-labelledby="contextual-inspector-collapsed">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Context</div>
            <h3 id="contextual-inspector-collapsed" className="mt-1 truncate font-display text-base font-semibold">{isRepository ? repositoryName : node?.label}</h3>
          </div>
          {onToggleCollapsed && <Button type="button" variant="ghost" size="sm" onClick={onToggleCollapsed} aria-label="Expand inspector"><PanelRightOpen className="h-3.5 w-3.5" /></Button>}
        </div>
      </aside>
    );
  }

  return (
    <aside className="rounded-[1.6rem] border border-primary/15 bg-[linear-gradient(155deg,hsl(var(--universe-surface-raised)/0.92),hsl(var(--universe-stage-bg)/0.8))] p-4 shadow-[0_24px_75px_hsl(var(--universe-stage-bg)/0.62)] backdrop-blur-xl" aria-labelledby="contextual-inspector-heading">
      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={node?.evidenceType === 'evidence' ? 'border-primary/40 text-primary-glow' : 'border-border/60 text-muted-foreground'}>
              {isRepository ? 'Repository' : node ? evidenceStateLabel(node.evidenceType) : 'Entity'}
            </Badge>
            {activeChapter && <Badge variant="outline" className="border-accent/40 text-accent">{activeChapter.shortLabel}</Badge>}
          </div>
          <h3 id="contextual-inspector-heading" className="mt-2 break-words font-display text-lg font-semibold">{isRepository ? repositoryName : node?.label}</h3>
          {node?.path && <p className="mt-1 break-all text-xs text-muted-foreground">{node.path}</p>}
        </div>
        {onToggleCollapsed && <Button type="button" variant="ghost" size="sm" onClick={onToggleCollapsed} aria-label="Collapse inspector"><PanelRightClose className="h-3.5 w-3.5" /></Button>}
        <Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label="Close inspector">Close</Button>
      </header>

      <div className="mt-4 flex gap-1 overflow-x-auto pb-1" role="tablist" aria-label="Contextual repository details">
        {availableTabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selectedTab === tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`shrink-0 rounded-full border px-2.5 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selectedTab === tab.id ? 'border-primary/45 bg-primary/15 text-primary-glow' : 'border-border/50 text-muted-foreground hover:text-foreground'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-4" role="tabpanel">
        {selectedTab === 'overview' && (
          <div className="space-y-3">
            <p className="text-sm leading-relaxed text-muted-foreground">
              {isRepository
                ? `${scanSummary.analyzedFiles.toLocaleString()} files were organized into ${scanSummary.clusterCount.toLocaleString()} evidence clusters.`
                : String(node?.metadata.repositoryRole || activeChapter?.repositoryMeaning || 'No repository role was inferred for this entity.')}
            </p>
            {nodeHiddenByFilters && <p className="rounded-xl border border-warning/35 bg-warning/10 p-3 text-xs text-warning">Selected, but hidden by the current filters.</p>}
            <div className="grid gap-2 text-sm">
              {isRepository ? (
                <>
                  <Row
                    label="Workspace Quality"
                    value={report.repositoryHealth.overall.score === null
                      ? 'Unavailable'
                      : `${report.repositoryHealth.overall.score} / 100 · ${report.repositoryHealth.overall.status}`}
                  />
                  <Row
                    label="Agent friction"
                    value={report.repositoryHealth.dimensions.contextWaste.riskScore === null
                      ? 'Unavailable'
                      : `${report.repositoryHealth.dimensions.contextWaste.riskScore} / 100 risk · ${contextWasteRiskLabel(report.repositoryHealth.dimensions.contextWaste.riskScore)}`}
                  />
                  <Row label="Confidence" value={`${report.repositoryHealth.overall.confidence} confidence`} />
                </>
              ) : (
                <>
                  <Row label="Type" value={node ? universeKindLabel(node.kind) : 'Repository'} />
                  <Row label="Cluster" value={cluster?.label || 'Repository'} />
                  <Row label="Relationships" value={String(relationships.length)} />
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {!isRepository && <Button type="button" variant="outline" size="sm" onClick={onFocusNode}>Focus node</Button>}
              {!isRepository && <Button type="button" variant="outline" size="sm" onClick={onFocusCluster} disabled={!node?.clusterId}>Focus cluster</Button>}
              {!isRepository && <Button type="button" variant="ghost" size="sm" onClick={onReturnRepository}>Repository profile</Button>}
              {onOpenAtlas && <Button type="button" variant="ghost" size="sm" onClick={onOpenAtlas}>Open Atlas 2D</Button>}
              <Button type="button" variant="ghost" size="sm" onClick={onClearFocus}>Clear focus</Button>
            </div>
          </div>
        )}

        {selectedTab === 'evidence' && (
          <div>
            <p className="mb-3 text-xs text-muted-foreground">Evidence is shown for this entity or its active repository story.</p>
            <ul className="space-y-2">
              {(evidenceItems.length ? evidenceItems : activeChapter?.evidenceItems || []).slice(0, 5).map((item, index) => (
                <li key={`${item.state}-${item.label}-${index}`} className="rounded-xl border border-border/50 bg-background/20 p-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="break-all font-medium text-foreground">{item.label}</span>
                    <Badge variant="outline" className={evidenceStateClass(item.state)}>{evidenceStateLabel(item.state)}</Badge>
                  </div>
                  {item.detail && <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {selectedTab === 'relationships' && (
          <div className="space-y-2">
            {relationships.slice(0, 8).map(edge => {
              const related = relatedNodes.find(item => item.id === (edge.source === node?.id ? edge.target : edge.source));
              return (
                <button key={edge.id} type="button" onClick={() => related && onSelectNode(related)} className="block w-full rounded-xl border border-border/50 bg-background/20 p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="text-sm font-medium text-foreground">{related?.label || 'Related entity'}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{relationshipLabel(edge)} · {edge.evidenceType}</span>
                </button>
              );
            })}
          </div>
        )}

        {selectedTab === 'agent-impact' && (
          <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>{String(node?.metadata.agentRelevance || activeChapter?.agentUse || 'No agent-specific impact surfaced.')}</p>
            {activeChapter && <p className="rounded-xl border border-border/50 bg-background/20 p-3">{activeChapter.relationship}</p>}
          </div>
        )}

        {selectedTab === 'story' && (
          <div className="space-y-3">
            {(isRepository ? story.chapters : activeChapter ? [activeChapter] : []).map(chapter => (
              <button key={chapter.id} type="button" onClick={() => onSelectChapter(chapter.id)} className="block w-full rounded-xl border border-border/50 bg-background/20 p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span className="text-sm font-semibold text-foreground">{chapter.label}</span>
                <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{chapter.repositoryMeaning}</span>
                <span className="mt-2 block text-[10px] uppercase tracking-wider text-muted-foreground">{chapter.evidenceItems.length} evidence references</span>
              </button>
            ))}
          </div>
        )}

        {selectedTab === 'dna' && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Current and potential workspace dimensions; calculations are unchanged.</p>
            {repositoryDna.map(dimension => {
              const chapter = chapterForDnaDimension(story, dimension.id as WorkspaceStoryDnaDimensionId);
              return (
                <details key={dimension.id} className="rounded-xl border border-border/50 bg-background/20 p-3">
                  <summary className="cursor-pointer text-sm font-medium text-foreground">
                    {dimension.label} · {dimension.score === null ? 'Unavailable' : dimension.score} / potential {dimension.potentialScore ?? 'n/a'}
                  </summary>
                  <p className="mt-2 text-xs text-muted-foreground">{dimension.description}</p>
                  <RepositoryDnaList title="Evidence" items={dimension.evidence} emptyText="No strong evidence surfaced." compact />
                  <RepositoryDnaList title="Recommendations" items={dimension.recommendations} emptyText="No recommendation generated." compact />
                  {chapter && <Button type="button" variant="ghost" size="sm" onClick={() => onSelectChapter(chapter.id)} className="mt-2 px-0">Open related story</Button>}
                </details>
              );
            })}
          </div>
        )}

        {selectedTab === 'mental-model' && mentalModel && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Semantic relationships use the existing repository model; no second graph is created.</p>
            {mentalModel.nodes.map(item => {
              const chapter = chapterForMentalModelNode(story, item.id as WorkspaceStoryMentalNodeId);
              const connectionCount = mentalModel.connections.filter(connection => connection.from === item.id || connection.to === item.id).length;
              return (
                <button key={item.id} type="button" onClick={() => chapter && onSelectChapter(chapter.id)} className="block w-full rounded-xl border border-border/50 bg-background/20 p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="flex items-center justify-between gap-2 text-sm font-medium text-foreground"><span>{item.label}</span><Badge variant="outline" className={mentalModelStatusClass(item.status)}>{mentalModelStatusLabel(item.status)}</Badge></span>
                  <span className="mt-1 block text-xs text-muted-foreground">{item.description}</span>
                  <span className="mt-2 block text-[10px] uppercase tracking-wider text-muted-foreground">{connectionCount} semantic relationships</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}

function LegacyUniverseInspector({
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
      <aside className="rounded-[1.6rem] border border-primary/15 bg-[hsl(var(--universe-surface-raised)/0.82)] p-4 shadow-[0_24px_75px_hsl(var(--universe-stage-bg)/0.58)] backdrop-blur-xl motion-safe:animate-fade-in" aria-labelledby="universe-inspector-heading-collapsed">
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
    <aside className="rounded-[1.6rem] border border-primary/15 bg-[linear-gradient(155deg,hsl(var(--universe-surface-raised)/0.9),hsl(var(--universe-stage-bg)/0.76))] p-5 shadow-[0_24px_75px_hsl(var(--universe-stage-bg)/0.62),0_0_36px_hsl(var(--accent)/0.05)] backdrop-blur-xl motion-safe:animate-fade-in" aria-labelledby="universe-inspector-heading">
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
  onClose,
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
  onClose: () => void;
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
      <aside className="rounded-[1.6rem] border border-primary/15 bg-[hsl(var(--universe-surface-raised)/0.82)] p-4 shadow-[0_24px_75px_hsl(var(--universe-stage-bg)/0.58)] backdrop-blur-xl motion-safe:animate-fade-in" aria-labelledby="atlas-inspector-heading-collapsed">
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
    <aside className="rounded-[1.6rem] border border-primary/15 bg-[linear-gradient(155deg,hsl(var(--universe-surface-raised)/0.9),hsl(var(--universe-stage-bg)/0.76))] p-5 shadow-[0_24px_75px_hsl(var(--universe-stage-bg)/0.62),0_0_36px_hsl(var(--accent)/0.05)] backdrop-blur-xl motion-safe:animate-fade-in" aria-labelledby="atlas-inspector-heading">
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
        <Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label="Close inspector">Close</Button>
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

function optimizationPrFailure(error: unknown) {
  if (error instanceof OptimizationPrClientError) {
    return { message: error.issue.message, nextAction: error.issue.nextAction, progress: error.progress };
  }
  return { message: 'The GitHub PR request could not be completed.', nextAction: 'Refresh repository state, reconnect GitHub, or download the unchanged Optimization Package.' };
}

function optimizationBranchStateLabel(state: OptimizationPrPreviewResponse['plan']['branch']['existingState']) {
  if (state === 'available') return 'Available for reviewed branch creation';
  if (state === 'matching') return 'Existing branch matches reviewed content';
  if (state === 'partial') return 'Existing branch can resume safely';
  return 'Existing branch conflicts with reviewed content';
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

export function WorkspaceOverview({ report }: { report: ReadinessReport }) {
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

export function LiveAgentSimulator({ report, activeChapter }: { report: ReadinessReport; activeChapter?: WorkspaceStoryChapter | null }) {
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

export function RepositoryHealthActions({ repositoryHealth }: { repositoryHealth: RepositoryHealth }) {
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

export function RepositoryHealthDimensions({ repositoryHealth }: { repositoryHealth: RepositoryHealth }) {
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

export function MeasurementBoundary({ repositoryHealth }: { repositoryHealth: RepositoryHealth }) {
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

