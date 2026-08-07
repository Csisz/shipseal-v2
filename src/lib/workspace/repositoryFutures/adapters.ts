import type { RepositoryHealthModel } from '../../repositoryHealth/types.js';
import type { RepositoryEvidence } from '../../repositoryIntelligence/evidence.js';
import type { RepositoryDeepIntelligenceValidatedFinding } from '../../repositoryIntelligence/deepIntelligenceSchema.js';
import type { RepositoryProductIntelligenceResult } from '../../repositoryIntelligence/productIntelligenceSchema.js';
import type { VerifiedOpportunitySignal } from '../repositoryVerificationRelationship.js';
import type { RepositoryActionableImprovement } from '../repositoryActionableImprovement.js';
import type { RepositoryUniverseModel } from '../repositoryUniverse.js';
import type { WorkspaceStory } from '../workspaceStory.js';
import {
  DEFAULT_REPOSITORY_FUTURE_DEPENDENCY_DEFINITIONS,
  REPOSITORY_FUTURE_CAPABILITIES,
  repositoryFutureArtifactFamilyForPath,
  repositoryFutureCapabilityForDomain,
  resolveKnownRepositoryFutureCapability,
} from './capabilities.js';
import {
  confidenceFromNumber,
  confidenceRank,
  lowerConfidence,
  normalizeEvidenceReferences,
  normalizeRepositoryFuturePath,
  normalizeUniverseMappings,
  repositoryFutureFingerprint,
  repositoryFutureId,
  sensitiveFutureContent,
  sortedUnique,
} from './identity.js';
import type {
  RepositoryFutureCandidateAdapterResult,
  RepositoryFutureCandidateDependencyHint,
  RepositoryFutureConfidence,
  RepositoryFutureEligibility,
  RepositoryFutureEvidenceReference,
  RepositoryFutureExpectedArtifact,
  RepositoryFutureFit,
  RepositoryFutureHumanReviewState,
  RepositoryFutureNormalizedCandidate,
  RepositoryFutureOrigin,
  RepositoryFutureRepositoryBinding,
  RepositoryFutureUniverseMapping,
  RepositoryFutureDependencyDefinition,
} from './schema.js';

export interface RepositoryFutureAdapterContext {
  repository: RepositoryFutureRepositoryBinding;
  universe: RepositoryUniverseModel;
}

interface CandidateDraft {
  sourceId: string;
  sourceContractVersion: string;
  title: string;
  rationale: string;
  origin: RepositoryFutureOrigin;
  targetCapabilityId: string;
  evidence: RepositoryFutureEvidenceReference[];
  dependencies?: RepositoryFutureCandidateDependencyHint[];
  expectedArtifacts?: RepositoryFutureExpectedArtifact[];
  confidence: RepositoryFutureConfidence;
  humanReviewState?: RepositoryFutureHumanReviewState;
  limitations?: string[];
  unavailableInformation?: string[];
  compatibilityHints?: string[];
  incompatibleCandidateIds?: string[];
  universeMappings?: RepositoryFutureUniverseMapping[];
  verificationMethod?: string;
  alignment: RepositoryFutureNormalizedCandidate['alignment'];
  eligibility?: RepositoryFutureEligibility;
  candidateClass?: RepositoryFutureNormalizedCandidate['candidateClass'];
  productOpportunityOrigin?: RepositoryFutureNormalizedCandidate['productOpportunityOrigin'];
  userValue?: string;
  whyItFits?: string;
  targetUsers?: string[];
  strategicRationale?: string;
  changeWeight?: RepositoryFutureNormalizedCandidate['changeWeight'];
  impactBreadth?: RepositoryFutureNormalizedCandidate['impactBreadth'];
  productUnderstandingFingerprint?: string;
}

