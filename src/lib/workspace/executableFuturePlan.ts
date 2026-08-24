import type { RepositoryProductIntelligenceResult } from '../repositoryIntelligence/index.js';
import type { ReadinessReport } from '../types.js';
import type {
  RepositoryFutureDraft,
  RepositoryFutureDraftDependency,
  RepositoryFutureDraftGoal,
  RepositoryFutureGraph,
  RepositoryFutureNormalizedCandidate,
} from './repositoryFutures/index.js';
import {
  normalizeRepositoryFuturePath,
  repositoryFutureFingerprint,
  repositoryFutureId,
  sortedUnique,
} from './repositoryFutures/identity.js';

export const EXECUTABLE_FUTURE_PLAN_VERSION = 'shipseal.executable-future-plan.omega18.5.v12' as const;
export const EXECUTABLE_FUTURE_HANDOFF_VERSION = 'shipseal.future-agent-handoff.v1' as const;

export type ExecutableFuturePlanAreaKind = 'existing-repository-area' | 'likely-new-responsibility';
export type ExecutableFuturePlanReviewCategory =
  | 'authentication'
  | 'security'
  | 'privacy'
  | 'data-handling'
  | 'billing'
  | 'compliance'
  | 'deployment'
  | 'human-review';

export interface ExecutableFuturePlanRepository {
  id: string;
  name: string;
  branch?: string;
  detectedStack: string;
  packageManager?: string;
  sourceScanFingerprint: string;
  sourceIntelligenceFingerprint: string;
}

export interface ExecutableFuturePlanGoal {
  goalId: string;
  candidateId: string;
  title: string;
  role: 'primary' | 'supporting';
  opportunityStatement: string;
  userValue: string;
  rationale: string;
  evidenceIds: string[];
}

export interface ExecutableFuturePlanCapability {
  id: string;
  capabilityId: string;
  title: string;
  state: RepositoryFutureDraftDependency['state'];
  rationale: string;
  executionOrder: number;
  dependentGoalIds: string[];
  evidenceIds: string[];
  humanReviewRequired: boolean;
}

export interface ExecutableFuturePlanArea {
  id: string;
  kind: ExecutableFuturePlanAreaKind;
  label: string;
  path?: string;
  sourceIds: string[];
  evidenceIds: string[];
}

export interface ExecutableFuturePlanEvidenceReference {
  id: string;
  path?: string;
  sourceIds: string[];
}

export interface ExecutableFuturePlanReviewGate {
  id: string;
  category: ExecutableFuturePlanReviewCategory;
  title: string;
  reason: string;
  sourceId: string;
  evidenceIds: string[];
}

export interface ExecutableFuturePlanStage {
  id: string;
  order: number;
  kind: 'foundation' | 'primary' | 'supporting' | 'integration' | 'review' | 'verification';
  title: string;
  purpose: string;
  whyNow: string;
  changes: string[];
  repositoryAreaIds: string[];
  completionCriteria: string[];
  evidenceIds: string[];
  reviewGateIds: string[];
  sourceIds: string[];
}

export interface ExecutableFuturePlanRisk {
  id: string;
  statement: string;
  sourceIds: string[];
}

export interface ExecutableFutureVerificationCheck {
  id: string;
  kind: 'static' | 'unit' | 'integration' | 'build' | 'review' | 'product-acceptance';
  title: string;
  command?: string;
  rationale: string;
  sourceIds: string[];
}

export interface ExecutableFutureVerificationPlan {
  checks: ExecutableFutureVerificationCheck[];
  completionStatement: string;
}

export interface ExecutableFutureAgentHandoffs {
  version: typeof EXECUTABLE_FUTURE_HANDOFF_VERSION;
  targets: Array<'codex' | 'claude-code'>;
  sharedRules: string[];
}

export interface ExecutableFuturePlan {
  version: typeof EXECUTABLE_FUTURE_PLAN_VERSION;
  id: string;
  fingerprint: string;
  repository: ExecutableFuturePlanRepository;
  primaryFuture: ExecutableFuturePlanGoal;
  supportingFutures: ExecutableFuturePlanGoal[];
  requiredCapabilities: ExecutableFuturePlanCapability[];
  objective: string;
  implementationStages: ExecutableFuturePlanStage[];
  affectedRepositoryAreas: ExecutableFuturePlanArea[];
  evidence: ExecutableFuturePlanEvidenceReference[];
  reviewGates: ExecutableFuturePlanReviewGate[];
  verificationPlan: ExecutableFutureVerificationPlan;
  risks: ExecutableFuturePlanRisk[];
  limitations: string[];
  humanReviewRequired: boolean;
  agentHandoffs: ExecutableFutureAgentHandoffs;
}

export interface BuildExecutableFuturePlanInput {
  report: ReadinessReport;
  graph: RepositoryFutureGraph;
  draft: RepositoryFutureDraft;
  productIntelligence?: RepositoryProductIntelligenceResult | null;
}

interface PlanContext {
  input: BuildExecutableFuturePlanInput;
  knownPaths: Set<string>;
  candidateById: Map<string, RepositoryFutureNormalizedCandidate>;
  opportunityById: Map<string, RepositoryProductIntelligenceResult['opportunities'][number]>;
  evidencePathById: Map<string, string>;
}

