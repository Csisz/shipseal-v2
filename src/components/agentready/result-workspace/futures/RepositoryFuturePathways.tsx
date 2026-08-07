import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bookmark,
  Box,
  Check,
  CircleDot,
  GitBranch,
  LockKeyhole,
  Network,
  Orbit,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import type { ReadinessReport } from '@/lib/types';
import type { RepositoryIntelligenceProviderStatus, RepositoryProductIntelligenceResult } from '@/lib/repositoryIntelligence';
import {
  buildRepositoryActionableImprovements,
  buildRepositoryAtlasModel,
  buildRepositoryOptimizationPlan,
  buildRepositoryTransformationProposalModel,
  buildWorkspaceStory,
} from '@/lib/workspace';
import {
  REPOSITORY_FUTURE_CAPABILITIES,
  DEFAULT_REPOSITORY_FUTURE_DEPENDENCY_DEFINITIONS,
  REPOSITORY_FUTURE_COMPATIBILITY_LABELS,
  REPOSITORY_FUTURE_FIT_LABELS,
  addRepositoryFutureSupportingGoal,
  adaptActionableImprovementCandidates,
  adaptProductOpportunityCandidates,
  adaptRepositoryHealthCandidates,
  adaptWorkspaceStoryCandidates,
  buildRepositoryFutureGraph,
  buildRepositoryFutureUniverseProjection,
  buildRepositoryFutureQuickPathModel,
  buildProductOpportunityCapabilityDefinitions,
  compareRepositoryFutureCandidates,
  inspectRepositoryFutureCandidateCompatibility,
  inspectRepositoryFutureDependencyImpact,
  removeRepositoryFutureSupportingGoal,
  replaceRepositoryFuturePrimary,
  productOpportunitySatisfiedCapabilityIds,
  synthesizeRepositoryFutureDraft,
  type RepositoryFutureCompatibilityState,
  type RepositoryFutureDraft,
  type RepositoryFutureFit,
  type RepositoryFutureGraph,
  type RepositoryFutureNormalizedCandidate,
  type RepositoryFutureOrigin,
  type RepositoryFutureSynthesisResult,
} from '@/lib/workspace/repositoryFutures';
import type { RepositoryUniverseModel } from '@/lib/workspace';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type {
  RepositoryFuturePathwaysMode,
  RepositoryFutureStageOverlay,
} from './futurePathwaysPresentation';
import { RepositoryFuturePathwaysStage } from './RepositoryFuturePathwaysStage';

interface RepositoryFuturePathwaysProps {
  report: ReadinessReport;
  universe: RepositoryUniverseModel;
  productIntelligence?: RepositoryProductIntelligenceResult | null;
  providerStatus?: RepositoryIntelligenceProviderStatus;
  prepareEnhancement?: () => Promise<void>;
  onStageOverlayChange: (overlay: RepositoryFutureStageOverlay | null) => void;
}

type RoleFilter = 'all' | 'selected' | 'saved' | 'available' | 'blocked';
type Focus = { kind: 'goal'; id: string } | { kind: 'dependency'; id: string } | null;

