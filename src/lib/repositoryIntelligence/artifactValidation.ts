import type { RepoScanInput } from '../types';
import { normalizeZipPath } from '../scannerLimits';
import type { RepositoryIntelligenceEvidenceModel } from './evidence';
import type { RepositoryDeepIntelligenceValidatedResult } from './deepIntelligenceSchema';
import { stableContextFingerprint } from './contextSelection';
import {
  type RepositoryIntelligenceArtifactSet,
  type RepositoryIntelligenceArtifactValidationIssue,
  type RepositoryIntelligenceArtifactValidationResult,
} from './artifactSchema';
import { renderRepositoryIntelligenceArtifact, serializeRepositoryIntelligenceArtifactManifest } from './artifactRendering';

export interface ValidateRepositoryIntelligenceArtifactSetInput {
  artifactSet: RepositoryIntelligenceArtifactSet;
  evidenceResult: RepositoryIntelligenceEvidenceModel;
  deepIntelligenceResult?: RepositoryDeepIntelligenceValidatedResult;
  scanInput: RepoScanInput;
}

const SECRET_RE = /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----|\b(?:sk|ghp|github_pat)_[A-Za-z0-9_-]{12,}|\b(?:API[_-]?KEY|ACCESS[_-]?TOKEN|SECRET|PASSWORD)\s*[:=]\s*\S+/i;
const ABSOLUTE_PATH_RE = /(?:[A-Za-z]:[\\/](?:Users|Documents|home)[\\/]|file:\/\/\/|\/Users\/[^/]+\/|\/home\/[^/]+\/)/i;
const PROHIBITED_RE = /\b(?:shipseal|we|i)\s+(?:ran|executed|deployed|migrated)\b|\b(?:certified|guaranteed compliant|fully compliant|security guarantee)\b|\b(?:system prompt|hidden reasoning|chain[- ]of[- ]thought)\b/i;
const GENERIC_RE = /\b(?:write clean code|follow best practices|test your changes)\b/i;

