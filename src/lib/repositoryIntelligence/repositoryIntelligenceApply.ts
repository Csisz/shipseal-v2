import { normalizeZipPath } from '../scannerLimits.js';
import { stableContextFingerprint } from './contextSelection.js';
import {
  REPOSITORY_INTELLIGENCE_SELECTED_PAYLOAD_VERSION,
  type RepositoryIntelligenceAnalysisMode,
  type RepositoryIntelligenceExpectedFileState,
  type RepositoryIntelligenceSelectedArtifactPayload,
} from './repositoryIntelligenceApplyContract.js';

export const REPOSITORY_INTELLIGENCE_APPLY_SCHEMA_VERSION = 'shipseal.repository-intelligence-github-apply.v1' as const;
export const REPOSITORY_INTELLIGENCE_APPLY_POLICY_VERSION = 'shipseal.repository-intelligence-github-apply-policy.v1' as const;
export const REPOSITORY_INTELLIGENCE_MANAGED_SECTION_START = '<!-- shipseal:repository-intelligence:start -->';
export const REPOSITORY_INTELLIGENCE_MANAGED_SECTION_END = '<!-- shipseal:repository-intelligence:end -->';

export type RepositoryIntelligenceApplyOperation = 'create' | 'update' | 'strengthen';
export type RepositoryIntelligenceApplyErrorCode =
  | 'github-connection-required' | 'installation-unavailable' | 'repository-permission-missing'
  | 'repository-not-found' | 'base-branch-missing' | 'scan-repository-mismatch'
  | 'stale-selected-plan' | 'stale-target-file' | 'target-now-exists' | 'target-disappeared'
  | 'managed-marker-conflict' | 'handwritten-preservation-conflict' | 'invalid-acknowledgement'
  | 'unsafe-path' | 'invalid-payload' | 'branch-creation-failed' | 'branch-already-exists'
  | 'file-write-failed' | 'partial-write-state' | 'pull-request-already-exists'
  | 'pull-request-creation-failed' | 'rate-limit' | 'github-unavailable' | 'internal-validation-failure';

export interface RepositoryIntelligenceApplyPolicy {
  version: typeof REPOSITORY_INTELLIGENCE_APPLY_POLICY_VERSION;
  maximumSelectedFiles: number;
  maximumTotalRenderedCharacters: number;
  maximumCharactersPerFile: number;
  maximumTargetPathLength: number;
  maximumPullRequestBodyCharacters: number;
  maximumAcknowledgements: number;
  maximumProvenanceReferences: number;
}

export const DEFAULT_REPOSITORY_INTELLIGENCE_APPLY_POLICY: RepositoryIntelligenceApplyPolicy = Object.freeze({
  version: REPOSITORY_INTELLIGENCE_APPLY_POLICY_VERSION,
  maximumSelectedFiles: 20,
  maximumTotalRenderedCharacters: 768 * 1024,
  maximumCharactersPerFile: 200_000,
  maximumTargetPathLength: 180,
  maximumPullRequestBodyCharacters: 16_000,
  maximumAcknowledgements: 20,
  maximumProvenanceReferences: 2_000,
});

export interface RepositoryIntelligenceGithubApplyRequest {
  version: typeof REPOSITORY_INTELLIGENCE_APPLY_SCHEMA_VERSION;
  mode: 'preview' | 'apply';
  installationId: string;
  owner: string;
  repo: string;
  baseBranch: string;
  analysisMode: RepositoryIntelligenceAnalysisMode;
  selectedPayload: RepositoryIntelligenceSelectedArtifactPayload;
  confirmed: boolean;
}

export interface RepositoryIntelligenceCurrentFileState {
  path: string;
  kind: 'missing' | 'file' | 'directory' | 'excluded';
  content?: string;
  blobSha?: string;
}

export interface RepositoryIntelligenceCurrentRepositoryState {
  owner: string;
  repo: string;
  baseBranch: string;
  baseCommit: string;
  files: RepositoryIntelligenceCurrentFileState[];
}

