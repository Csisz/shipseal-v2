import { stableContextFingerprint } from '../repositoryIntelligence/contextSelection';
import type {
  RepositoryIntelligenceArtifactVerification,
  RepositoryIntelligenceStatementVerification,
  RepositoryIntelligenceVerificationResult,
} from '../repositoryIntelligence/repositoryIntelligenceVerification';

export const REPOSITORY_VERIFICATION_RELATIONSHIP_VERSION = 'shipseal.verification-relationship.v2' as const;
export const REPOSITORY_VERIFICATION_ALGORITHM_VERSION = 'shipseal.repository-verification.omega18.4.v1' as const;
export const REPOSITORY_VERIFICATION_MEASUREMENT_VERSION = 'shipseal.repository-measurement.v1' as const;

export type RepositoryVerificationOutcome = 'pending' | 'verified' | 'partially-verified' | 'unresolved' | 'regressed' | 'incompatible';
export type ExpectedArtifactVerificationResult = 'verified' | 'partially-verified' | 'missing' | 'changed-differently' | 'unreadable' | 'incompatible' | 'regressed';
export type ExpectedStatementVerificationResult = 'confirmed' | 'partially-confirmed' | 'not-confirmed' | 'contradicted' | 'unable-to-evaluate';
export type VerificationEvidenceConfidence = 'low' | 'medium' | 'high';

export interface RepositoryMeasurementBoundary {
  scannerVersion: string;
  measurementVersion: string;
  scoringVersion: string;
  scanBoundaryFingerprint: string;
  limited: boolean;
  discoveredFiles: number;
  analyzedFiles: number;
}

export interface RepositoryVerificationScanBinding {
  ownerId: string;
  projectId: string;
  scanId: string;
  completedAt: string;
  repositoryIdentity: string;
  branch?: string;
  deterministicScanFingerprint: string;
  boundary: RepositoryMeasurementBoundary;
}

export interface ExpectedArtifactContract {
  id: string;
  path: string;
  action: 'create' | 'update' | 'strengthen';
  method: 'exact-fingerprint' | 'managed-section' | 'structural-statements' | 'path-presence';
  blocking: boolean;
  expectedFingerprint?: string;
  expectedStatementIds: string[];
  relatedNodeIds: string[];
}

export interface ExpectedStatementContract {
  id: string;
  text: string;
  method: 'deterministic-evidence' | 'path-exists' | 'script-exists' | 'config-key-exists' | 'human-review';
  blocking: boolean;
  acceptedPaths: string[];
  expectedEvidenceIds: string[];
  confidence: VerificationEvidenceConfidence;
}

export interface AppliedOperationBinding {
  id: string;
  kind: 'github-pull-request' | 'zip-export' | 'manual';
  state: 'prepared' | 'exported' | 'applied';
  preparedPlanId: string;
  preparedPlanFingerprint: string;
  branch?: string;
  pullRequestUrl?: string;
  pullRequestNumber?: number;
}

export interface DeepIntelligenceVerificationBinding {
  findingId: string;
  state: 'accepted' | 'rejected';
  requestFingerprint: string;
  sourceScanFingerprint: string;
  promptVersion: string;
  schemaVersion: string;
  contextVersion: string;
  confidence: VerificationEvidenceConfidence;
  evidenceIds: string[];
}

export interface ExpectedArtifactVerification {
  artifactId: string;
  path: string;
  action: ExpectedArtifactContract['action'];
  method: ExpectedArtifactContract['method'];
  blocking: boolean;
  result: ExpectedArtifactVerificationResult;
  evidenceIds: string[];
  expected: string;
  observed: string;
  confidence: VerificationEvidenceConfidence;
  relatedNodeIds: string[];
}

export interface ExpectedStatementVerification {
  statementId: string;
  blocking: boolean;
  result: ExpectedStatementVerificationResult;
  method: ExpectedStatementContract['method'];
  evidenceIds: string[];
  expected: string;
  observed: string;
  confidence: VerificationEvidenceConfidence;
}

export interface RepositoryGraphNodeSnapshot {
  id: string;
  path?: string;
  responsibility?: string;
  fingerprint?: string;
}

export interface RepositoryGraphEdgeSnapshot {
  source: string;
  target: string;
  relationship: string;
}

export interface RepositoryGraphFrictionSnapshot {
  id: string;
  fingerprint?: string;
}

