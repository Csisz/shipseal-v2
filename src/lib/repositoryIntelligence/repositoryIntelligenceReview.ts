import type { RepoScanInput } from '../types';
import { normalizeZipPath } from '../scannerLimits';
import {
  generateRepositoryIntelligenceArtifacts,
  type GenerateRepositoryIntelligenceArtifactsInput,
} from './artifactGeneration';
import { planRepositoryIntelligenceArtifacts } from './artifactPlanning';
import {
  REPOSITORY_INTELLIGENCE_ARTIFACT_SCHEMA_VERSION,
  type RepositoryIntelligenceArtifactCategory,
  type RepositoryIntelligenceArtifactOperation,
  type RepositoryIntelligenceArtifactPolicyOverride,
  type RepositoryIntelligenceArtifactSet,
  type RepositoryIntelligenceArtifactStatement,
  type RepositoryIntelligenceArtifactValidationResult,
  type RepositoryIntelligenceExistingFileState,
} from './artifactSchema';
import { validateRepositoryIntelligenceArtifactSet } from './artifactValidation';
import { prepareRepositoryIntelligenceContext, type RepositoryIntelligenceContextBundle } from './contextPreparation';
import { stableContextFingerprint } from './contextSelection';
import type {
  RepositoryDeepIntelligenceConfidence,
  RepositoryDeepIntelligenceValidatedResult,
} from './deepIntelligenceSchema';
import type {
  EvidenceAssertionState,
  EvidenceValidationState,
  RepositoryEvidenceCategory,
  RepositoryIntelligenceEvidenceModel,
} from './evidence';
import { buildRepositoryIntelligenceEvidence } from './repositoryResponsibilities';
import {
  REPOSITORY_INTELLIGENCE_SELECTED_PAYLOAD_VERSION,
  type RepositoryIntelligenceAnalysisMode,
  type RepositoryIntelligenceExpectedFileState,
  type RepositoryIntelligenceReviewStatementProvenance,
  type RepositoryIntelligenceSelectedArtifactPayload,
} from './repositoryIntelligenceApplyContract.js';

export {
  REPOSITORY_INTELLIGENCE_SELECTED_PAYLOAD_VERSION,
  type RepositoryIntelligenceAnalysisMode,
  type RepositoryIntelligenceExpectedFileState,
  type RepositoryIntelligenceReviewStatementProvenance,
  type RepositoryIntelligenceSelectedArtifactPayload,
} from './repositoryIntelligenceApplyContract.js';

export const REPOSITORY_INTELLIGENCE_REVIEW_VERSION = 'shipseal.repository-intelligence-review.v1' as const;
export const REPOSITORY_INTELLIGENCE_REVIEW_SELECTION_VERSION = 'shipseal.repository-intelligence-review-selection.v1' as const;
export type RepositoryIntelligenceEligibilityState =
  | 'supported-full-scan'
  | 'supported-limited-scan'
  | 'partially-supported'
  | 'unsupported-stack'
  | 'insufficient-readable-content'
  | 'artifact-generation-unavailable'
  | 'validation-failed';
export type RepositoryIntelligenceReviewValidationState = 'validated' | 'validation-failed';

export interface RepositoryIntelligenceReviewEvidence {
  id: string;
  path: string;
  category: RepositoryEvidenceCategory;
  fact: string;
  validationState: EvidenceValidationState;
  assertionState: EvidenceAssertionState;
  limitations: string[];
}

export interface RepositoryIntelligenceReviewDependency {
  category: RepositoryIntelligenceArtifactCategory;
  artifactIds: string[];
  satisfied: boolean;
}

export interface RepositoryIntelligenceArtifactReviewItem {
  id: string;
  artifactId: string;
  targetPath: string;
  category: RepositoryIntelligenceArtifactCategory;
  operation: RepositoryIntelligenceArtifactOperation;
  operationReason: string;
  reviewState: RepositoryIntelligenceArtifactSet['plan']['artifacts'][number]['reviewState'];
  validationState: RepositoryIntelligenceReviewValidationState;
  artifactFingerprint: string;
  renderedContent: string;
  existingContentState: RepositoryIntelligenceExistingFileState;
  expectedFileState: RepositoryIntelligenceExpectedFileState;
  preservation: RepositoryIntelligenceArtifactSet['plan']['artifacts'][number]['preservation'];
  purpose: string;
  confidence: RepositoryDeepIntelligenceConfidence;
  statementCount: number;
  evidence: RepositoryIntelligenceReviewEvidence[];
  evidenceIds: string[];
  acceptedFindingIds: string[];
  statementProvenance: RepositoryIntelligenceReviewStatementProvenance[];
  referencedPaths: string[];
  affectedFolders: string[];
  humanReviewRequired: boolean;
  humanReviewAcknowledged: boolean;
  limitations: string[];
  blockedReasons: string[];
  dependencies: RepositoryIntelligenceReviewDependency[];
  defaultIncluded: boolean;
  defaultSelectionReason: string;
  selected: boolean;
  selectable: boolean;
  canSelectNow: boolean;
  selectionReason: string;
  mayLaterBeApplied: boolean;
  previewKind: 'markdown' | 'manifest-metadata';
}

export interface RepositoryIntelligenceReviewSelectionEntry {
  artifactFingerprint: string;
  included: boolean;
  acknowledgementFingerprint?: string;
}