export default function RepositoryFuturePathways({ report, universe, productIntelligence, providerStatus, prepareEnhancement, onStageOverlayChange }: RepositoryFuturePathwaysProps) {
  const rootRef = useRef<HTMLElement | null>(null);
  const productRequestRef = useRef(false);
  const [mode, setMode] = useState<RepositoryFuturePathwaysMode>('quick');
  const [draft, setDraft] = useState<RepositoryFutureDraft>();
  const [focus, setFocus] = useState<Focus>(null);
  const [tracePreviewId, setTracePreviewId] = useState<string>();
  const [tracePinnedId, setTracePinnedId] = useState<string>();
  const [notice, setNotice] = useState('');
  const [replaceSupportGoalId, setReplaceSupportGoalId] = useState<string>();
  const [fitFilter, setFitFilter] = useState<'all' | RepositoryFutureFit>('all');
  const [originFilter, setOriginFilter] = useState<'all' | RepositoryFutureOrigin>('all');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const graph = useMemo(() => buildFutureGraph(report, universe, productIntelligence), [productIntelligence, report, universe]);
  const quickPath = useMemo(() => buildRepositoryFutureQuickPathModel(graph, draft), [draft, graph]);
  const goalById = useMemo(() => new Map(graph.nodes
    .filter(node => node.kind === 'future-goal' && node.candidateId)
    .map(node => [node.id, graph.candidates.find(candidate => candidate.id === node.candidateId)!])
    .filter((entry): entry is [string, RepositoryFutureNormalizedCandidate] => Boolean(entry[1]))), [graph]);
  const selectedGoalIds = useMemo(() => new Set(draft
    ? [draft.primaryGoal.goalId, ...draft.supportingGoals.map(goal => goal.goalId)]
    : []), [draft]);
  const savedGoalIds = useMemo(() => new Set(draft?.savedAlternatives.map(item => item.goalId) || []), [draft]);
  const focusedCandidate = focus?.kind === 'goal' ? goalById.get(focus.id) : undefined;
  const focusedDependency = focus?.kind === 'dependency' && draft
    ? inspectRepositoryFutureDependencyImpact(draft, focus.id)
    : undefined;
  const productIntelligenceState = productIntelligence?.opportunities.length
    ? 'enhanced' as const
    : providerStatus?.state === 'preparing'
      ? 'analysing' as const
      : providerStatus?.state === 'fallback' || providerStatus?.state === 'cancelled'
        ? 'deterministic-fallback' as const
        : 'unavailable' as const;

  useEffect(() => {
    productRequestRef.current = false;
  }, [report.repoName, report.scannedAt]);

  useEffect(() => {
    if (productIntelligence?.opportunities.length || !prepareEnhancement || productRequestRef.current) return;
    if (providerStatus && providerStatus.state !== 'deterministic') return;
    productRequestRef.current = true;
    void prepareEnhancement();
  }, [prepareEnhancement, productIntelligence, providerStatus]);

  useEffect(() => {
    setDraft(undefined);
    setFocus(null);
    setTracePreviewId(undefined);
    setTracePinnedId(undefined);
    setNotice('');
    setReplaceSupportGoalId(undefined);
  }, [graph.fingerprint]);

  const acceptResult = useCallback((result: RepositoryFutureSynthesisResult, successNotice: string) => {
    if (result.ok) {
      setDraft(result.draft);
      setNotice(successNotice);
      return true;
    }
    setNotice(('issues' in result ? result.issues[0]?.reason : undefined) || 'ShipSeal could not synthesize that selection from the current evidence.');
    return false;
  }, []);

  const choosePrimary = useCallback((goalId: string) => {
    if (!draft) {
      const accepted = acceptResult(synthesizeRepositoryFutureDraft(graph, {
        sourceGraphFingerprint: graph.fingerprint,
        primaryGoalIds: [goalId],
        supportingGoalIds: [],
      }), 'Primary future selected. Required dependencies were included automatically.');
      if (accepted) {
        setFocus({ kind: 'goal', id: goalId });
        setTracePinnedId(goalId);
      }
      return;
    }
    const operation = replaceRepositoryFuturePrimary(graph, draft, goalId);
    const accepted = acceptResult(operation.result, operation.removedGoalIds.length
      ? `Primary replaced. ${operation.removedGoalIds.length} incompatible supporting ${operation.removedGoalIds.length === 1 ? 'goal was' : 'goals were'} removed and remain available as alternatives.`
      : 'Primary replaced. Compatible supporting goals were preserved.');
    if (accepted) {
      setFocus({ kind: 'goal', id: goalId });
      setTracePinnedId(goalId);
    }
  }, [acceptResult, draft, graph]);

  const addSupport = useCallback((goalId: string) => {
    if (!draft) {
      setNotice('Choose one primary future before adding supporting goals.');
      return;
    }
    if (draft.supportingGoals.length >= 2) {
      setReplaceSupportGoalId(goalId);
      setNotice('Your Future Plan can include up to two supporting goals. Replace one to add this future.');
      return;
    }
    const accepted = acceptResult(addRepositoryFutureSupportingGoal(graph, draft, goalId), 'Supporting goal joined the path. Shared dependencies remain represented once.');
    if (accepted) {
      setFocus({ kind: 'goal', id: goalId });
      setTracePinnedId(goalId);
    }
  }, [acceptResult, draft, graph]);

  const removeSupport = useCallback((goalId: string) => {
    if (!draft) return;
    const accepted = acceptResult(removeRepositoryFutureSupportingGoal(graph, draft, goalId), 'Supporting goal removed. Dependencies were recomputed from the remaining path.');
    if (accepted && tracePinnedId === goalId) {
      setTracePinnedId(undefined);
      setTracePreviewId(undefined);
      setFocus(null);
    }
  }, [acceptResult, draft, graph, tracePinnedId]);

  const replaceSupport = useCallback((removedGoalId: string) => {
    if (!draft || !replaceSupportGoalId) return;
    const withoutSupport = removeRepositoryFutureSupportingGoal(graph, draft, removedGoalId);
    if (!withoutSupport.ok) {
      acceptResult(withoutSupport, '');
      return;
    }
    const replacement = addRepositoryFutureSupportingGoal(graph, withoutSupport.draft, replaceSupportGoalId);
    if (acceptResult(replacement, 'Supporting goal replaced. Dependencies and saved alternatives were recomputed.')) {
      setFocus({ kind: 'goal', id: replaceSupportGoalId });
      setReplaceSupportGoalId(undefined);
    }
  }, [acceptResult, draft, graph, replaceSupportGoalId]);

  const replaceSupportDirect = useCallback((addedGoalId: string, removedGoalId: string) => {
    if (!draft) return;
    const withoutSupport = removeRepositoryFutureSupportingGoal(graph, draft, removedGoalId);
    if (!withoutSupport.ok) {
      acceptResult(withoutSupport, '');
      return;
    }
    const replacement = addRepositoryFutureSupportingGoal(graph, withoutSupport.draft, addedGoalId);
    if (acceptResult(replacement, 'Supporting goal replaced. Required capabilities were recomputed.')) {
      setFocus({ kind: 'goal', id: addedGoalId });
      setTracePinnedId(addedGoalId);
      setReplaceSupportGoalId(undefined);
    }
  }, [acceptResult, draft, graph]);

  const compatibilityFor = useCallback((goalId: string): RepositoryFutureCompatibilityState => {
    if (!draft) return goalById.get(goalId)?.eligibility === 'eligible' ? 'compatible' : 'blocked';
    return inspectRepositoryFutureCandidateCompatibility(graph, {
      sourceGraphFingerprint: graph.fingerprint,
      primaryGoalIds: [draft.primaryGoal.goalId],
      supportingGoalIds: draft.supportingGoals.map(goal => goal.goalId),
    }, goalId).state;
  }, [draft, goalById, graph]);

  const stageCandidates = useMemo(() => {
    const capabilityTitles = new Map(DEFAULT_REPOSITORY_FUTURE_DEPENDENCY_DEFINITIONS.map(definition => [definition.id, definition.title]));
    const recommendedProductIds = quickPath.primaryRecommendations.candidates
      .filter(item => goalById.get(item.goalId)?.candidateClass === 'product-opportunity')
      .slice(0, 5)
      .map(item => item.goalId);
    const recommendedIds = recommendedProductIds.length
      ? recommendedProductIds
      : quickPath.primaryRecommendations.candidates.slice(0, 5).map(item => item.goalId);
    const primaryIsProduct = draft ? goalById.get(draft.primaryGoal.goalId)?.candidateClass === 'product-opportunity' : false;
    const compatibleIds = draft ? [...goalById.entries()]
      .filter(([goalId, candidate]) => !selectedGoalIds.has(goalId)
        && ['compatible', 'compatible-with-review'].includes(compatibilityFor(goalId))
        && (!primaryIsProduct || candidate.candidateClass === 'product-opportunity'))
      .sort(([, left], [, right]) => compareRepositoryFutureCandidates(left, right))
      .slice(0, 5)
      .map(([goalId]) => goalId) : [];
    const displayIds = draft
      ? [draft.primaryGoal.goalId, ...draft.supportingGoals.map(goal => goal.goalId), ...compatibleIds, ...draft.savedAlternatives.map(item => item.goalId).slice(0, 2)]
      : recommendedIds;
    return [...new Set(displayIds)].flatMap(goalId => {
      const candidate = goalById.get(goalId);
      if (!candidate) return [];
      const replaceableSupportGoalIds = draft && !selectedGoalIds.has(goalId) && draft.supportingGoals.length >= 2
        ? draft.supportingGoals.flatMap(support => {
          const withoutSupport = removeRepositoryFutureSupportingGoal(graph, draft, support.goalId);
          if (!withoutSupport.ok) return [];
          const replacementCompatibility = inspectRepositoryFutureCandidateCompatibility(graph, {
            sourceGraphFingerprint: graph.fingerprint,
            primaryGoalIds: [withoutSupport.draft.primaryGoal.goalId],
            supportingGoalIds: withoutSupport.draft.supportingGoals.map(goal => goal.goalId),
          }, goalId).state;
          return ['compatible', 'compatible-with-review'].includes(replacementCompatibility) ? [support.goalId] : [];
        })
        : [];
      const role = draft?.primaryGoal.goalId === goalId
        ? 'primary' as const
        : draft?.supportingGoals.some(goal => goal.goalId === goalId)
          ? 'supporting' as const
          : draft?.savedAlternatives.some(item => item.goalId === goalId)
            ? 'saved' as const
            : compatibilityFor(goalId) === 'blocked' || compatibilityFor(goalId) === 'incompatible'
              ? 'blocked' as const
              : 'candidate' as const;
      return [{
        goalId,
        title: candidate.title,
        fit: REPOSITORY_FUTURE_FIT_LABELS[candidate.fit],
        role,
        origin: candidateOriginLabel(candidate),
        capabilityId: candidate.targetCapabilityId,
        confidence: candidate.confidence,
        compatibility: compatibilityFor(goalId),
        humanReviewRequired: candidate.humanReviewState === 'required',
        evidenceCount: candidate.evidence.length,
        mappedEvidenceCount: candidate.universeMappings.length,
        universeNodeIds: candidate.universeMappings.map(mapping => mapping.universeNodeId),
        capabilityTitle: capabilityTitles.get(candidate.targetCapabilityId) || candidate.title,
        rationale: candidate.rationale,
        evidencePaths: candidate.evidence.map(evidence => evidence.path || evidence.id),
        artifactLabels: candidate.expectedArtifacts.map(artifact => artifact.targetPath || artifact.family),
        limitations: candidate.limitations,
        candidateClass: candidate.candidateClass,
        opportunityOrigin: candidate.productOpportunityOrigin,
        userValue: candidate.userValue,
        whyItFits: candidate.whyItFits,
        targetUsers: candidate.targetUsers,
        replaceableSupportGoalIds,
      }];
    });
  }, [compatibilityFor, draft, goalById, graph, quickPath.primaryRecommendations.candidates, selectedGoalIds]);
  const universeProjection = useMemo(() => draft
    ? buildRepositoryFutureUniverseProjection({ universe, graph, draft })
    : undefined, [draft, graph, universe]);

  const overlay = useMemo<RepositoryFutureStageOverlay>(() => ({
    active: true,
    mode,
    phase: draft ? 'synthesis' : focus || tracePreviewId || tracePinnedId ? 'choice' : 'possibility',
    graphFingerprint: graph.fingerprint,
    draftFingerprint: draft?.fingerprint,
    universeProjection,
    candidates: stageCandidates,
    dependencies: (draft?.dependencies || []).map(dependency => ({
      id: dependency.id,
      title: dependency.title,
      state: dependency.state,
      dependentCount: dependency.dependentGoalIds.length,
      dependentGoalIds: dependency.dependentGoalIds,
      executionOrder: dependency.executionOrder,
      humanReviewRequired: dependency.humanReviewState === 'required',
      rationale: dependency.rationale,
      evidencePaths: dependency.evidenceIds,
      limitations: dependency.limitations,
    })),
    artifactCount: draft?.artifacts.length || 0,
    gateCount: draft?.gates.length || 0,
    conflictCount: draft?.conflicts.length || 0,
    limited: graph.summary.limited,
    focusedId: focus?.id,
    activeTraceId: tracePreviewId || tracePinnedId,
    tracePinned: Boolean(tracePinnedId),
    supportCount: draft?.supportingGoals.length || 0,
    productIntelligenceState,
    onModeChange: setMode,
    onCandidateFocus: goalId => setFocus({ kind: 'goal', id: goalId }),
    onCandidateSelect: choosePrimary,
    onCandidateAddSupport: addSupport,
    onCandidateRemoveSupport: removeSupport,
    onCandidateReplaceSupport: replaceSupportDirect,
    onDependencyFocus: dependencyId => setFocus({ kind: 'dependency', id: dependencyId }),
    onTracePreview: setTracePreviewId,
    onTracePin: id => {
      setTracePinnedId(id);
      setFocus(stageCandidates.some(candidate => candidate.goalId === id)
        ? { kind: 'goal', id }
        : { kind: 'dependency', id });
    },
    onTraceClear: () => {
      setTracePreviewId(undefined);
      setTracePinnedId(undefined);
      setFocus(null);
    },
    onOpenDomControls: () => rootRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' }),
  }), [addSupport, choosePrimary, draft, focus, graph.fingerprint, graph.summary.limited, mode, productIntelligenceState, removeSupport, replaceSupportDirect, stageCandidates, tracePinnedId, tracePreviewId, universeProjection]);

  useEffect(() => onStageOverlayChange(overlay), [onStageOverlayChange, overlay]);
  useEffect(() => () => onStageOverlayChange(null), [onStageOverlayChange]);

  const deepCandidates = useMemo(() => [...goalById.entries()].filter(([goalId, candidate]) => {
    if (fitFilter !== 'all' && candidate.fit !== fitFilter) return false;
    if (originFilter !== 'all' && candidate.origin !== originFilter) return false;
    const compatibility = compatibilityFor(goalId);
    if (roleFilter === 'selected' && !selectedGoalIds.has(goalId)) return false;
    if (roleFilter === 'saved' && !savedGoalIds.has(goalId)) return false;
    if (roleFilter === 'available' && (selectedGoalIds.has(goalId) || !['compatible', 'compatible-with-review'].includes(compatibility))) return false;
    if (roleFilter === 'blocked' && !['blocked', 'incompatible'].includes(compatibility)) return false;
    return true;
  }), [compatibilityFor, fitFilter, goalById, originFilter, roleFilter, savedGoalIds, selectedGoalIds]);

  return (
    <section ref={rootRef} aria-labelledby="future-pathways-heading" className="scroll-mt-20 overflow-hidden rounded-[2rem] border border-primary/20 bg-[hsl(var(--universe-surface)/0.5)] shadow-[var(--shadow-md-semantic)]">
      <div className="border-b border-primary/15 bg-[radial-gradient(circle_at_15%_0%,hsl(var(--primary)/0.13),transparent_38%)] p-5 md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-[0.16em] text-primary">
              <Orbit className="h-4 w-4" aria-hidden="true" /> Future Pathways
            </div>
            <h2 id="future-pathways-heading" className="mt-2 font-display text-2xl font-semibold text-foreground md:text-3xl">Where should this product go next?</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">ShipSeal understood the product from bounded repository evidence and mapped its strongest user-facing next directions.</p>
          </div>
          <ModeToggle mode={mode} onChange={setMode} />
        </div>
        {graph.summary.limited && (
          <div role="status" className="mt-4 flex gap-2 rounded-2xl border border-warning/35 bg-warning/10 p-3 text-sm text-warning">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            Recommendations are limited by the available scan evidence. Exploratory and blocked paths are not presented as safe plans.
          </div>
        )}
      </div>

      <ProductUnderstandingDisclosure productIntelligence={productIntelligence} state={productIntelligenceState} />

      <RepositoryFuturePathwaysStage overlay={overlay} />

      <div className="grid gap-0">
        <div className="min-w-0 p-4 md:p-6">
          {mode === 'deep' && <PathComposer draft={draft} />}
          {notice && <div role="status" aria-live="polite" className="mt-3 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-foreground">{notice}</div>}

          {!draft && quickPath.primaryRecommendations.state === 'none' && (
            <div className="mt-5 rounded-2xl border border-border/60 bg-background/35 p-5">
              <h3 className="font-display text-lg font-semibold">No supported Future Path yet</h3>
              <p className="mt-2 text-sm text-muted-foreground">ShipSeal cannot form an eligible primary future from the current evidence. Improve scan coverage or resolve the blocking evidence conditions shown in Deep Configuration.</p>
            </div>
          )}

          {mode === 'quick' ? (
            <QuickPath
              draft={draft}
              replaceSupportGoalId={replaceSupportGoalId}
              onReplaceSupport={replaceSupport}
              onCancelReplace={() => setReplaceSupportGoalId(undefined)}
            />
          ) : (
            <DeepConfiguration
              candidates={deepCandidates}
              draft={draft}
              selectedGoalIds={selectedGoalIds}
              savedGoalIds={savedGoalIds}
              fitFilter={fitFilter}
              originFilter={originFilter}
              roleFilter={roleFilter}
              compatibilityFor={compatibilityFor}
              onFitFilter={setFitFilter}
              onOriginFilter={setOriginFilter}
              onRoleFilter={setRoleFilter}
              onFocus={goalId => setFocus({ kind: 'goal', id: goalId })}
              onChoosePrimary={choosePrimary}
              onAddSupport={addSupport}
              onRemoveSupport={removeSupport}
            />
          )}

          {draft && (
            <DraftDetails
              draft={draft}
              onDependencyFocus={id => setFocus({ kind: 'dependency', id })}
              onSavedFocus={id => setFocus({ kind: 'goal', id })}
              onSavedPrimary={choosePrimary}
              onSavedSupport={addSupport}
            />
          )}
        </div>
        {mode === 'deep' && (focusedCandidate || focusedDependency) && <FutureInspector
          graph={graph}
          draft={draft}
          focusedCandidate={focusedCandidate}
          focusedGoalId={focus?.kind === 'goal' ? focus.id : undefined}
          focusedDependency={focusedDependency}
          onChoosePrimary={choosePrimary}
          onAddSupport={addSupport}
        />}
      </div>
    </section>
  );
}