export interface RepositoryGraphSnapshot {
  nodes: RepositoryGraphNodeSnapshot[];
  edges: RepositoryGraphEdgeSnapshot[];
  frictions: RepositoryGraphFrictionSnapshot[];
}

export interface RepositoryGraphDifference {
  version: 'shipseal.repository-graph-diff.v1';
  addedNodeIds: string[];
  removedNodeIds: string[];
  changedNodeIds: string[];
  addedRelationshipIds: string[];
  removedRelationshipIds: string[];
  changedResponsibilityNodeIds: string[];
  newArtifactPaths: string[];
  unresolvedExpectedArtifactIds: string[];
  resolvedFrictionIds: string[];
  newFrictionIds: string[];
  fingerprint: string;
}

export interface RepositoryScoreSnapshot {
  overall: number;
  categories: Record<string, number>;
  findingIds: string[];
  boundary: RepositoryMeasurementBoundary;
}

export interface RepositoryScoreComparison {
  compatible: boolean;
  reason?: string;
  overallDelta: number | null;
  categoryDeltas: Record<string, number>;
  resolvedFindingIds: string[];
  newFindingIds: string[];
  language: 'observed-after-rescan';
}

export interface RepositoryVerificationCompatibility {
  eligible: boolean;
  reasons: string[];
  repositoryCompatible: boolean;
  branchCompatible: boolean;
  scannerCompatible: boolean;
  measurementCompatible: boolean;
  evidenceSufficient: boolean;
}

export interface VerifiedOpportunitySignal {
  id: string;
  projectId: string;
  sourceVerificationId: string;
  kind: 'dependency-satisfied' | 'friction-resolved' | 'capability-added' | 'risk-detected' | 'future-unlocked';
  title: string;
  rationale: string;
  evidenceIds: string[];
  relatedArtifactIds: string[];
  confidence: VerificationEvidenceConfidence;
}

export interface RepositoryVerificationRelationship {
  version: typeof REPOSITORY_VERIFICATION_RELATIONSHIP_VERSION;
  id: string;
  ownerId: string;
  projectId: string;
  baselineScanId: string;
  laterScanId: string;
  preparedPlanId: string;
  preparedPlanFingerprint: string;
  appliedOperation?: AppliedOperationBinding;
  pullRequestUrl?: string;
  branch?: string;
  repositoryIdentity: string;
  baseRef?: string;
  scannerVersion: string;
  measurementVersion: string;
  verificationAlgorithmVersion: typeof REPOSITORY_VERIFICATION_ALGORITHM_VERSION;
  expectedArtifactIds: string[];
  expectedStatementIds: string[];
  artifacts: ExpectedArtifactVerification[];
  statements: ExpectedStatementVerification[];
  compatibility: RepositoryVerificationCompatibility;
  graphDifference: RepositoryGraphDifference;
  scoreComparison: RepositoryScoreComparison;
  deepIntelligenceBindings: DeepIntelligenceVerificationBinding[];
  result: RepositoryVerificationOutcome;
  verifiedAt?: string;
  opportunitySignals: VerifiedOpportunitySignal[];
  limitations: string[];
  fingerprint: string;
}

export interface BuildRepositoryVerificationRelationshipInput {
  baseline: RepositoryVerificationScanBinding;
  later: RepositoryVerificationScanBinding;
  preparedPlan: {
    id: string;
    fingerprint: string;
    baseRef?: string;
    artifacts: ExpectedArtifactContract[];
    statements: ExpectedStatementContract[];
  };
  appliedOperation?: AppliedOperationBinding;
  artifactResults?: ExpectedArtifactVerification[];
  statementResults?: ExpectedStatementVerification[];
  intelligenceResult?: RepositoryIntelligenceVerificationResult;
  baselineGraph: RepositoryGraphSnapshot;
  laterGraph: RepositoryGraphSnapshot;
  baselineScore: RepositoryScoreSnapshot;
  laterScore: RepositoryScoreSnapshot;
  deepIntelligenceBindings?: DeepIntelligenceVerificationBinding[];
  compatibleBranches?: string[];
  now?: string;
}

