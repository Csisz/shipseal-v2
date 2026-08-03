import {
  buildOptimizationApplyPlan,
  type BuildOptimizationApplyPlanInput,
  type OptimizationApplyPlan,
} from './repositoryOptimizationApply';
import type {
  RepositoryOptimizationConflictKind,
  RepositoryOptimizationPlan,
  RepositoryOptimizationPlanItem,
} from './repositoryOptimizationPlan';

export type OptimizationPlanValidationIssueKind =
  | RepositoryOptimizationConflictKind
  | 'empty-plan'
  | 'forbidden-destination'
  | 'action-evidence-mismatch'
  | 'invalid-generated-content'
  | 'generated-content-too-large'
  | 'unsupported-artifact';

export interface OptimizationPlanValidationIssue {
  id: string;
  kind: OptimizationPlanValidationIssueKind;
  severity: 'review-required' | 'blocking';
  title: string;
  explanation: string;
  artifactId?: string;
  proposalIds: string[];
  paths: string[];
  recovery: string;
}

export interface RepositoryOptimizationPlanValidation {
  planId: string;
  readiness: 'ready-for-preview' | 'needs-review' | 'has-conflicts' | 'unsupported';
  canPrepare: boolean;
  issues: OptimizationPlanValidationIssue[];
  summary: {
    blockingCount: number;
    reviewRequiredCount: number;
    validatedArtifactCount: number;
  };
}

export interface PreparedRepositoryOptimizationPlan {
  id: string;
  lifecycle: 'prepared';
  sourcePlanId: string;
  selectedProposalIds: string[];
  validation: RepositoryOptimizationPlanValidation;
  applyPlan: OptimizationApplyPlan;
}

export type PrepareRepositoryOptimizationPlanResult =
  | { status: 'prepared'; prepared: PreparedRepositoryOptimizationPlan }
  | { status: 'blocked'; validation: RepositoryOptimizationPlanValidation };

const MAX_GENERATED_CONTENT_BYTES = 512 * 1024;

export function validateRepositoryOptimizationPlan(plan: RepositoryOptimizationPlan): RepositoryOptimizationPlanValidation {
  const issues = plan.items.flatMap(validateItem);
  const representedProposalIds = new Set(plan.items.flatMap(item => item.proposalIds));
  const unsupportedProposalIds = plan.manifest.selectedProposalIds
    .filter(proposalId => !representedProposalIds.has(proposalId));
  if (unsupportedProposalIds.length > 0) {
    issues.push({
      id: `optimization-validation:unsupported-proposals:${unsupportedProposalIds.join(':')}`,
      kind: 'unsupported-artifact',
      severity: 'blocking',
      title: 'Selected proposal has no supported plan action',
      explanation: 'One or more selected proposals do not map to a generated artifact or supported non-artifact action.',
      proposalIds: unsupportedProposalIds,
      paths: [],
      recovery: 'Remove the unsupported proposal before preparing the plan.',
    });
  }
  if (plan.items.length === 0) {
    issues.push({
      id: 'optimization-validation:empty-plan',
      kind: 'empty-plan',
      severity: 'blocking',
      title: 'No supported artifacts are selected',
      explanation: 'The plan has no included generator-backed artifacts.',
      proposalIds: [],
      paths: [],
      recovery: 'Include at least one supported proposal before preparing the plan.',
    });
  }

  const blockingCount = issues.filter(issue => issue.severity === 'blocking').length;
  const reviewRequiredCount = issues.filter(issue => issue.severity === 'review-required').length;
  const readiness = blockingCount > 0
    ? plan.items.some(item => item.artifact.action === 'unavailable') ? 'unsupported' : 'has-conflicts'
    : reviewRequiredCount > 0
      ? 'needs-review'
      : 'ready-for-preview';

  return {
    planId: plan.id,
    readiness,
    canPrepare: blockingCount === 0 && plan.items.length > 0,
    issues: issues.sort((left, right) => left.id.localeCompare(right.id)),
    summary: {
      blockingCount,
      reviewRequiredCount,
      validatedArtifactCount: plan.items.length - new Set(
        issues.filter(issue => issue.severity === 'blocking').map(issue => issue.artifactId).filter(Boolean)
      ).size,
    },
  };
}

export function prepareRepositoryOptimizationPlan(
  plan: RepositoryOptimizationPlan,
  applyInput: BuildOptimizationApplyPlanInput = {}
): PrepareRepositoryOptimizationPlanResult {
  const validation = validateRepositoryOptimizationPlan(plan);
  if (!validation.canPrepare) return { status: 'blocked', validation };
  const applyPlan = buildOptimizationApplyPlan(plan, applyInput);
  return {
    status: 'prepared',
    prepared: {
      id: `prepared:${plan.id}`,
      lifecycle: 'prepared',
      sourcePlanId: plan.id,
      selectedProposalIds: [...plan.manifest.selectedProposalIds],
      validation,
      applyPlan,
    },
  };
}