export function adaptProductOpportunityCandidates(input: {
  productIntelligence: RepositoryProductIntelligenceResult;
  context: RepositoryFutureAdapterContext;
}): RepositoryFutureCandidateAdapterResult {
  const evidenceById = new Map(input.productIntelligence.evidenceReferences.map(item => [item.id, item]));
  const candidates = input.productIntelligence.opportunities.map(opportunity => {
    const evidence = opportunity.evidenceIds.flatMap(id => {
      const source = evidenceById.get(id);
      if (!source) return [];
      return [evidenceReference({
        id: source.id,
        path: source.path,
        confidence: opportunity.acceptedConfidence,
        state: 'provider-suggestion',
        origin: 'deep-intelligence',
        contractVersion: opportunity.version,
        limitation: opportunity.origin === 'evidence-backed'
          ? 'The opportunity is grounded in current evidence but remains a proposed product extension.'
          : 'The repository evidence supports product fit, not current implementation of the proposed capability.',
        humanReviewRequired: opportunity.humanReviewRequirements.length > 0,
        context: input.context,
      })];
    });
    const dependencies: RepositoryFutureCandidateDependencyHint[] = [
      repositoryEvidenceDependency(evidence, 'deep-intelligence'),
      ...opportunity.requiredNewCapabilities.map(capability => ({
        capabilityId: capability.id,
        requirement: 'required' as const,
        origin: 'deep-intelligence' as const,
        rationale: capability.rationale,
        evidenceIds: [...opportunity.evidenceIds],
        confidence: opportunity.acceptedConfidence,
        state: capability.satisfiedByExistingCapabilityId ? 'satisfied' as const : 'missing' as const,
        humanReviewState: opportunity.humanReviewRequirements.length ? 'required' as const : 'not-required' as const,
        limitations: capability.satisfiedByExistingCapabilityId
          ? ['Satisfied only by the validated existing Product Understanding capability binding.']
          : ['Proposed capability; it is not current repository truth.'],
      })),
    ];
    const mappedPaths = new Set(opportunity.expectedImplementationAreas.flatMap(area => area.existingPath ? [area.existingPath] : []));
    const mappings = input.context.universe.nodes.flatMap(node => node.path && mappedPaths.has(normalizeRepositoryFuturePath(node.path))
      ? [{ universeNodeId: node.id, repositoryRelativePath: normalizeRepositoryFuturePath(node.path) }]
      : []);
    return normalizeCandidate({
      sourceId: opportunity.id,
      sourceContractVersion: opportunity.version,
      title: opportunity.title,
      rationale: opportunity.whyItFits,
      origin: 'deep-intelligence',
      targetCapabilityId: `product-outcome:${opportunity.id}`,
      evidence,
      dependencies,
      expectedArtifacts: [],
      confidence: opportunity.acceptedConfidence,
      humanReviewState: opportunity.humanReviewRequirements.length || input.productIntelligence.understanding?.humanReviewState === 'required' ? 'required' : 'not-required',
      limitations: [
        ...opportunity.limitations,
        `${opportunity.origin === 'evidence-backed' ? 'Evidence-backed' : opportunity.origin === 'strategic' ? 'Strategic' : 'Exploratory'} Product Opportunity; proposed, not current, applied, or verified.`,
      ],
      unavailableInformation: opportunity.expectedImplementationAreas.some(area => !area.existingPath)
        ? ['One or more implementation areas are conceptual because deterministic repository paths are unavailable.']
        : [],
      compatibilityHints: opportunity.optionalSupportingOpportunityIds,
      universeMappings: mappings,
      verificationMethod: opportunity.verificationConcept,
      alignment: 'product-opportunity',
      eligibility: opportunity.origin === 'exploratory' ? 'exploratory' : undefined,
      candidateClass: 'product-opportunity',
      productOpportunityOrigin: opportunity.origin,
      userValue: opportunity.userValue,
      whyItFits: opportunity.whyItFits,
      targetUsers: opportunity.targetUsers,
      strategicRationale: opportunity.strategicRationale,
      changeWeight: opportunity.changeWeight,
      impactBreadth: opportunity.impactBreadth,
      productUnderstandingFingerprint: input.productIntelligence.understanding?.fingerprint,
    }, input.context);
  });
  return adapterResult(candidates);
}

export function buildProductOpportunityCapabilityDefinitions(productIntelligence: RepositoryProductIntelligenceResult): RepositoryFutureDependencyDefinition[] {
  return [...new Map(productIntelligence.opportunities.flatMap(opportunity => opportunity.requiredNewCapabilities.map(capability => [capability.id, {
    id: capability.id,
    title: capability.title,
    rationale: capability.rationale,
    requires: [REPOSITORY_FUTURE_CAPABILITIES.repositoryEvidence] as string[],
  }] as const))).values()].sort((left, right) => left.id.localeCompare(right.id));
}

export function productOpportunitySatisfiedCapabilityIds(productIntelligence: RepositoryProductIntelligenceResult) {
  return sortedUnique(productIntelligence.opportunities.flatMap(opportunity => opportunity.requiredNewCapabilities
    .filter(capability => Boolean(capability.satisfiedByExistingCapabilityId))
    .map(capability => capability.id)));
}