function buildFutureGraph(report: ReadinessReport, universe: RepositoryUniverseModel, productIntelligence?: RepositoryProductIntelligenceResult | null) {
  const atlas = buildRepositoryAtlasModel(report);
  const transformation = buildRepositoryTransformationProposalModel(report, universe, atlas);
  const plan = buildRepositoryOptimizationPlan({ report, universe, atlas, transformation });
  const improvements = buildRepositoryActionableImprovements({ transformation, plan });
  const sourceScanId = `scan:${report.repoName}:${report.scannedAt}`;
  const sourceScanFingerprint = sourceScanId;
  const repository = {
    repositoryId: report.source.sourceType === 'github-app'
      ? `github:${report.source.githubOwner}/${report.source.githubRepo}`
      : `upload:${report.repoName}`,
    sourceScanId,
    sourceScanFingerprint,
    limited: Boolean(report.scanEvidence.limitedScan || report.scanSummary.limited),
  };
  const context = { repository, universe };
  return buildRepositoryFutureGraph({
    repository,
    universe,
    candidateResults: [
      ...(productIntelligence?.opportunities.length ? [adaptProductOpportunityCandidates({ productIntelligence, context })] : []),
      adaptActionableImprovementCandidates(improvements, context),
      adaptRepositoryHealthCandidates(report.repositoryHealth, context),
      adaptWorkspaceStoryCandidates(buildWorkspaceStory(report), context),
    ],
    capabilityDefinitions: [
      ...DEFAULT_REPOSITORY_FUTURE_DEPENDENCY_DEFINITIONS,
      ...(productIntelligence ? buildProductOpportunityCapabilityDefinitions(productIntelligence) : []),
    ],
    satisfiedCapabilityIds: [
      REPOSITORY_FUTURE_CAPABILITIES.repositoryEvidence,
      ...(productIntelligence ? productOpportunitySatisfiedCapabilityIds(productIntelligence) : []),
    ],
  });
}