function validateItem(item: RepositoryOptimizationPlanItem): OptimizationPlanValidationIssue[] {
  const issues: OptimizationPlanValidationIssue[] = item.conflicts.map(conflict => ({
    id: `optimization-validation:${item.id}:${conflict.kind}`,
    kind: conflict.kind,
    severity: conflict.state === 'blocked' ? 'blocking' : 'review-required',
    title: issueTitle(conflict.kind),
    explanation: conflict.explanation,
    artifactId: item.artifact.id,
    proposalIds: [...conflict.proposalIds],
    paths: [...conflict.paths],
    recovery: conflict.state === 'blocked'
      ? 'Remove the affected proposal or resolve the destination before preparing.'
      : 'Review the generated content and destination before preparing.',
  }));
  const destination = normalizePath(item.artifact.repositoryDestinationPath);

  if (isForbiddenDestination(destination)) {
    issues.push(issue(item, 'forbidden-destination', 'blocking', 'Forbidden destination', 'The generated destination is outside ShipSeal’s bounded repository write paths.', 'Remove this proposal or choose a supported repository destination.'));
  }
  const destinationExists = item.conflicts.some(conflict => conflict.kind === 'exact-existing-path');
  if ((item.artifact.action === 'create' && destinationExists)
    || ((item.artifact.action === 'update' || item.artifact.action === 'strengthen') && !destinationExists)) {
    issues.push(issue(item, 'action-evidence-mismatch', 'blocking', 'Artifact action does not match repository evidence', 'The create, update, or strengthen action conflicts with the scanned destination state.', 'Review the repository destination and regenerate the plan with matching action semantics.'));
  }
  if (item.artifact.action === 'unavailable') {
    issues.push(issue(item, 'unsupported-artifact', 'blocking', 'Unsupported artifact', 'The current generator cannot produce this selected artifact.', 'Remove the unsupported proposal from the plan.'));
  }
  if (!item.artifact.content.trim()) {
    issues.push(issue(item, 'invalid-generated-content', 'blocking', 'Generated content is empty', 'The selected artifact has no validated generator output.', 'Remove the artifact or regenerate it from a supported scan.'));
  } else if (new TextEncoder().encode(item.artifact.content).byteLength > MAX_GENERATED_CONTENT_BYTES) {
    issues.push(issue(item, 'generated-content-too-large', 'blocking', 'Generated content exceeds the plan limit', 'The generated artifact is larger than the 512 KiB preparation limit.', 'Reduce or split the generated artifact before preparing.'));
  }

  return dedupeIssues(issues);
}

function issue(
  item: RepositoryOptimizationPlanItem,
  kind: OptimizationPlanValidationIssueKind,
  severity: OptimizationPlanValidationIssue['severity'],
  title: string,
  explanation: string,
  recovery: string
): OptimizationPlanValidationIssue {
  return {
    id: `optimization-validation:${item.id}:${kind}`,
    kind,
    severity,
    title,
    explanation,
    artifactId: item.artifact.id,
    proposalIds: [...item.proposalIds],
    paths: [item.artifact.repositoryDestinationPath],
    recovery,
  };
}

function isForbiddenDestination(path: string) {
  if (!path || path.startsWith('/') || /^[a-z]:\//i.test(path)) return true;
  const parts = path.toLowerCase().split('/');
  if (parts.includes('..')) return true;
  if (parts.includes('.git') || parts.includes('node_modules')) return true;
  const filename = parts[parts.length - 1];
  return filename === '.env' || filename.startsWith('.env.') || /(^|[-_.])(secret|credential|private-key)([-_.]|$)/i.test(filename);
}

function issueTitle(kind: RepositoryOptimizationConflictKind) {
  return ({
    'exact-existing-path': 'Existing destination requires review',
    'case-insensitive-path-collision': 'Path casing conflict',
    'duplicate-target': 'Duplicate destination consolidated',
    'unresolved-folder-agents-destination': 'Folder destination is unresolved',
    'unavailable-generator-output': 'Generator output is unavailable',
    'inconsistent-action': 'Artifact actions conflict',
  })[kind];
}

function normalizePath(path: string) {
  return path.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+/g, '/');
}

function dedupeIssues(issues: OptimizationPlanValidationIssue[]) {
  const seen = new Set<string>();
  return issues.filter(issue => {
    if (seen.has(issue.kind)) return false;
    seen.add(issue.kind);
    return true;
  });
}