export function adaptActionableImprovementCandidates(
  improvements: readonly RepositoryActionableImprovement[],
  context: RepositoryFutureAdapterContext,
): RepositoryFutureCandidateAdapterResult {
  const candidates = improvements.map(improvement => {
    const mappedNodes = improvement.affectedEntities
      .map(id => context.universe.nodes.find(node => node.id === id))
      .filter((node): node is RepositoryUniverseModel['nodes'][number] => Boolean(node));
    const evidence = improvement.evidence.map((item, index) => evidenceReference({
      id: repositoryFutureId('future-evidence', {
        source: improvement.id,
        index,
        summary: item.summary,
        detail: item.detail,
        entityId: item.entityId,
        relationshipId: item.relationshipId,
      }),
      path: item.entityId ? context.universe.nodes.find(node => node.id === item.entityId)?.path : undefined,
      confidence: confidenceFromNumber(item.confidence),
      state: item.kind === 'evidence-backed' ? 'observed-current' : 'deterministic-inference',
      origin: 'deterministic',
      context,
    }));
    const artifacts = improvement.artifacts.map(artifact => expectedArtifact({
      sourceId: artifact.id,
      family: repositoryFutureArtifactFamilyForPath(artifact.futureDestination),
      targetPath: artifact.futureDestination,
      action: artifact.action,
      generatorId: artifact.generatorId,
      supported: artifact.readiness !== 'blocked' && artifact.action !== 'unavailable',
      humanReviewRequired: artifact.readiness === 'review-required',
      limitations: artifact.readiness === 'blocked' ? ['The current generator marks this artifact blocked.'] : [],
    }));
    const confidence = weakestConfidence(improvement.evidence.map(item => confidenceFromNumber(item.confidence)), 'low');
    const humanReviewState = sensitiveFutureContent([
      improvement.title,
      improvement.problem.explanation,
      improvement.recommendation.rationale,
      ...artifacts.map(item => item.targetPath || item.family),
    ]) || artifacts.some(item => item.humanReviewRequired) ? 'required' : 'not-required';

    return normalizeCandidate({
      sourceId: improvement.id,
      sourceContractVersion: 'shipseal.repository-actionable-improvement.v1',
      title: improvement.recommendation.summary,
      rationale: improvement.recommendation.rationale || improvement.problem.explanation,
      origin: 'deterministic',
      targetCapabilityId: repositoryFutureCapabilityForDomain(improvement.domain),
      evidence,
      dependencies: [repositoryEvidenceDependency(evidence, 'deterministic')],
      expectedArtifacts: artifacts,
      confidence,
      humanReviewState,
      limitations: [improvement.unsupportedReason || ''].filter(Boolean),
      unavailableInformation: improvement.support === 'unsupported' ? ['A supported executable artifact path is unavailable.'] : [],
      universeMappings: mappedNodes.map(node => ({ universeNodeId: node.id, repositoryRelativePath: node.path })),
      verificationMethod: improvement.verification.method,
      alignment: 'transformation',
      eligibility: improvement.support === 'unsupported' ? 'unsupported' : undefined,
    }, context);
  });
  return adapterResult(candidates);
}

export function adaptRepositoryHealthCandidates(
  health: RepositoryHealthModel,
  context: RepositoryFutureAdapterContext,
): RepositoryFutureCandidateAdapterResult {
  const topActions = health.topActions.map(action => {
    const path = normalizeRepositoryFuturePath(action.suggestedTargetPath);
    const mappings = path ? mappingsForPaths([path], context.universe) : [];
    const evidence = action.evidence.map((detail, index) => evidenceReference({
      id: repositoryFutureId('future-health-evidence', { source: action.id, index, detail }),
      path: mappings[0]?.repositoryRelativePath,
      confidence: normalizeHealthConfidence(health.overall.confidence),
      state: 'observed-current',
      origin: 'deterministic',
      context,
    }));
    const artifacts = path ? [expectedArtifact({
      sourceId: `health:${action.id}`,
      family: repositoryFutureArtifactFamilyForPath(path),
      targetPath: path,
      action: 'create',
      generatorId: 'shipseal.repository-health-recommendation.v1',
      supported: true,
      humanReviewRequired: sensitiveFutureContent([path, action.title, action.action]),
      limitations: [],
    })] : [];
    return normalizeCandidate({
      sourceId: `health-action:${action.id}`,
      sourceContractVersion: health.modelVersion,
      title: action.title,
      rationale: `${action.whyItMatters} ${action.action}`.trim(),
      origin: 'deterministic',
      targetCapabilityId: capabilityForHealthDimensions(action.dimensions),
      evidence,
      dependencies: [repositoryEvidenceDependency(evidence, 'deterministic')],
      expectedArtifacts: artifacts,
      confidence: normalizeHealthConfidence(health.overall.confidence),
      humanReviewState: sensitiveFutureContent([action.title, action.action, path]) ? 'required' : 'not-required',
      limitations: path ? [] : ['The current recommendation does not identify a supported repository destination.'],
      unavailableInformation: path ? [] : ['Artifact destination is unavailable.'],
      universeMappings: mappings,
      alignment: 'direct-friction',
      eligibility: path ? undefined : 'exploratory',
    }, context);
  });

  const blockers = health.blockers.map(blocker => {
    const evidence = blocker.evidence.map((detail, index) => evidenceReference({
      id: repositoryFutureId('future-blocker-evidence', { source: blocker.id, index, detail }),
      confidence: normalizeHealthConfidence(health.overall.confidence),
      state: 'observed-current',
      origin: 'deterministic',
      context,
    }));
    return normalizeCandidate({
      sourceId: `health-blocker:${blocker.id}`,
      sourceContractVersion: health.modelVersion,
      title: `Resolve ${blocker.title}`,
      rationale: blocker.detail,
      origin: 'deterministic',
      targetCapabilityId: REPOSITORY_FUTURE_CAPABILITIES.repositoryQuality,
      evidence,
      dependencies: [repositoryEvidenceDependency(evidence, 'deterministic')],
      confidence: normalizeHealthConfidence(health.overall.confidence),
      humanReviewState: sensitiveFutureContent([blocker.title, blocker.detail]) ? 'required' : 'not-required',
      limitations: ['The blocker has no direct generator binding in the current health contract.'],
      unavailableInformation: ['Artifact generation support is unavailable until a deterministic transformation maps this blocker.'],
      alignment: 'direct-friction',
      eligibility: 'exploratory',
    }, context);
  });
  return adapterResult([...topActions, ...blockers]);
}