export function buildExecutableFuturePlan(input: BuildExecutableFuturePlanInput): ExecutableFuturePlan {
  const context = buildContext(input);
  const primaryFuture = planGoal(input.draft.primaryGoal, 'primary', context);
  const supportingFutures = input.draft.supportingGoals.map(goal => planGoal(goal, 'supporting', context));
  const selectedEvidenceIds = new Set([primaryFuture, ...supportingFutures].flatMap(goal => goal.evidenceIds));
  const requiredCapabilities = input.draft.dependencies
    .map(dependency => ({
      id: dependency.id,
      capabilityId: dependency.capabilityId,
      title: dependency.title,
      state: dependency.state,
      rationale: dependency.rationale,
      executionOrder: dependency.executionOrder,
      dependentGoalIds: [...dependency.dependentGoalIds],
      evidenceIds: selectedDependencyEvidence(dependency.evidenceIds, selectedEvidenceIds),
      humanReviewRequired: dependency.humanReviewState === 'required' || dependency.state === 'review-required',
    }))
    .sort((left, right) => left.executionOrder - right.executionOrder || left.id.localeCompare(right.id));
  const affectedRepositoryAreas = buildAffectedAreas(primaryFuture, supportingFutures, requiredCapabilities, context);
  const reviewGates = buildReviewGates(primaryFuture, supportingFutures, requiredCapabilities, context);
  const verificationPlan = buildVerificationPlan(primaryFuture, supportingFutures, reviewGates, context);
  const implementationStages = buildImplementationStages({
    primaryFuture,
    supportingFutures,
    requiredCapabilities,
    affectedRepositoryAreas,
    reviewGates,
    verificationPlan,
    context,
  });
  const evidence = buildEvidence(primaryFuture, supportingFutures, requiredCapabilities, affectedRepositoryAreas, reviewGates, context);
  const risks = buildRisks(primaryFuture, supportingFutures, requiredCapabilities, affectedRepositoryAreas, reviewGates, context);
  const limitations = sortedUnique([
    ...input.draft.limitations,
    ...(input.productIntelligence?.limitations || []),
  ]).slice(0, 10);
  const repository = buildRepository(input, context);
  const objective = buildObjective(primaryFuture, supportingFutures, requiredCapabilities);
  const agentHandoffs: ExecutableFutureAgentHandoffs = {
    version: EXECUTABLE_FUTURE_HANDOFF_VERSION,
    targets: ['codex', 'claude-code'],
    sharedRules: [
      'Inspect the current implementation before editing.',
      'Preserve existing behavior unless the plan explicitly changes it.',
      'Do not invent repository paths.',
      'Work in dependency order and verify after meaningful changes.',
      'Stop at every human-review gate until a qualified reviewer approves continuation.',
      'Do not commit or push unless the repository owner explicitly requests it.',
      'Report changed files and validation results.',
    ],
  };
  const core = {
    version: EXECUTABLE_FUTURE_PLAN_VERSION,
    repository,
    primaryFuture,
    supportingFutures,
    requiredCapabilities,
    objective,
    implementationStages,
    affectedRepositoryAreas,
    evidence,
    reviewGates,
    verificationPlan,
    risks,
    limitations,
    humanReviewRequired: reviewGates.length > 0,
    agentHandoffs,
  };
  const fingerprint = repositoryFutureFingerprint(core);
  return {
    ...core,
    id: repositoryFutureId('executable-future-plan', fingerprint),
    fingerprint,
  };
}

function buildContext(input: BuildExecutableFuturePlanInput): PlanContext {
  const knownPaths = new Set((input.report.analyzedFiles || input.report.sampleFiles)
    .filter(file => !file.isDir)
    .map(file => normalizeRepositoryFuturePath(file.path))
    .filter(Boolean));
  const candidateById = new Map(input.graph.candidates.map(candidate => [candidate.id, candidate]));
  const opportunityById = new Map((input.productIntelligence?.opportunities || []).map(opportunity => [opportunity.id, opportunity]));
  const evidencePathById = new Map<string, string>();
  for (const candidate of input.graph.candidates) {
    for (const evidence of candidate.evidence) {
      const path = safeExistingPath(evidence.path, knownPaths);
      if (path) evidencePathById.set(evidence.id, path);
    }
  }
  for (const evidence of input.productIntelligence?.evidenceReferences || []) {
    const path = safeExistingPath(evidence.path, knownPaths);
    if (path) evidencePathById.set(evidence.id, path);
  }
  return { input, knownPaths, candidateById, opportunityById, evidencePathById };
}

function planGoal(goal: RepositoryFutureDraftGoal, role: ExecutableFuturePlanGoal['role'], context: PlanContext): ExecutableFuturePlanGoal {
  const candidate = context.candidateById.get(goal.candidateId);
  const opportunity = candidate ? context.opportunityById.get(candidate.sourceId) : undefined;
  return {
    goalId: goal.goalId,
    candidateId: goal.candidateId,
    title: goal.title,
    role,
    opportunityStatement: opportunity?.opportunityStatement || `Implement ${goal.title} as the selected repository Future.`,
    userValue: opportunity?.userValue || candidate?.userValue || goal.rationale,
    rationale: opportunity?.whyItFits || candidate?.whyItFits || goal.rationale,
    evidenceIds: sortedUnique(goal.evidenceIds),
  };
}