export function evaluateRepositoryVerificationCompatibility(input: {
  baseline: RepositoryVerificationScanBinding;
  later: RepositoryVerificationScanBinding;
  preparedPlanId: string;
  appliedOperation?: AppliedOperationBinding;
  compatibleBranches?: string[];
}): RepositoryVerificationCompatibility {
  const reasons: string[] = [];
  const sameOwner = input.baseline.ownerId === input.later.ownerId;
  const sameProject = input.baseline.projectId === input.later.projectId;
  if (!sameOwner) reasons.push('The baseline and later scan belong to different users.');
  if (!sameProject) reasons.push('The baseline and later scan belong to different projects.');
  const repositoryCompatible = input.baseline.repositoryIdentity.toLowerCase() === input.later.repositoryIdentity.toLowerCase();
  if (!repositoryCompatible) reasons.push('The later scan repository identity differs from the baseline.');
  const acceptedBranches = new Set([
    input.baseline.branch,
    input.preparedPlanId === input.appliedOperation?.preparedPlanId ? input.appliedOperation?.branch : undefined,
    ...(input.compatibleBranches || []),
  ].filter((value): value is string => Boolean(value)));
  const branchCompatible = !input.baseline.branch || !input.later.branch || acceptedBranches.has(input.later.branch);
  if (!branchCompatible) reasons.push('The later scan branch is outside the baseline, applied branch, and explicitly compatible branches.');
  const scannerCompatible = input.baseline.boundary.scannerVersion === input.later.boundary.scannerVersion;
  if (!scannerCompatible) reasons.push('Scanner versions are incompatible for this verification algorithm.');
  const measurementCompatible = measurementBoundariesCompatible(input.baseline.boundary, input.later.boundary);
  if (!measurementCompatible) reasons.push('Measurement or scoring boundaries are incompatible.');
  const laterTimestamp = Date.parse(input.later.completedAt);
  const baselineTimestamp = Date.parse(input.baseline.completedAt);
  if (!Number.isFinite(laterTimestamp) || !Number.isFinite(baselineTimestamp) || laterTimestamp <= baselineTimestamp) reasons.push('The later scan must complete after the baseline scan.');
  if (input.appliedOperation && input.appliedOperation.preparedPlanId !== input.preparedPlanId) reasons.push('The applied operation belongs to a different prepared plan.');
  const evidenceSufficient = !input.later.boundary.limited && input.later.boundary.analyzedFiles > 0;
  if (!evidenceSufficient) reasons.push('The later scan is limited or contains insufficient analyzed evidence.');
  return {
    eligible: sameOwner && sameProject && repositoryCompatible && branchCompatible && scannerCompatible
      && Number.isFinite(laterTimestamp) && Number.isFinite(baselineTimestamp) && laterTimestamp > baselineTimestamp
      && (!input.appliedOperation || input.appliedOperation.preparedPlanId === input.preparedPlanId) && evidenceSufficient,
    reasons,
    repositoryCompatible,
    branchCompatible,
    scannerCompatible,
    measurementCompatible,
    evidenceSufficient,
  };
}

export function buildRepositoryGraphDifference(
  baseline: RepositoryGraphSnapshot,
  later: RepositoryGraphSnapshot,
  artifacts: ExpectedArtifactVerification[] = [],
): RepositoryGraphDifference {
  const baselineNodes = uniqueBy(baseline.nodes, item => item.id);
  const laterNodes = uniqueBy(later.nodes, item => item.id);
  const baselineById = new Map(baselineNodes.map(node => [node.id, node]));
  const laterById = new Map(laterNodes.map(node => [node.id, node]));
  const addedNodeIds = sorted(laterNodes.filter(node => !baselineById.has(node.id)).map(node => node.id));
  const removedNodeIds = sorted(baselineNodes.filter(node => !laterById.has(node.id)).map(node => node.id));
  const changedNodeIds = sorted(laterNodes.filter(node => {
    const before = baselineById.get(node.id);
    return before && stableContextFingerprint(before) !== stableContextFingerprint(node);
  }).map(node => node.id));
  const changedResponsibilityNodeIds = sorted(laterNodes.filter(node => {
    const before = baselineById.get(node.id);
    return before && (before.responsibility || '') !== (node.responsibility || '');
  }).map(node => node.id));
  const edgeIdentity = (edge: RepositoryGraphEdgeSnapshot) => `${edge.source}->${edge.target}:${edge.relationship}`;
  const baselineEdges = new Set(baseline.edges.map(edgeIdentity));
  const laterEdges = new Set(later.edges.map(edgeIdentity));
  const baselineFrictions = new Set(baseline.frictions.map(item => item.id));
  const laterFrictions = new Set(later.frictions.map(item => item.id));
  const core = {
    version: 'shipseal.repository-graph-diff.v1' as const,
    addedNodeIds,
    removedNodeIds,
    changedNodeIds,
    addedRelationshipIds: sorted([...laterEdges].filter(id => !baselineEdges.has(id))),
    removedRelationshipIds: sorted([...baselineEdges].filter(id => !laterEdges.has(id))),
    changedResponsibilityNodeIds,
    newArtifactPaths: sorted(artifacts.filter(item => item.action === 'create' && item.result === 'verified').map(item => item.path)),
    unresolvedExpectedArtifactIds: sorted(artifacts.filter(item => !['verified', 'partially-verified'].includes(item.result)).map(item => item.artifactId)),
    resolvedFrictionIds: sorted([...baselineFrictions].filter(id => !laterFrictions.has(id))),
    newFrictionIds: sorted([...laterFrictions].filter(id => !baselineFrictions.has(id))),
  };
  return { ...core, fingerprint: stableContextFingerprint(core) };
}