export interface RepositoryIntelligenceApplyIssue {
  code: RepositoryIntelligenceApplyErrorCode;
  message: string;
  nextAction: string;
  path?: string;
}

export interface RepositoryIntelligenceApplyPlanFile {
  artifactId: string;
  category: RepositoryIntelligenceSelectedArtifactPayload['artifacts'][number]['category'];
  artifactFingerprint: string;
  path: string;
  operation: RepositoryIntelligenceApplyOperation;
  expectedState: RepositoryIntelligenceExpectedFileState;
  currentContentFingerprint?: string;
  finalContentFingerprint: string;
  expectedManagedSectionFingerprint?: string;
  expectedPreservationFingerprint?: string;
  preservedLineFingerprints: string[];
  finalContent: string;
  blobSha?: string;
  provenanceReferences: number;
  humanReviewAcknowledged: boolean;
  statementProvenance: RepositoryIntelligenceSelectedArtifactPayload['artifacts'][number]['statementProvenance'];
}

export interface RepositoryIntelligenceGithubApplyPlan {
  version: typeof REPOSITORY_INTELLIGENCE_APPLY_SCHEMA_VERSION;
  repository: { owner: string; repo: string };
  baseBranch: string;
  baseCommit: string;
  proposedBranchName: string;
  pullRequestTitle: string;
  pullRequestBody: string;
  selectedPlanFingerprint: string;
  files: RepositoryIntelligenceApplyPlanFile[];
  operationCounts: Record<RepositoryIntelligenceApplyOperation, number>;
  acknowledgementCount: number;
  provenanceReferenceCount: number;
  blockingErrors: RepositoryIntelligenceApplyIssue[];
  warnings: string[];
  applyReady: boolean;
  fingerprint: string;
}

export interface RepositoryIntelligenceApplyValidationResult {
  valid: boolean;
  request?: RepositoryIntelligenceGithubApplyRequest;
  issues: RepositoryIntelligenceApplyIssue[];
}