export interface RepositoryIntelligenceReviewSelectionState {
  version: typeof REPOSITORY_INTELLIGENCE_REVIEW_SELECTION_VERSION;
  sourceArtifactSetFingerprint: string;
  entries: Record<string, RepositoryIntelligenceReviewSelectionEntry>;
}

export interface RepositoryIntelligenceArtifactReviewSummary {
  proposedArtifacts: number;
  selectedArtifacts: number;
  selectedStatements: number;
  humanReviewRequired: number;
  humanReviewAcknowledged: number;
  blockedOrUnavailable: number;
  operationCounts: Record<RepositoryIntelligenceArtifactOperation, number>;
  selectedOperationCounts: Record<RepositoryIntelligenceArtifactOperation, number>;
  readyForFutureApply: boolean;
}

export interface RepositoryIntelligenceArtifactReview {
  version: typeof REPOSITORY_INTELLIGENCE_REVIEW_VERSION;
  repository: RepositoryIntelligenceContextBundle['repository'];
  repositoryIdentityFingerprint: string;
  scanIdentity: string;
  analysisMode: RepositoryIntelligenceAnalysisMode;
  eligibility: { state: RepositoryIntelligenceEligibilityState; explanation: string };
  artifactSetFingerprint: string;
  manifestFingerprint: string;
  items: RepositoryIntelligenceArtifactReviewItem[];
  selection: RepositoryIntelligenceReviewSelectionState;
  summary: RepositoryIntelligenceArtifactReviewSummary;
  limitations: string[];
  selectedPlanFingerprint: string;
  fingerprint: string;
}

export type RepositoryIntelligenceReviewSelectionAction =
  | { type: 'include'; artifactId: string }
  | { type: 'exclude'; artifactId: string }
  | { type: 'include-all-safe' }
  | { type: 'exclude-all' }
  | { type: 'reset-safe-defaults' }
  | { type: 'acknowledge-human-review'; artifactId: string; acknowledged: boolean };

export interface RepositoryIntelligenceReviewSelectionTransition {
  review: RepositoryIntelligenceArtifactReview;
  accepted: boolean;
  reasons: string[];
}

export interface BuildRepositoryIntelligenceArtifactReviewInput {
  scanInput: RepoScanInput;
  deepIntelligenceResult?: RepositoryDeepIntelligenceValidatedResult;
  artifactPolicy?: RepositoryIntelligenceArtifactPolicyOverride;
  selectionState?: RepositoryIntelligenceReviewSelectionState;
  evidenceResult?: RepositoryIntelligenceEvidenceModel;
  contextBundle?: RepositoryIntelligenceContextBundle;
  artifactSet?: RepositoryIntelligenceArtifactSet;
  artifactValidation?: RepositoryIntelligenceArtifactValidationResult;
}

export interface BuildRepositoryIntelligenceArtifactReviewResult {
  evidenceResult: RepositoryIntelligenceEvidenceModel;
  contextBundle: RepositoryIntelligenceContextBundle;
  artifactSet: RepositoryIntelligenceArtifactSet;
  artifactValidation: RepositoryIntelligenceArtifactValidationResult;
  review: RepositoryIntelligenceArtifactReview;
}

export interface RepositoryIntelligenceReviewValidationIssue {
  code:
    | 'no-artifacts-selected'
    | 'blocked-artifact-selected'
    | 'artifact-validation-failed'
    | 'missing-dependency'
    | 'destructive-handwritten-replacement'
    | 'artifact-fingerprint-stale'
    | 'unsafe-target-path'
    | 'provenance-mismatch'
    | 'human-review-acknowledgement-required'
    | 'repository-identity-mismatch'
    | 'scan-identity-mismatch'
    | 'selection-fingerprint-stale';
  artifactId?: string;
  message: string;
}

export interface RepositoryIntelligenceReviewSelectionValidation {
  valid: boolean;
  issues: RepositoryIntelligenceReviewValidationIssue[];
  selectedArtifactIds: string[];
  selectedPlanFingerprint: string;
}

/**
 * Internal orchestration boundary for Omega 16.5a. It reuses scanner-loaded text and the
 * Omega 16.1-16.4 builders. Supplying prebuilt stages avoids repeated parsing in callers.
 */
export function buildRepositoryIntelligenceArtifactReview(
  input: BuildRepositoryIntelligenceArtifactReviewInput,
): BuildRepositoryIntelligenceArtifactReviewResult {
  const evidenceResult = input.evidenceResult || buildRepositoryIntelligenceEvidence(input.scanInput);
  const contextBundle = input.contextBundle || prepareRepositoryIntelligenceContext({ scanInput: input.scanInput, evidenceResult });
  const artifactSet = input.artifactSet || buildArtifactSet({
    scanInput: input.scanInput,
    evidenceResult,
    contextBundle,
    deepIntelligenceResult: input.deepIntelligenceResult,
    policy: input.artifactPolicy,
  });
  const artifactValidation = input.artifactValidation || validateRepositoryIntelligenceArtifactSet({
    artifactSet,
    evidenceResult,
    deepIntelligenceResult: input.deepIntelligenceResult,
    scanInput: input.scanInput,
  });
  const review = adaptRepositoryIntelligenceArtifactSetForReview({
    scanInput: input.scanInput,
    evidenceResult,
    contextBundle,
    artifactSet,
    artifactValidation,
    deepIntelligenceResult: input.deepIntelligenceResult,
    selectionState: input.selectionState,
  });
  return { evidenceResult, contextBundle, artifactSet, artifactValidation, review };
}