export function validateRepositoryIntelligenceArtifactSet({
  artifactSet,
  evidenceResult,
  deepIntelligenceResult,
  scanInput,
}: ValidateRepositoryIntelligenceArtifactSetInput): RepositoryIntelligenceArtifactValidationResult {
  const issues: RepositoryIntelligenceArtifactValidationIssue[] = [];
  const evidenceById = new Map(evidenceResult.evidence.map(item => [item.id, item]));
  const findingById = new Map(deepIntelligenceResult?.findings.map(item => [item.id, item]) || []);
  const knownPaths = new Set([...evidenceResult.files.map(item => item.path), ...evidenceResult.folders.map(item => item.path)]);
  const existingPaths = new Set(scanInput.files.map(item => normalizeZipPath(item.path)).filter(Boolean));
  const renderedById = new Map(artifactSet.artifacts.map(item => [item.artifactId, item]));
  const validatedArtifactIds: string[] = [];
  const blockedArtifactIds = new Set<string>();

  for (const artifact of artifactSet.plan.artifacts) {
    let artifactError = false;
    const add = (code: string, message: string, statementId?: string, state: 'warning' | 'error' = 'error') => {
      issues.push({ code, state, artifactId: artifact.id, statementId, message });
      if (state === 'error') artifactError = true;
    };
    if (!normalizeZipPath(artifact.targetPath) || normalizeZipPath(artifact.targetPath) !== artifact.targetPath) {
      add('unsafe-target-path', 'Artifact target path is not a normalized repository-relative path.');
    }
    const rendered = renderedById.get(artifact.id);
    if (!rendered) add('missing-rendered-artifact', 'Planned artifact has no corresponding rendered record.');
    if (rendered && rendered.fingerprint !== stableContextFingerprint({ artifactFingerprint: artifact.fingerprint, content: rendered.content })) {
      add('artifact-fingerprint-mismatch', 'Rendered artifact fingerprint does not match its planned artifact and content.');
    }
    if (rendered && rendered.content.length > artifactSet.plan.policy.maximumArtifactCharacters) add('artifact-size-limit', 'Rendered artifact exceeded the configured character limit.');
    if (rendered && unsafeOutput(rendered.content)) add('unsafe-rendered-content', 'Rendered artifact contained prohibited or sensitive output.');
    if (rendered && GENERIC_RE.test(rendered.content)) add('generic-guidance', 'Generic evidence-free guidance is prohibited.');
    if (artifact.operation === 'skip' || artifact.operation === 'unavailable') {
      if (rendered?.content) add('unexpected-content', 'Skipped or unavailable artifact must not emit content.');
    } else if (artifact.category !== 'evidence-manifest' && !rendered?.content) {
      add('missing-content', 'Reviewable artifact did not render content.');
    }
    if (artifact.operation === 'update' && artifact.existingFileState !== 'shipseal-managed') {
      add('unsafe-update', 'Only explicitly ShipSeal-managed existing files may be replaced by an update operation.');
    }
    if (artifact.operation === 'strengthen' && !artifact.preservation.existingContentPreserved) {
      add('handwritten-preservation', 'Strengthen operations must preserve existing handwritten content.');
    }
    if (artifact.operation === 'create' && existingPaths.has(artifact.targetPath)) {
      add('create-existing-path', 'Create operation targets an existing repository file.');
    }
    const substantive = artifact.statements.filter(statement => !['heading', 'limitation', 'unavailable-information-notice'].includes(statement.type));
    if (artifact.operation !== 'unavailable' && artifact.operation !== 'skip' && artifact.category !== 'evidence-manifest' && !substantive.length) {
      add('generic-empty-artifact', 'Artifact has no repository-specific substantive statements.');
    }
    for (const statement of artifact.statements) {
      if (statement.referencedPaths.length > artifactSet.plan.policy.maximumReferencedPathsPerStatement) {
        add('statement-path-limit', 'Statement exceeded the configured referenced-path limit.', statement.id);
      }
      if (statement.referencedPaths.some(path => !knownPaths.has(path))) add('unknown-statement-path', 'Statement references a nonexistent repository path.', statement.id);
      if (statement.supportingEvidenceIds.some(id => !evidenceById.has(id))) add('unknown-statement-evidence', 'Statement references unknown deterministic evidence.', statement.id);
      if (statement.supportingFindingIds.some(id => !findingById.has(id))) add('unknown-statement-finding', 'Statement references a rejected, unavailable, or unknown finding.', statement.id);
      if (!['heading', 'limitation', 'unavailable-information-notice'].includes(statement.type)
        && !statement.supportingEvidenceIds.length && !statement.supportingFindingIds.length) {
        add('missing-statement-provenance', 'Substantive statement has no deterministic evidence or validated finding.', statement.id);
      }
      if (statement.humanReviewRequired && artifact.reviewState !== 'requires-human-review') {
        add('missing-human-review-state', 'Human-review statement is not reflected in artifact review state.', statement.id);
      }
      if (unsafeOutput(statement.content.text)) add('unsafe-statement', 'Statement contained prohibited or sensitive output.', statement.id);
      if (GENERIC_RE.test(statement.content.text)) add('generic-statement', 'Generic evidence-free statement is prohibited.', statement.id);
      if (statement.type === 'command') validateCommand(statement, evidenceById, findingById, add);
    }
    if (rendered && artifact.category !== 'evidence-manifest' && artifact.operation !== 'skip' && artifact.operation !== 'unavailable') {
      const rerendered = renderRepositoryIntelligenceArtifact(artifact);
      if (rerendered !== rendered.content) add('nondeterministic-render', 'Rendered Markdown does not match deterministic structured-statement rendering.');
    }
    if (artifactError) blockedArtifactIds.add(artifact.id);
    else validatedArtifactIds.push(artifact.id);
  }

  validateManifest(artifactSet, issues, blockedArtifactIds);
  const { fingerprint: manifestFingerprint, ...manifestWithoutFingerprint } = artifactSet.manifest;
  if (manifestFingerprint !== stableContextFingerprint(manifestWithoutFingerprint)) {
    issues.push({ code: 'manifest-fingerprint-mismatch', state: 'error', message: 'Evidence manifest fingerprint is invalid.' });
  }
  if (artifactSet.fingerprint !== artifactSet.manifest.artifactSetFingerprint) {
    issues.push({ code: 'artifact-set-fingerprint-mismatch', state: 'error', message: 'Artifact-set fingerprint does not match the evidence manifest.' });
  }
  const errors = issues.filter(item => item.state === 'error').length;
  return {
    valid: errors === 0,
    issues: issues.sort((a, b) => `${a.artifactId || ''}:${a.statementId || ''}:${a.code}`.localeCompare(`${b.artifactId || ''}:${b.statementId || ''}:${b.code}`)),
    validatedArtifactIds: validatedArtifactIds.sort(),
    blockedArtifactIds: [...blockedArtifactIds].sort(),
    summary: {
      artifacts: artifactSet.plan.artifacts.length,
      statements: artifactSet.plan.artifacts.reduce((total, artifact) => total + artifact.statements.length, 0),
      errors,
      warnings: issues.filter(item => item.state === 'warning').length,
    },
  };
}