export function validateRepositoryIntelligenceGithubApplyRequest(
  input: unknown,
  policy: RepositoryIntelligenceApplyPolicy = DEFAULT_REPOSITORY_INTELLIGENCE_APPLY_POLICY,
): RepositoryIntelligenceApplyValidationResult {
  const issues: RepositoryIntelligenceApplyIssue[] = [];
  const add = (code: RepositoryIntelligenceApplyErrorCode, message: string, nextAction: string, path?: string) =>
    issues.push({ code, message, nextAction, path });
  if (!isRecord(input)) {
    add('invalid-payload', 'The Repository Intelligence request is not a valid object.', 'Rebuild the PR preview from the current scan.');
    return { valid: false, issues };
  }
  if (containsCredentialField(input)) add('invalid-payload', 'Credential fields are not accepted in Repository Intelligence apply payloads.', 'Reconnect through the GitHub App; do not submit tokens or credentials.');
  const allowed = new Set(['version', 'mode', 'installationId', 'owner', 'repo', 'baseBranch', 'analysisMode', 'selectedPayload', 'confirmed']);
  if (Object.keys(input).some(key => !allowed.has(key))) add('invalid-payload', 'The request contains unsupported fields.', 'Rebuild the preview without credentials or extra fields.');
  const request = input as unknown as RepositoryIntelligenceGithubApplyRequest;
  if (request.version !== REPOSITORY_INTELLIGENCE_APPLY_SCHEMA_VERSION) add('invalid-payload', 'Unsupported apply schema version.', 'Regenerate the preview with the current ShipSeal version.');
  if (!['preview', 'apply'].includes(request.mode)) add('invalid-payload', 'The request mode is invalid.', 'Open a new PR preview.');
  if (request.mode === 'apply' && request.confirmed !== true) add('invalid-payload', 'Explicit confirmation is required before GitHub mutation.', 'Review the plan and use the final Create Pull Request confirmation.');
  if (request.mode === 'preview' && request.confirmed) add('invalid-payload', 'Preview requests cannot be confirmed mutations.', 'Open the preview without confirmation.');
  if (!/^\d+$/.test(stringValue(request.installationId))) add('installation-unavailable', 'A valid GitHub App installation is required.', 'Reconnect GitHub and select the repository again.');
  if (!safeRepoPart(request.owner) || !safeRepoPart(request.repo)) add('invalid-payload', 'Repository owner or name is invalid.', 'Select the connected repository again.');
  if (!safeBranch(request.baseBranch)) add('base-branch-missing', 'A safe base branch is required.', 'Rescan the connected repository with its base branch.');
  if (!['deterministic-repository-evidence', 'deep-intelligence-enhanced'].includes(request.analysisMode)) add('invalid-payload', 'Analysis mode is invalid.', 'Regenerate Repository Intelligence.');
  const payload = request.selectedPayload;
  if (!isRecord(payload) || payload.version !== REPOSITORY_INTELLIGENCE_SELECTED_PAYLOAD_VERSION || !Array.isArray(payload.artifacts)) {
    add('invalid-payload', 'The reviewed selected-artifact payload is invalid.', 'Return to artifact review and rebuild the selection.');
    return { valid: false, issues };
  }
  const expectedPayloadFingerprint = stableContextFingerprint(omitFingerprint(payload));
  if (payload.fingerprint !== expectedPayloadFingerprint) add('stale-selected-plan', 'The selected payload fingerprint no longer matches its reviewed content.', 'Regenerate and review the artifact selection.');
  const fullName = `${request.owner}/${request.repo}`;
  if (payload.repository.fullName && payload.repository.fullName.toLowerCase() !== fullName.toLowerCase()) {
    add('scan-repository-mismatch', 'The reviewed scan belongs to a different GitHub repository.', 'Rescan the currently connected repository.');
  }
  if (payload.repository.ref && payload.repository.ref !== request.baseBranch) add('scan-repository-mismatch', 'The reviewed scan used a different branch or ref.', 'Rescan the selected base branch.');
  if (!payload.artifacts.length) add('invalid-payload', 'At least one reviewed artifact is required.', 'Select a validated artifact.');
  if (payload.artifacts.length > policy.maximumSelectedFiles) add('invalid-payload', 'Too many artifacts were selected for one PR.', 'Reduce the selected artifact set.');
  let total = 0;
  let acknowledgements = 0;
  let provenance = 0;
  const paths = new Set<string>();
  for (const artifact of payload.artifacts) {
    const path = normalizeZipPath(stringValue(artifact.targetPath));
    if (!path || path !== artifact.targetPath || path.length > policy.maximumTargetPathLength) add('unsafe-path', 'An artifact target path is unsafe.', 'Regenerate the artifact plan.', artifact.targetPath);
    if (paths.has(path)) add('invalid-payload', 'Multiple artifacts target the same path.', 'Select only one operation per target.', path);
    paths.add(path);
    if (!['create', 'update', 'strengthen'].includes(artifact.operation)) add('invalid-payload', 'An artifact operation is not applyable.', 'Rebuild the selection.', path);
    if (!representationMatches(artifact.operation, artifact.applyRepresentation)) add('invalid-payload', 'The apply representation does not match the reviewed operation.', 'Rebuild the selection.', path);
    if (!artifact.content?.trim()) add('invalid-payload', 'Reviewed artifact content cannot be empty.', 'Regenerate the artifact.', path);
    if (artifact.contentFingerprint !== stableContextFingerprint(normalizeContent(artifact.content || ''))) add('stale-selected-plan', 'Reviewed artifact content no longer matches its fingerprint.', 'Regenerate and review the artifact again.', path);
    if (artifact.content.length > policy.maximumCharactersPerFile) add('invalid-payload', 'A selected artifact exceeds the per-file limit.', 'Reduce the artifact size.', path);
    total += artifact.content?.length || 0;
    provenance += artifact.statementProvenance?.reduce((sum, item) => sum + item.evidenceIds.length + item.findingIds.length, 0) || 0;
    const acknowledgement = artifact.humanReviewAcknowledgement;
    if (acknowledgement) {
      acknowledgements += 1;
      if (acknowledgement.artifactId !== artifact.artifactId || acknowledgement.artifactFingerprint !== artifact.artifactFingerprint) {
        add('invalid-acknowledgement', 'A human-review acknowledgement is stale or mismatched.', 'Review and acknowledge the current artifact again.', path);
      }
    }
    if (artifact.operation === 'strengthen' && !acknowledgement) add('invalid-acknowledgement', 'Handwritten strengthening requires an explicit current acknowledgement.', 'Review and acknowledge this artifact.', path);
    validateExpectedState(artifact.operation, artifact.expectedFileState, add, path);
  }
  if (total > policy.maximumTotalRenderedCharacters) add('invalid-payload', 'Selected rendered content exceeds the total request limit.', 'Reduce the selected artifact set.');
  if (acknowledgements > policy.maximumAcknowledgements) add('invalid-payload', 'Too many acknowledgement records were submitted.', 'Reduce the selected artifact set.');
  if (provenance > policy.maximumProvenanceReferences) add('invalid-payload', 'The selected provenance set exceeds the request limit.', 'Reduce the selected artifact set.');
  return { valid: issues.length === 0, request: issues.length ? undefined : request, issues };
}