function ProductUnderstandingDisclosure({ productIntelligence, state }: {
  productIntelligence?: RepositoryProductIntelligenceResult | null;
  state: RepositoryFutureStageOverlay['productIntelligenceState'];
}) {
  const understanding = productIntelligence?.understanding;
  return (
    <details className="border-b border-primary/15 bg-background/30 px-5 py-3 md:px-7">
      <summary className="cursor-pointer list-none text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="flex flex-wrap items-center justify-between gap-2">
          <span>What ShipSeal understood</span>
          <span className="text-xs font-normal text-muted-foreground">
            {state === 'analysing' ? 'Analysing product opportunities'
              : state === 'enhanced' ? 'Product opportunities enhanced'
                : state === 'deterministic-fallback' ? 'Based on repository evidence only'
                  : 'Strategic Product Intelligence unavailable'}
          </span>
        </span>
      </summary>
      {understanding ? (
        <div className="mt-3 grid gap-3 text-sm md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="rounded-xl border border-border/50 bg-background/35 p-3">
            <div className="text-xs font-mono uppercase tracking-wide text-primary">Product</div>
            <p className="mt-1 text-foreground">{understanding.productSummary.statement}</p>
            <p className="mt-2 text-xs text-muted-foreground">Primary problem: {understanding.primaryProblem.statement}</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-background/35 p-3">
            <div className="text-xs font-mono uppercase tracking-wide text-primary">Current loop</div>
            <p className="mt-1 text-muted-foreground">{understanding.currentProductLoop.map(item => item.statement).join(' → ') || 'Current loop remains incomplete.'}</p>
          </div>
          <p className="text-xs text-muted-foreground md:col-span-2">Observed statements cite repository evidence. Inferred statements are hypotheses for review. {understanding.evidenceIds.length} evidence references · {understanding.confidence} bounded confidence.</p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">Repository improvement opportunities remain available, but ShipSeal is not presenting them as equivalent to strategic user-facing Product Opportunities.</p>
      )}
    </details>
  );
}

