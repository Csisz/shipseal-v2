import type { RepoFileSummary, RepoScanInput } from '../types';
import { normalizeZipPath } from '../scannerLimits';
import type { RepositoryIntelligenceArtifactCategory } from './artifactSchema';
import { stableContextFingerprint } from './contextSelection';
import type { RepositoryIntelligenceEvidenceModel } from './evidence';
import { buildRepositoryIntelligenceEvidence } from './repositoryResponsibilities';
import {
  REPOSITORY_INTELLIGENCE_APPLY_SCHEMA_VERSION,
  REPOSITORY_INTELLIGENCE_MANAGED_SECTION_END,
  REPOSITORY_INTELLIGENCE_MANAGED_SECTION_START,
} from './repositoryIntelligenceApply';
import type { RepositoryIntelligenceReviewStatementProvenance } from './repositoryIntelligenceReview';

export const REPOSITORY_INTELLIGENCE_VERIFICATION_BASELINE_VERSION = 'shipseal.repository-intelligence-verification-baseline.v1' as const;
export const REPOSITORY_INTELLIGENCE_VERIFICATION_RESULT_VERSION = 'shipseal.repository-intelligence-verification-result.v1' as const;
export const REPOSITORY_INTELLIGENCE_VERIFICATION_POLICY_VERSION = 'shipseal.repository-intelligence-verification-policy.v1' as const;
export const REPOSITORY_INTELLIGENCE_PATH_POLICY_VERSION = 'shipseal.repository-path-policy.v1' as const;

export type RepositoryIntelligenceVerificationScope = 'artifact-set' | 'artifact' | 'managed-section' | 'structured-statement' | 'referenced-path' | 'referenced-evidence' | 'operation-result' | 'repository-or-scan-identity';
export type RepositoryIntelligenceArtifactVerificationState = 'verified-exact' | 'verified-present-with-modifications' | 'verified-strengthened' | 'partially-verified' | 'missing' | 'conflicting' | 'stale' | 'unavailable' | 'not-applicable' | 'requires-human-review';
export type RepositoryIntelligenceStatementVerificationState = 'verified-by-current-deterministic-evidence' | 'present-in-artifact-only' | 'still-inferred' | 'contradicted' | 'evidence-missing' | 'unavailable' | 'requires-human-review';
export type RepositoryIntelligenceOverallVerificationState = 'fully-verified' | 'partially-verified' | 'changes-detected' | 'verification-blocked' | 'unavailable';
export type RepositoryIntelligenceVerificationLifecycleState = 'baseline-created-after-pr' | 'awaiting-repository-change' | 'current-branch-does-not-contain-changes' | 'eligible-for-verification' | 'verified' | 'repository-changed-after-verification' | 'stale-baseline' | 'incompatible-baseline' | 'verification-unavailable';
export type RepositoryIntelligenceIdentityState = 'verified-compatible' | 'compatible-lineage-limited' | 'repository-mismatch' | 'branch-mismatch' | 'source-incompatible' | 'unavailable';
export type RepositoryIntelligencePreservationState = 'not-applicable' | 'preserved-exact' | 'preserved-with-additions' | 'changed-unproven' | 'content-loss-detected' | 'unavailable';

export interface RepositoryIntelligenceVerificationBaselineArtifact {
  artifactId: string;
  category: RepositoryIntelligenceArtifactCategory;
  artifactFingerprint: string;
  targetPath: string;
  operation: 'create' | 'update' | 'strengthen';
  finalContentFingerprint: string;
  expectedManagedSectionFingerprint?: string;
  expectedPreservationFingerprint?: string;
  preservedLineFingerprints: string[];
  humanReviewRequired: boolean;
  statements: RepositoryIntelligenceReviewStatementProvenance[];
}

export interface RepositoryIntelligenceVerificationBaseline {
  schemaVersion: typeof REPOSITORY_INTELLIGENCE_VERIFICATION_BASELINE_VERSION;
  applySchemaVersion: typeof REPOSITORY_INTELLIGENCE_APPLY_SCHEMA_VERSION;
  pathPolicyVersion: typeof REPOSITORY_INTELLIGENCE_PATH_POLICY_VERSION;
  repository: { owner: string; repo: string };
  baseBranch: string;
  prBranch: string;
  selectedPlanFingerprint: string;
  artifacts: RepositoryIntelligenceVerificationBaselineArtifact[];
  prUrl: string;
  prNumber?: number;
}

export interface RepositoryIntelligenceVerificationPolicy {
  version: typeof REPOSITORY_INTELLIGENCE_VERIFICATION_POLICY_VERSION;
  maximumArtifacts: number;
  maximumStatements: number;
  maximumProvenanceReferences: number;
  maximumLimitations: number;
  maximumOpenWorkItems: number;
  maximumReadableContentCharacters: number;
  maximumPreservedLineFingerprints: number;
  acceptedBaselineVersions: Array<typeof REPOSITORY_INTELLIGENCE_VERIFICATION_BASELINE_VERSION>;
  acceptedMarkerVersions: ['shipseal:repository-intelligence:v1'];
  exactMatchRequiredForExactState: true;
  modificationClassification: 'structural-and-fingerprint';
  preservationComparisonMode: 'ordered-original-line-fingerprints';
}

export type RepositoryIntelligenceVerificationPolicyOverride = Partial<Omit<RepositoryIntelligenceVerificationPolicy, 'version' | 'acceptedBaselineVersions' | 'acceptedMarkerVersions' | 'exactMatchRequiredForExactState' | 'modificationClassification' | 'preservationComparisonMode'>>;