export function compareRepositoryScores(baseline: RepositoryScoreSnapshot, later: RepositoryScoreSnapshot): RepositoryScoreComparison {
  if (!measurementBoundariesCompatible(baseline.boundary, later.boundary)) {
    return { compatible: false, reason: 'Direct score comparison is unavailable because the measurement boundary changed.', overallDelta: null, categoryDeltas: {}, resolvedFindingIds: [], newFindingIds: [], language: 'observed-after-rescan' };
  }
  const categoryDeltas: Record<string, number> = {};
  for (const category of sorted([...new Set([...Object.keys(baseline.categories), ...Object.keys(later.categories)])])) {
    if (baseline.categories[category] === undefined || later.categories[category] === undefined) continue;
    categoryDeltas[category] = later.categories[category] - baseline.categories[category];
  }
  const baselineFindings = new Set(baseline.findingIds);
  const laterFindings = new Set(later.findingIds);
  return {
    compatible: true,
    overallDelta: later.overall - baseline.overall,
    categoryDeltas,
    resolvedFindingIds: sorted([...baselineFindings].filter(id => !laterFindings.has(id))),
    newFindingIds: sorted([...laterFindings].filter(id => !baselineFindings.has(id))),
    language: 'observed-after-rescan',
  };
}

export function mapRepositoryIntelligenceArtifactResults(
  contracts: ExpectedArtifactContract[],
  results: RepositoryIntelligenceArtifactVerification[],
): ExpectedArtifactVerification[] {
  const byId = new Map(results.map(result => [result.artifactId, result]));
  return contracts.map(contract => {
    const observed = byId.get(contract.id);
    if (!observed) return artifactResult(contract, 'unreadable', [], 'No later-scan artifact result was available.', 'low');
    const result: ExpectedArtifactVerificationResult = ({
      'verified-exact': 'verified',
      'verified-strengthened': 'verified',
      'verified-present-with-modifications': 'partially-verified',
      'partially-verified': 'partially-verified',
      missing: contract.action === 'create' ? 'missing' : 'regressed',
      conflicting: 'changed-differently',
      stale: 'regressed',
      unavailable: 'unreadable',
      'not-applicable': 'incompatible',
      'requires-human-review': 'partially-verified',
    } as const)[observed.state];
    const evidenceIds = sorted(observed.statementResults.flatMap(statement => statement.resolvedEvidenceIds));
    return artifactResult(contract, result, evidenceIds, `${observed.state}; ${observed.nextAction}`, observed.confidence);
  });
}

export function mapRepositoryIntelligenceStatementResults(
  contracts: ExpectedStatementContract[],
  results: RepositoryIntelligenceStatementVerification[],
): ExpectedStatementVerification[] {
  const byId = new Map(results.map(result => [result.statementId, result]));
  return contracts.map(contract => {
    const observed = byId.get(contract.id);
    if (!observed) return statementResult(contract, 'unable-to-evaluate', [], 'No later-scan statement result was available.');
    const result: ExpectedStatementVerificationResult = ({
      'verified-by-current-deterministic-evidence': 'confirmed',
      'present-in-artifact-only': 'partially-confirmed',
      'still-inferred': 'partially-confirmed',
      contradicted: 'contradicted',
      'evidence-missing': 'not-confirmed',
      unavailable: 'unable-to-evaluate',
      'requires-human-review': 'unable-to-evaluate',
    } as const)[observed.state];
    return statementResult(contract, result, observed.resolvedEvidenceIds, `${observed.state}; ${observed.nextAction}`);
  });
}