export function adaptWorkspaceStoryCandidates(
  story: WorkspaceStory,
  context: RepositoryFutureAdapterContext,
): RepositoryFutureCandidateAdapterResult {
  const candidates = story.chapters
    .filter(chapter => chapter.evidenceItems.some(item => item.state !== 'evidence'))
    .map(chapter => {
      const evidence = chapter.evidenceItems.map((item, index) => evidenceReference({
        id: repositoryFutureId('future-story-evidence', { chapter: chapter.id, index, item }),
        confidence: item.state === 'evidence' ? 'high' : item.state === 'heuristic' ? 'medium' : 'low',
        state: item.state === 'evidence' ? 'observed-current' : 'deterministic-inference',
        origin: 'deterministic',
        limitation: item.state === 'missing' ? item.detail || `${item.label} is missing.` : undefined,
        context,
      }));
      return normalizeCandidate({
        sourceId: `workspace-story:${chapter.id}`,
        sourceContractVersion: 'shipseal.workspace-story.v1',
        title: `Strengthen ${chapter.label}`,
        rationale: chapter.repositoryMeaning,
        origin: 'deterministic',
        targetCapabilityId: capabilityForStoryChapter(chapter.id),
        evidence,
        dependencies: [repositoryEvidenceDependency(evidence, 'deterministic')],
        confidence: weakestConfidence(evidence.map(item => item.confidence), 'low'),
        limitations: ['Workspace Story evidence does not itself provide an executable artifact binding.'],
        unavailableInformation: ['A supported transformation must map this direction before executable use.'],
        alignment: 'workspace-evidence',
        eligibility: 'exploratory',
      }, context);
    });
  return adapterResult(candidates);
}

export function adaptValidatedDeepIntelligenceCandidates(input: {
  findings: readonly unknown[];
  deterministicEvidence: readonly RepositoryEvidence[];
  context: RepositoryFutureAdapterContext;
}): RepositoryFutureCandidateAdapterResult {
  const evidenceById = new Map(input.deterministicEvidence.map(item => [item.id, item]));
  const candidates: RepositoryFutureNormalizedCandidate[] = [];
  const rejected: RepositoryFutureCandidateAdapterResult['rejected'] = [];

  for (const value of input.findings) {
    if (!isValidatedFutureDirectionFinding(value)) {
      rejected.push({
        sourceId: isRecord(value) && typeof value.id === 'string' ? value.id : undefined,
        origin: 'deep-intelligence',
        reasonCodes: ['invalid-shape'],
        limitations: ['Only an already-validated future-direction finding may enter the Repository Future Graph.'],
      });
      continue;
    }
    const future = value.futureDirectionCandidate;
    const evidence = future.evidenceIds
      .map(id => evidenceById.get(id))
      .filter((item): item is RepositoryEvidence => Boolean(item))
      .map(item => evidenceReference({
        id: item.id,
        path: item.repositoryRelativePath,
        confidence: confidenceFromNumber(item.confidence),
        state: item.validation.state === 'observed' || item.validation.state === 'validated' ? 'observed-current' : 'deterministic-inference',
        origin: 'deterministic',
        contractVersion: item.schemaVersion,
        limitation: item.limitations.join(' ') || undefined,
        humanReviewRequired: value.humanReviewState === 'required',
        context: input.context,
      }));
    const bestEvidenceConfidence = evidence.reduce<RepositoryFutureConfidence>(
      (best, item) => confidenceRank(item.confidence) > confidenceRank(best) ? item.confidence : best,
      'low',
    );
    const dependencies: RepositoryFutureCandidateDependencyHint[] = [repositoryEvidenceDependency(evidence, 'deep-intelligence')];
    const unknownDependencies: string[] = [];
    for (const hint of future.dependencies) {
      const capabilityId = resolveKnownRepositoryFutureCapability(hint);
      if (!capabilityId) {
        unknownDependencies.push(hint);
        continue;
      }
      dependencies.push({
        capabilityId,
        requirement: 'required',
        origin: 'deep-intelligence',
        rationale: `Validated provider dependency hint: ${hint}`,
        evidenceIds: evidence.map(item => item.id),
        confidence: lowerConfidence(future.confidence, bestEvidenceConfidence),
        humanReviewState: value.humanReviewState,
        limitations: ['Provider dependency hint requires deterministic capability mapping before executable use.'],
      });
    }
    const artifacts = future.expectedArtifactFamilies.map(family => expectedArtifact({
      sourceId: `${value.id}:${family}`,
      family,
      supported: true,
      humanReviewRequired: value.humanReviewState === 'required',
      limitations: ['The future-direction finding identifies an artifact family, not a prepared artifact or destination.'],
    }));
    candidates.push(normalizeCandidate({
      sourceId: value.id,
      sourceContractVersion: 'shipseal.deep-intelligence-result.v1',
      title: future.goal,
      rationale: future.repositorySpecificRationale,
      origin: 'deep-intelligence',
      targetCapabilityId: repositoryFutureCapabilityForArtifactFamilies(future.expectedArtifactFamilies),
      evidence,
      dependencies,
      expectedArtifacts: artifacts,
      confidence: lowerConfidence(future.confidence, bestEvidenceConfidence),
      humanReviewState: value.humanReviewState,
      limitations: [...value.limitations, ...unknownDependencies.map(item => `Unknown provider dependency was retained only as a limitation: ${item}.`)],
      unavailableInformation: unknownDependencies.map(item => `No supported capability mapping exists for dependency: ${item}.`),
      compatibilityHints: future.compatibilityHints,
      incompatibleCandidateIds: incompatibleIdsFromHints(future.compatibilityHints),
      universeMappings: mappingsForPaths(future.evidencePaths, input.context.universe),
      verificationMethod: future.verificationMethod,
      alignment: 'provider-suggestion',
      eligibility: evidence.length ? undefined : 'blocked',
    }, input.context));
  }
  return { candidates: sortCandidates(candidates), rejected: sortRejections(rejected) };
}