function buildRepository(input: BuildExecutableFuturePlanInput, context: PlanContext): ExecutableFuturePlanRepository {
  const source = input.report.source;
  const githubName = source.githubOwner && source.githubRepo ? `${source.githubOwner}/${source.githubRepo}` : undefined;
  return {
    id: input.draft.sourceRepository.repositoryId,
    name: githubName || input.report.repoName,
    branch: source.githubBranch || source.githubDefaultBranch,
    detectedStack: input.report.stack.primary,
    packageManager: input.report.stack.packageManagers[0] || input.report.repoContextPack.packageManager || undefined,
    sourceScanFingerprint: input.draft.sourceRepository.sourceScanFingerprint,
    sourceIntelligenceFingerprint: context.input.productIntelligence?.fingerprint || input.graph.fingerprint,
  };
}

function buildObjective(
  primary: ExecutableFuturePlanGoal,
  supports: ExecutableFuturePlanGoal[],
  dependencies: ExecutableFuturePlanCapability[],
) {
  const supportClause = supports.length
    ? ` Integrate ${supports.map(goal => goal.title).join(supports.length === 2 ? ' and ' : '')} as supporting outcomes.`
    : '';
  const dependencyClause = dependencies.length
    ? ` Establish the required ${dependencies.map(item => item.title).join(', ')} capabilities first.`
    : '';
  return `${primary.opportunityStatement} ${primary.userValue}${supportClause}${dependencyClause}`.replace(/\s+/g, ' ').trim();
}

function buildAffectedAreas(
  primary: ExecutableFuturePlanGoal,
  supports: ExecutableFuturePlanGoal[],
  dependencies: ExecutableFuturePlanCapability[],
  context: PlanContext,
) {
  const areas: ExecutableFuturePlanArea[] = [];
  for (const goal of [primary, ...supports]) {
    const candidate = context.candidateById.get(goal.candidateId);
    const opportunity = candidate ? context.opportunityById.get(candidate.sourceId) : undefined;
    if (opportunity?.expectedImplementationAreas.length) {
      for (const area of opportunity.expectedImplementationAreas) {
        const path = safeExistingPath(area.existingPath, context.knownPaths);
        areas.push(planArea({
          kind: path ? 'existing-repository-area' : 'likely-new-responsibility',
          label: area.label,
          path,
          sourceIds: [goal.goalId],
          evidenceIds: area.evidenceIds,
        }));
      }
    } else if (candidate) {
      const mappedPaths = candidate.universeMappings
        .map(mapping => safeExistingPath(mapping.repositoryRelativePath, context.knownPaths))
        .filter((path): path is string => Boolean(path));
      if (mappedPaths.length) {
        mappedPaths.forEach(path => areas.push(planArea({
          kind: 'existing-repository-area',
          label: repositoryAreaLabel(path),
          path,
          sourceIds: [goal.goalId],
          evidenceIds: goal.evidenceIds,
        })));
      } else {
        areas.push(planArea({
          kind: 'likely-new-responsibility',
          label: candidate.targetCapabilityId || goal.title,
          sourceIds: [goal.goalId],
          evidenceIds: goal.evidenceIds,
        }));
      }
    }
  }
  for (const dependency of dependencies.filter(item => item.state !== 'satisfied')) {
    areas.push(planArea({
      kind: 'likely-new-responsibility',
      label: dependency.title,
      sourceIds: [dependency.id, ...dependency.dependentGoalIds],
      evidenceIds: dependency.evidenceIds,
    }));
  }
  return mergeAreas(areas);
}

function planArea(input: Omit<ExecutableFuturePlanArea, 'id'>): ExecutableFuturePlanArea {
  const core = {
    ...input,
    sourceIds: sortedUnique(input.sourceIds),
    evidenceIds: sortedUnique(input.evidenceIds),
  };
  return { id: repositoryFutureId('future-plan-area', core), ...core };
}

function mergeAreas(areas: ExecutableFuturePlanArea[]) {
  const merged = new Map<string, ExecutableFuturePlanArea>();
  for (const area of areas) {
    const key = `${area.kind}:${area.path || area.label.toLowerCase()}`;
    const existing = merged.get(key);
    if (!existing) merged.set(key, area);
    else merged.set(key, planArea({
      kind: existing.kind,
      label: existing.label,
      path: existing.path,
      sourceIds: [...existing.sourceIds, ...area.sourceIds],
      evidenceIds: [...existing.evidenceIds, ...area.evidenceIds],
    }));
  }
  return [...merged.values()].sort((left, right) => Number(left.kind !== 'existing-repository-area') - Number(right.kind !== 'existing-repository-area') || (left.path || left.label).localeCompare(right.path || right.label));
}