function validateCommand(
  statement: RepositoryIntelligenceArtifactSet['plan']['artifacts'][number]['statements'][number],
  evidenceById: Map<string, RepositoryIntelligenceEvidenceModel['evidence'][number]>,
  findingById: Map<string, NonNullable<RepositoryDeepIntelligenceValidatedResult>['findings'][number]>,
  add: (code: string, message: string, statementId?: string, state?: 'warning' | 'error') => void,
) {
  const deterministic = statement.supportingEvidenceIds.some(id => evidenceById.get(id)?.category === 'command');
  const findingStates = statement.supportingFindingIds.map(id => findingById.get(id)?.commandState);
  if (!deterministic && !findingStates.includes('verified') && !findingStates.includes('inferred')) {
    add('unsupported-command', 'Command statement is not supported by verified or visibly inferred command evidence.', statement.id);
  }
  if (findingStates.includes('inferred') && statement.validationState !== 'inferred') {
    add('unmarked-inferred-command', 'Inferred command must remain visibly marked as inferred.', statement.id);
  }
}

function validateManifest(
  artifactSet: RepositoryIntelligenceArtifactSet,
  issues: RepositoryIntelligenceArtifactValidationIssue[],
  blockedArtifactIds: Set<string>,
) {
  const manifestArtifact = artifactSet.artifacts.find(item => item.category === 'evidence-manifest');
  if (!manifestArtifact) {
    issues.push({ code: 'missing-manifest', state: 'error', message: 'Artifact set is missing its evidence manifest.' });
    return;
  }
  if (unsafeOutput(manifestArtifact.content) || /"content"\s*:/.test(manifestArtifact.content)) {
    issues.push({ code: 'unsafe-manifest', state: 'error', artifactId: manifestArtifact.artifactId, message: 'Evidence manifest contains source content or prohibited material.' });
    blockedArtifactIds.add(manifestArtifact.artifactId);
  }
  if (manifestArtifact.content && manifestArtifact.content !== serializeRepositoryIntelligenceArtifactManifest(artifactSet.manifest)) {
    issues.push({ code: 'manifest-render-mismatch', state: 'error', artifactId: manifestArtifact.artifactId, message: 'Rendered evidence manifest does not match the structured manifest.' });
  }
  const manifestStatements = new Map(artifactSet.manifest.artifacts.flatMap(artifact => artifact.statements).map(statement => [statement.id, statement]));
  for (const statement of artifactSet.plan.artifacts.filter(item => item.category !== 'evidence-manifest').flatMap(item => item.statements)) {
    const manifestStatement = manifestStatements.get(statement.id);
    if (!manifestStatement) {
      issues.push({ code: 'manifest-missing-statement', state: 'error', statementId: statement.id, message: 'Evidence manifest omitted a structured statement.' });
      continue;
    }
    const expected = {
      id: statement.id,
      type: statement.type,
      evidenceIds: statement.supportingEvidenceIds,
      findingIds: statement.supportingFindingIds,
      referencedPaths: statement.referencedPaths,
      confidence: statement.acceptedConfidence,
      validationState: statement.validationState,
      humanReviewRequired: statement.humanReviewRequired,
      limitations: statement.limitations,
    };
    if (JSON.stringify(manifestStatement) !== JSON.stringify(expected)) {
      issues.push({ code: 'manifest-provenance-mismatch', state: 'error', statementId: statement.id, message: 'Evidence manifest provenance does not match the structured statement.' });
    }
  }
}

function unsafeOutput(value: string) {
  return SECRET_RE.test(value) || ABSOLUTE_PATH_RE.test(value) || PROHIBITED_RE.test(value);
}