function buildArtifactSet(input: GenerateRepositoryIntelligenceArtifactsInput & {
  scanInput: RepoScanInput;
  contextBundle: RepositoryIntelligenceContextBundle;
  policy?: RepositoryIntelligenceArtifactPolicyOverride;
}) {
  const artifactPlan = planRepositoryIntelligenceArtifacts({
    scanInput: input.scanInput,
    evidenceResult: input.evidenceResult,
    contextBundle: input.contextBundle,
    deepIntelligenceResult: input.deepIntelligenceResult,
    policy: input.policy,
  });
  return generateRepositoryIntelligenceArtifacts({
    artifactPlan,
    evidenceResult: input.evidenceResult,
    deepIntelligenceResult: input.deepIntelligenceResult,
  });
}

export function adaptRepositoryIntelligenceArtifactSetForReview(input: {
  scanInput: RepoScanInput;
  evidenceResult: RepositoryIntelligenceEvidenceModel;
  contextBundle: RepositoryIntelligenceContextBundle;
  artifactSet: RepositoryIntelligenceArtifactSet;
  artifactValidation: RepositoryIntelligenceArtifactValidationResult;
  deepIntelligenceResult?: RepositoryDeepIntelligenceValidatedResult;
  selectionState?: RepositoryIntelligenceReviewSelectionState;
}): RepositoryIntelligenceArtifactReview {
  const renderedById = new Map(input.artifactSet.artifacts.map(item => [item.artifactId, item]));
  const evidenceById = new Map(input.evidenceResult.evidence.map(item => [item.id, item]));
  const validationIssuesByArtifact = groupValidationIssues(input.artifactValidation);
  const validatedIds = new Set(input.artifactValidation.validatedArtifactIds);
  const plannedByCategory = new Map<RepositoryIntelligenceArtifactCategory, string[]>();
  for (const artifact of input.artifactSet.plan.artifacts) {
    const ids = plannedByCategory.get(artifact.category) || [];
    ids.push(artifact.id);
    plannedByCategory.set(artifact.category, ids.sort());
  }
  const baseItems = [...input.artifactSet.plan.artifacts]
    .sort((left, right) => left.targetPath.localeCompare(right.targetPath) || left.id.localeCompare(right.id))
    .map(artifact => {
      const rendered = renderedById.get(artifact.id);
      const validationState: RepositoryIntelligenceReviewValidationState = validatedIds.has(artifact.id) ? 'validated' : 'validation-failed';
      const evidence = artifact.requiredEvidenceIds
        .map(id => evidenceById.get(id))
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
        .map(item => ({
          id: item.id,
          path: item.repositoryRelativePath,
          category: item.category,
          fact: item.extractedFact,
          validationState: item.validation.state,
          assertionState: item.assertionState,
          limitations: [...item.limitations],
        }))
        .sort((left, right) => left.path.localeCompare(right.path) || left.id.localeCompare(right.id));
      const artifactFingerprint = rendered?.fingerprint || artifact.fingerprint;
      const defaultSelection = defaultSelectionFor(artifact, validationState);
      const blockedReasons = sortedUnique([
        ...artifact.blockingLimitations,
        ...(validationIssuesByArtifact.get(artifact.id) || []),
        ...(artifact.reviewState === 'blocked' ? [artifact.operationReason] : []),
        ...(artifact.reviewState === 'unavailable' ? [artifact.operationReason] : []),
      ]);
      const referencedPaths = sortedUnique(artifact.statements.flatMap(statement => statement.referencedPaths));
      const affectedFolders = sortedUnique(referencedPaths.map(parentFolder).filter(Boolean));
      const selectable = validationState === 'validated'
        && ['create', 'update', 'strengthen'].includes(artifact.operation)
        && !['blocked', 'unavailable'].includes(artifact.reviewState);
      return {
        id: `ri-review:${artifact.id}`,
        artifactId: artifact.id,
        targetPath: artifact.targetPath,
        category: artifact.category,
        operation: artifact.operation,
        operationReason: artifact.operationReason,
        reviewState: artifact.reviewState,
        validationState,
        artifactFingerprint,
        renderedContent: rendered?.content || '',
        existingContentState: artifact.existingFileState,
        expectedFileState: expectedFileStateFor(input.scanInput, artifact.targetPath, artifact.existingFileState, artifact.operation),
        preservation: { ...artifact.preservation },
        purpose: purposeFor(artifact.category, artifact.statements, artifact.targetPath),
        confidence: confidenceFor(artifact.statements),
        statementCount: artifact.statements.length,
        evidence,
        evidenceIds: [...artifact.requiredEvidenceIds].sort(),
        acceptedFindingIds: [...artifact.contributingFindingIds].sort(),
        statementProvenance: artifact.statements.map(statement => ({
          statementId: statement.id,
          statementType: statement.type,
          statementText: statement.content.text,
          validationState: statement.validationState,
          evidenceIds: [...statement.supportingEvidenceIds].sort(),
          findingIds: [...statement.supportingFindingIds].sort(),
          referencedPaths: [...statement.referencedPaths].sort(),
          humanReviewRequired: statement.humanReviewRequired,
          rescanVerificationTarget: statement.rescanVerificationTarget ? { ...statement.rescanVerificationTarget } : undefined,
        })),
        referencedPaths,
        affectedFolders,
        humanReviewRequired: artifact.reviewState === 'requires-human-review'
          || artifact.statements.some(statement => statement.humanReviewRequired)
          || artifact.operation === 'strengthen',
        humanReviewAcknowledged: false,
        limitations: sortedUnique([...artifact.blockingLimitations, ...artifact.statements.flatMap(statement => statement.limitations)]),
        blockedReasons,
        dependencies: artifact.dependencies.map(category => ({
          category,
          artifactIds: [...(plannedByCategory.get(category) || [])],
          satisfied: false,
        })),
        defaultIncluded: defaultSelection.included,
        defaultSelectionReason: defaultSelection.reason,
        selected: false,
        selectable,
        canSelectNow: selectable,
        selectionReason: defaultSelection.reason,
        mayLaterBeApplied: selectable && (artifact.operation !== 'strengthen' || artifact.preservation.mode === 'propose-additions'),
        previewKind: artifact.category === 'evidence-manifest' ? 'manifest-metadata' as const : 'markdown' as const,
      } satisfies RepositoryIntelligenceArtifactReviewItem;
    });

  const repository = { ...input.contextBundle.repository };
  const selection = reconcileSelectionState(baseItems, input.artifactSet.fingerprint, input.selectionState);
  return finalizeReview({
    repository,
    repositoryIdentityFingerprint: stableContextFingerprint(repository),
    scanIdentity: input.contextBundle.fingerprint,
    analysisMode: input.deepIntelligenceResult?.findings.length ? 'deep-intelligence-enhanced' : 'deterministic-repository-evidence',
    eligibility: eligibilityFor(input.scanInput, input.evidenceResult, input.artifactValidation, baseItems),
    artifactSetFingerprint: input.artifactSet.fingerprint,
    manifestFingerprint: input.artifactSet.manifest.fingerprint,
    baseItems,
    selection,
    limitations: sortedUnique([
      ...input.artifactSet.plan.limitations,
      ...input.artifactValidation.issues.map(issue => issue.message),
      ...(input.deepIntelligenceResult?.limitations || []),
    ]),
  });
}