export function adaptVerifiedOpportunitySignalCandidates(input: {
  signals: readonly unknown[];
  context: RepositoryFutureAdapterContext;
  expectedProjectId: string;
  eligibleVerificationIds: readonly string[];
}): RepositoryFutureCandidateAdapterResult {
  const eligibleIds = new Set(input.eligibleVerificationIds);
  const candidates: RepositoryFutureNormalizedCandidate[] = [];
  const rejected: RepositoryFutureCandidateAdapterResult['rejected'] = [];
  for (const value of input.signals) {
    if (!isVerifiedOpportunitySignal(value)) {
      rejected.push({ origin: 'verified-signal', reasonCodes: ['unsupported-signal'], limitations: ['Opportunity signal shape is invalid.'] });
      continue;
    }
    if (value.projectId !== input.expectedProjectId) {
      rejected.push({ sourceId: value.id, origin: 'verified-signal', reasonCodes: ['foreign-project'], limitations: ['Opportunity signal belongs to another project.'] });
      continue;
    }
    if (!eligibleIds.has(value.sourceVerificationId)) {
      rejected.push({ sourceId: value.id, origin: 'verified-signal', reasonCodes: ['ineligible-verification'], limitations: ['Opportunity signal source verification was not explicitly admitted by the caller.'] });
      continue;
    }
    const evidence = value.evidenceIds.map(id => evidenceReference({
      id,
      confidence: value.confidence,
      state: 'verified-signal',
      origin: 'verified-signal',
      contractVersion: 'shipseal.verification-relationship.v2',
      context: input.context,
    }));
    candidates.push(normalizeCandidate({
      sourceId: value.id,
      sourceContractVersion: 'shipseal.verified-opportunity-signal.omega18.4.v1',
      title: value.title,
      rationale: value.rationale,
      origin: 'verified-signal',
      targetCapabilityId: capabilityForSignal(value.kind),
      evidence,
      dependencies: [repositoryEvidenceDependency(evidence, 'verified-signal')],
      confidence: value.confidence,
      limitations: ['Signal acceptance is scoped input only; Ω.18.5b does not wire or persist production opportunity relationships.'],
      unavailableInformation: ['Repository and scan identity are supplied by the explicit adapter scope because the current signal contract does not carry them.'],
      alignment: 'verified-opportunity',
      eligibility: input.context.repository.limited ? 'exploratory' : undefined,
    }, input.context));
  }
  return { candidates: sortCandidates(candidates), rejected: sortRejections(rejected) };
}

