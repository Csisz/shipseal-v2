export {
  REPOSITORY_FUTURE_GRAPH_POLICY_VERSION,
  REPOSITORY_FUTURE_GRAPH_VERSION,
  REPOSITORY_FUTURE_FIT_LABELS,
} from './schema.js';
export type {
  BuildRepositoryFutureGraphInput,
  RepositoryFutureCandidateAdapterResult,
  RepositoryFutureCandidateDependencyHint,
  RepositoryFutureCandidateRejection,
  RepositoryFutureConfidence,
  RepositoryFutureConflict,
  RepositoryFutureConflictKind,
  RepositoryFutureCurrentness,
  RepositoryFutureDependency,
  RepositoryFutureDependencyCycle,
  RepositoryFutureDependencyDefinition,
  RepositoryFutureDependencyRequirement,
  RepositoryFutureDependencyState,
  RepositoryFutureEdge,
  RepositoryFutureEdgeRelation,
  RepositoryFutureEligibility,
  RepositoryFutureEvidenceReference,
  RepositoryFutureExpectedArtifact,
  RepositoryFutureFit,
  RepositoryFutureGraph,
  RepositoryFutureHumanReviewState,
  RepositoryFutureLifecycle,
  RepositoryFutureNode,
  RepositoryFutureNodeKind,
  RepositoryFutureNormalizedCandidate,
  RepositoryFutureOrigin,
  RepositoryFutureRepositoryBinding,
  RepositoryFutureUniverseMapping,
} from './schema.js';
export {
  DEFAULT_REPOSITORY_FUTURE_DEPENDENCY_DEFINITIONS,
  REPOSITORY_FUTURE_CAPABILITIES,
  repositoryFutureArtifactFamilyForPath,
  repositoryFutureCapabilityForArtifactFamily,
  repositoryFutureCapabilityForDomain,
  resolveKnownRepositoryFutureCapability,
} from './capabilities.js';
export type { RepositoryFutureAdapterContext } from './adapters.js';
export {
  adaptActionableImprovementCandidates,
  adaptRepositoryHealthCandidates,
  adaptValidatedDeepIntelligenceCandidates,
  adaptVerifiedOpportunitySignalCandidates,
  adaptWorkspaceStoryCandidates,
} from './adapters.js';
export {
  buildRepositoryFutureDependencies,
  buildRepositoryFutureGraph,
  compareRepositoryFutureCandidates,
  detectRepositoryFutureDependencyCycles,
} from './graph.js';