function ModeToggle({ mode, onChange }: { mode: RepositoryFuturePathwaysMode; onChange: (mode: RepositoryFuturePathwaysMode) => void }) {
  return (
    <div role="group" aria-label="Future Pathways mode" className="inline-flex min-h-11 rounded-xl border border-border/60 bg-background/50 p-1">
      {(['quick', 'deep'] as const).map(value => (
        <button key={value} type="button" aria-pressed={mode === value} onClick={() => onChange(value)} className={`min-h-9 rounded-lg px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${mode === value ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
          {value === 'quick' ? 'Quick Path' : 'Deep Configuration'}
        </button>
      ))}
    </div>
  );
}

function PathComposer({ draft }: { draft?: RepositoryFutureDraft }) {
  return (
    <div aria-label="Future Path composer" className="rounded-2xl border border-primary/15 bg-background/35 p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <ComposerStep label="Primary" value={draft?.primaryGoal.title || 'Choose one'} active={Boolean(draft)} />
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        <ComposerStep label="Supporting" value={draft ? `${draft.supportingGoals.length} of 2` : '0 of 2'} active={Boolean(draft?.supportingGoals.length)} />
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        <ComposerStep label="Required" value={draft ? `${draft.dependencies.length} automatic` : 'After selection'} active={Boolean(draft)} />
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        <ComposerStep label="One future" value={draft ? (draft.preparationReadiness === 'ready' ? 'Synthesized' : 'Review required') : 'Not selected'} active={Boolean(draft)} />
      </div>
    </div>
  );
}

function ComposerStep({ label, value, active }: { label: string; value: string; active: boolean }) {
  return <span className={`rounded-lg border px-2.5 py-1.5 ${active ? 'border-primary/35 bg-primary/10 text-foreground' : 'border-border/50 text-muted-foreground'}`}><span className="font-mono uppercase tracking-wide">{label}</span><span className="ml-1.5 font-medium">{value}</span></span>;
}

function QuickPath({ draft, replaceSupportGoalId, onReplaceSupport, onCancelReplace }: {
  draft?: RepositoryFutureDraft;
  replaceSupportGoalId?: string;
  onReplaceSupport: (goalId: string) => void;
  onCancelReplace: () => void;
}) {
  return (
    <div className="mt-5 space-y-4">
      <div role="status" className="rounded-2xl border border-primary/15 bg-primary/5 p-4 text-sm text-muted-foreground">
        {draft
          ? 'The Future Draft is composed directly on the canvas above. Open details below only when you need dependency, trade-off, or provenance depth.'
          : 'Select one product direction directly on the composer above.'}
      </div>
      {draft && replaceSupportGoalId && (
            <section role="dialog" aria-labelledby="replace-support-heading" className="rounded-2xl border border-warning/35 bg-warning/10 p-4">
              <h3 id="replace-support-heading" className="font-semibold">Replace one supporting goal</h3>
              <p className="mt-1 text-sm text-muted-foreground">Your Future Plan can include up to two supporting goals. Choose which selected support to replace; nothing is removed silently.</p>
              <div className="mt-3 flex flex-wrap gap-2">{draft.supportingGoals.map(goal => <Button key={goal.goalId} type="button" variant="outline" className="min-h-11" onClick={() => onReplaceSupport(goal.goalId)}>Replace {goal.title}</Button>)}<Button type="button" variant="ghost" className="min-h-11" onClick={onCancelReplace}>Cancel</Button></div>
            </section>
      )}
    </div>
  );
}

function DeepConfiguration({ candidates, draft, selectedGoalIds, savedGoalIds, fitFilter, originFilter, roleFilter, compatibilityFor, onFitFilter, onOriginFilter, onRoleFilter, onFocus, onChoosePrimary, onAddSupport, onRemoveSupport }: {
  candidates: Array<[string, RepositoryFutureNormalizedCandidate]>;
  draft?: RepositoryFutureDraft;
  selectedGoalIds: Set<string>;
  savedGoalIds: Set<string>;
  fitFilter: 'all' | RepositoryFutureFit;
  originFilter: 'all' | RepositoryFutureOrigin;
  roleFilter: RoleFilter;
  compatibilityFor: (goalId: string) => RepositoryFutureCompatibilityState;
  onFitFilter: (value: 'all' | RepositoryFutureFit) => void;
  onOriginFilter: (value: 'all' | RepositoryFutureOrigin) => void;
  onRoleFilter: (value: RoleFilter) => void;
  onFocus: (goalId: string) => void;
  onChoosePrimary: (goalId: string) => void;
  onAddSupport: (goalId: string) => void;
  onRemoveSupport: (goalId: string) => void;
}) {
  return (
    <section aria-labelledby="deep-configuration-heading" className="mt-5">
      <h3 id="deep-configuration-heading" className="font-display text-lg font-semibold">Deep Configuration</h3>
      <p className="mt-1 text-sm text-muted-foreground">The same draft, with truthful candidate, fit, origin, compatibility and role controls.</p>
      <div className="mt-4 grid gap-3 rounded-2xl border border-border/55 bg-background/30 p-3 sm:grid-cols-3">
        <Filter label="Fit" value={fitFilter} onChange={value => onFitFilter(value as 'all' | RepositoryFutureFit)} options={[['all', 'All fits'], ['strong-evidence-fit', 'Strong evidence fit'], ['supported-with-review', 'Supported with review'], ['exploratory', 'Exploratory'], ['blocked', 'Blocked']]} />
        <Filter label="Origin" value={originFilter} onChange={value => onOriginFilter(value as 'all' | RepositoryFutureOrigin)} options={[['all', 'All origins'], ['deterministic', 'Deterministic'], ['deep-intelligence', 'Validated bounded inference'], ['verified-signal', 'Verified signal']]} />
        <Filter label="Plan role" value={roleFilter} onChange={value => onRoleFilter(value as RoleFilter)} options={[['all', 'All roles'], ['selected', 'Selected'], ['saved', 'Saved for later'], ['available', 'Compatible'], ['blocked', 'Blocked or incompatible']]} />
      </div>
      <div className="mt-4 space-y-2" role="list" aria-label="Future candidates">
        {candidates.map(([goalId, candidate]) => {
          const compatibility = compatibilityFor(goalId);
          const selected = selectedGoalIds.has(goalId);
          const primary = draft?.primaryGoal.goalId === goalId;
          const support = draft?.supportingGoals.some(goal => goal.goalId === goalId);
          const blocked = compatibility === 'blocked' || compatibility === 'incompatible';
          return (
            <article key={goalId} role="listitem" className={`rounded-2xl border p-3 ${primary ? 'border-primary/45 bg-primary/10' : support ? 'border-accent/40 bg-accent/10' : blocked ? 'border-warning/30 bg-warning/5' : 'border-border/55 bg-background/30'}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button type="button" onClick={() => onFocus(goalId)} className="min-h-11 min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="flex flex-wrap items-center gap-2"><span className="font-semibold">{candidate.title}</span>{primary && <Badge>Primary</Badge>}{support && <Badge variant="secondary">Supporting</Badge>}{savedGoalIds.has(goalId) && !selected && <Badge variant="outline"><Bookmark className="mr-1 h-3 w-3" aria-hidden="true" />Saved</Badge>}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{REPOSITORY_FUTURE_FIT_LABELS[candidate.fit]} · {candidateOriginLabel(candidate)} · {REPOSITORY_FUTURE_COMPATIBILITY_LABELS[compatibility]}{candidate.humanReviewState === 'required' ? ' · Review required' : ''}</span>
                </button>
                <div className="flex flex-wrap gap-2">
                  {!primary && <Button type="button" size="sm" variant="outline" className="min-h-11" disabled={blocked} onClick={() => onChoosePrimary(goalId)}>Make primary</Button>}
                  {support ? <Button type="button" size="sm" variant="ghost" className="min-h-11" onClick={() => onRemoveSupport(goalId)}>Remove support</Button> : draft && !primary && <Button type="button" size="sm" className="min-h-11" disabled={blocked} onClick={() => onAddSupport(goalId)}>Use as support</Button>}
                </div>
              </div>
              {blocked && <p className="mt-2 flex items-center gap-2 text-xs text-warning"><LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />This branch remains inspectable but cannot join the current path: {REPOSITORY_FUTURE_COMPATIBILITY_LABELS[compatibility]}.</p>}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function Filter({ label, value, options, onChange }: { label: string; value: string; options: Array<[string, string]>; onChange: (value: string) => void }) {
  return <label className="text-xs font-medium text-muted-foreground">{label}<select value={value} onChange={event => onChange(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></label>;
}

function DraftDetails({ draft, onDependencyFocus, onSavedFocus, onSavedPrimary, onSavedSupport }: { draft: RepositoryFutureDraft; onDependencyFocus: (id: string) => void; onSavedFocus: (id: string) => void; onSavedPrimary: (id: string) => void; onSavedSupport: (id: string) => void }) {
  return (
    <div className="mt-6 space-y-3">
      <details className="rounded-2xl border border-border/55 bg-background/25 p-4">
        <summary className="cursor-pointer font-semibold">Required dependency path · {draft.dependencies.length}</summary>
        <p className="mt-2 text-xs text-muted-foreground">Prerequisite-first and automatic. Dependencies cannot be toggled off independently.</p>
        <ol className="mt-3 space-y-2">{draft.dependencies.map((dependency, index) => <li key={dependency.id}><button type="button" onClick={() => onDependencyFocus(dependency.id)} className="flex min-h-11 w-full items-center gap-3 rounded-xl border border-border/50 bg-background/35 px-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-primary/35 font-mono text-xs">{index + 1}</span><span className="min-w-0 flex-1"><span className="block font-medium">{dependency.title}</span><span className="block text-xs text-muted-foreground">{dependency.state} · required by {dependency.dependentGoalIds.length} {dependency.dependentGoalIds.length === 1 ? 'goal' : 'goals'}</span></span><LockKeyhole className="h-4 w-4 text-muted-foreground" aria-label="Automatically required" /></button></li>)}</ol>
      </details>
      <details className="rounded-2xl border border-border/55 bg-background/25 p-4"><summary className="cursor-pointer font-semibold">Prospective artifacts and gates · {draft.artifacts.length + draft.gates.length}</summary><div className="mt-3 grid gap-2 sm:grid-cols-2">{draft.artifacts.map(artifact => <div key={artifact.id} className="rounded-xl border border-border/45 p-3 text-sm"><Box className="mb-2 h-4 w-4 text-primary" aria-hidden="true" /><span className="font-medium">Prospective artifact</span><span className="mt-1 block text-muted-foreground">{artifact.title}</span></div>)}{draft.gates.map(gate => <div key={gate.id} className="rounded-xl border border-warning/30 p-3 text-sm"><ShieldCheck className="mb-2 h-4 w-4 text-warning" aria-hidden="true" /><span className="font-medium">Gate</span><span className="mt-1 block text-muted-foreground">{gate.title}</span></div>)}</div><p className="mt-3 text-xs text-muted-foreground">These are metadata previews only. No files or prepared artifacts have been generated.</p></details>
      <details className="rounded-2xl border border-border/55 bg-background/25 p-4"><summary className="cursor-pointer font-semibold">Saved for later · {draft.savedAlternatives.length}</summary><div className="mt-3 space-y-2">{draft.savedAlternatives.slice(0, 12).map(saved => <div key={saved.goalId} className="rounded-xl border border-dashed border-border/60 bg-background/25 p-3"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><button type="button" className="min-h-11 text-left font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => onSavedFocus(saved.goalId)}>{saved.title}<span className="block text-xs font-normal text-muted-foreground">{REPOSITORY_FUTURE_COMPATIBILITY_LABELS[saved.compatibility]} · not selected · not prepared</span></button><div className="flex gap-2"><Button type="button" size="sm" variant="outline" className="min-h-11" onClick={() => onSavedPrimary(saved.goalId)}>Make primary</Button><Button type="button" size="sm" variant="ghost" className="min-h-11" disabled={!['compatible', 'compatible-with-review'].includes(saved.compatibility)} onClick={() => onSavedSupport(saved.goalId)}>Use as support</Button></div></div></div>)}</div></details>
      <details className="rounded-2xl border border-border/55 bg-background/25 p-4"><summary className="cursor-pointer font-semibold">Trade-offs, review and conflicts</summary><div className="mt-3 grid gap-2 sm:grid-cols-2">{draft.tradeOffs.map(tradeOff => <div key={`${tradeOff.category}:${tradeOff.value}`} className="rounded-xl border border-border/45 p-3 text-sm"><span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">{humanize(tradeOff.category)}</span><span className="mt-1 block font-medium">{humanize(tradeOff.value)}</span><span className="mt-1 block text-xs text-muted-foreground">{tradeOff.rationale}</span></div>)}</div>{draft.conflicts.length > 0 && <div className="mt-3 space-y-2">{draft.conflicts.map(conflict => <div key={conflict.id} className="rounded-xl border border-warning/30 bg-warning/5 p-3 text-sm"><span className="font-medium">{humanize(conflict.kind)} · {conflict.severity}</span><p className="mt-1 text-muted-foreground">{conflict.rationale}</p></div>)}</div>}</details>
      <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4"><div className="flex items-start gap-3"><Sparkles className="mt-0.5 h-5 w-5 text-primary" aria-hidden="true" /><div><div className="font-semibold">Future Draft crystallized</div><p className="mt-1 text-sm text-muted-foreground">This means the selected structure is stable and synthesized. It is not prepared, persisted or applied.</p><div className="mt-2 font-mono text-[10px] text-muted-foreground">Draft {draft.fingerprint.slice(0, 16)}</div></div></div></div>
    </div>
  );
}

function FutureInspector({ graph, draft, focusedCandidate, focusedGoalId, focusedDependency, onChoosePrimary, onAddSupport }: { graph: RepositoryFutureGraph; draft?: RepositoryFutureDraft; focusedCandidate?: RepositoryFutureNormalizedCandidate; focusedGoalId?: string; focusedDependency?: ReturnType<typeof inspectRepositoryFutureDependencyImpact>; onChoosePrimary: (id: string) => void; onAddSupport: (id: string) => void }) {
  return (
    <aside aria-label="Future Pathways inspector" className="border-t border-border/55 bg-background/30 p-4 lg:border-l lg:border-t-0 lg:p-5">
      <div className="sticky top-20">
        <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wide text-muted-foreground"><Network className="h-4 w-4" aria-hidden="true" />Contextual inspector</div>
        {focusedDependency ? (
          <div className="mt-4"><Badge variant="outline">Required dependency · {focusedDependency.state}</Badge><h3 className="mt-3 font-display text-lg font-semibold">{draft?.dependencies.find(item => item.id === focusedDependency.dependencyId)?.title}</h3><p className="mt-2 text-sm text-muted-foreground">{draft?.dependencies.find(item => item.id === focusedDependency.dependencyId)?.rationale}</p><dl className="mt-4 space-y-3 text-sm"><InspectorRow label="Required by" value={`${focusedDependency.directDependentGoalIds.length} direct, ${draft?.dependencies.find(item => item.id === focusedDependency.dependencyId)?.dependentGoalIds.length || 0} total`} /><InspectorRow label="Primary requires it" value={focusedDependency.requiredByPrimary ? 'Yes' : 'No'} /><InspectorRow label="Review" value={focusedDependency.humanReviewState === 'required' ? 'Human review required' : 'No special review gate'} /><InspectorRow label="Removal" value={focusedDependency.removableByRemovingSupportingGoals ? 'Only by removing its supporting goal' : 'Cannot be removed independently'} /></dl><details className="mt-4 rounded-xl border border-border/50 p-3"><summary className="cursor-pointer text-sm font-medium">Causal chains and evidence</summary><ul className="mt-2 space-y-1 text-xs text-muted-foreground">{focusedDependency.causeChains.map(chain => <li key={chain.join(':')}>{chain.join(' → ')}</li>)}</ul><p className="mt-2 text-xs text-muted-foreground">{focusedDependency.evidenceIds.length} evidence references</p></details></div>
        ) : focusedCandidate && focusedGoalId ? (
          <div className="mt-4"><Badge variant="outline">Future goal · {REPOSITORY_FUTURE_FIT_LABELS[focusedCandidate.fit]}</Badge><h3 className="mt-3 font-display text-lg font-semibold">{focusedCandidate.title}</h3><p className="mt-2 text-sm text-muted-foreground">{focusedCandidate.whyItFits || focusedCandidate.rationale}</p><dl className="mt-4 space-y-3 text-sm"><InspectorRow label="Role" value={draft?.primaryGoal.goalId === focusedGoalId ? 'Primary path' : draft?.supportingGoals.some(goal => goal.goalId === focusedGoalId) ? 'Supporting goal' : draft?.savedAlternatives.some(item => item.goalId === focusedGoalId) ? 'Saved for later' : 'Candidate future'} /><InspectorRow label="Origin" value={candidateOriginLabel(focusedCandidate)} /><InspectorRow label="Evidence" value={`${focusedCandidate.evidence.length} references · ${focusedCandidate.universeMappings.length} Universe mappings`} /><InspectorRow label="Review" value={focusedCandidate.humanReviewState === 'required' ? 'Required' : 'Not required'} /></dl><div className="mt-4 flex flex-wrap gap-2">{draft?.primaryGoal.goalId !== focusedGoalId && <Button type="button" size="sm" className="min-h-11" onClick={() => onChoosePrimary(focusedGoalId)}>Make primary</Button>}{draft && draft.primaryGoal.goalId !== focusedGoalId && !draft.supportingGoals.some(goal => goal.goalId === focusedGoalId) && <Button type="button" size="sm" variant="outline" className="min-h-11" onClick={() => onAddSupport(focusedGoalId)}>Use as support</Button>}</div><details className="mt-4 rounded-xl border border-border/50 p-3"><summary className="cursor-pointer text-sm font-medium">Evidence, artifacts and limitations</summary><div className="mt-3 space-y-3 text-xs text-muted-foreground"><div><div className="font-medium text-foreground">Evidence paths</div>{focusedCandidate.evidence.map(item => <div key={item.id} className="mt-1 break-all">{item.path || item.id} · {item.state} · {item.confidence}</div>)}</div><div><div className="font-medium text-foreground">Prospective outputs</div>{focusedCandidate.expectedArtifacts.map(item => <div key={item.id} className="mt-1">{item.targetPath || item.family} · {item.supported ? 'supported metadata' : 'unsupported'}</div>)}</div>{focusedCandidate.limitations.length > 0 && <div><div className="font-medium text-foreground">Limitations</div>{focusedCandidate.limitations.map(item => <div key={item} className="mt-1">{item}</div>)}</div>}<div className="break-all font-mono text-[10px]">{focusedCandidate.id}</div></div></details></div>
        ) : (
          <div className="mt-4"><CircleDot className="h-6 w-6 text-primary" aria-hidden="true" /><h3 className="mt-3 font-display text-lg font-semibold">Inspect a possible future</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Focus a goal or dependency to see why it fits, its role, evidence, causal requirements and review boundary.</p><div className="mt-4 rounded-xl border border-border/45 p-3 text-xs text-muted-foreground"><div className="flex items-center gap-2"><Check className="h-3.5 w-3.5" aria-hidden="true" />Solid = deterministic support</div><div className="mt-2 flex items-center gap-2"><GitBranch className="h-3.5 w-3.5" aria-hidden="true" />Dashed = bounded inference or saved branch</div><div className="mt-2 flex items-center gap-2"><LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />Diamond/gate = required condition</div><div className="mt-2 flex items-center gap-2"><AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />Broken route = conflict or blocker</div></div><p className="mt-4 text-xs text-muted-foreground">{graph.summary.eligibleCandidates} eligible · {graph.summary.exploratoryCandidates} exploratory · {graph.summary.blockingConflicts} blocking conflicts</p></div>
        )}
      </div>
    </aside>
  );
}

function InspectorRow({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-mono uppercase tracking-wide text-muted-foreground">{label}</dt><dd className="mt-0.5 text-foreground">{value}</dd></div>;
}

function originLabel(origin: RepositoryFutureOrigin) {
  if (origin === 'deep-intelligence') return 'Validated bounded inference';
  if (origin === 'verified-signal') return 'Verified opportunity signal';
  return 'Deterministic evidence';
}

function candidateOriginLabel(candidate: RepositoryFutureNormalizedCandidate) {
  if (candidate.productOpportunityOrigin === 'evidence-backed') return 'Evidence-backed Product Opportunity';
  if (candidate.productOpportunityOrigin === 'strategic') return 'Strategic Product Opportunity';
  if (candidate.productOpportunityOrigin === 'exploratory') return 'Exploratory Product Opportunity';
  return originLabel(candidate.origin);
}

function humanize(value: string) {
  return value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/-/g, ' ').replace(/^./, character => character.toUpperCase());
}