function normalizeCandidate(draft: CandidateDraft, context: RepositoryFutureAdapterContext): RepositoryFutureNormalizedCandidate {
  const evidence = normalizeEvidenceReferences(draft.evidence);
  const mappings = normalizeUniverseMappings(draft.universeMappings || []);
  const artifacts = [...(draft.expectedArtifacts || [])].sort((left, right) => left.id.localeCompare(right.id));
  const limitations = sortedUnique([
    ...(draft.limitations || []),
    ...(context.repository.limited ? ['The source scan is limited; executable-quality eligibility is unavailable.'] : []),
  ]);
  const humanReviewState = draft.humanReviewState || (sensitiveFutureContent([
    draft.title,
    draft.rationale,
    ...artifacts.map(item => item.targetPath || item.family),
  ]) ? 'required' : 'not-required');
  let eligibility = draft.eligibility || 'eligible';
  if (!evidence.length) eligibility = 'blocked';
  else if (context.repository.limited && eligibility === 'eligible') eligibility = 'exploratory';
  else if (artifacts.length && artifacts.every(item => !item.supported) && eligibility === 'eligible') eligibility = 'unsupported';
  const contentSeed = {
    sourceId: draft.sourceId,
    sourceContractVersion: draft.sourceContractVersion,
    repositoryId: context.repository.repositoryId,
    sourceScanId: context.repository.sourceScanId,
    sourceScanFingerprint: context.repository.sourceScanFingerprint,
    title: draft.title.trim(),
    rationale: draft.rationale.trim(),
    origin: draft.origin,
    targetCapabilityId: draft.targetCapabilityId,
    evidence,
    dependencies: normalizeDependencies(draft.dependencies || []),
    expectedArtifacts: artifacts,
    confidence: draft.confidence,
    humanReviewState,
    limitations,
    unavailableInformation: sortedUnique(draft.unavailableInformation || []),
    compatibilityHints: sortedUnique(draft.compatibilityHints || []),
    incompatibleCandidateIds: sortedUnique(draft.incompatibleCandidateIds || []),
    universeMappings: mappings,
    verificationMethod: draft.verificationMethod?.trim() || undefined,
    alignment: draft.alignment,
    eligibility,
    candidateClass: draft.candidateClass || 'repository-improvement',
    productOpportunityOrigin: draft.productOpportunityOrigin,
    userValue: draft.userValue?.trim() || undefined,
    whyItFits: draft.whyItFits?.trim() || undefined,
    targetUsers: sortedUnique(draft.targetUsers || []),
    strategicRationale: draft.strategicRationale?.trim() || undefined,
    changeWeight: draft.changeWeight,
    impactBreadth: draft.impactBreadth,
    productUnderstandingFingerprint: draft.productUnderstandingFingerprint,
  };
  const id = repositoryFutureId('future-candidate', {
    sourceId: contentSeed.sourceId,
    sourceContractVersion: contentSeed.sourceContractVersion,
    repositoryId: contentSeed.repositoryId,
    targetCapabilityId: contentSeed.targetCapabilityId,
  });
  return {
    id,
    ...contentSeed,
    lifecycle: 'proposed',
    currentness: 'future',
    fit: fitFor(contentSeed),
    contentFingerprint: repositoryFutureFingerprint(contentSeed),
  };
}

function fitFor(candidate: Pick<RepositoryFutureNormalizedCandidate, 'eligibility' | 'origin' | 'confidence' | 'humanReviewState' | 'evidence' | 'expectedArtifacts' | 'candidateClass' | 'productOpportunityOrigin'>): RepositoryFutureFit {
  if (candidate.eligibility === 'blocked' || candidate.eligibility === 'unsupported') return 'blocked';
  if (candidate.eligibility === 'exploratory' || candidate.productOpportunityOrigin === 'exploratory' || candidate.confidence === 'low') return 'exploratory';
  if (candidate.candidateClass === 'product-opportunity' && candidate.productOpportunityOrigin === 'strategic') return 'supported-with-review';
  if (candidate.origin === 'deep-intelligence' && candidate.candidateClass !== 'product-opportunity') return 'exploratory';
  if (candidate.humanReviewState === 'required' || candidate.confidence === 'medium') return 'supported-with-review';
  if (candidate.evidence.some(item => item.state === 'observed-current' || item.state === 'verified-signal')
    && (!candidate.expectedArtifacts.length || candidate.expectedArtifacts.some(item => item.supported))) return 'strong-evidence-fit';
  return 'supported-with-review';
}

function expectedArtifact(input: Omit<RepositoryFutureExpectedArtifact, 'id'> & { sourceId: string }) {
  const targetPath = normalizeRepositoryFuturePath(input.targetPath);
  const core = {
    family: input.family.trim(),
    targetPath: targetPath || undefined,
    action: input.action,
    generatorId: input.generatorId,
    supported: input.supported && (!input.targetPath || Boolean(targetPath)),
    contentFingerprint: input.contentFingerprint,
    humanReviewRequired: input.humanReviewRequired,
    limitations: sortedUnique([
      ...input.limitations,
      ...(input.targetPath && !targetPath ? ['Unsafe or non-repository-relative artifact destination was rejected.'] : []),
    ]),
  };
  return { id: repositoryFutureId('future-artifact', { sourceId: input.sourceId, family: core.family, targetPath: core.targetPath }), ...core };
}