export const DEFAULT_REPOSITORY_INTELLIGENCE_VERIFICATION_POLICY: RepositoryIntelligenceVerificationPolicy = Object.freeze({
  version: REPOSITORY_INTELLIGENCE_VERIFICATION_POLICY_VERSION,
  maximumArtifacts: 20,
  maximumStatements: 1_200,
  maximumProvenanceReferences: 4_000,
  maximumLimitations: 200,
  maximumOpenWorkItems: 100,
  maximumReadableContentCharacters: 300 * 1024,
  maximumPreservedLineFingerprints: 500,
  acceptedBaselineVersions: [REPOSITORY_INTELLIGENCE_VERIFICATION_BASELINE_VERSION],
  acceptedMarkerVersions: ['shipseal:repository-intelligence:v1'] as ['shipseal:repository-intelligence:v1'],
  exactMatchRequiredForExactState: true,
  modificationClassification: 'structural-and-fingerprint',
  preservationComparisonMode: 'ordered-original-line-fingerprints',
});

export interface RepositoryIntelligenceBaselineValidationIssue {
  code: 'unsupported-version' | 'invalid-identity' | 'invalid-fingerprint' | 'unsafe-path' | 'duplicate-artifact' | 'invalid-operation-state' | 'limit-exceeded' | 'invalid-statement';
  message: string;
  artifactId?: string;
}

export interface RepositoryIntelligenceStatementVerification {
  id: string;
  statementId: string;
  artifactId: string;
  statementType: RepositoryIntelligenceReviewStatementProvenance['statementType'];
  state: RepositoryIntelligenceStatementVerificationState;
  referencedPaths: string[];
  resolvedEvidenceIds: string[];
  missingEvidenceIds: string[];
  limitations: string[];
  nextAction: string;
}

export interface RepositoryIntelligenceArtifactVerification {
  id: string;
  artifactId: string;
  targetPath: string;
  operation: RepositoryIntelligenceVerificationBaselineArtifact['operation'];
  category: RepositoryIntelligenceArtifactCategory;
  baselineArtifactFingerprint: string;
  expectedAppliedContentFingerprint: string;
  currentContentFingerprint?: string;
  expectedManagedSectionFingerprint?: string;
  currentManagedSectionFingerprint?: string;
  preservationState: RepositoryIntelligencePreservationState;
  state: RepositoryIntelligenceArtifactVerificationState;
  confidence: 'high' | 'medium' | 'low';
  identityState: RepositoryIntelligenceIdentityState;
  statementResults: RepositoryIntelligenceStatementVerification[];
  verifiedStatementCount: number;
  unresolvedStatementCount: number;
  evidenceCoverage: { referenced: number; resolved: number; missing: number };
  humanReviewRequired: boolean;
  limitations: string[];
  nextAction: string;
}

export interface RepositoryIntelligenceVerificationOpenWorkItem {
  id: string;
  artifactId?: string;
  path?: string;
  reason: string;
  evidence: string[];
  priority: 'critical' | 'high' | 'medium' | 'low';
  nextAction: string;
  actionType: 'regenerate' | 'rescan' | 'human-review';
}

export interface RepositoryIntelligenceVerificationQualityEvaluation {
  dimensions: Array<{
    dimension: 'artifact-presence' | 'provenance-integrity' | 'evidence-freshness' | 'handwritten-preservation' | 'command-accuracy' | 'path-accuracy' | 'responsibility-coverage' | 'limitation-visibility' | 'review-completeness';
    state: 'verified' | 'partial' | 'conflicting' | 'unavailable' | 'not-applicable';
    verified: number;
    unresolved: number;
  }>;
}

export interface RepositoryIntelligenceVerificationResult {
  version: typeof REPOSITORY_INTELLIGENCE_VERIFICATION_RESULT_VERSION;
  baselineFingerprint: string;
  currentScanFingerprint: string;
  identity: { state: RepositoryIntelligenceIdentityState; repositoryMatches: boolean; branchCompatible: boolean; reasons: string[] };
  lifecycle: RepositoryIntelligenceVerificationLifecycleState;
  overallState: RepositoryIntelligenceOverallVerificationState;
  artifacts: RepositoryIntelligenceArtifactVerification[];
  counts: Record<RepositoryIntelligenceArtifactVerificationState, number>;
  statementCounts: Record<RepositoryIntelligenceStatementVerificationState, number>;
  quality: RepositoryIntelligenceVerificationQualityEvaluation;
  comparison: {
    exactArtifacts: number; modifiedArtifacts: number; missingArtifacts: number; conflictingArtifacts: number; unavailableArtifacts: number;
    newlyCorroboratedStatements: number; inferredStatements: number; contradictedStatements: number; humanReviewItemsOpen: number;
  };
  openWork: RepositoryIntelligenceVerificationOpenWorkItem[];
  limitations: string[];
  fingerprint: string;
}

export function resolveRepositoryIntelligenceVerificationPolicy(override: RepositoryIntelligenceVerificationPolicyOverride = {}): RepositoryIntelligenceVerificationPolicy {
  const policy = { ...DEFAULT_REPOSITORY_INTELLIGENCE_VERIFICATION_POLICY, ...override };
  for (const field of ['maximumArtifacts', 'maximumStatements', 'maximumProvenanceReferences', 'maximumLimitations', 'maximumOpenWorkItems', 'maximumReadableContentCharacters', 'maximumPreservedLineFingerprints'] as const) {
    if (!Number.isSafeInteger(policy[field]) || policy[field] < 1) throw new Error(`Invalid Repository Intelligence verification policy value: ${field}`);
  }
  return policy;
}