export function validateDeepIntelligenceBindings(
  bindings: DeepIntelligenceVerificationBinding[],
  baselineScanFingerprint: string,
): { accepted: DeepIntelligenceVerificationBinding[]; limitations: string[] } {
  const limitations: string[] = [];
  const accepted = bindings.filter(binding => {
    if (binding.state !== 'accepted') { limitations.push(`Deep Intelligence finding ${binding.findingId} was rejected and cannot become a verification expectation.`); return false; }
    if (binding.sourceScanFingerprint !== baselineScanFingerprint) { limitations.push(`Deep Intelligence finding ${binding.findingId} is stale for this baseline scan.`); return false; }
    if (!binding.requestFingerprint || !binding.promptVersion || !binding.schemaVersion || !binding.contextVersion || !binding.evidenceIds.length) {
      limitations.push(`Deep Intelligence finding ${binding.findingId} lacks the required identity or evidence versions.`); return false;
    }
    return true;
  });
  return { accepted: uniqueBy(accepted, item => item.findingId), limitations: sorted(limitations) };
}

export function synthesizeRepositoryVerificationResult(input: {
  compatibility: RepositoryVerificationCompatibility;
  artifacts: ExpectedArtifactVerification[];
  statements: ExpectedStatementVerification[];
  appliedOperation?: AppliedOperationBinding;
}): RepositoryVerificationOutcome {
  if (!input.compatibility.eligible) return 'incompatible';
  if (!input.appliedOperation || input.appliedOperation.state !== 'applied') return 'pending';
  const blockingArtifacts = input.artifacts.filter(item => item.blocking);
  const blockingStatements = input.statements.filter(item => item.blocking);
  if (blockingArtifacts.some(item => item.result === 'regressed' || item.result === 'changed-differently')
    || blockingStatements.some(item => item.result === 'contradicted')) return 'regressed';
  if (blockingArtifacts.some(item => ['missing', 'unreadable', 'incompatible'].includes(item.result))
    || blockingStatements.some(item => ['not-confirmed', 'unable-to-evaluate'].includes(item.result))) return 'unresolved';
  const allBlockingVerified = blockingArtifacts.every(item => item.result === 'verified')
    && blockingStatements.every(item => item.result === 'confirmed');
  const hasPartial = input.artifacts.some(item => item.result === 'partially-verified')
    || input.statements.some(item => item.result === 'partially-confirmed');
  if (allBlockingVerified && !hasPartial) return 'verified';
  if (input.artifacts.some(item => ['verified', 'partially-verified'].includes(item.result))
    || input.statements.some(item => ['confirmed', 'partially-confirmed'].includes(item.result))) return 'partially-verified';
  return 'unresolved';
}