function buildReviewGates(
  primary: ExecutableFuturePlanGoal,
  supports: ExecutableFuturePlanGoal[],
  dependencies: ExecutableFuturePlanCapability[],
  context: PlanContext,
) {
  const gates: ExecutableFuturePlanReviewGate[] = [];
  const explicitGoalIds = new Set<string>();
  for (const goal of [primary, ...supports]) {
    const candidate = context.candidateById.get(goal.candidateId);
    const opportunity = candidate ? context.opportunityById.get(candidate.sourceId) : undefined;
    for (const reason of opportunity?.humanReviewRequirements || []) {
      gates.push(reviewGate(goal.goalId, reason, goal.evidenceIds));
      explicitGoalIds.add(goal.goalId);
    }
    if (candidate?.humanReviewState === 'required' && !opportunity?.humanReviewRequirements.length) {
      gates.push(reviewGate(goal.goalId, candidate.rationale, goal.evidenceIds));
    }
  }
  const explicitEvidenceIds = new Set(gates.flatMap(gate => gate.evidenceIds));
  for (const dependency of dependencies.filter(item => item.humanReviewRequired)) {
    const inheritedFromExplicitGoal = dependency.dependentGoalIds.some(goalId => explicitGoalIds.has(goalId))
      || dependency.evidenceIds.some(evidenceId => explicitEvidenceIds.has(evidenceId));
    if (inheritedFromExplicitGoal) continue;
    gates.push(reviewGate(dependency.id, dependency.rationale, dependency.evidenceIds));
  }
  for (const requirement of context.input.draft.humanReviewRequirements) {
    if (gates.some(gate => gate.sourceId === requirement.sourceId)) continue;
    if (requirement.sourceKind === 'goal' && explicitGoalIds.has(requirement.sourceId)) continue;
    if (requirement.sourceKind === 'dependency' && requirement.evidenceIds.some(evidenceId => explicitEvidenceIds.has(evidenceId))) continue;
    const duplicatesExplicitGate = ['gate', 'conflict'].includes(requirement.sourceKind)
      && gates.some(gate => gate.evidenceIds.some(evidenceId => requirement.evidenceIds.includes(evidenceId)));
    if (duplicatesExplicitGate) continue;
    gates.push(reviewGate(requirement.sourceId, requirement.rationale, requirement.evidenceIds));
  }
  return [...new Map(gates.map(gate => [`${gate.sourceId}:${gate.reason}`, gate])).values()]
    .sort((left, right) => left.category.localeCompare(right.category) || left.id.localeCompare(right.id));
}

function reviewGate(sourceId: string, reason: string, evidenceIds: string[]): ExecutableFuturePlanReviewGate {
  const category = reviewCategory(reason);
  const core = { category, reason, sourceId, evidenceIds: sortedUnique(evidenceIds) };
  return {
    id: repositoryFutureId('future-plan-review-gate', core),
    ...core,
    title: `${reviewCategoryLabel(category)} review`,
  };
}

function reviewCategory(value: string): ExecutableFuturePlanReviewCategory {
  if (/auth|session|identity|access control/i.test(value)) return 'authentication';
  if (/privacy|personal data/i.test(value)) return 'privacy';
  if (/data handling|retention|storage/i.test(value)) return 'data-handling';
  if (/payment|billing|subscription/i.test(value)) return 'billing';
  if (/legal|compliance|regulat/i.test(value)) return 'compliance';
  if (/security|secret|credential|vulnerab/i.test(value)) return 'security';
  if (/deploy|production|infrastructure|environment|ci\b/i.test(value)) return 'deployment';
  return 'human-review';
}

function reviewCategoryLabel(category: ExecutableFuturePlanReviewCategory) {
  return category === 'data-handling' ? 'Data handling' : category === 'human-review' ? 'Human' : `${category[0].toUpperCase()}${category.slice(1)}`;
}

function buildVerificationPlan(
  primary: ExecutableFuturePlanGoal,
  supports: ExecutableFuturePlanGoal[],
  reviewGates: ExecutableFuturePlanReviewGate[],
  context: PlanContext,
): ExecutableFutureVerificationPlan {
  const scripts = context.input.report.stack.scripts;
  const goals = [primary, ...supports];
  const checks: ExecutableFutureVerificationCheck[] = [];
  const scriptKinds: Array<[string, ExecutableFutureVerificationCheck['kind'], string]> = [
    ['lint', 'static', 'Static verification'],
    ['typecheck', 'static', 'Type verification'],
    ['test', 'unit', 'Repository tests'],
    ['test:integration', 'integration', 'Integration tests'],
    ['build', 'build', 'Production build'],
  ];
  for (const [script, kind, title] of scriptKinds) {
    if (!scripts[script]) continue;
    checks.push(verificationCheck(kind, title, scriptCommand(script, context.input.report), `Run the repository's existing ${script} script without changing its configured behavior.`, [context.input.graph.fingerprint]));
  }
  for (const goal of goals) {
    const candidate = context.candidateById.get(goal.candidateId);
    const opportunity = candidate ? context.opportunityById.get(candidate.sourceId) : undefined;
    const rationale = opportunity?.verificationConcept || candidate?.verificationMethod;
    if (rationale) checks.push(verificationCheck('product-acceptance', `${goal.title} acceptance`, undefined, rationale, [goal.goalId]));
  }
  if (reviewGates.length) {
    checks.push(verificationCheck('review', 'Human review gates', undefined, 'Confirm every listed review gate before production verification or delivery.', reviewGates.map(gate => gate.id)));
  }
  if (!checks.length) {
    checks.push(verificationCheck('product-acceptance', 'Manual product acceptance', undefined, `Confirm that ${primary.title} meets its stated objective without regressing observed repository behavior.`, [primary.goalId]));
  }
  return {
    checks,
    completionStatement: 'The Future Plan is complete only when repository checks, product acceptance, and every applicable human-review gate pass.',
  };
}