export function validateRepositoryIntelligenceVerificationBaseline(input: unknown, policyOverride: RepositoryIntelligenceVerificationPolicyOverride = {}) {
  const policy = resolveRepositoryIntelligenceVerificationPolicy(policyOverride);
  const issues: RepositoryIntelligenceBaselineValidationIssue[] = [];
  const add = (code: RepositoryIntelligenceBaselineValidationIssue['code'], message: string, artifactId?: string) => issues.push({ code, message, artifactId });
  if (!record(input)) return { valid: false, issues: [{ code: 'unsupported-version' as const, message: 'Verification baseline must be an object.' }] };
  const baseline = input as unknown as RepositoryIntelligenceVerificationBaseline;
  if (!policy.acceptedBaselineVersions.includes(baseline.schemaVersion)) add('unsupported-version', 'Repository Intelligence verification baseline version is unsupported.');
  if (baseline.applySchemaVersion !== REPOSITORY_INTELLIGENCE_APPLY_SCHEMA_VERSION || baseline.pathPolicyVersion !== REPOSITORY_INTELLIGENCE_PATH_POLICY_VERSION) add('unsupported-version', 'Apply or repository-path compatibility version is unsupported.');
  if (!safeRepoPart(baseline.repository?.owner) || !safeRepoPart(baseline.repository?.repo) || !safeBranch(baseline.baseBranch) || !safeBranch(baseline.prBranch)) add('invalid-identity', 'Baseline repository or branch identity is invalid.');
  if (!fingerprint(baseline.selectedPlanFingerprint)) add('invalid-fingerprint', 'Selected-plan fingerprint is malformed.');
  if (!Array.isArray(baseline.artifacts) || baseline.artifacts.length === 0 || baseline.artifacts.length > policy.maximumArtifacts) add('limit-exceeded', 'Baseline artifact count is empty or exceeds the verification limit.');
  const identities = new Map<string, string>(); let statements = 0; let references = 0;
  for (const artifact of Array.isArray(baseline.artifacts) ? baseline.artifacts : []) {
    const path = normalizeZipPath(artifact.targetPath);
    if (!path || path !== artifact.targetPath) add('unsafe-path', 'Baseline contains an unsafe target path.', artifact.artifactId);
    if (!fingerprint(artifact.artifactFingerprint) || !fingerprint(artifact.finalContentFingerprint)) add('invalid-fingerprint', 'Artifact fingerprints are missing or malformed.', artifact.artifactId);
    const prior = identities.get(artifact.artifactId);
    if (prior && prior !== `${path}:${artifact.finalContentFingerprint}`) add('duplicate-artifact', 'Duplicate artifact identity has conflicting target data.', artifact.artifactId);
    identities.set(artifact.artifactId, `${path}:${artifact.finalContentFingerprint}`);
    if (!['create', 'update', 'strengthen'].includes(artifact.operation)) add('invalid-operation-state', 'Artifact operation is invalid.', artifact.artifactId);
    if (artifact.operation === 'strengthen' && (!fingerprint(artifact.expectedManagedSectionFingerprint) || !fingerprint(artifact.expectedPreservationFingerprint))) add('invalid-operation-state', 'Strengthen baseline requires managed-section and preservation fingerprints.', artifact.artifactId);
    if (!Array.isArray(artifact.statements) || !Array.isArray(artifact.preservedLineFingerprints)) add('invalid-statement', 'Artifact statement or preservation metadata is invalid.', artifact.artifactId);
    statements += artifact.statements?.length || 0;
    references += artifact.statements?.reduce((sum, item) => sum + item.evidenceIds.length + item.findingIds.length + item.referencedPaths.length, 0) || 0;
    if ((artifact.preservedLineFingerprints?.length || 0) > policy.maximumPreservedLineFingerprints) add('limit-exceeded', 'Preservation fingerprint limit exceeded.', artifact.artifactId);
  }
  if (statements > policy.maximumStatements || references > policy.maximumProvenanceReferences) add('limit-exceeded', 'Baseline statement or provenance limits were exceeded.');
  return { valid: issues.length === 0, issues, baseline: issues.length ? undefined : cloneBaseline(baseline) };
}

export function verifyRepositoryIntelligenceArtifacts(input: {
  baseline: unknown;
  currentScan: RepoScanInput;
  currentEvidence?: RepositoryIntelligenceEvidenceModel;
  explicitlyCompatibleBranches?: string[];
  policy?: RepositoryIntelligenceVerificationPolicyOverride;
}): RepositoryIntelligenceVerificationResult {
  const policy = resolveRepositoryIntelligenceVerificationPolicy(input.policy);
  const validated = validateRepositoryIntelligenceVerificationBaseline(input.baseline, policy);
  if (!validated.valid || !validated.baseline) return unavailableResult(input.currentScan, validated.issues.map(issue => issue.message));
  const baseline = validated.baseline;
  const evidence = input.currentEvidence || buildRepositoryIntelligenceEvidence(input.currentScan);
  const identity = compareIdentity(baseline, input.currentScan, input.explicitlyCompatibleBranches || []);
  const scanLimited = Boolean(input.currentScan.scanSummary?.limited || input.currentScan.scanSummary?.scanMode === 'limited-fallback');
  const fileIndex = buildFileIndex(input.currentScan);
  const evidenceById = new Map(evidence.evidence.map(item => [item.id, item]));
  const pathSet = new Set(fileIndex.keys());
  const artifacts = [...baseline.artifacts].sort((a, b) => a.targetPath.localeCompare(b.targetPath) || a.artifactId.localeCompare(b.artifactId)).map(artifact =>
    verifyArtifact({ artifact, identity: identity.state, file: fileIndex.get(artifact.targetPath), scanLimited, evidenceById, pathSet, policy }));
  const counts = artifactCounts(artifacts);
  const statementResults = artifacts.flatMap(artifact => artifact.statementResults);
  const statementCounts = statementStateCounts(statementResults);
  const limitations = sortedUnique([
    ...identity.reasons,
    ...evidence.limitations,
    ...(scanLimited ? ['Current scan is limited; absent targets or evidence remain unavailable rather than missing or contradicted.'] : []),
    ...artifacts.flatMap(artifact => artifact.limitations),
  ]).slice(0, policy.maximumLimitations);
  const quality = qualityEvaluation(artifacts, statementResults);
  const openWork = buildRepositoryIntelligenceOpenWork({ artifacts, identityState: identity.state, scanLimited, maximumItems: policy.maximumOpenWorkItems });
  const lifecycle = lifecycleFor(identity.state, artifacts, statementCounts);
  const overallState = overallFor(identity.state, artifacts, statementCounts);
  const comparison = {
    exactArtifacts: counts['verified-exact'] + counts['verified-strengthened'],
    modifiedArtifacts: counts['verified-present-with-modifications'] + counts['partially-verified'],
    missingArtifacts: counts.missing,
    conflictingArtifacts: counts.conflicting,
    unavailableArtifacts: counts.unavailable,
    newlyCorroboratedStatements: statementCounts['verified-by-current-deterministic-evidence'],
    inferredStatements: statementCounts['still-inferred'] + statementCounts['present-in-artifact-only'],
    contradictedStatements: statementCounts.contradicted,
    humanReviewItemsOpen: statementCounts['requires-human-review'] + artifacts.filter(item => item.humanReviewRequired).length,
  };
  const core = {
    version: REPOSITORY_INTELLIGENCE_VERIFICATION_RESULT_VERSION,
    baselineFingerprint: stableContextFingerprint(baseline),
    currentScanFingerprint: scanFingerprint(input.currentScan),
    identity, lifecycle, overallState, artifacts, counts, statementCounts, quality, comparison, openWork, limitations,
  };
  return { ...core, fingerprint: stableContextFingerprint(core) };
}