export function buildRepositoryVerificationRelationship(input: BuildRepositoryVerificationRelationshipInput): RepositoryVerificationRelationship {
  const compatibility = evaluateRepositoryVerificationCompatibility({
    baseline: input.baseline,
    later: input.later,
    preparedPlanId: input.preparedPlan.id,
    appliedOperation: input.appliedOperation,
    compatibleBranches: input.compatibleBranches,
  });
  const intelligenceArtifacts = input.intelligenceResult?.artifacts || [];
  const intelligenceStatements = intelligenceArtifacts.flatMap(artifact => artifact.statementResults);
  const artifacts = input.artifactResults || mapRepositoryIntelligenceArtifactResults(input.preparedPlan.artifacts, intelligenceArtifacts);
  const statements = input.statementResults || mapRepositoryIntelligenceStatementResults(input.preparedPlan.statements, intelligenceStatements);
  const graphDifference = buildRepositoryGraphDifference(input.baselineGraph, input.laterGraph, artifacts);
  const scoreComparison = compareRepositoryScores(input.baselineScore, input.laterScore);
  const deep = validateDeepIntelligenceBindings(input.deepIntelligenceBindings || [], input.baseline.deterministicScanFingerprint);
  const result = synthesizeRepositoryVerificationResult({ compatibility, artifacts, statements, appliedOperation: input.appliedOperation });
  const verifiedAt = ['verified', 'partially-verified', 'unresolved', 'regressed'].includes(result) ? input.now || new Date().toISOString() : undefined;
  const identitySeed = {
    ownerId: input.baseline.ownerId,
    projectId: input.baseline.projectId,
    baselineScanId: input.baseline.scanId,
    laterScanId: input.later.scanId,
    preparedPlanId: input.preparedPlan.id,
    appliedOperationId: input.appliedOperation?.id,
    algorithmVersion: REPOSITORY_VERIFICATION_ALGORITHM_VERSION,
  };
  const id = `repository-verification:${stableContextFingerprint(identitySeed)}`;
  const limitations = sorted([...compatibility.reasons, ...deep.limitations, ...(scoreComparison.reason ? [scoreComparison.reason] : [])]);
  const withoutSignals = {
    version: REPOSITORY_VERIFICATION_RELATIONSHIP_VERSION,
    id,
    ownerId: input.baseline.ownerId,
    projectId: input.baseline.projectId,
    baselineScanId: input.baseline.scanId,
    laterScanId: input.later.scanId,
    preparedPlanId: input.preparedPlan.id,
    preparedPlanFingerprint: input.preparedPlan.fingerprint,
    appliedOperation: input.appliedOperation,
    pullRequestUrl: input.appliedOperation?.pullRequestUrl,
    branch: input.later.branch,
    repositoryIdentity: input.baseline.repositoryIdentity,
    baseRef: input.preparedPlan.baseRef,
    scannerVersion: input.later.boundary.scannerVersion,
    measurementVersion: input.later.boundary.measurementVersion,
    verificationAlgorithmVersion: REPOSITORY_VERIFICATION_ALGORITHM_VERSION,
    expectedArtifactIds: sorted(input.preparedPlan.artifacts.map(item => item.id)),
    expectedStatementIds: sorted(input.preparedPlan.statements.map(item => item.id)),
    artifacts: [...artifacts].sort((a, b) => a.artifactId.localeCompare(b.artifactId)),
    statements: [...statements].sort((a, b) => a.statementId.localeCompare(b.statementId)),
    compatibility,
    graphDifference,
    scoreComparison,
    deepIntelligenceBindings: deep.accepted,
    result,
    verifiedAt,
    limitations,
  };
  const opportunitySignals = deriveVerifiedOpportunitySignals({ relationshipId: id, projectId: input.baseline.projectId, result, artifacts, graphDifference, scoreComparison });
  const core = { ...withoutSignals, opportunitySignals };
  return { ...core, fingerprint: stableContextFingerprint(core) };
}