function verificationCheck(
  kind: ExecutableFutureVerificationCheck['kind'],
  title: string,
  command: string | undefined,
  rationale: string,
  sourceIds: string[],
): ExecutableFutureVerificationCheck {
  const core = { kind, title, command, rationale, sourceIds: sortedUnique(sourceIds) };
  return { id: repositoryFutureId('future-plan-verification', core), ...core };
}

function scriptCommand(script: string, report: ReadinessReport) {
  const packageManager = (report.stack.packageManagers[0] || report.repoContextPack.packageManager || 'npm').toLowerCase();
  if (packageManager.includes('bun')) return `bun run ${script}`;
  if (packageManager.includes('pnpm')) return `pnpm ${script}`;
  if (packageManager.includes('yarn')) return `yarn ${script}`;
  return script === 'test' ? 'npm test' : `npm run ${script}`;
}

function buildImplementationStages(input: {
  primaryFuture: ExecutableFuturePlanGoal;
  supportingFutures: ExecutableFuturePlanGoal[];
  requiredCapabilities: ExecutableFuturePlanCapability[];
  affectedRepositoryAreas: ExecutableFuturePlanArea[];
  reviewGates: ExecutableFuturePlanReviewGate[];
  verificationPlan: ExecutableFutureVerificationPlan;
  context: PlanContext;
}) {
  const stages: Omit<ExecutableFuturePlanStage, 'id' | 'order'>[] = [];
  const dependencyAreaIds = areaIdsForSources(input.affectedRepositoryAreas, input.requiredCapabilities.flatMap(item => [item.id, ...item.dependentGoalIds]));
  if (input.requiredCapabilities.length) {
    stages.push({
      kind: 'foundation',
      title: 'Establish required capabilities',
      purpose: `Prepare ${input.requiredCapabilities.map(item => item.title).join(', ')} before dependent Future work begins.`,
      whyNow: 'The selected graph marks these capabilities as prerequisites, and its deterministic execution order places them first.',
      changes: input.requiredCapabilities.map(item => `${item.state === 'satisfied' ? 'Confirm' : 'Establish'} ${item.title}: ${item.rationale}`),
      repositoryAreaIds: dependencyAreaIds,
      completionCriteria: input.requiredCapabilities.map(item => `${item.title} is ${item.state === 'satisfied' ? 'confirmed against current evidence' : 'implemented and available to every dependent Future'}.`),
      evidenceIds: sortedUnique(input.requiredCapabilities.flatMap(item => item.evidenceIds)),
      reviewGateIds: gateIdsForSources(input.reviewGates, input.requiredCapabilities.map(item => item.id)),
      sourceIds: input.requiredCapabilities.map(item => item.id),
    });
  }
  stages.push(goalStage(input.primaryFuture, 'primary', input));
  if (input.supportingFutures.length) {
    stages.push({
      kind: 'supporting',
      title: 'Integrate supporting outcomes',
      purpose: `Connect ${input.supportingFutures.map(goal => goal.title).join(input.supportingFutures.length === 2 ? ' and ' : '')} to the Primary Future as one product path.`,
      whyNow: 'Prerequisite capability work and the Primary outcome establish the boundary that supporting Futures must extend without becoming separate roadmaps.',
      changes: input.supportingFutures.map(goal => goal.opportunityStatement),
      repositoryAreaIds: areaIdsForSources(input.affectedRepositoryAreas, input.supportingFutures.map(goal => goal.goalId)),
      completionCriteria: input.supportingFutures.map(goal => `${goal.title} contributes its stated user value without displacing the Primary Future.`),
      evidenceIds: sortedUnique(input.supportingFutures.flatMap(goal => goal.evidenceIds)),
      reviewGateIds: gateIdsForSources(input.reviewGates, input.supportingFutures.map(goal => goal.goalId)),
      sourceIds: input.supportingFutures.map(goal => goal.goalId),
    });
  }
  stages.push({
    kind: 'integration',
    title: 'Converge the Future path',
    purpose: 'Join the Primary Future, supporting outcomes, and required capabilities into one coherent repository workflow.',
    whyNow: 'The selected outcomes have been introduced; this stage proves that they operate as one plan rather than unrelated features.',
    changes: [
      `Connect ${input.primaryFuture.title} to every required capability.`,
      ...(input.supportingFutures.length ? ['Integrate supporting outcomes through the same product and repository boundaries.'] : []),
    ],
    repositoryAreaIds: input.affectedRepositoryAreas.map(area => area.id),
    completionCriteria: ['The complete selected path works as one flow and preserves existing repository responsibilities outside its stated scope.'],
    evidenceIds: sortedUnique([input.primaryFuture, ...input.supportingFutures].flatMap(goal => goal.evidenceIds)),
    reviewGateIds: [],
    sourceIds: [input.primaryFuture.goalId, ...input.supportingFutures.map(goal => goal.goalId)],
  });
  if (input.reviewGates.length) {
    stages.push({
      kind: 'review',
      title: 'Pass human-review gates',
      purpose: 'Place qualified human decisions before production verification for sensitive or explicitly reviewed work.',
      whyNow: 'Validated Future intelligence marks these boundaries as requiring review; the plan cannot self-approve them.',
      changes: input.reviewGates.map(gate => `${gate.title}: ${gate.reason}`),
      repositoryAreaIds: areaIdsForSources(input.affectedRepositoryAreas, input.reviewGates.map(gate => gate.sourceId)),
      completionCriteria: input.reviewGates.map(gate => `${gate.title} has a recorded reviewer decision before execution continues.`),
      evidenceIds: sortedUnique(input.reviewGates.flatMap(gate => gate.evidenceIds)),
      reviewGateIds: input.reviewGates.map(gate => gate.id),
      sourceIds: input.reviewGates.map(gate => gate.sourceId),
    });
  }
  stages.push({
    kind: 'verification',
    title: 'Verify and prepare delivery',
    purpose: 'Prove the selected Future against repository-supported checks and explicit product acceptance.',
    whyNow: 'Verification follows prerequisite, implementation, integration, and review work so it measures the complete plan.',
    changes: input.verificationPlan.checks.map(check => check.command ? `${check.title}: ${check.command}` : check.title),
    repositoryAreaIds: [],
    completionCriteria: [input.verificationPlan.completionStatement],
    evidenceIds: [],
    reviewGateIds: input.reviewGates.map(gate => gate.id),
    sourceIds: input.verificationPlan.checks.map(check => check.id),
  });
  return stages.map((stage, index) => {
    const core = {
      ...stage,
      order: index + 1,
      repositoryAreaIds: sortedUnique(stage.repositoryAreaIds),
      evidenceIds: sortedUnique(stage.evidenceIds),
      reviewGateIds: sortedUnique(stage.reviewGateIds),
      sourceIds: sortedUnique(stage.sourceIds),
    };
    return { id: repositoryFutureId('future-plan-stage', core), ...core };
  });
}