export function updateRepositoryIntelligenceReviewSelection(
  review: RepositoryIntelligenceArtifactReview,
  action: RepositoryIntelligenceReviewSelectionAction,
): RepositoryIntelligenceReviewSelectionTransition {
  const entries = cloneEntries(review.selection.entries);
  const byId = new Map(review.items.map(item => [item.artifactId, item]));
  const target = 'artifactId' in action ? byId.get(action.artifactId) : undefined;
  const rejected = (reason: string): RepositoryIntelligenceReviewSelectionTransition => ({ review, accepted: false, reasons: [reason] });

  if ('artifactId' in action && !target) return rejected('The artifact is not part of the current review.');
  if (action.type === 'include') {
    if (!target?.selectable) return rejected(target?.blockedReasons[0] || 'This artifact cannot be selected.');
    const missing = target.dependencies.filter(dependency => !dependencySatisfied(dependency, review.items, entries));
    if (missing.length) return rejected(`Select or satisfy dependencies first: ${missing.map(item => item.category).join(', ')}.`);
    entries[target.artifactId] = { ...entries[target.artifactId], artifactFingerprint: target.artifactFingerprint, included: true };
  } else if (action.type === 'exclude') {
    entries[target!.artifactId] = { ...entries[target!.artifactId], artifactFingerprint: target!.artifactFingerprint, included: false };
    cascadeUnsatisfiedDependencies(review.items, entries);
  } else if (action.type === 'include-all-safe') {
    for (let pass = 0; pass < review.items.length; pass += 1) {
      let changed = false;
      for (const item of review.items) {
        if (!item.selectable || item.humanReviewRequired) continue;
        if (item.dependencies.every(dependency => dependencySatisfied(dependency, review.items, entries))) {
          if (!entries[item.artifactId]?.included) changed = true;
          entries[item.artifactId] = { artifactFingerprint: item.artifactFingerprint, included: true };
        }
      }
      if (!changed) break;
    }
  } else if (action.type === 'exclude-all') {
    for (const item of review.items) entries[item.artifactId] = { artifactFingerprint: item.artifactFingerprint, included: false };
  } else if (action.type === 'reset-safe-defaults') {
    const reset = reconcileSelectionState(review.items, review.artifactSetFingerprint);
    return { review: rebuildReview(review, reset), accepted: true, reasons: ['Selection reset to conservative defaults.'] };
  } else if (action.type === 'acknowledge-human-review') {
    if (!target?.humanReviewRequired) return rejected('This artifact does not require a human-review acknowledgement.');
    const current = entries[target.artifactId] || { artifactFingerprint: target.artifactFingerprint, included: false };
    entries[target.artifactId] = {
      ...current,
      artifactFingerprint: target.artifactFingerprint,
      acknowledgementFingerprint: action.acknowledged ? target.artifactFingerprint : undefined,
    };
  }
  const selection: RepositoryIntelligenceReviewSelectionState = {
    version: REPOSITORY_INTELLIGENCE_REVIEW_SELECTION_VERSION,
    sourceArtifactSetFingerprint: review.artifactSetFingerprint,
    entries,
  };
  return { review: rebuildReview(review, selection), accepted: true, reasons: [] };
}