export function compareRepositoryIntelligenceVerification(result: RepositoryIntelligenceVerificationResult) { return { ...result.comparison, overallState: result.overallState, lifecycle: result.lifecycle, limitations: [...result.limitations] }; }

export function getRepositoryIntelligenceVerificationBaselineLifecycle(baseline: unknown): RepositoryIntelligenceVerificationLifecycleState {
  return validateRepositoryIntelligenceVerificationBaseline(baseline).valid ? 'baseline-created-after-pr' : 'incompatible-baseline';
}

export function buildRepositoryIntelligenceOpenWork(input: { artifacts: RepositoryIntelligenceArtifactVerification[]; identityState: RepositoryIntelligenceIdentityState; scanLimited: boolean; maximumItems?: number }): RepositoryIntelligenceVerificationOpenWorkItem[] {
  const work: RepositoryIntelligenceVerificationOpenWorkItem[] = [];
  if (!['verified-compatible', 'compatible-lineage-limited'].includes(input.identityState)) work.push(workItem(undefined, undefined, 'Repository or branch identity is incompatible with the saved baseline.', ['Identity verification did not pass.'], 'critical', 'Scan the baseline repository on its base or PR branch.', 'rescan'));
  for (const artifact of input.artifacts) {
    if (artifact.state === 'missing') work.push(workItem(artifact.artifactId, artifact.targetPath, 'Applied artifact is missing from the complete rescan.', [`${artifact.targetPath} was not found.`], 'high', 'Apply or regenerate the reviewed artifact, then rescan.', 'regenerate'));
    if (artifact.state === 'conflicting') work.push(workItem(artifact.artifactId, artifact.targetPath, 'Artifact ownership, marker or preservation state conflicts with the baseline.', artifact.limitations, 'high', 'Review the current file and regenerate only after resolving the conflict.', 'human-review'));
    if (['verified-present-with-modifications', 'partially-verified', 'stale'].includes(artifact.state)) work.push(workItem(artifact.artifactId, artifact.targetPath, 'Artifact changed after the applied baseline.', [`Current fingerprint: ${artifact.currentContentFingerprint || 'unavailable'}.`], 'medium', 'Review the modification and regenerate if repository guidance is stale.', 'human-review'));
    if (artifact.state === 'unavailable') work.push(workItem(artifact.artifactId, artifact.targetPath, 'Current scan coverage cannot verify this artifact.', artifact.limitations, 'medium', 'Run a complete scan with readable target content.', 'rescan'));
    for (const statement of artifact.statementResults.filter(item => ['contradicted', 'evidence-missing', 'requires-human-review'].includes(item.state))) {
      work.push(workItem(artifact.artifactId, artifact.targetPath, statement.state === 'requires-human-review' ? 'Statement still requires human review.' : 'Statement evidence no longer resolves.', statement.limitations, statement.state === 'contradicted' ? 'high' : 'medium', statement.nextAction, statement.state === 'requires-human-review' ? 'human-review' : 'regenerate'));
    }
  }
  if (input.scanLimited && !work.some(item => item.actionType === 'rescan')) work.push(workItem(undefined, undefined, 'Limited scan prevents complete Repository Intelligence verification.', ['Absence is not treated as failure.'], 'medium', 'Run a complete rescan.', 'rescan'));
  return dedupeWork(work).slice(0, input.maximumItems || DEFAULT_REPOSITORY_INTELLIGENCE_VERIFICATION_POLICY.maximumOpenWorkItems);
}