function goalStage(
  goal: ExecutableFuturePlanGoal,
  kind: 'primary',
  input: Parameters<typeof buildImplementationStages>[0],
): Omit<ExecutableFuturePlanStage, 'id' | 'order'> {
  return {
    kind,
    title: `Implement ${goal.title}`,
    purpose: goal.opportunityStatement,
    whyNow: `${goal.rationale} Required capability work precedes this stage.`,
    changes: [goal.opportunityStatement, `Deliver the stated user value: ${goal.userValue}`],
    repositoryAreaIds: areaIdsForSources(input.affectedRepositoryAreas, [goal.goalId]),
    completionCriteria: [`${goal.title} delivers its stated user value through the validated repository scope.`],
    evidenceIds: goal.evidenceIds,
    reviewGateIds: gateIdsForSources(input.reviewGates, [goal.goalId]),
    sourceIds: [goal.goalId],
  };
}

function buildEvidence(
  primary: ExecutableFuturePlanGoal,
  supports: ExecutableFuturePlanGoal[],
  dependencies: ExecutableFuturePlanCapability[],
  areas: ExecutableFuturePlanArea[],
  gates: ExecutableFuturePlanReviewGate[],
  context: PlanContext,
) {
  const sourceByEvidence = new Map<string, Set<string>>();
  const append = (evidenceIds: string[], sourceIds: string[]) => evidenceIds.forEach(evidenceId => {
    const values = sourceByEvidence.get(evidenceId) || new Set<string>();
    sourceIds.forEach(sourceId => values.add(sourceId));
    sourceByEvidence.set(evidenceId, values);
  });
  [primary, ...supports].forEach(goal => append(goal.evidenceIds, [goal.goalId]));
  dependencies.forEach(item => append(item.evidenceIds, [item.id]));
  areas.forEach(item => append(item.evidenceIds, [item.id]));
  gates.forEach(item => append(item.evidenceIds, [item.id]));
  return [...sourceByEvidence.entries()].map(([id, sourceIds]) => ({
    id,
    path: context.evidencePathById.get(id),
    sourceIds: [...sourceIds].sort(),
  })).sort((left, right) => (left.path || left.id).localeCompare(right.path || right.id));
}