function evidenceReference(input: {
  id: string;
  path?: string;
  confidence: RepositoryFutureConfidence;
  state: RepositoryFutureEvidenceReference['state'];
  origin: RepositoryFutureOrigin;
  contractVersion?: string;
  limitation?: string;
  humanReviewRequired?: boolean;
  context: RepositoryFutureAdapterContext;
}): RepositoryFutureEvidenceReference {
  return {
    id: input.id,
    path: input.path,
    sourceScanId: input.context.repository.sourceScanId,
    sourceScanFingerprint: input.context.repository.sourceScanFingerprint,
    state: input.state,
    origin: input.origin,
    confidence: input.confidence,
    contractVersion: input.contractVersion,
    limitation: input.limitation,
    humanReviewRequired: Boolean(input.humanReviewRequired),
  };
}

function repositoryEvidenceDependency(evidence: readonly RepositoryFutureEvidenceReference[], origin: RepositoryFutureOrigin): RepositoryFutureCandidateDependencyHint {
  return {
    capabilityId: REPOSITORY_FUTURE_CAPABILITIES.repositoryEvidence,
    requirement: 'required',
    origin,
    rationale: 'The future direction must remain grounded in bounded current repository evidence.',
    evidenceIds: evidence.map(item => item.id).sort((left, right) => left.localeCompare(right)),
    confidence: weakestConfidence(evidence.map(item => item.confidence), 'low'),
    state: evidence.length ? 'satisfied' : 'unknown',
    humanReviewState: 'not-required',
    limitations: evidence.length ? [] : ['No repository evidence resolved for this dependency.'],
  };
}

function normalizeDependencies(values: readonly RepositoryFutureCandidateDependencyHint[]) {
  const byId = new Map<string, RepositoryFutureCandidateDependencyHint>();
  for (const value of values) {
    const key = `${value.requirement}:${value.capabilityId}`;
    const normalized = {
      ...value,
      evidenceIds: sortedUnique(value.evidenceIds),
      limitations: sortedUnique(value.limitations),
    };
    const existing = byId.get(key);
    if (!existing || confidenceRank(normalized.confidence) > confidenceRank(existing.confidence)) byId.set(key, normalized);
  }
  return [...byId.values()].sort((left, right) => left.capabilityId.localeCompare(right.capabilityId) || left.requirement.localeCompare(right.requirement));
}

function mappingsForPaths(paths: readonly string[], universe: RepositoryUniverseModel) {
  const normalized = new Set(paths.map(normalizeRepositoryFuturePath).filter(Boolean));
  return universe.nodes
    .filter(node => node.path && normalized.has(normalizeRepositoryFuturePath(node.path)))
    .map(node => ({ universeNodeId: node.id, repositoryRelativePath: normalizeRepositoryFuturePath(node.path) }));
}

function capabilityForHealthDimensions(dimensions: readonly string[]) {
  if (dimensions.includes('agentRouting')) return REPOSITORY_FUTURE_CAPABILITIES.agentRouting;
  if (dimensions.includes('deliveryConfidence')) return REPOSITORY_FUTURE_CAPABILITIES.verificationStrategy;
  if (dimensions.includes('repositoryIntelligence')) return REPOSITORY_FUTURE_CAPABILITIES.projectMemory;
  return REPOSITORY_FUTURE_CAPABILITIES.repositoryQuality;
}

function capabilityForStoryChapter(chapterId: string) {
  if (chapterId.includes('memory') || chapterId.includes('structure')) return REPOSITORY_FUTURE_CAPABILITIES.projectMemory;
  if (chapterId.includes('routing') || chapterId.includes('agent')) return REPOSITORY_FUTURE_CAPABILITIES.agentRouting;
  if (chapterId.includes('verification') || chapterId.includes('delivery')) return REPOSITORY_FUTURE_CAPABILITIES.verificationStrategy;
  return REPOSITORY_FUTURE_CAPABILITIES.repositoryQuality;
}

function capabilityForSignal(kind: VerifiedOpportunitySignal['kind']) {
  if (kind === 'risk-detected') return REPOSITORY_FUTURE_CAPABILITIES.riskRemediation;
  if (kind === 'dependency-satisfied') return REPOSITORY_FUTURE_CAPABILITIES.dependencyReadiness;
  if (kind === 'friction-resolved') return REPOSITORY_FUTURE_CAPABILITIES.repositoryQuality;
  return REPOSITORY_FUTURE_CAPABILITIES.repositoryCapability;
}

function repositoryFutureCapabilityForArtifactFamilies(families: readonly string[]) {
  for (const family of families) {
    const mapped = resolveKnownRepositoryFutureCapability(family, DEFAULT_REPOSITORY_FUTURE_DEPENDENCY_DEFINITIONS);
    if (mapped) return mapped;
    if (family === 'task-router') return REPOSITORY_FUTURE_CAPABILITIES.taskRouting;
    if (family === 'architecture') return REPOSITORY_FUTURE_CAPABILITIES.architectureMemory;
    if (family === 'agents-instructions') return REPOSITORY_FUTURE_CAPABILITIES.agentInstructions;
  }
  return REPOSITORY_FUTURE_CAPABILITIES.repositoryCapability;
}