function verifyArtifact(input: { artifact: RepositoryIntelligenceVerificationBaselineArtifact; identity: RepositoryIntelligenceIdentityState; file?: IndexedFile; scanLimited: boolean; evidenceById: Map<string, RepositoryIntelligenceEvidenceModel['evidence'][number]>; pathSet: Set<string>; policy: RepositoryIntelligenceVerificationPolicy }): RepositoryIntelligenceArtifactVerification {
  const { artifact, identity, file, scanLimited } = input;
  let state: RepositoryIntelligenceArtifactVerificationState = 'unavailable'; let confidence: 'high' | 'medium' | 'low' = 'low'; let preservationState: RepositoryIntelligencePreservationState = 'not-applicable';
  const limitations: string[] = []; let currentContentFingerprint: string | undefined; let currentManagedSectionFingerprint: string | undefined;
  if (!['verified-compatible', 'compatible-lineage-limited'].includes(identity)) limitations.push('Repository or branch identity is incompatible with this artifact baseline.');
  else if (!file) { state = scanLimited ? 'unavailable' : 'missing'; limitations.push(scanLimited ? 'Target absence cannot be concluded from a limited scan.' : 'Target path is absent from the complete scan.'); }
  else if (file.conflict) { state = 'conflicting'; limitations.push(file.conflict); }
  else if (file.unavailable || file.content === undefined) { state = 'unavailable'; limitations.push(file.unavailable || 'Target content was not readable in the current scan.'); }
  else {
    const content = normalizeContent(file.content); currentContentFingerprint = stableContextFingerprint(content);
    if (content.length > input.policy.maximumReadableContentCharacters) { state = 'unavailable'; limitations.push('Target content exceeds the verification policy limit.'); }
    else if (artifact.operation === 'create') {
      if (currentContentFingerprint === artifact.finalContentFingerprint) { state = 'verified-exact'; confidence = 'high'; }
      else if (content.trim() && structurallyRecognizable(content, artifact.category)) { state = 'verified-present-with-modifications'; confidence = 'medium'; limitations.push('Created artifact is present but differs from the applied fingerprint.'); }
      else { state = 'conflicting'; limitations.push('Target exists but no longer resembles the applied artifact.'); }
    } else if (artifact.operation === 'update') {
      if (currentContentFingerprint === artifact.finalContentFingerprint) { state = 'verified-exact'; confidence = 'high'; }
      else if (recognizedManaged(content)) { state = 'verified-present-with-modifications'; confidence = 'medium'; limitations.push('ShipSeal-managed artifact has compatible later modifications.'); }
      else { state = 'conflicting'; limitations.push('ShipSeal-managed ownership marker is missing or the file was replaced with unrelated content.'); }
    } else {
      const parsed = parseManagedSection(content); currentManagedSectionFingerprint = parsed.section ? stableContextFingerprint(parsed.section) : undefined;
      if (!parsed.valid) { state = 'conflicting'; preservationState = 'changed-unproven'; limitations.push(parsed.reason); }
      else {
        const outside = contentOutsideSection(content, parsed); const outsideFingerprint = stableContextFingerprint(outside);
        const linesPreserved = orderedSubsequence(artifact.preservedLineFingerprints, lineFingerprints(outside));
        preservationState = outsideFingerprint === artifact.expectedPreservationFingerprint ? 'preserved-exact' : linesPreserved ? 'preserved-with-additions' : 'content-loss-detected';
        if (preservationState === 'content-loss-detected') { state = 'conflicting'; limitations.push('Previously preserved handwritten lines were removed or changed.'); }
        else if (currentManagedSectionFingerprint === artifact.expectedManagedSectionFingerprint) { state = 'verified-strengthened'; confidence = preservationState === 'preserved-exact' ? 'high' : 'medium'; if (preservationState === 'preserved-with-additions') limitations.push('Handwritten content gained later additions while original non-empty lines remain ordered.'); }
        else { state = 'verified-present-with-modifications'; confidence = 'medium'; limitations.push('Managed section is present but differs from the applied section fingerprint.'); }
      }
    }
  }
  const artifactPresent = Boolean(file && !file.conflict && !file.unavailable && file.content !== undefined);
  const statementResults = artifact.statements.map(statement => verifyStatement(statement, artifact, artifactPresent, input.scanLimited, input.evidenceById, input.pathSet));
  const verifiedStatementCount = statementResults.filter(item => item.state === 'verified-by-current-deterministic-evidence').length;
  const evidenceIds = artifact.statements.flatMap(item => item.evidenceIds); const resolved = evidenceIds.filter(id => input.evidenceById.has(id)).length;
  const humanReviewRequired = artifact.humanReviewRequired || statementResults.some(item => item.state === 'requires-human-review');
  const nextAction = nextActionFor(state, artifact.operation, humanReviewRequired);
  const core = { artifactId: artifact.artifactId, targetPath: artifact.targetPath, operation: artifact.operation, category: artifact.category, baselineArtifactFingerprint: artifact.artifactFingerprint, expectedAppliedContentFingerprint: artifact.finalContentFingerprint, currentContentFingerprint, expectedManagedSectionFingerprint: artifact.expectedManagedSectionFingerprint, currentManagedSectionFingerprint, preservationState, state, confidence, identityState: identity, statementResults, verifiedStatementCount, unresolvedStatementCount: statementResults.length - verifiedStatementCount, evidenceCoverage: { referenced: evidenceIds.length, resolved, missing: evidenceIds.length - resolved }, humanReviewRequired, limitations: sortedUnique(limitations), nextAction };
  return { id: `ri-verification:${stableContextFingerprint(core)}`, ...core };
}