export function validateRepositoryIntelligenceReviewSelection(input: {
  review: RepositoryIntelligenceArtifactReview;
  artifactSet: RepositoryIntelligenceArtifactSet;
  expectedRepositoryIdentityFingerprint?: string;
  expectedScanIdentity?: string;
}): RepositoryIntelligenceReviewSelectionValidation {
  const issues: RepositoryIntelligenceReviewValidationIssue[] = [];
  const selected = input.review.items.filter(item => item.selected);
  const artifactById = new Map(input.artifactSet.artifacts.map(item => [item.artifactId, item]));
  const manifestById = new Map(input.artifactSet.manifest.artifacts.map(item => [item.artifactId, item]));
  const add = (code: RepositoryIntelligenceReviewValidationIssue['code'], message: string, artifactId?: string) => issues.push({ code, message, artifactId });
  if (!selected.length) add('no-artifacts-selected', 'Select at least one validated artifact before preparing a future PR payload.');
  if (input.expectedRepositoryIdentityFingerprint && input.expectedRepositoryIdentityFingerprint !== input.review.repositoryIdentityFingerprint) {
    add('repository-identity-mismatch', 'The review belongs to a different repository identity. Rebuild the review from the current scan.');
  }
  if (input.expectedScanIdentity && input.expectedScanIdentity !== input.review.scanIdentity) {
    add('scan-identity-mismatch', 'The review belongs to a different scan. Rebuild it before applying artifacts.');
  }
  if (input.review.selection.sourceArtifactSetFingerprint !== input.review.artifactSetFingerprint
    || input.review.artifactSetFingerprint !== input.artifactSet.fingerprint) {
    add('selection-fingerprint-stale', 'The selection was created for a different artifact set. Reset it from the current review.');
  }
  for (const item of selected) {
    const rendered = artifactById.get(item.artifactId);
    const selectionEntry = input.review.selection.entries[item.artifactId];
    if (!item.selectable || item.blockedReasons.length || ['blocked', 'unavailable'].includes(item.reviewState)) {
      add('blocked-artifact-selected', 'A blocked or unavailable artifact cannot enter the selected payload.', item.artifactId);
    }
    if (item.validationState !== 'validated') add('artifact-validation-failed', 'Artifact validation failed.', item.artifactId);
    if (!rendered || rendered.fingerprint !== item.artifactFingerprint || selectionEntry?.artifactFingerprint !== item.artifactFingerprint) {
      add('artifact-fingerprint-stale', 'The rendered artifact changed after selection. Review it again.', item.artifactId);
    }
    if (!safePath(item.targetPath)) add('unsafe-target-path', 'The artifact target is not a safe repository-relative path.', item.artifactId);
    if (item.operation === 'strengthen' && (!item.preservation.existingContentPreserved || item.preservation.mode !== 'propose-additions')) {
      add('destructive-handwritten-replacement', 'A handwritten file may only use the proposed-addition representation.', item.artifactId);
    }
    for (const dependency of item.dependencies) {
      if (!dependency.satisfied) add('missing-dependency', `Required artifact category is not selected or already satisfied: ${dependency.category}.`, item.artifactId);
    }
    const manifest = manifestById.get(item.artifactId);
    if (item.category !== 'evidence-manifest' && (!manifest || !provenanceMatches(item, manifest))) {
      add('provenance-mismatch', 'Statement provenance does not match the validated evidence manifest.', item.artifactId);
    }
    if (item.humanReviewRequired && selectionEntry?.acknowledgementFingerprint !== item.artifactFingerprint) {
      add('human-review-acknowledgement-required', 'Acknowledge this artifact after reviewing its current content and evidence.', item.artifactId);
    }
  }
  const expectedFingerprint = selectedPlanFingerprint(input.review.items, input.review.selection);
  if (expectedFingerprint !== input.review.selectedPlanFingerprint) {
    add('selection-fingerprint-stale', 'The selected-plan fingerprint is stale. Rebuild the review selection.');
  }
  return {
    valid: issues.length === 0,
    issues,
    selectedArtifactIds: selected.map(item => item.artifactId).sort(),
    selectedPlanFingerprint: expectedFingerprint,
  };
}

export function buildRepositoryIntelligenceSelectedArtifactPayload(input: {
  review: RepositoryIntelligenceArtifactReview;
  artifactSet: RepositoryIntelligenceArtifactSet;
  expectedRepositoryIdentityFingerprint?: string;
  expectedScanIdentity?: string;
}): { validation: RepositoryIntelligenceReviewSelectionValidation; payload?: RepositoryIntelligenceSelectedArtifactPayload } {
  const validation = validateRepositoryIntelligenceReviewSelection(input);
  if (!validation.valid) return { validation };
  const artifacts = input.review.items
    .filter(item => item.selected && ['create', 'update', 'strengthen'].includes(item.operation))
    .map(item => ({
      artifactId: item.artifactId,
      category: item.category,
      targetPath: item.targetPath,
      operation: item.operation as Extract<RepositoryIntelligenceArtifactOperation, 'create' | 'update' | 'strengthen'>,
      content: item.renderedContent,
      contentFingerprint: stableContextFingerprint(normalizeFingerprintContent(item.renderedContent)),
      applyRepresentation: item.operation === 'create' ? 'create-file' as const
        : item.operation === 'update' ? 'replace-shipseal-managed' as const : 'proposed-addition' as const,
      expectedFileState: { ...item.expectedFileState },
      artifactFingerprint: item.artifactFingerprint,
      statementProvenance: item.statementProvenance.map(statement => ({
        ...statement,
        evidenceIds: [...statement.evidenceIds],
        findingIds: [...statement.findingIds],
        referencedPaths: [...statement.referencedPaths],
        rescanVerificationTarget: statement.rescanVerificationTarget ? { ...statement.rescanVerificationTarget } : undefined,
      })),
      humanReviewAcknowledgement: item.humanReviewRequired
        ? { artifactId: item.artifactId, artifactFingerprint: item.artifactFingerprint }
        : undefined,
    }))
    .sort((left, right) => left.targetPath.localeCompare(right.targetPath) || left.artifactId.localeCompare(right.artifactId));
  const withoutFingerprint = {
    version: REPOSITORY_INTELLIGENCE_SELECTED_PAYLOAD_VERSION,
    artifactSchemaVersion: REPOSITORY_INTELLIGENCE_ARTIFACT_SCHEMA_VERSION,
    reviewVersion: REPOSITORY_INTELLIGENCE_REVIEW_VERSION,
    repository: { ...input.review.repository },
    repositoryIdentityFingerprint: input.review.repositoryIdentityFingerprint,
    scanIdentity: input.review.scanIdentity,
    artifactSetFingerprint: input.review.artifactSetFingerprint,
    selectedPlanFingerprint: input.review.selectedPlanFingerprint,
    artifacts,
  };
  return { validation, payload: { ...withoutFingerprint, fingerprint: stableContextFingerprint(withoutFingerprint) } };
}