export function buildRepositoryIntelligenceGithubApplyPlan(input: {
  request: RepositoryIntelligenceGithubApplyRequest;
  currentRepositoryState: RepositoryIntelligenceCurrentRepositoryState;
  policy?: RepositoryIntelligenceApplyPolicy;
}): RepositoryIntelligenceGithubApplyPlan {
  const policy = input.policy || DEFAULT_REPOSITORY_INTELLIGENCE_APPLY_POLICY;
  const validation = validateRepositoryIntelligenceGithubApplyRequest(input.request, policy);
  const blockingErrors = [...validation.issues];
  const current = input.currentRepositoryState;
  if (current.owner.toLowerCase() !== input.request.owner.toLowerCase() || current.repo.toLowerCase() !== input.request.repo.toLowerCase()) {
    blockingErrors.push(issue('scan-repository-mismatch', 'Current repository identity differs from the reviewed plan.', 'Rescan the connected repository.'));
  }
  if (current.baseBranch !== input.request.baseBranch) blockingErrors.push(issue('scan-repository-mismatch', 'Current base branch differs from the reviewed plan.', 'Rescan the selected base branch.'));
  const currentByPath = new Map(current.files.map(file => [file.path, file]));
  const files: RepositoryIntelligenceApplyPlanFile[] = [];
  for (const artifact of [...input.request.selectedPayload.artifacts].sort((left, right) => left.targetPath.localeCompare(right.targetPath) || left.artifactId.localeCompare(right.artifactId))) {
    const state = currentByPath.get(artifact.targetPath) || { path: artifact.targetPath, kind: 'missing' as const };
    const prepared = prepareOperation(artifact, state);
    if ('issue' in prepared) {
      blockingErrors.push(prepared.issue);
      continue;
    }
    files.push(prepared.file);
  }
  const operationCounts = { create: 0, update: 0, strengthen: 0 };
  for (const file of files) operationCounts[file.operation] += 1;
  const branch = `shipseal/repository-intelligence-${input.request.selectedPayload.selectedPlanFingerprint.slice(0, 12)}`;
  const title = 'ShipSeal: improve AI repository intelligence';
  const body = buildPullRequestBody(input.request, files, operationCounts, branch).slice(0, policy.maximumPullRequestBodyCharacters);
  const acknowledgementCount = files.filter(file => file.humanReviewAcknowledged).length;
  const provenanceReferenceCount = files.reduce((sum, file) => sum + file.provenanceReferences, 0);
  const withoutFingerprint = {
    version: REPOSITORY_INTELLIGENCE_APPLY_SCHEMA_VERSION,
    repository: { owner: input.request.owner, repo: input.request.repo },
    baseBranch: current.baseBranch,
    baseCommit: current.baseCommit,
    proposedBranchName: branch,
    pullRequestTitle: title,
    pullRequestBody: body,
    selectedPlanFingerprint: input.request.selectedPayload.selectedPlanFingerprint,
    files,
    operationCounts,
    acknowledgementCount,
    provenanceReferenceCount,
    blockingErrors,
    warnings: sortedUnique([
      ...(operationCounts.strengthen ? ['Handwritten files are preserved outside the delimited ShipSeal-managed section.'] : []),
      ...input.request.selectedPayload.artifacts.flatMap(artifact => artifact.statementProvenance.some(item => item.humanReviewRequired) ? ['Selected statements still require human review in the Pull Request.'] : []),
    ]),
    applyReady: blockingErrors.length === 0 && files.length === input.request.selectedPayload.artifacts.length,
  };
  return { ...withoutFingerprint, fingerprint: stableContextFingerprint(withoutFingerprint) };
}