function verifyStatement(statement: RepositoryIntelligenceReviewStatementProvenance, artifact: RepositoryIntelligenceVerificationBaselineArtifact, artifactPresent: boolean, scanLimited: boolean, evidenceById: Map<string, RepositoryIntelligenceEvidenceModel['evidence'][number]>, pathSet: Set<string>): RepositoryIntelligenceStatementVerification {
  const resolvedEvidenceIds = statement.evidenceIds.filter(id => evidenceById.has(id)).sort(); const missingEvidenceIds = statement.evidenceIds.filter(id => !evidenceById.has(id)).sort();
  const missingPaths = statement.referencedPaths.filter(path => !pathSet.has(path)); const limitations: string[] = [];
  let state: RepositoryIntelligenceStatementVerificationState; let nextAction: string;
  if (statement.humanReviewRequired || sensitiveClaim(statement.statementText)) { state = 'requires-human-review'; nextAction = 'A qualified reviewer must confirm this statement against the current repository and operating context.'; }
  else if (scanLimited && (missingPaths.length || missingEvidenceIds.length)) { state = 'unavailable'; limitations.push('Limited scan cannot distinguish missing evidence from unanalyzed evidence.'); nextAction = 'Run a complete rescan.'; }
  else if (missingPaths.length) { state = 'contradicted'; limitations.push(`Referenced path is absent: ${missingPaths.join(', ')}.`); nextAction = 'Regenerate the artifact from current repository evidence.'; }
  else if (/ShipSeal (?:executed|ran) (?:the )?(?:code|tests|commands)/i.test(statement.statementText) || certificationClaim(statement.statementText)) { state = 'contradicted'; limitations.push('Static verification cannot support execution or certification claims.'); nextAction = 'Remove the unsupported claim and require human verification.'; }
  else if (missingEvidenceIds.length) { state = statement.findingIds.length ? 'still-inferred' : 'evidence-missing'; limitations.push('One or more deterministic evidence references no longer resolve.'); nextAction = 'Review and regenerate this statement from current evidence.'; }
  else if (statement.evidenceIds.length && resolvedEvidenceIds.length === statement.evidenceIds.length) { state = 'verified-by-current-deterministic-evidence'; nextAction = 'Retain the evidence link and reverify after future repository changes.'; }
  else if (statement.findingIds.length) { state = 'still-inferred'; nextAction = 'Keep the inference labeled and obtain deterministic or human corroboration.'; }
  else if (artifactPresent) { state = 'present-in-artifact-only'; nextAction = 'Do not treat Markdown presence as proof; add deterministic evidence if needed.'; }
  else { state = 'unavailable'; nextAction = 'Restore readable artifact and evidence coverage, then rescan.'; }
  const core = { statementId: statement.statementId, artifactId: artifact.artifactId, statementType: statement.statementType, state, referencedPaths: [...statement.referencedPaths].sort(), resolvedEvidenceIds, missingEvidenceIds, limitations, nextAction };
  return { id: `ri-statement-verification:${stableContextFingerprint(core)}`, ...core };
}

interface IndexedFile { file: RepoFileSummary; content?: string; unavailable?: string; conflict?: string }
function buildFileIndex(scan: RepoScanInput) {
  const index = new Map<string, IndexedFile>();
  for (const file of scan.files) {
    const path = normalizeZipPath(file.path); if (!path) continue;
    if (index.has(path)) { index.set(path, { file, conflict: 'Multiple scan entries normalize to the same target path.' }); continue; }
    if (file.isDir) index.set(path, { file, conflict: 'Target path is now a directory.' });
    else if (file.ignored) index.set(path, { file, unavailable: `Target was excluded from analysis${file.ignoredReason ? `: ${file.ignoredReason}` : ''}.` });
    else if (scan.textContents[path] === undefined) index.set(path, { file, unavailable: 'Target exists but readable scanner-loaded content is unavailable.' });
    else index.set(path, { file, content: scan.textContents[path] });
  }
  return index;
}

function compareIdentity(baseline: RepositoryIntelligenceVerificationBaseline, scan: RepoScanInput, explicitBranches: string[]) {
  const reasons: string[] = []; const source = scan.source; const full = `${source?.githubOwner || ''}/${source?.githubRepo || ''}`;
  if (source?.sourceType !== 'github-app') return { state: 'source-incompatible' as const, repositoryMatches: false, branchCompatible: false, reasons: ['A GitHub App verification baseline cannot be silently verified by ZIP, sample or public-URL scan input.'] };
  const repositoryMatches = full.toLowerCase() === `${baseline.repository.owner}/${baseline.repository.repo}`.toLowerCase();
  if (!repositoryMatches) reasons.push('Current scan repository owner/name differs from the baseline.');
  const branch = source.githubBranch || source.githubDefaultBranch || '';
  const direct = branch === baseline.baseBranch || branch === baseline.prBranch; const explicit = explicitBranches.includes(branch);
  if (!direct && !explicit) reasons.push('Current branch is not the baseline base branch, PR branch, or an explicitly accepted compatible branch.');
  const state: RepositoryIntelligenceIdentityState = !repositoryMatches ? 'repository-mismatch' : direct ? 'verified-compatible' : explicit ? 'compatible-lineage-limited' : branch ? 'branch-mismatch' : 'unavailable';
  return { state, repositoryMatches, branchCompatible: direct || explicit, reasons };
}

function qualityEvaluation(artifacts: RepositoryIntelligenceArtifactVerification[], statements: RepositoryIntelligenceStatementVerification[]): RepositoryIntelligenceVerificationQualityEvaluation {
  const verifiedArtifacts = artifacts.filter(item => ['verified-exact', 'verified-strengthened'].includes(item.state)).length;
  const conflictArtifacts = artifacts.filter(item => item.state === 'conflicting').length;
  const verifiedStatements = statements.filter(item => item.state === 'verified-by-current-deterministic-evidence').length;
  const contradicted = statements.filter(item => item.state === 'contradicted').length;
  const review = statements.filter(item => item.state === 'requires-human-review').length + artifacts.filter(item => item.humanReviewRequired).length;
  const dimension = (name: RepositoryIntelligenceVerificationQualityEvaluation['dimensions'][number]['dimension'], state: RepositoryIntelligenceVerificationQualityEvaluation['dimensions'][number]['state'], verified: number, unresolved: number) => ({ dimension: name, state, verified, unresolved });
  const artifactState = conflictArtifacts ? 'conflicting' as const : verifiedArtifacts === artifacts.length ? 'verified' as const : 'partial' as const;
  const evidenceState = contradicted ? 'conflicting' as const : verifiedStatements ? (verifiedStatements === statements.length ? 'verified' as const : 'partial' as const) : 'unavailable' as const;
  const preservation = artifacts.filter(item => item.operation === 'strengthen');
  return { dimensions: [
    dimension('artifact-presence', artifactState, verifiedArtifacts, artifacts.length - verifiedArtifacts),
    dimension('provenance-integrity', evidenceState, verifiedStatements, statements.length - verifiedStatements),
    dimension('evidence-freshness', evidenceState, verifiedStatements, statements.length - verifiedStatements),
    dimension('handwritten-preservation', preservation.length ? (preservation.every(item => ['preserved-exact', 'preserved-with-additions'].includes(item.preservationState)) ? 'verified' : 'conflicting') : 'not-applicable', preservation.filter(item => ['preserved-exact', 'preserved-with-additions'].includes(item.preservationState)).length, preservation.filter(item => !['preserved-exact', 'preserved-with-additions'].includes(item.preservationState)).length),
    dimension('command-accuracy', stateForStatements(statements.filter(item => item.statementType === 'command')), statements.filter(item => item.statementType === 'command' && item.state === 'verified-by-current-deterministic-evidence').length, statements.filter(item => item.statementType === 'command' && item.state !== 'verified-by-current-deterministic-evidence').length),
    dimension('path-accuracy', contradicted ? 'conflicting' : evidenceState, verifiedStatements, statements.length - verifiedStatements),
    dimension('responsibility-coverage', evidenceState, verifiedStatements, statements.length - verifiedStatements),
    dimension('limitation-visibility', 'verified', artifacts.filter(item => item.limitations.length > 0).length, 0),
    dimension('review-completeness', review ? 'partial' : 'verified', review ? 0 : artifacts.length, review),
  ] };
}