function finalizeReview(input: {
  repository: RepositoryIntelligenceArtifactReview['repository'];
  repositoryIdentityFingerprint: string;
  scanIdentity: string;
  analysisMode: RepositoryIntelligenceAnalysisMode;
  eligibility: RepositoryIntelligenceArtifactReview['eligibility'];
  artifactSetFingerprint: string;
  manifestFingerprint: string;
  baseItems: RepositoryIntelligenceArtifactReviewItem[];
  selection: RepositoryIntelligenceReviewSelectionState;
  limitations: string[];
}): RepositoryIntelligenceArtifactReview {
  const items = input.baseItems.map(item => {
    const entry = input.selection.entries[item.artifactId];
    const dependencies = item.dependencies.map(dependency => ({
      ...dependency,
      artifactIds: [...dependency.artifactIds],
      satisfied: dependencySatisfied(dependency, input.baseItems, input.selection.entries),
    }));
    const missing = dependencies.filter(dependency => !dependency.satisfied);
    const selected = Boolean(entry?.included && item.selectable && missing.length === 0);
    const acknowledged = item.humanReviewRequired && entry?.acknowledgementFingerprint === item.artifactFingerprint;
    return {
      ...item,
      dependencies,
      selected,
      humanReviewAcknowledged: acknowledged,
      canSelectNow: item.selectable && missing.length === 0,
      selectionReason: selected
        ? 'Included in the current future-PR selection.'
        : !item.selectable ? item.blockedReasons[0] || item.defaultSelectionReason
          : missing.length ? `Waiting for dependencies: ${missing.map(value => value.category).join(', ')}.`
            : entry && entry.artifactFingerprint !== item.artifactFingerprint ? 'Artifact content changed; selection was reset to its safe default.'
              : item.defaultSelectionReason,
    };
  });
  const selection = {
    ...input.selection,
    entries: cloneEntries(input.selection.entries),
  };
  const operationCounts = emptyOperationCounts();
  const selectedOperationCounts = emptyOperationCounts();
  for (const item of items) {
    operationCounts[item.operation] += 1;
    if (item.selected) selectedOperationCounts[item.operation] += 1;
  }
  const summary: RepositoryIntelligenceArtifactReviewSummary = {
    proposedArtifacts: items.filter(item => ['create', 'update', 'strengthen'].includes(item.operation)).length,
    selectedArtifacts: items.filter(item => item.selected).length,
    selectedStatements: items.filter(item => item.selected).reduce((sum, item) => sum + item.statementCount, 0),
    humanReviewRequired: items.filter(item => item.humanReviewRequired).length,
    humanReviewAcknowledged: items.filter(item => item.humanReviewAcknowledged).length,
    blockedOrUnavailable: items.filter(item => !item.selectable).length,
    operationCounts,
    selectedOperationCounts,
    readyForFutureApply: items.some(item => item.selected)
      && items.filter(item => item.selected).every(item => item.mayLaterBeApplied && (!item.humanReviewRequired || item.humanReviewAcknowledged)),
  };
  const selectedPlan = selectedPlanFingerprint(items, selection);
  const withoutFingerprint = {
    version: REPOSITORY_INTELLIGENCE_REVIEW_VERSION,
    repository: input.repository,
    repositoryIdentityFingerprint: input.repositoryIdentityFingerprint,
    scanIdentity: input.scanIdentity,
    analysisMode: input.analysisMode,
    eligibility: input.eligibility,
    artifactSetFingerprint: input.artifactSetFingerprint,
    manifestFingerprint: input.manifestFingerprint,
    items,
    selection,
    summary,
    limitations: [...input.limitations],
    selectedPlanFingerprint: selectedPlan,
  };
  return { ...withoutFingerprint, fingerprint: stableContextFingerprint(withoutFingerprint) };
}

function rebuildReview(review: RepositoryIntelligenceArtifactReview, selection: RepositoryIntelligenceReviewSelectionState) {
  return finalizeReview({
    repository: review.repository,
    repositoryIdentityFingerprint: review.repositoryIdentityFingerprint,
    scanIdentity: review.scanIdentity,
    analysisMode: review.analysisMode,
    eligibility: review.eligibility,
    artifactSetFingerprint: review.artifactSetFingerprint,
    manifestFingerprint: review.manifestFingerprint,
    baseItems: review.items,
    selection,
    limitations: review.limitations,
  });
}