function prepareOperation(
  artifact: RepositoryIntelligenceSelectedArtifactPayload['artifacts'][number],
  current: RepositoryIntelligenceCurrentFileState,
): { file: RepositoryIntelligenceApplyPlanFile } | { issue: RepositoryIntelligenceApplyIssue } {
  const expected = artifact.expectedFileState;
  if (current.kind === 'directory' || current.kind === 'excluded') return { issue: issue('stale-target-file', 'The target is not an applyable repository file.', 'Rescan before preparing another PR.', artifact.targetPath) };
  if (artifact.operation === 'create' && current.kind !== 'missing') return { issue: issue('target-now-exists', 'A file now exists at a reviewed create target.', 'Rescan so ShipSeal can preserve the current file.', artifact.targetPath) };
  if (artifact.operation !== 'create' && current.kind === 'missing') return { issue: issue('target-disappeared', 'A reviewed existing target no longer exists.', 'Rescan before preparing another PR.', artifact.targetPath) };
  const normalizedCurrent = normalizeContent(current.content || '');
  const currentFingerprint = current.kind === 'file' ? stableContextFingerprint(normalizedCurrent) : undefined;
  if (expected.presence === 'existing' && currentFingerprint !== expected.contentFingerprint) return { issue: issue('stale-target-file', 'The target changed materially after the reviewed scan.', 'Rescan and review regenerated artifacts.', artifact.targetPath) };
  let finalContent = ensureFinalNewline(normalizeContent(artifact.content));
  if (artifact.operation === 'update') {
    if (expected.ownership !== 'shipseal-managed' || !isRecognizedShipSealManaged(normalizedCurrent)) {
      return { issue: issue('managed-marker-conflict', 'The current file is not a recognized ShipSeal-managed artifact.', 'Rescan and review the file as handwritten content.', artifact.targetPath) };
    }
  }
  if (artifact.operation === 'strengthen') {
    const merged = strengthenHandwrittenContent(normalizedCurrent, artifact.content);
    if (merged.ok === false) return { issue: issue('handwritten-preservation-conflict', merged.message, 'Repair the managed markers or rescan before retrying.', artifact.targetPath) };
    finalContent = merged.content;
  }
  return { file: {
    artifactId: artifact.artifactId,
    category: artifact.category,
    artifactFingerprint: artifact.artifactFingerprint,
    path: artifact.targetPath,
    operation: artifact.operation,
    expectedState: { ...expected },
    currentContentFingerprint: currentFingerprint,
    finalContentFingerprint: stableContextFingerprint(normalizeContent(finalContent)),
    expectedManagedSectionFingerprint: artifact.operation === 'strengthen' ? fingerprintManagedSection(finalContent) : undefined,
    expectedPreservationFingerprint: artifact.operation === 'strengthen' ? stableContextFingerprint(contentOutsideManagedSection(finalContent)) : undefined,
    preservedLineFingerprints: artifact.operation === 'strengthen' ? lineFingerprints(contentOutsideManagedSection(finalContent)) : [],
    finalContent,
    blobSha: current.blobSha,
    provenanceReferences: artifact.statementProvenance.reduce((sum, value) => sum + value.evidenceIds.length + value.findingIds.length, 0),
    humanReviewAcknowledged: Boolean(artifact.humanReviewAcknowledgement),
    statementProvenance: artifact.statementProvenance.map(statement => ({
      ...statement,
      evidenceIds: [...statement.evidenceIds], findingIds: [...statement.findingIds], referencedPaths: [...statement.referencedPaths],
      rescanVerificationTarget: statement.rescanVerificationTarget ? { ...statement.rescanVerificationTarget } : undefined,
    })),
  } };
}