function stateForStatements(statements: RepositoryIntelligenceStatementVerification[]) { if (!statements.length) return 'not-applicable' as const; if (statements.some(item => item.state === 'contradicted')) return 'conflicting' as const; return statements.every(item => item.state === 'verified-by-current-deterministic-evidence') ? 'verified' as const : 'partial' as const; }
function lifecycleFor(identity: RepositoryIntelligenceIdentityState, artifacts: RepositoryIntelligenceArtifactVerification[], statements: Record<RepositoryIntelligenceStatementVerificationState, number>): RepositoryIntelligenceVerificationLifecycleState { if (identity === 'source-incompatible' || identity === 'repository-mismatch' || identity === 'branch-mismatch') return 'incompatible-baseline'; if (identity === 'unavailable') return 'verification-unavailable'; if (artifacts.every(item => item.state === 'missing')) return 'current-branch-does-not-contain-changes'; if (artifacts.some(item => item.state === 'missing' || item.state === 'unavailable')) return 'awaiting-repository-change'; if (artifacts.some(item => ['conflicting', 'stale', 'verified-present-with-modifications'].includes(item.state)) || statements.contradicted > 0) return 'repository-changed-after-verification'; if (artifacts.every(item => ['verified-exact', 'verified-strengthened'].includes(item.state)) && unresolvedStatementCount(statements) === 0) return 'verified'; return 'eligible-for-verification'; }
function overallFor(identity: RepositoryIntelligenceIdentityState, artifacts: RepositoryIntelligenceArtifactVerification[], statements: Record<RepositoryIntelligenceStatementVerificationState, number>): RepositoryIntelligenceOverallVerificationState { if (!['verified-compatible', 'compatible-lineage-limited'].includes(identity)) return 'verification-blocked'; if (artifacts.every(item => item.state === 'unavailable')) return 'unavailable'; if (artifacts.some(item => ['conflicting', 'stale'].includes(item.state)) || statements.contradicted > 0) return 'changes-detected'; if (artifacts.every(item => ['verified-exact', 'verified-strengthened'].includes(item.state)) && unresolvedStatementCount(statements) === 0) return 'fully-verified'; return 'partially-verified'; }
function unresolvedStatementCount(statements: Record<RepositoryIntelligenceStatementVerificationState, number>) { return statements['present-in-artifact-only'] + statements['still-inferred'] + statements.contradicted + statements['evidence-missing'] + statements.unavailable + statements['requires-human-review']; }
function nextActionFor(state: RepositoryIntelligenceArtifactVerificationState, operation: string, human: boolean) { if (human) return 'Complete the required human review; artifact presence does not close that review.'; if (state === 'missing') return 'Apply or regenerate the reviewed artifact, then rescan.'; if (state === 'unavailable') return 'Run a complete scan with readable target content.'; if (state === 'conflicting') return 'Review ownership, markers and preserved content before regenerating.'; if (state === 'verified-present-with-modifications') return 'Review later modifications and regenerate if repository guidance is stale.'; return operation === 'strengthen' ? 'Retain the managed-section boundary and reverify after later edits.' : 'Reverify after future repository changes.'; }
function unavailableResult(scan: RepoScanInput, limitations: string[]): RepositoryIntelligenceVerificationResult { const counts = emptyArtifactCounts(); const statementCounts = emptyStatementCounts(); const core = { version: REPOSITORY_INTELLIGENCE_VERIFICATION_RESULT_VERSION, baselineFingerprint: 'unavailable', currentScanFingerprint: scanFingerprint(scan), identity: { state: 'unavailable' as const, repositoryMatches: false, branchCompatible: false, reasons: limitations }, lifecycle: 'incompatible-baseline' as const, overallState: 'unavailable' as const, artifacts: [], counts, statementCounts, quality: { dimensions: [] }, comparison: { exactArtifacts: 0, modifiedArtifacts: 0, missingArtifacts: 0, conflictingArtifacts: 0, unavailableArtifacts: 0, newlyCorroboratedStatements: 0, inferredStatements: 0, contradictedStatements: 0, humanReviewItemsOpen: 0 }, openWork: [workItem(undefined, undefined, 'Verification baseline is invalid or incompatible.', limitations, 'critical', 'Create a new baseline from a reviewed Repository Intelligence PR.', 'rescan')], limitations }; return { ...core, fingerprint: stableContextFingerprint(core) }; }