function reconcileSelectionState(
  items: RepositoryIntelligenceArtifactReviewItem[],
  artifactSetFingerprint: string,
  previous?: RepositoryIntelligenceReviewSelectionState,
): RepositoryIntelligenceReviewSelectionState {
  const entries: Record<string, RepositoryIntelligenceReviewSelectionEntry> = {};
  for (const item of items) {
    const previousEntry = previous?.entries[item.artifactId];
    const compatible = previousEntry?.artifactFingerprint === item.artifactFingerprint;
    entries[item.artifactId] = {
      artifactFingerprint: item.artifactFingerprint,
      included: compatible ? previousEntry.included : item.defaultIncluded,
      acknowledgementFingerprint: compatible && previousEntry.acknowledgementFingerprint === item.artifactFingerprint
        ? item.artifactFingerprint : undefined,
    };
  }
  cascadeUnsatisfiedDependencies(items, entries);
  return {
    version: REPOSITORY_INTELLIGENCE_REVIEW_SELECTION_VERSION,
    sourceArtifactSetFingerprint: artifactSetFingerprint,
    entries,
  };
}

function cascadeUnsatisfiedDependencies(
  items: RepositoryIntelligenceArtifactReviewItem[],
  entries: Record<string, RepositoryIntelligenceReviewSelectionEntry>,
) {
  for (let pass = 0; pass < items.length; pass += 1) {
    let changed = false;
    for (const item of items) {
      if (!entries[item.artifactId]?.included) continue;
      if (item.dependencies.some(dependency => !dependencySatisfied(dependency, items, entries))) {
        entries[item.artifactId] = { ...entries[item.artifactId], included: false };
        changed = true;
      }
    }
    if (!changed) break;
  }
}

function dependencySatisfied(
  dependency: Pick<RepositoryIntelligenceReviewDependency, 'artifactIds'>,
  items: RepositoryIntelligenceArtifactReviewItem[],
  entries: Record<string, RepositoryIntelligenceReviewSelectionEntry>,
) {
  const byId = new Map(items.map(item => [item.artifactId, item]));
  return dependency.artifactIds.some(id => {
    const item = byId.get(id);
    return item?.operation === 'skip' || Boolean(item?.selectable && entries[id]?.included);
  });
}

function defaultSelectionFor(
  artifact: RepositoryIntelligenceArtifactSet['plan']['artifacts'][number],
  validationState: RepositoryIntelligenceReviewValidationState,
) {
  if (validationState !== 'validated') return { included: false, reason: 'Excluded because artifact validation did not pass.' };
  if (artifact.reviewState === 'blocked') return { included: false, reason: 'Blocked artifacts cannot be selected.' };
  if (artifact.reviewState === 'unavailable' || artifact.operation === 'unavailable') return { included: false, reason: 'Unavailable artifacts cannot be selected.' };
  if (artifact.operation === 'skip') return { included: false, reason: 'No change is needed because the existing artifact already covers the evidence.' };
  if (artifact.operation === 'strengthen') return { included: false, reason: 'Excluded by default because handwritten content requires separate human review.' };
  if (artifact.reviewState === 'requires-human-review' || artifact.statements.some(statement => statement.humanReviewRequired)) {
    return { included: false, reason: 'Excluded by default until its human-review requirement is inspected and acknowledged.' };
  }
  if (artifact.operation === 'update' && artifact.existingFileState !== 'shipseal-managed') {
    return { included: false, reason: 'Only a validated ShipSeal-managed file may be selected for replacement.' };
  }
  return { included: true, reason: artifact.operation === 'update'
    ? 'Included by default because this is a validated ShipSeal-managed update.'
    : 'Included by default because this is a validated new repository-specific artifact.' };
}

function eligibilityFor(
  scanInput: RepoScanInput,
  evidence: RepositoryIntelligenceEvidenceModel,
  validation: RepositoryIntelligenceArtifactValidationResult,
  items: RepositoryIntelligenceArtifactReviewItem[],
): RepositoryIntelligenceArtifactReview['eligibility'] {
  const limited = Boolean(scanInput.scanSummary?.limited || scanInput.scanSummary?.limitedScanBlocker || scanInput.scanSummary?.scanMode === 'limited-fallback');
  if (!validation.valid) return { state: 'validation-failed', explanation: 'One or more generated artifacts failed provenance or safety validation. Invalid items remain unselectable.' };
  if (!items.some(item => item.selectable)) return { state: 'artifact-generation-unavailable', explanation: 'The available evidence did not support a safely selectable repository artifact.' };
  if (evidence.summary.eligibleJsTsFiles === 0) return { state: 'unsupported-stack', explanation: 'Deep Repository Intelligence review currently requires readable JavaScript or TypeScript repository evidence.' };
  if (evidence.summary.parsedFiles === 0 && Object.keys(scanInput.textContents).length === 0) {
    return { state: 'insufficient-readable-content', explanation: 'Repository paths were detected, but readable scanner-loaded source was insufficient for a full artifact review.' };
  }
  if (limited) return { state: 'supported-limited-scan', explanation: 'Deterministic artifacts are available, but the limited scan may leave repository areas unanalyzed.' };
  if (evidence.files.some(file => file.extractionState === 'unsupported' || file.extractionState === 'parse-failed')) {
    return { state: 'partially-supported', explanation: 'The JavaScript/TypeScript evidence is reviewable, with explicit unsupported or parse-limited areas.' };
  }
  return { state: 'supported-full-scan', explanation: 'The full JavaScript/TypeScript scan produced validated repository-specific artifact drafts.' };
}