export function strengthenHandwrittenContent(existing: string, proposedAddition: string): { ok: true; content: string } | { ok: false; message: string } {
  const starts = occurrences(existing, REPOSITORY_INTELLIGENCE_MANAGED_SECTION_START);
  const ends = occurrences(existing, REPOSITORY_INTELLIGENCE_MANAGED_SECTION_END);
  if (starts.length !== ends.length || starts.length > 1) return { ok: false, message: 'Managed section markers are missing, duplicated, or ambiguous.' };
  if (starts.length === 1 && starts[0] > ends[0]) return { ok: false, message: 'Managed section markers are nested or reversed.' };
  const section = [REPOSITORY_INTELLIGENCE_MANAGED_SECTION_START, normalizeContent(proposedAddition).trim(), REPOSITORY_INTELLIGENCE_MANAGED_SECTION_END].join('\n');
  if (!starts.length) return { ok: true, content: `${normalizeContent(existing).replace(/\n*$/, '')}\n\n${section}\n` };
  const before = existing.slice(0, starts[0]);
  const after = existing.slice(ends[0] + REPOSITORY_INTELLIGENCE_MANAGED_SECTION_END.length);
  return { ok: true, content: ensureFinalNewline(`${before}${section}${after}`) };
}

function buildPullRequestBody(request: RepositoryIntelligenceGithubApplyRequest, files: RepositoryIntelligenceApplyPlanFile[], counts: Record<RepositoryIntelligenceApplyOperation, number>, branch: string) {
  const paths = files.map(file => `- \`${file.path}\` (${file.operation})`).join('\n');
  return [
    'Generated by ShipSeal from explicitly reviewed, evidence-linked Repository Intelligence artifacts.', '',
    `Analysis mode: ${request.analysisMode === 'deep-intelligence-enhanced' ? 'validated deep-intelligence enhanced' : 'deterministic repository evidence only'}`,
    `Selected artifacts: ${files.length} (${counts.create} create, ${counts.update} update, ${counts.strengthen} strengthen)`,
    `Base branch: \`${request.baseBranch}\``, `Proposed branch: \`${branch}\``,
    `Scan fingerprint: \`${request.selectedPayload.scanIdentity.slice(0, 16)}\``,
    `Selected-plan fingerprint: \`${request.selectedPayload.selectedPlanFingerprint.slice(0, 16)}\``, '',
    'Reviewed paths:', paths || '- None', '',
    'Safety and preservation:',
    '- ShipSeal revalidated every target against the scanned base-branch state before writing.',
    '- Handwritten files are preserved outside a clearly delimited ShipSeal-managed section.',
    '- Repository code was analyzed statically and was not executed.',
    '- This PR does not certify runtime behavior, security, privacy, legal, or compliance outcomes.', '',
    'Reviewer steps:',
    '- Review every changed file and each human-review-required statement.',
    '- Confirm commands and sensitive-area guidance against the actual project.',
    '- Merge only after normal repository checks pass, then rescan with ShipSeal to verify the result.', '',
    `<!-- shipseal:repository-intelligence-plan:${request.selectedPayload.selectedPlanFingerprint} -->`,
  ].join('\n');
}

