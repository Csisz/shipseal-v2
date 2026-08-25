export {
  AI_WORKSPACE_ENGINE_PIPELINE,
  AI_WORKSPACE_TERM_IDS,
  AI_WORKSPACE_TERMS,
  FUTURE_AI_WORKSPACE_NAVIGATION,
  WORKSPACE_STATE_TERM_IDS,
  WORKSPACE_STATE_TERMS,
  workspaceStateLabel,
} from './terminology';

export {
  buildIntelligenceRevealModel,
  INTELLIGENCE_REVEAL_REDUCED_MOTION_MS,
  INTELLIGENCE_REVEAL_TOTAL_MS,
} from './intelligenceReveal';

export {
  DEFAULT_REPOSITORY_UNIVERSE_FILTERS,
  buildRepositoryUniverseModel,
  repositoryUniverseEdgeVisible,
  repositoryUniverseFilterCounts,
  repositoryUniverseFilterKeysForNode,
  repositoryUniverseNodeVisible,
  repositoryUniverseVisibleNodeIds,
} from './repositoryUniverse';

export {
  repositoryUniverseClusterSemanticStyle,
  repositoryUniverseSemanticStyle,
} from './repositoryUniverseSemantics';

export {
  buildRepositoryAtlasModel,
  buildRepositoryKnowledgeModel,
  buildWorkspaceStory,
  chapterForDnaDimension,
  chapterForMentalModelNode,
} from './workspaceStory';

export {
  buildRepositoryTransformationProposalModel,
  repositoryTransformationAffectedEntityCount,
  repositoryTransformationDomainCounts,
  transformationDomainLabel,
} from './repositoryTransformation';

export {
  buildRepositoryOptimizationPlan,
  prepareRepositoryOptimizationManifest,
  serializeRepositoryOptimizationManifest,
} from './repositoryOptimizationPlan';

export {
  buildRepositoryActionableImprovements,
} from './repositoryActionableImprovement';

export {
  prepareRepositoryOptimizationPlan,
  validateRepositoryOptimizationPlan,
} from './repositoryOptimizationPreparation';

export {
  buildOptimizationApplyPlan,
  buildOptimizationPackZipBlob,
  buildOptimizationPackZipFilename,
  optimizationPackZipFiles,
} from './repositoryOptimizationApply';

export {
  OPTIMIZATION_GITHUB_APPLY_LIMITS,
  OPTIMIZATION_GITHUB_APPLY_VERSION,
  buildOptimizationFileDiff,
  buildOptimizationGithubApplyPlan,
  buildOptimizationGithubPreparedSnapshot,
  optimizationContentFingerprint,
  optimizationPlanMarker,
  validateOptimizationGithubApplyRequest,
} from './repositoryOptimizationGithubApply';

export {
  buildRepositoryVerificationBaseline,
  buildRepositoryVerificationResult,
} from './repositoryVerification';

export {
  REPOSITORY_VERIFICATION_ALGORITHM_VERSION,
  REPOSITORY_VERIFICATION_MEASUREMENT_VERSION,
  REPOSITORY_VERIFICATION_RELATIONSHIP_VERSION,
  buildRepositoryGraphDifference,
  buildRepositoryVerificationRelationship,
  compareRepositoryScores,
  deriveVerifiedOpportunitySignals,
  evaluateRepositoryVerificationCompatibility,
  mapRepositoryIntelligenceArtifactResults,
  mapRepositoryIntelligenceStatementResults,
  repositoryVerificationOverlayStates,
  repositoryVerificationOutcomeForIntelligenceResult,
  synthesizeRepositoryVerificationResult,
  validateDeepIntelligenceBindings,
} from './repositoryVerificationRelationship';

export {
  buildRepositoryAgentFlightPath,
} from './repositoryAgentFlightPath';

export {
  EXECUTABLE_FUTURE_HANDOFF_VERSION,
  EXECUTABLE_FUTURE_PLAN_VERSION,
  buildExecutableFuturePlan,
  executableFuturePlanMarkdownFilename,
  renderClaudeCodeFuturePlanPrompt,
  renderCodexFuturePlanPrompt,
  renderExecutableFuturePlanMarkdown,
} from './executableFuturePlan';

export type {
  AiWorkspaceTerm,
  AiWorkspaceTermId,
} from './terminology';

export type {
  AgentRouting,
  AiWorkspaceModel,
  AiWorkspaceModelVersion,
  ContextCompression,
  DeliveryOutputs,
  ProjectMemory,
  RepositoryIntelligence,
  WorkspaceMetric,
  WorkspaceMetrics,
  WorkspaceMetricStatus,
} from './types';

export type {
  IntelligenceRevealModel,
  IntelligenceRevealSignal,
  IntelligenceRevealSignalKind,
} from './intelligenceReveal';

export type { WorkspaceStateTermId } from './terminology';

export type {
  RepositoryUniverseCluster,
  RepositoryUniverseEdge,
  RepositoryUniverseFileCategory,
  RepositoryUniverseFilters,
  RepositoryUniverseFilterCounts,
  RepositoryUniverseFilterKey,
  RepositoryUniverseFileRecord,
  RepositoryUniverseImportance,
  RepositoryUniverseModel,
  RepositoryUniverseNode,
  RepositoryUniverseNodeKind,
  RepositoryUniversePosition,
  RepositoryUniverseRelationship,
  RepositoryUniverseSummary,
} from './repositoryUniverse';