function parseManagedSection(content: string) { const starts = occurrences(content, REPOSITORY_INTELLIGENCE_MANAGED_SECTION_START); const ends = occurrences(content, REPOSITORY_INTELLIGENCE_MANAGED_SECTION_END); if (starts.length !== 1 || ends.length !== 1 || starts[0] > ends[0]) return { valid: false as const, reason: starts.length || ends.length ? 'Managed section markers are duplicate, nested, reversed or malformed.' : 'Managed section is missing.', start: -1, end: -1, section: undefined }; return { valid: true as const, reason: '', start: starts[0], end: ends[0] + REPOSITORY_INTELLIGENCE_MANAGED_SECTION_END.length, section: content.slice(starts[0], ends[0] + REPOSITORY_INTELLIGENCE_MANAGED_SECTION_END.length) }; }
function contentOutsideSection(content: string, parsed: ReturnType<typeof parseManagedSection>) { return parsed.valid ? normalizeContent(`${content.slice(0, parsed.start)}${content.slice(parsed.end)}`) : ''; }
function structurallyRecognizable(content: string, category: RepositoryIntelligenceArtifactCategory) { if (category === 'evidence-manifest') { try { return record(JSON.parse(content)); } catch { return false; } } return /^#\s+.+/m.test(content) && /shipseal:repository-intelligence:managed/i.test(content); }
function recognizedManaged(content: string) { return /Generated by ShipSeal|shipseal:repository-intelligence:managed|shipseal\.repository-intelligence-evidence-manifest\.v1/i.test(content); }
function sensitiveClaim(text: string) { return /(security|authentication|payment|legal|privacy|compliance|deployment|production|personal data|AI Act)/i.test(text); }
function certificationClaim(text: string) { return /\b(certified|compliant|secure|guaranteed safe)\b/i.test(text); }
function scanFingerprint(scan: RepoScanInput) { return stableContextFingerprint({ repoName: scan.repoName, source: scan.source, files: scan.files.map(file => ({ path: normalizeZipPath(file.path), size: file.size, ignored: file.ignored, reason: file.ignoredReason })).sort((a, b) => a.path.localeCompare(b.path)) }); }
function cloneBaseline(value: RepositoryIntelligenceVerificationBaseline): RepositoryIntelligenceVerificationBaseline { return { ...value, repository: { ...value.repository }, artifacts: value.artifacts.map(artifact => ({ ...artifact, preservedLineFingerprints: [...artifact.preservedLineFingerprints], statements: artifact.statements.map(statement => ({ ...statement, evidenceIds: [...statement.evidenceIds], findingIds: [...statement.findingIds], referencedPaths: [...statement.referencedPaths], rescanVerificationTarget: statement.rescanVerificationTarget ? { ...statement.rescanVerificationTarget } : undefined })) })).sort((a, b) => a.targetPath.localeCompare(b.targetPath) || a.artifactId.localeCompare(b.artifactId)) }; }
function artifactCounts(artifacts: RepositoryIntelligenceArtifactVerification[]) { const counts = emptyArtifactCounts(); for (const artifact of artifacts) counts[artifact.state] += 1; return counts; }
function statementStateCounts(statements: RepositoryIntelligenceStatementVerification[]) { const counts = emptyStatementCounts(); for (const statement of statements) counts[statement.state] += 1; return counts; }
function emptyArtifactCounts(): Record<RepositoryIntelligenceArtifactVerificationState, number> { return { 'verified-exact': 0, 'verified-present-with-modifications': 0, 'verified-strengthened': 0, 'partially-verified': 0, missing: 0, conflicting: 0, stale: 0, unavailable: 0, 'not-applicable': 0, 'requires-human-review': 0 }; }
function emptyStatementCounts(): Record<RepositoryIntelligenceStatementVerificationState, number> { return { 'verified-by-current-deterministic-evidence': 0, 'present-in-artifact-only': 0, 'still-inferred': 0, contradicted: 0, 'evidence-missing': 0, unavailable: 0, 'requires-human-review': 0 }; }
function workItem(artifactId: string | undefined, path: string | undefined, reason: string, evidence: string[], priority: RepositoryIntelligenceVerificationOpenWorkItem['priority'], nextAction: string, actionType: RepositoryIntelligenceVerificationOpenWorkItem['actionType']): RepositoryIntelligenceVerificationOpenWorkItem { const core = { artifactId, path, reason, evidence: sortedUnique(evidence), priority, nextAction, actionType }; return { id: `ri-open-work:${stableContextFingerprint(core)}`, ...core }; }
function dedupeWork(items: RepositoryIntelligenceVerificationOpenWorkItem[]) { return [...new Map(items.map(item => [item.id, item])).values()].sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || `${a.path || ''}:${a.reason}`.localeCompare(`${b.path || ''}:${b.reason}`)); }
function priorityRank(value: RepositoryIntelligenceVerificationOpenWorkItem['priority']) { return value === 'critical' ? 0 : value === 'high' ? 1 : value === 'medium' ? 2 : 3; }
function lineFingerprints(content: string) { return normalizeContent(content).split('\n').map(line => line.trim()).filter(Boolean).map(line => stableContextFingerprint(line)).slice(0, 500); }
function orderedSubsequence(expected: string[], current: string[]) { let index = 0; for (const value of current) if (value === expected[index]) index += 1; return index === expected.length; }
function occurrences(value: string, marker: string) { const values: number[] = []; let from = 0; while (true) { const index = value.indexOf(marker, from); if (index < 0) return values; values.push(index); from = index + marker.length; } }
function normalizeContent(value: string) { return value.replace(/\r\n?/g, '\n'); }
function fingerprint(value: unknown) { return typeof value === 'string' && /^[a-z0-9]{8,128}$/i.test(value); }
function safeRepoPart(value: unknown) { return typeof value === 'string' && value.length > 0 && value.length <= 100 && /^[A-Za-z0-9_.-]+$/.test(value); }
function safeBranch(value: unknown) { return typeof value === 'string' && value.length > 0 && value.length <= 160 && /^[A-Za-z0-9._/-]+$/.test(value) && !value.includes('..') && !value.startsWith('/') && !value.endsWith('/'); }
function record(value: unknown): value is Record<string, unknown> { return Boolean(value && typeof value === 'object' && !Array.isArray(value)); }
function sortedUnique(values: string[]) { return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b)); }