function validateExpectedState(operation: RepositoryIntelligenceApplyOperation, state: RepositoryIntelligenceExpectedFileState | undefined, add: (code: RepositoryIntelligenceApplyErrorCode, message: string, nextAction: string, path?: string) => void, path: string) {
  if (!state || !['missing', 'existing'].includes(state.presence)) return add('invalid-payload', 'Expected file state is missing or invalid.', 'Rescan and rebuild the review.', path);
  if (operation === 'create' && (state.presence !== 'missing' || state.preservationMode !== 'create-new')) add('invalid-payload', 'Create expected state is inconsistent.', 'Rebuild the review.', path);
  if (operation !== 'create' && (state.presence !== 'existing' || !state.contentFingerprint)) add('invalid-payload', 'Existing targets require a reviewed content fingerprint.', 'Rescan and rebuild the review.', path);
  if (operation === 'update' && (state.ownership !== 'shipseal-managed' || state.preservationMode !== 'replace-managed')) add('invalid-payload', 'Update may only target a recognized ShipSeal-managed file.', 'Rescan and rebuild the review.', path);
  if (operation === 'strengthen' && (state.ownership !== 'handwritten' || state.preservationMode !== 'preserve-handwritten')) add('invalid-payload', 'Strengthen must preserve a reviewed handwritten file.', 'Rescan and rebuild the review.', path);
}

function representationMatches(operation: string, representation: string) {
  return (operation === 'create' && representation === 'create-file') || (operation === 'update' && representation === 'replace-shipseal-managed') || (operation === 'strengthen' && representation === 'proposed-addition');
}
function isRecognizedShipSealManaged(content: string) { return /Generated by ShipSeal|shipseal\.[a-z-]+\.generator|shipseal:repository-intelligence:managed|shipseal\.repository-intelligence-evidence-manifest\.v1/i.test(content); }
function fingerprintManagedSection(content: string) { const section = managedSection(content); return section === undefined ? undefined : stableContextFingerprint(section); }
function managedSection(content: string) { const start = content.indexOf(REPOSITORY_INTELLIGENCE_MANAGED_SECTION_START); const end = content.indexOf(REPOSITORY_INTELLIGENCE_MANAGED_SECTION_END); return start >= 0 && end >= start ? content.slice(start, end + REPOSITORY_INTELLIGENCE_MANAGED_SECTION_END.length) : undefined; }
function contentOutsideManagedSection(content: string) { const start = content.indexOf(REPOSITORY_INTELLIGENCE_MANAGED_SECTION_START); const end = content.indexOf(REPOSITORY_INTELLIGENCE_MANAGED_SECTION_END); return start >= 0 && end >= start ? normalizeContent(`${content.slice(0, start)}${content.slice(end + REPOSITORY_INTELLIGENCE_MANAGED_SECTION_END.length)}`) : normalizeContent(content); }
function lineFingerprints(content: string) { return content.split('\n').map(line => line.trim()).filter(Boolean).map(line => stableContextFingerprint(line)).slice(0, 500); }
function omitFingerprint(payload: Record<string, unknown>) { const { fingerprint: _fingerprint, ...rest } = payload; return rest; }
function normalizeContent(value: string) { return value.replace(/\r\n?/g, '\n'); }
function ensureFinalNewline(value: string) { return `${value.replace(/\n*$/, '')}\n`; }
function occurrences(value: string, marker: string) { const indexes: number[] = []; let from = 0; while (true) { const index = value.indexOf(marker, from); if (index < 0) return indexes; indexes.push(index); from = index + marker.length; } }
function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value && typeof value === 'object' && !Array.isArray(value)); }
function containsCredentialField(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsCredentialField);
  if (!isRecord(value)) return false;
  return Object.entries(value).some(([key, nested]) => /^(githubToken|installationToken|accessToken|authorization|credential|credentials)$/i.test(key) || containsCredentialField(nested));
}
function stringValue(value: unknown) { return typeof value === 'string' ? value.trim() : ''; }
function safeRepoPart(value: unknown) { const text = stringValue(value); return text.length > 0 && text.length <= 100 && /^[A-Za-z0-9_.-]+$/.test(text); }
function safeBranch(value: unknown) { const text = stringValue(value); return text.length > 0 && text.length <= 160 && /^[A-Za-z0-9._/-]+$/.test(text) && !text.includes('..') && !text.startsWith('/') && !text.endsWith('/'); }
function issue(code: RepositoryIntelligenceApplyErrorCode, message: string, nextAction: string, path?: string): RepositoryIntelligenceApplyIssue { return { code, message, nextAction, path }; }
function sortedUnique(values: string[]) { return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b)); }