function buildRisks(
  primary: ExecutableFuturePlanGoal,
  supports: ExecutableFuturePlanGoal[],
  dependencies: ExecutableFuturePlanCapability[],
  areas: ExecutableFuturePlanArea[],
  gates: ExecutableFuturePlanReviewGate[],
  context: PlanContext,
) {
  const risks: Array<Omit<ExecutableFuturePlanRisk, 'id'>> = [];
  if (context.input.graph.summary.limited) risks.push({ statement: 'The source scan is limited, so implementation scope may require additional repository inspection.', sourceIds: [context.input.graph.fingerprint] });
  const unresolved = dependencies.filter(item => item.state !== 'satisfied');
  if (unresolved.length) risks.push({ statement: `${unresolved.length} required ${unresolved.length === 1 ? 'capability is' : 'capabilities are'} not confirmed as satisfied by current evidence.`, sourceIds: unresolved.map(item => item.id) });
  const conceptual = areas.filter(area => area.kind === 'likely-new-responsibility');
  if (conceptual.length) risks.push({ statement: `${conceptual.length} implementation ${conceptual.length === 1 ? 'area is' : 'areas are'} represented as a responsibility because no validated current path exists.`, sourceIds: conceptual.map(area => area.id) });
  if (gates.length) risks.push({ statement: `${gates.length} human-review ${gates.length === 1 ? 'gate must' : 'gates must'} pass before production verification.`, sourceIds: gates.map(gate => gate.id) });
  for (const goal of [primary, ...supports]) {
    const candidate = context.candidateById.get(goal.candidateId);
    const grounded = sortedUnique([...(candidate?.limitations || []), ...(candidate?.unavailableInformation || [])])
      .filter(statement => !/product opportunity.*proposed|proposed direction, not a current capability|proposed, not current, applied, or verified/i.test(statement))
      .slice(0, 2);
    grounded.forEach(statement => risks.push({ statement, sourceIds: [goal.goalId] }));
  }
  return [...new Map(risks.map(risk => [`${risk.statement}:${sortedUnique(risk.sourceIds).join(',')}`, risk])).values()]
    .slice(0, 8)
    .map(risk => ({ id: repositoryFutureId('future-plan-risk', risk), ...risk, sourceIds: sortedUnique(risk.sourceIds) }));
}

function areaIdsForSources(areas: ExecutableFuturePlanArea[], sourceIds: string[]) {
  const sources = new Set(sourceIds);
  return areas.filter(area => area.sourceIds.some(sourceId => sources.has(sourceId))).map(area => area.id);
}

function gateIdsForSources(gates: ExecutableFuturePlanReviewGate[], sourceIds: string[]) {
  const sources = new Set(sourceIds);
  return gates.filter(gate => sources.has(gate.sourceId)).map(gate => gate.id);
}

function safeExistingPath(value: string | undefined, knownPaths: ReadonlySet<string>) {
  const normalized = normalizeRepositoryFuturePath(value);
  return normalized && knownPaths.has(normalized) ? normalized : undefined;
}

function selectedDependencyEvidence(evidenceIds: string[], selectedEvidenceIds: ReadonlySet<string>) {
  const selected = evidenceIds.filter(evidenceId => selectedEvidenceIds.has(evidenceId));
  return sortedUnique(selected.length ? selected : evidenceIds.slice(0, 8));
}

function repositoryAreaLabel(path: string) {
  const parts = path.split('/');
  return parts.length > 1 ? parts.slice(0, -1).join('/') : path;
}