export type {
  RepositoryUniverseSemanticEmphasis,
  RepositoryUniverseSemanticStyle,
  RepositoryUniverseSemanticType,
} from './repositoryUniverseSemantics';

export type {
  RepositoryTransformationArtifactAction,
  RepositoryTransformationConfidence,
  RepositoryTransformationDomain,
  RepositoryTransformationDomainFilter,
  RepositoryTransformationMode,
  RepositoryTransformationProposal,
  RepositoryTransformationProposalModel,
  RepositoryTransformationProposedEdge,
  RepositoryTransformationProposedNode,
} from './repositoryTransformation';

export type {
  RepositoryOptimizationAction,
  RepositoryOptimizationArtifact,
  RepositoryOptimizationConflict,
  RepositoryOptimizationConflictKind,
  RepositoryOptimizationInclusionState,
  RepositoryOptimizationManifest,
  RepositoryOptimizationPlan,
  RepositoryOptimizationPlanItem,
  RepositoryOptimizationPlanSummary,
  RepositoryOptimizationReadiness,
} from './repositoryOptimizationPlan';

export type {
  ActionableImprovementEvidence,
  ActionableImprovementLifecycle,
  ActionableImprovementSupport,
  RepositoryActionableImprovement,
} from './repositoryActionableImprovement';

export type {
  OptimizationPlanValidationIssue,
  OptimizationPlanValidationIssueKind,
  PreparedRepositoryOptimizationPlan,
  PrepareRepositoryOptimizationPlanResult,
  RepositoryOptimizationPlanValidation,
} from './repositoryOptimizationPreparation';

export type {
  OptimizationApplyInstruction,
  OptimizationApplyPlan,
  OptimizationApplyReadiness,
  OptimizationPackFile,
  OptimizationPackManifest,
  OptimizationPackZipFile,
  OptimizationPrPreview,
  OptimizationPrPreviewFile,
} from './repositoryOptimizationApply';

export type {
  OptimizationGithubApplyAction,
  OptimizationGithubApplyIssue,
  OptimizationGithubApplyIssueCode,
  OptimizationGithubApplyPlan,
  OptimizationGithubApplyPlanFile,
  OptimizationGithubApplyProgress,
  OptimizationGithubApplyRequest,
  OptimizationGithubCurrentFile,
  OptimizationGithubPreparedFile,
  OptimizationGithubPreparedSnapshot,
  OptimizationGithubRepositoryState,
} from './repositoryOptimizationGithubApply';

export type {
  RepositoryVerificationBaseline,
  RepositoryVerificationBaselineArtifact,
  RepositoryVerificationIdentity,
  RepositoryVerificationReadinessState,
  RepositoryVerificationResult,
  VerificationBaselineMethod,
  VerificationManifest,
  VerifiedArtifactMatch,
  VerifiedArtifactState,
  WorkspaceMetricComparison,
} from './repositoryVerification';

export type {
  AppliedOperationBinding,
  BuildRepositoryVerificationRelationshipInput,
  DeepIntelligenceVerificationBinding,
  ExpectedArtifactContract,
  ExpectedArtifactVerification,
  ExpectedArtifactVerificationResult,
  ExpectedStatementContract,
  ExpectedStatementVerification,
  ExpectedStatementVerificationResult,
  RepositoryGraphDifference,
  RepositoryGraphSnapshot,
  RepositoryMeasurementBoundary,
  RepositoryScoreComparison,
  RepositoryScoreSnapshot,
  RepositoryVerificationCompatibility,
  RepositoryVerificationOutcome,
  RepositoryVerificationRelationship,
  RepositoryVerificationScanBinding,
  VerifiedOpportunitySignal,
} from './repositoryVerificationRelationship';

export type {
  AgentFlightPathAvoidance,
  AgentFlightPathCommand,
  AgentFlightPathConfidence,
  AgentFlightPathContextFile,
  AgentFlightPathEvidence,
  AgentFlightPathEvidenceState,
  AgentFlightPathRequest,
  AgentFlightPathReviewGate,
  AgentFlightPathStep,
  AgentFlightPathStepType,
  RepositoryAgentFlightPath,
} from './repositoryAgentFlightPath';

export type {
  BuildExecutableFuturePlanInput,
  ExecutableFutureAgentHandoffs,
  ExecutableFuturePlan,
  ExecutableFuturePlanArea,
  ExecutableFuturePlanAreaKind,
  ExecutableFuturePlanCapability,
  ExecutableFuturePlanEvidenceReference,
  ExecutableFuturePlanGoal,
  ExecutableFuturePlanRepository,
  ExecutableFuturePlanReviewCategory,
  ExecutableFuturePlanReviewGate,
  ExecutableFuturePlanRisk,
  ExecutableFuturePlanStage,
  ExecutableFutureVerificationCheck,
  ExecutableFutureVerificationPlan,
} from './executableFuturePlan';

export type {
  RepositoryAtlasCluster,
  RepositoryAtlasModel,
  RepositoryAtlasNode,
  RepositoryKnowledgeCluster,
  RepositoryKnowledgeEdge,
  RepositoryKnowledgeEdgeRelationship,
  RepositoryKnowledgeModel,
  RepositoryKnowledgeNode,
  RepositoryKnowledgeNodeKind,
  WorkspaceEvidenceItem,
  WorkspaceStory,
  WorkspaceStoryAgentStepId,
  WorkspaceStoryChapter,
  WorkspaceStoryChapterId,
  WorkspaceStoryDnaDimensionId,
  WorkspaceStoryEvidenceState,
  WorkspaceStoryMentalNodeId,
} from './workspaceStory';