function incompatibleIdsFromHints(hints: readonly string[]) {
  return sortedUnique(hints.flatMap(hint => {
    const match = /^(?:conflicts-with|incompatible-with):\s*(.+)$/i.exec(hint.trim());
    return match?.[1]?.trim() ? [match[1].trim()] : [];
  }));
}

function normalizeHealthConfidence(confidence: RepositoryHealthModel['overall']['confidence']): RepositoryFutureConfidence {
  if (confidence === 'High') return 'high';
  if (confidence === 'Medium') return 'medium';
  return 'low';
}

function weakestConfidence(values: readonly RepositoryFutureConfidence[], fallback: RepositoryFutureConfidence) {
  if (!values.length) return fallback;
  return values.reduce((weakest, value) => confidenceRank(value) < confidenceRank(weakest) ? value : weakest, values[0]);
}

function adapterResult(candidates: RepositoryFutureNormalizedCandidate[]): RepositoryFutureCandidateAdapterResult {
  return { candidates: sortCandidates(candidates), rejected: [] };
}

function sortCandidates(candidates: RepositoryFutureNormalizedCandidate[]) {
  return [...candidates].sort((left, right) => left.id.localeCompare(right.id));
}

function sortRejections(rejected: RepositoryFutureCandidateAdapterResult['rejected']) {
  return [...rejected].sort((left, right) => (left.sourceId || '').localeCompare(right.sourceId || '') || left.reasonCodes.join(':').localeCompare(right.reasonCodes.join(':')));
}

function isValidatedFutureDirectionFinding(value: unknown): value is RepositoryDeepIntelligenceValidatedFinding & {
  futureDirectionCandidate: NonNullable<RepositoryDeepIntelligenceValidatedFinding['futureDirectionCandidate']>;
} {
  if (!isRecord(value) || value.category !== 'future-direction') return false;
  if (!['accepted', 'accepted-with-limitations', 'requires-human-review'].includes(String(value.validationState))) return false;
  if (!['low', 'medium', 'high'].includes(String(value.acceptedConfidence))) return false;
  if (!['not-required', 'required'].includes(String(value.humanReviewState))) return false;
  if (!Array.isArray(value.acceptedPaths) || !value.acceptedPaths.every(item => typeof item === 'string')) return false;
  if (!Array.isArray(value.supportingEvidenceIds) || !value.supportingEvidenceIds.every(item => typeof item === 'string')) return false;
  if (!Array.isArray(value.limitations) || !value.limitations.every(item => typeof item === 'string')) return false;
  const acceptedPaths = value.acceptedPaths as string[];
  const supportingEvidenceIds = value.supportingEvidenceIds as string[];
  const future = value.futureDirectionCandidate;
  const supportedArtifactFamilies = new Set([
    'agents-instructions', 'architecture', 'critical-files', 'task-router', 'command-map', 'known-risks', 'context-guide', 'repository-intelligence-manifest',
  ]);
  return isRecord(future)
    && typeof future.goal === 'string' && Boolean(future.goal.trim())
    && typeof future.repositorySpecificRationale === 'string' && Boolean(future.repositorySpecificRationale.trim())
    && Array.isArray(future.evidencePaths) && future.evidencePaths.every(item => typeof item === 'string' && acceptedPaths.includes(item))
    && Array.isArray(future.evidenceIds) && future.evidenceIds.every(item => typeof item === 'string' && supportingEvidenceIds.includes(item))
    && Array.isArray(future.dependencies) && future.dependencies.every(item => typeof item === 'string')
    && Array.isArray(future.expectedArtifactFamilies) && future.expectedArtifactFamilies.length > 0
    && future.expectedArtifactFamilies.every(item => typeof item === 'string' && supportedArtifactFamilies.has(item))
    && ['low', 'medium', 'high'].includes(String(future.confidence)) && future.confidence === value.acceptedConfidence
    && Array.isArray(future.compatibilityHints) && future.compatibilityHints.every(item => typeof item === 'string');
}

function isVerifiedOpportunitySignal(value: unknown): value is VerifiedOpportunitySignal {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string' && Boolean(value.id.trim())
    && typeof value.projectId === 'string' && Boolean(value.projectId.trim())
    && typeof value.sourceVerificationId === 'string' && Boolean(value.sourceVerificationId.trim())
    && ['dependency-satisfied', 'friction-resolved', 'capability-added', 'risk-detected', 'future-unlocked'].includes(String(value.kind))
    && typeof value.title === 'string' && Boolean(value.title.trim())
    && typeof value.rationale === 'string' && Boolean(value.rationale.trim())
    && Array.isArray(value.evidenceIds) && value.evidenceIds.length > 0 && value.evidenceIds.every(item => typeof item === 'string')
    && Array.isArray(value.relatedArtifactIds) && value.relatedArtifactIds.every(item => typeof item === 'string')
    && ['low', 'medium', 'high'].includes(String(value.confidence));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