export function renderExecutableFuturePlanMarkdown(plan: ExecutableFuturePlan) {
  const lines = [
    '# Executable Future Plan',
    '',
    `Repository: ${plan.repository.name}`,
    ...(plan.repository.branch ? [`Branch or ref: ${plan.repository.branch}`] : []),
    `Plan fingerprint: ${plan.fingerprint}`,
    `Source intelligence: ${plan.repository.sourceIntelligenceFingerprint}`,
    '',
    '## Objective',
    '',
    plan.objective,
    '',
    `Primary Future: ${plan.primaryFuture.title}`,
    `Supporting Futures: ${plan.supportingFutures.length ? plan.supportingFutures.map(goal => goal.title).join('; ') : 'None selected'}`,
    '',
    '## Required capabilities',
    '',
    ...numberedOrNone(plan.requiredCapabilities.map(item => `${item.title} — ${item.state}. ${item.rationale}`)),
    '',
    '## Implementation stages',
    '',
    ...plan.implementationStages.flatMap(stage => [
      `### ${String(stage.order).padStart(2, '0')} ${stage.title}`,
      '',
      `Purpose: ${stage.purpose}`,
      '',
      `Why now: ${stage.whyNow}`,
      '',
      'What changes:',
      ...bullets(stage.changes),
      '',
      'Repository areas:',
      ...bullets(stage.repositoryAreaIds.length
        ? stage.repositoryAreaIds.map(id => areaMarkdown(plan.affectedRepositoryAreas.find(area => area.id === id)!))
        : ['No additional repository area is asserted for this stage.']),
      '',
      'Completion criteria:',
      ...bullets(stage.completionCriteria),
      '',
      `Evidence references: ${stage.evidenceIds.length ? stage.evidenceIds.join(', ') : 'No additional stage-specific evidence.'}`,
      ...(stage.reviewGateIds.length ? ['', `Human-review gates: ${stage.reviewGateIds.join(', ')}`] : []),
      '',
    ]),
    '## Affected repository areas',
    '',
    ...bullets(plan.affectedRepositoryAreas.map(areaMarkdown)),
    '',
    '## Review gates',
    '',
    ...bullets(plan.reviewGates.length ? plan.reviewGates.map(gate => `${gate.title}: ${gate.reason}`) : ['No explicit human-review gate is represented by the selected intelligence.']),
    '',
    '## Risks & assumptions',
    '',
    ...bullets(plan.risks.length ? plan.risks.map(risk => risk.statement) : ['No additional grounded risk is represented by the selected intelligence.']),
    '',
    '## Verification',
    '',
    ...bullets(plan.verificationPlan.checks.map(check => `${check.title}${check.command ? ` — \`${check.command}\`` : ''}: ${check.rationale}`)),
    '',
    plan.verificationPlan.completionStatement,
    '',
    '## Evidence index',
    '',
    ...bullets(plan.evidence.map(item => `${item.id}${item.path ? ` — ${item.path}` : ''}`)),
    '',
    '## Limitations',
    '',
    ...bullets(plan.limitations.length ? plan.limitations : ['No additional limitation was declared by the selected intelligence.']),
    '',
    '> This plan is a deterministic, reviewed handoff. It does not execute an agent, mutate the repository, approve human-review gates, or provide legal advice.',
    '',
  ];
  return lines.join('\n');
}

export function renderCodexFuturePlanPrompt(plan: ExecutableFuturePlan) {
  return renderAgentPrompt(plan, 'Codex', [
    'Use repository-native inspection and editing tools.',
    'Keep changes small and reviewable, and run the listed checks after meaningful edits.',
  ]);
}

export function renderClaudeCodeFuturePlanPrompt(plan: ExecutableFuturePlan) {
  return renderAgentPrompt(plan, 'Claude Code', [
    'Read repository guidance files before editing and maintain a concise implementation checklist.',
    'Inspect related call sites before changing a shared contract.',
  ]);
}

function renderAgentPrompt(plan: ExecutableFuturePlan, target: 'Codex' | 'Claude Code', targetRules: string[]) {
  const lines = [
    `# ${target} — ShipSeal Executable Future Plan`,
    '',
    'You are implementing a ShipSeal-generated Future Plan in the repository below.',
    '',
    '## Repository',
    '',
    `- Name: ${plan.repository.name}`,
    ...(plan.repository.branch ? [`- Branch or ref: ${plan.repository.branch}`] : []),
    `- Detected stack: ${plan.repository.detectedStack}`,
    `- Plan fingerprint: ${plan.fingerprint}`,
    '',
    '## Objective',
    '',
    plan.objective,
    '',
    `- Primary Future: ${plan.primaryFuture.title}`,
    `- Supporting Futures: ${plan.supportingFutures.length ? plan.supportingFutures.map(goal => goal.title).join('; ') : 'None'}`,
    '',
    '## Required capabilities',
    '',
    ...numberedOrNone(plan.requiredCapabilities.map(item => `${item.title} (${item.state}) — ${item.rationale}`)),
    '',
    '## Implementation order',
    '',
    ...plan.implementationStages.flatMap(stage => [
      `${stage.order}. ${stage.title}`,
      `   Purpose: ${stage.purpose}`,
      `   Areas: ${stage.repositoryAreaIds.length ? stage.repositoryAreaIds.map(id => areaMarkdown(plan.affectedRepositoryAreas.find(area => area.id === id)!)).join('; ') : 'No asserted path'}`,
      `   Complete when: ${stage.completionCriteria.join(' ')}`,
      `   Evidence: ${stage.evidenceIds.length ? stage.evidenceIds.join(', ') : 'No additional stage-specific evidence'}`,
    ]),
    '',
    '## Repository evidence',
    '',
    ...bullets(plan.evidence.map(item => `${item.id}${item.path ? ` — ${item.path}` : ''}`)),
    '',
    '## Human-review gates',
    '',
    ...bullets(plan.reviewGates.length ? plan.reviewGates.map(gate => `${gate.title}: ${gate.reason}`) : ['No explicit human-review gate is represented.']),
    '',
    '## Verification',
    '',
    ...bullets(plan.verificationPlan.checks.map(check => `${check.title}${check.command ? ` — ${check.command}` : ''}: ${check.rationale}`)),
    '',
    '## Constraints and rules',
    '',
    ...bullets([...plan.agentHandoffs.sharedRules, ...targetRules]),
    '',
    'Do not begin by assuming paths or implementation details beyond this plan. Inspect the current repository, then work stage-by-stage. Stop and report if evidence contradicts the plan or a human-review gate is reached.',
    '',
  ];
  return lines.join('\n');
}

function areaMarkdown(area: ExecutableFuturePlanArea) {
  return area.kind === 'existing-repository-area'
    ? `Existing repository area: ${area.path} (${area.label})`
    : `Likely new responsibility: ${area.label} — no validated current path is asserted`;
}

function bullets(values: string[]) {
  return values.map(value => `- ${value}`);
}

function numberedOrNone(values: string[]) {
  return values.length ? values.map((value, index) => `${index + 1}. ${value}`) : ['None.'];
}

export function executableFuturePlanMarkdownFilename(plan: ExecutableFuturePlan) {
  const repository = plan.repository.name.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'repository';
  return `${repository}-future-plan-${plan.fingerprint.slice(0, 12)}.md`;
}