export function deriveVerifiedOpportunitySignals(input: {
  relationshipId: string;
  projectId: string;
  result: RepositoryVerificationOutcome;
  artifacts: ExpectedArtifactVerification[];
  graphDifference: RepositoryGraphDifference;
  scoreComparison: RepositoryScoreComparison;
}): VerifiedOpportunitySignal[] {
  if (!['verified', 'partially-verified', 'regressed'].includes(input.result)) return [];
  const signals: Omit<VerifiedOpportunitySignal, 'id'>[] = [];
  for (const frictionId of input.graphDifference.resolvedFrictionIds) signals.push({ projectId: input.projectId, sourceVerificationId: input.relationshipId, kind: 'friction-resolved', title: 'Repository friction resolved', rationale: `Later-scan graph evidence no longer contains ${frictionId}.`, evidenceIds: [input.graphDifference.fingerprint, frictionId], relatedArtifactIds: [], confidence: 'high' });
  const verifiedCreates = input.artifacts.filter(item => item.action === 'create' && item.result === 'verified');
  for (const artifact of verifiedCreates) signals.push({ projectId: input.projectId, sourceVerificationId: input.relationshipId, kind: 'capability-added', title: `Capability artifact added: ${artifact.path}`, rationale: 'The expected create artifact was absent in the baseline and verified in the later scan.', evidenceIds: [...artifact.evidenceIds], relatedArtifactIds: [artifact.artifactId], confidence: artifact.confidence });
  if (input.graphDifference.newFrictionIds.length || input.scoreComparison.newFindingIds.length) signals.push({ projectId: input.projectId, sourceVerificationId: input.relationshipId, kind: 'risk-detected', title: 'New repository risk detected', rationale: 'The later scan contains new bounded friction or finding identities.', evidenceIds: sorted([...input.graphDifference.newFrictionIds, ...input.scoreComparison.newFindingIds]), relatedArtifactIds: [], confidence: 'high' });
  if (verifiedCreates.length && input.graphDifference.resolvedFrictionIds.length) signals.push({ projectId: input.projectId, sourceVerificationId: input.relationshipId, kind: 'future-unlocked', title: 'Verified change may unlock a later pathway', rationale: 'A planned capability is verified and a prior friction is resolved.', evidenceIds: sorted([input.graphDifference.fingerprint, ...verifiedCreates.flatMap(item => item.evidenceIds)]), relatedArtifactIds: sorted(verifiedCreates.map(item => item.artifactId)), confidence: 'medium' });
  return uniqueBy(signals.filter(signal => signal.evidenceIds.length > 0), signal => `${signal.kind}:${signal.title}`)
    .map(signal => ({ id: `verified-opportunity:${stableContextFingerprint(signal)}`, ...signal }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function repositoryVerificationOverlayStates(relationship: RepositoryVerificationRelationship) {
  const states: Record<string, 'verified-change' | 'partially-verified' | 'unresolved' | 'regressed' | 'newly-detected' | 'unchanged'> = {};
  for (const artifact of relationship.artifacts) {
    const state = artifact.result === 'verified' ? 'verified-change'
      : artifact.result === 'partially-verified' ? 'partially-verified'
        : artifact.result === 'regressed' || artifact.result === 'changed-differently' ? 'regressed'
          : 'unresolved';
    for (const nodeId of artifact.relatedNodeIds) states[nodeId] = state;
  }
  for (const nodeId of relationship.graphDifference.addedNodeIds) if (!states[nodeId]) states[nodeId] = 'newly-detected';
  return states;
}

export function repositoryVerificationOutcomeForIntelligenceResult(result?: RepositoryIntelligenceVerificationResult | null): RepositoryVerificationOutcome | null {
  if (!result) return null;
  if (!['verified-compatible', 'compatible-lineage-limited'].includes(result.identity.state)) return 'incompatible';
  if (result.artifacts.some(artifact => ['conflicting', 'stale'].includes(artifact.state)) || result.statementCounts.contradicted > 0) return 'regressed';
  if (result.overallState === 'fully-verified') return 'verified';
  if (result.artifacts.some(artifact => ['partially-verified', 'verified-present-with-modifications', 'requires-human-review'].includes(artifact.state))) return 'partially-verified';
  const confirmed = result.counts['verified-exact'] + result.counts['verified-strengthened'] + result.counts['verified-present-with-modifications'];
  if (confirmed > 0) return 'partially-verified';
  if (result.artifacts.some(artifact => ['missing', 'unavailable'].includes(artifact.state))) return 'unresolved';
  return result.overallState === 'unavailable' ? 'incompatible' : 'unresolved';
}

function artifactResult(contract: ExpectedArtifactContract, result: ExpectedArtifactVerificationResult, evidenceIds: string[], observed: string, confidence: VerificationEvidenceConfidence): ExpectedArtifactVerification {
  return { artifactId: contract.id, path: contract.path, action: contract.action, method: contract.method, blocking: contract.blocking, result, evidenceIds: sorted(evidenceIds), expected: `${contract.action} ${contract.path} using ${contract.method}`, observed, confidence, relatedNodeIds: sorted(contract.relatedNodeIds) };
}

function statementResult(contract: ExpectedStatementContract, result: ExpectedStatementVerificationResult, evidenceIds: string[], observed: string): ExpectedStatementVerification {
  return { statementId: contract.id, blocking: contract.blocking, result, method: contract.method, evidenceIds: sorted(evidenceIds), expected: contract.text, observed, confidence: contract.confidence };
}

function measurementBoundariesCompatible(baseline: RepositoryMeasurementBoundary, later: RepositoryMeasurementBoundary) {
  return !baseline.limited && !later.limited
    && baseline.scannerVersion === later.scannerVersion
    && baseline.measurementVersion === later.measurementVersion
    && baseline.scoringVersion === later.scoringVersion
    && baseline.scanBoundaryFingerprint === later.scanBoundaryFingerprint;
}

function uniqueBy<T>(values: T[], identity: (value: T) => string) {
  return [...new Map(values.map(value => [identity(value), value])).values()];
}

function sorted(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}
