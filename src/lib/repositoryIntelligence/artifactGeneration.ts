import { stableContextFingerprint } from './contextSelection';
import type { RepositoryIntelligenceEvidenceModel } from './evidence';
import type { RepositoryDeepIntelligenceValidatedResult } from './deepIntelligenceSchema';
import {
  REPOSITORY_INTELLIGENCE_ARTIFACT_GENERATOR_VERSION,
  REPOSITORY_INTELLIGENCE_ARTIFACT_POLICY_VERSION,
  REPOSITORY_INTELLIGENCE_ARTIFACT_SCHEMA_VERSION,
  type RepositoryIntelligenceArtifactManifest,
  type RepositoryIntelligenceArtifactPlan,
  type RepositoryIntelligenceArtifactSet,
  type RepositoryIntelligenceRenderedArtifact,
} from './artifactSchema';
import {
  operationProducesContent,
  renderRepositoryIntelligenceArtifact,
  serializeRepositoryIntelligenceArtifactManifest,
} from './artifactRendering';

export interface GenerateRepositoryIntelligenceArtifactsInput {
  artifactPlan: RepositoryIntelligenceArtifactPlan;
  evidenceResult: RepositoryIntelligenceEvidenceModel;
  deepIntelligenceResult?: RepositoryDeepIntelligenceValidatedResult;
}

export function generateRepositoryIntelligenceArtifacts({
  artifactPlan,
  evidenceResult,
  deepIntelligenceResult,
}: GenerateRepositoryIntelligenceArtifactsInput): RepositoryIntelligenceArtifactSet {
  const evidenceIds = new Set(evidenceResult.evidence.map(item => item.id));
  const findingIds = new Set(deepIntelligenceResult?.findings.map(item => item.id) || []);
  for (const artifact of artifactPlan.artifacts) {
    for (const statement of artifact.statements) {
      if (statement.supportingEvidenceIds.some(id => !evidenceIds.has(id))) throw new Error(`Artifact statement references unknown evidence: ${statement.id}`);
      if (statement.supportingFindingIds.some(id => !findingIds.has(id))) throw new Error(`Artifact statement references unknown validated finding: ${statement.id}`);
    }
  }
  const normalArtifacts = artifactPlan.artifacts.filter(item => item.category !== 'evidence-manifest').map(artifact => {
    const content = operationProducesContent(artifact.operation) ? renderRepositoryIntelligenceArtifact(artifact) : '';
    return rendered(artifact, content);
  });
  const artifactSetFingerprint = stableContextFingerprint({
    planFingerprint: artifactPlan.fingerprint,
    artifacts: normalArtifacts.map(item => ({ artifactId: item.artifactId, fingerprint: item.fingerprint })),
  });
  const manifest = buildRepositoryIntelligenceArtifactManifest({
    artifactPlan,
    renderedArtifacts: normalArtifacts,
    artifactSetFingerprint,
  });
  const manifestPlan = artifactPlan.artifacts.find(item => item.category === 'evidence-manifest');
  if (!manifestPlan) throw new Error('Artifact plan is missing the evidence manifest.');
  const manifestArtifact = rendered(manifestPlan, operationProducesContent(manifestPlan.operation)
    ? serializeRepositoryIntelligenceArtifactManifest(manifest) : '');
  return {
    version: REPOSITORY_INTELLIGENCE_ARTIFACT_SCHEMA_VERSION,
    plan: artifactPlan,
    artifacts: [...normalArtifacts, manifestArtifact].sort((a, b) => a.targetPath.localeCompare(b.targetPath)),
    manifest,
    fingerprint: artifactSetFingerprint,
  };
}

export function buildRepositoryIntelligenceArtifactManifest(input: {
  artifactPlan: RepositoryIntelligenceArtifactPlan;
  renderedArtifacts: RepositoryIntelligenceRenderedArtifact[];
  artifactSetFingerprint?: string;
}): RepositoryIntelligenceArtifactManifest {
  const renderedById = new Map(input.renderedArtifacts.map(item => [item.artifactId, item]));
  const artifacts = input.artifactPlan.artifacts.filter(item => item.category !== 'evidence-manifest').map(artifact => ({
    artifactId: artifact.id,
    path: artifact.targetPath,
    operation: artifact.operation,
    artifactFingerprint: renderedById.get(artifact.id)?.fingerprint || artifact.fingerprint,
    statementIds: artifact.statements.map(item => item.id),
    statements: artifact.statements.map(statement => ({
      id: statement.id,
      type: statement.type,
      evidenceIds: [...statement.supportingEvidenceIds],
      findingIds: [...statement.supportingFindingIds],
      referencedPaths: [...statement.referencedPaths],
      confidence: statement.acceptedConfidence,
      validationState: statement.validationState,
      humanReviewRequired: statement.humanReviewRequired,
      limitations: [...statement.limitations],
    })),
    reviewState: artifact.reviewState,
    limitations: [...artifact.blockingLimitations],
  }));
  const artifactSetFingerprint = input.artifactSetFingerprint || stableContextFingerprint({
    planFingerprint: input.artifactPlan.fingerprint,
    artifacts: artifacts.map(item => ({ id: item.artifactId, fingerprint: item.artifactFingerprint })),
  });
  const withoutFingerprint = {
    version: 'shipseal.repository-intelligence-evidence-manifest.v1' as const,
    generatorVersion: REPOSITORY_INTELLIGENCE_ARTIFACT_GENERATOR_VERSION,
    policyVersion: REPOSITORY_INTELLIGENCE_ARTIFACT_POLICY_VERSION,
    artifactSetFingerprint,
    inputFingerprints: { ...input.artifactPlan.inputFingerprints },
    artifacts,
  };
  return { ...withoutFingerprint, fingerprint: stableContextFingerprint(withoutFingerprint) };
}

function rendered(
  artifact: RepositoryIntelligenceArtifactPlan['artifacts'][number],
  content: string,
): RepositoryIntelligenceRenderedArtifact {
  return {
    artifactId: artifact.id,
    category: artifact.category,
    targetPath: artifact.targetPath,
    operation: artifact.operation,
    reviewState: artifact.reviewState,
    content,
    fingerprint: stableContextFingerprint({ artifactFingerprint: artifact.fingerprint, content }),
  };
}
