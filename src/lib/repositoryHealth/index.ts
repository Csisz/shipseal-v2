export { classifyRepositoryFile, classifyRepositoryFiles } from './classifyFiles';
export { extractRepositoryHealthSignals } from './extractSignals';
export { buildRepositoryHealthRecommendations, recommendationForSignal } from './recommendations';
export { scoreRepositoryHealth } from './scoreRepositoryHealth';
export type {
  ClassifiedRepositoryFile,
  ContextWasteDimension,
  DocumentationDuplicateGroup,
  DocumentationFamilyGroup,
  HealthBlocker,
  HealthConfidence,
  HealthDimension,
  HealthRecommendation,
  HealthSignal,
  HealthSignalStatus,
  RepositoryFileKind,
  RepositoryHealthModel,
  RepositoryHealthSignals,
  RepositoryHealthStatus,
} from './types';