function groupValidationIssues(validation: RepositoryIntelligenceArtifactValidationResult) {
  const grouped = new Map<string, string[]>();
  for (const issue of validation.issues.filter(item => item.state === 'error' && item.artifactId)) {
    const values = grouped.get(issue.artifactId!) || [];
    values.push(issue.message);
    grouped.set(issue.artifactId!, sortedUnique(values));
  }
  return grouped;
}

function purposeFor(category: RepositoryIntelligenceArtifactCategory, statements: RepositoryIntelligenceArtifactStatement[], targetPath: string) {
  const substantive = statements.find(statement => statement.content.text.trim());
  if (substantive) return substantive.content.text.trim().slice(0, 240);
  if (category === 'evidence-manifest') return `Records statement provenance for the proposed artifacts associated with ${targetPath}.`;
  return `No repository-specific content is available for ${targetPath}.`;
}

function confidenceFor(statements: RepositoryIntelligenceArtifactStatement[]): RepositoryDeepIntelligenceConfidence {
  if (!statements.length) return 'high';
  const ranks: Record<RepositoryDeepIntelligenceConfidence, number> = { low: 0, medium: 1, high: 2 };
  return statements.reduce<RepositoryDeepIntelligenceConfidence>((lowest, statement) =>
    ranks[statement.acceptedConfidence] < ranks[lowest] ? statement.acceptedConfidence : lowest, 'high');
}

function provenanceMatches(
  item: RepositoryIntelligenceArtifactReviewItem,
  manifest: RepositoryIntelligenceArtifactSet['manifest']['artifacts'][number],
) {
  return stableContextFingerprint(item.statementProvenance.map(statement => ({
    id: statement.statementId,
    evidenceIds: [...statement.evidenceIds].sort(),
    findingIds: [...statement.findingIds].sort(),
    referencedPaths: [...statement.referencedPaths].sort(),
  }))) === stableContextFingerprint(manifest.statements.map(statement => ({
    id: statement.id,
    evidenceIds: [...statement.evidenceIds].sort(),
    findingIds: [...statement.findingIds].sort(),
    referencedPaths: [...statement.referencedPaths].sort(),
  })));
}

function selectedPlanFingerprint(items: RepositoryIntelligenceArtifactReviewItem[], selection: RepositoryIntelligenceReviewSelectionState) {
  return stableContextFingerprint({
    version: REPOSITORY_INTELLIGENCE_REVIEW_SELECTION_VERSION,
    artifactSetFingerprint: selection.sourceArtifactSetFingerprint,
    selected: items
      .filter(item => selection.entries[item.artifactId]?.included)
      .map(item => ({
        artifactId: item.artifactId,
        artifactFingerprint: item.artifactFingerprint,
        acknowledgementFingerprint: selection.entries[item.artifactId]?.acknowledgementFingerprint,
      }))
      .sort((left, right) => left.artifactId.localeCompare(right.artifactId)),
  });
}

function emptyOperationCounts(): Record<RepositoryIntelligenceArtifactOperation, number> {
  return { create: 0, update: 0, strengthen: 0, unavailable: 0, skip: 0 };
}

function safePath(path: string) {
  return Boolean(path && normalizeZipPath(path) === path && !path.startsWith('/') && !/^[A-Za-z]:/.test(path));
}

function expectedFileStateFor(
  scanInput: RepoScanInput,
  targetPath: string,
  state: RepositoryIntelligenceExistingFileState,
  operation: RepositoryIntelligenceArtifactOperation,
): RepositoryIntelligenceExpectedFileState {
  const content = scanInput.textContents[targetPath];
  if (state === 'missing') {
    return { presence: 'missing', ownership: 'missing', preservationMode: 'create-new' };
  }
  const ownership = state === 'shipseal-managed' ? 'shipseal-managed' as const : 'handwritten' as const;
  const managed = content === undefined ? undefined : extractRepositoryIntelligenceManagedSection(content);
  return {
    presence: 'existing',
    ownership,
    contentFingerprint: content === undefined ? undefined : stableContextFingerprint(normalizeFingerprintContent(content)),
    managedSectionFingerprint: managed === undefined ? undefined : stableContextFingerprint(normalizeFingerprintContent(managed)),
    preservationMode: operation === 'update' ? 'replace-managed' : 'preserve-handwritten',
  };
}

function extractRepositoryIntelligenceManagedSection(content: string) {
  const start = '<!-- shipseal:repository-intelligence:start -->';
  const end = '<!-- shipseal:repository-intelligence:end -->';
  const startIndex = content.indexOf(start);
  const endIndex = content.indexOf(end);
  if (startIndex < 0 || endIndex < 0 || endIndex < startIndex) return undefined;
  return content.slice(startIndex, endIndex + end.length);
}

function normalizeFingerprintContent(content: string) {
  return content.replace(/\r\n?/g, '\n');
}

function parentFolder(path: string) {
  const index = path.lastIndexOf('/');
  return index > 0 ? path.slice(0, index) : '';
}

function cloneEntries(entries: Record<string, RepositoryIntelligenceReviewSelectionEntry>) {
  return Object.fromEntries(Object.entries(entries).map(([id, entry]) => [id, { ...entry }]));
}

function sortedUnique(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}
