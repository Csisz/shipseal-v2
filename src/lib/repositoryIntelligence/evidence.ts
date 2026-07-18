import { normalizeZipPath } from '../scannerLimits';

export const REPOSITORY_EVIDENCE_SCHEMA_VERSION = 'shipseal.repository-evidence.v1' as const;
export const REPOSITORY_INTELLIGENCE_EXTRACTOR = {
  id: 'shipseal-js-ts-responsibility-extractor',
  version: '1.0.0',
} as const;

export type EvidenceOrigin = 'deterministic' | 'model-derived';
export type EvidenceValidationState =
  | 'observed'
  | 'validated'
  | 'inferred'
  | 'contradicted'
  | 'rejected'
  | 'missing-context';
export type EvidenceAssertionState = 'verified' | 'inferred' | 'limited' | 'unavailable';

export type RepositoryEvidenceCategory =
  | 'structure'
  | 'stack'
  | 'command'
  | 'entry-point'
  | 'responsibility'
  | 'relationship'
  | 'test'
  | 'ci'
  | 'instruction'
  | 'documentation'
  | 'risk'
  | 'exclusion';

export type RepositoryEvidenceSourceType =
  | 'file-inventory'
  | 'manifest'
  | 'config'
  | 'source'
  | 'test-source'
  | 'ci-config'
  | 'documentation'
  | 'generated-metadata';

export type RepositorySymbolKind =
  | 'function'
  | 'component'
  | 'hook'
  | 'class'
  | 'interface'
  | 'type'
  | 'enum'
  | 'variable'
  | 'default-export'
  | 'route-handler'
  | 'unknown';

export type RepositoryRelationshipType =
  | 'imports'
  | 'exports-through'
  | 'contains'
  | 'configures'
  | 'tests'
  | 'documents'
  | 'provides-agent-instructions-for'
  | 'route-belongs-to'
  | 'entry-point-loads';

export type RepositoryResponsibility =
  | 'application-entry-point'
  | 'framework-bootstrap'
  | 'route-or-page'
  | 'ui-component'
  | 'layout'
  | 'hook'
  | 'state-management'
  | 'api-route-or-request-handler'
  | 'service'
  | 'repository-or-data-access-layer'
  | 'schema-or-model'
  | 'validation'
  | 'authentication-or-authorization-area'
  | 'configuration'
  | 'build-configuration'
  | 'test-configuration'
  | 'test-or-fixture'
  | 'utility'
  | 'integration'
  | 'export-barrel'
  | 'documentation'
  | 'ai-agent-instruction'
  | 'generated-or-vendor-content'
  | 'unknown-or-insufficient-evidence';

export type FutureArtifactCategory =
  | 'agents-instructions'
  | 'architecture'
  | 'critical-files'
  | 'task-router'
  | 'command-map'
  | 'known-risks'
  | 'context-guide'
  | 'repository-intelligence-manifest';

export interface RepositorySymbol {
  name: string;
  kind: RepositorySymbolKind;
  exported: boolean;
  defaultExport: boolean;
  startLine?: number;
  endLine?: number;
}

export interface EvidenceRelationshipReference {
  type: RepositoryRelationshipType;
  targetPath: string;
  targetSymbol?: string;
}

export interface RepositoryEvidence {
  id: string;
  schemaVersion: typeof REPOSITORY_EVIDENCE_SCHEMA_VERSION;
  repositoryRelativePath: string;
  folderPath?: string;
  symbol?: RepositorySymbol;
  responsibility?: RepositoryResponsibility;
  category: RepositoryEvidenceCategory;
  sourceType: RepositoryEvidenceSourceType;
  extractedFact: string;
  confidence: number;
  origin: EvidenceOrigin;
  assertionState: EvidenceAssertionState;
  extractor: { id: string; version: string };
  relatedEvidenceIds: string[];
  relationships: EvidenceRelationshipReference[];
  affectedArtifactCategories?: FutureArtifactCategory[];
  validation: {
    state: EvidenceValidationState;
    validatorIds: string[];
    reasons: string[];
  };
  limitations: string[];
  metadata?: Record<string, string | number | boolean | string[]>;
}

export type RepositoryEvidenceDraft = Omit<RepositoryEvidence, 'id' | 'schemaVersion'>;

export interface RepositoryRelationship {
  id: string;
  type: RepositoryRelationshipType;
  sourcePath: string;
  targetPath: string;
  sourceSymbol?: string;
  targetSymbol?: string;
  supportingEvidenceIds: string[];
  confidence: number;
  validationState: EvidenceValidationState;
}

export type FileExtractionState = 'parsed' | 'path-only' | 'parse-failed' | 'excluded' | 'unsupported';

export interface FileResponsibilityRecord {
  path: string;
  folderPath: string;
  primaryResponsibility: RepositoryResponsibility;
  secondaryResponsibilities: RepositoryResponsibility[];
  confidence: number;
  supportingEvidenceIds: string[];
  relationships: RepositoryRelationship[];
  declaredSymbols: RepositorySymbol[];
  limitations: string[];
  extractionState: FileExtractionState;
  safeToPrioritizeForDeepAnalysis: boolean;
}

export interface FolderResponsibilityRecord {
  path: string;
  aggregationState: 'dominant' | 'mixed' | 'insufficient-evidence';
  dominantResponsibilities: Array<{
    responsibility: RepositoryResponsibility;
    fileCount: number;
    significanceScore: number;
  }>;
  importantChildFiles: string[];
  hasTests: boolean;
  hasDocumentation: boolean;
  hasAgentInstructions: boolean;
  hasConfiguration: boolean;
  generatedOrVendor: boolean;
  relationshipDensity: number;
  confidence: number;
  supportingEvidenceIds: string[];
  limitations: string[];
}

export interface RepositoryIntelligenceExtractionSummary {
  eligibleJsTsFiles: number;
  parsedFiles: number;
  conservativelyClassifiedFiles: number;
  unknownFiles: number;
  parseFailures: number;
  excludedGeneratedFiles: number;
  excludedBinaryFiles: number;
  relationshipCount: number;
  folderResponsibilityCount: number;
  limitations: string[];
}

export interface RepositoryIntelligenceEvidenceModel {
  schemaVersion: typeof REPOSITORY_EVIDENCE_SCHEMA_VERSION;
  evidence: RepositoryEvidence[];
  files: FileResponsibilityRecord[];
  folders: FolderResponsibilityRecord[];
  relationships: RepositoryRelationship[];
  limitations: string[];
  summary: RepositoryIntelligenceExtractionSummary;
}

export function createRepositoryEvidence(draft: RepositoryEvidenceDraft): RepositoryEvidence {
  const repositoryRelativePath = requireRepositoryPath(draft.repositoryRelativePath);
  const folderPath = draft.folderPath ? normalizeFolderPath(draft.folderPath) : undefined;
  const relationships = [...draft.relationships]
    .map(relationship => ({ ...relationship, targetPath: normalizeEvidencePath(relationship.targetPath) }))
    .sort(compareRelationshipReferences);
  const normalized: RepositoryEvidenceDraft = {
    ...draft,
    repositoryRelativePath,
    folderPath,
    confidence: clampConfidence(draft.confidence),
    relatedEvidenceIds: sortedUnique(draft.relatedEvidenceIds),
    relationships,
    affectedArtifactCategories: draft.affectedArtifactCategories
      ? sortedUnique(draft.affectedArtifactCategories)
      : undefined,
    validation: {
      ...draft.validation,
      validatorIds: sortedUnique(draft.validation.validatorIds),
      reasons: sortedUnique(draft.validation.reasons),
    },
    limitations: sortedUnique(draft.limitations),
  };

  return {
    ...normalized,
    id: createDeterministicEvidenceId(normalized),
    schemaVersion: REPOSITORY_EVIDENCE_SCHEMA_VERSION,
  };
}

export function createDeterministicEvidenceId(
  evidence: Pick<RepositoryEvidenceDraft, 'repositoryRelativePath' | 'symbol' | 'responsibility' | 'category' | 'sourceType' | 'extractedFact' | 'origin' | 'relationships'>,
): string {
  const path = requireRepositoryPath(evidence.repositoryRelativePath);
  const identity = stableSerialize({
    path,
    symbol: evidence.symbol ? {
      name: evidence.symbol.name,
      kind: evidence.symbol.kind,
      exported: evidence.symbol.exported,
      defaultExport: evidence.symbol.defaultExport,
      startLine: evidence.symbol.startLine,
      endLine: evidence.symbol.endLine,
    } : undefined,
    responsibility: evidence.responsibility,
    category: evidence.category,
    sourceType: evidence.sourceType,
    fact: evidence.extractedFact,
    origin: evidence.origin,
    relationships: [...evidence.relationships]
      .map(item => ({ ...item, targetPath: normalizeEvidencePath(item.targetPath) }))
      .sort(compareRelationshipReferences),
  });
  const pathSlug = path.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(-48) || 'root';
  return `evidence:${pathSlug}:${fnv1a(identity)}${djb2(identity)}`;
}

export function createRepositoryRelationshipId(
  relationship: Pick<RepositoryRelationship, 'type' | 'sourcePath' | 'targetPath' | 'sourceSymbol' | 'targetSymbol'>,
): string {
  const identity = stableSerialize({
    type: relationship.type,
    sourcePath: normalizeEvidencePath(relationship.sourcePath),
    targetPath: normalizeEvidencePath(relationship.targetPath),
    sourceSymbol: relationship.sourceSymbol,
    targetSymbol: relationship.targetSymbol,
  });
  return `relationship:${fnv1a(identity)}${djb2(identity)}`;
}

export function normalizeEvidencePath(path: string): string {
  if (path === '.') return '.';
  return requireRepositoryPath(path);
}

export function parentRepositoryFolder(path: string): string {
  const normalized = requireRepositoryPath(path);
  const parts = normalized.split('/');
  parts.pop();
  return parts.join('/') || '.';
}

function normalizeFolderPath(path: string) {
  return path === '.' ? '.' : requireRepositoryPath(path);
}

function requireRepositoryPath(path: string) {
  const normalized = normalizeZipPath(path);
  if (!normalized) throw new Error(`Invalid repository-relative path: ${path || '(empty)'}`);
  return normalized;
}

function compareRelationshipReferences(left: EvidenceRelationshipReference, right: EvidenceRelationshipReference) {
  return `${left.type}:${left.targetPath}:${left.targetSymbol || ''}`.localeCompare(`${right.type}:${right.targetPath}:${right.targetSymbol || ''}`);
}

function clampConfidence(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function sortedUnique<T extends string>(values: T[]): T[] {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function stableSerialize(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).filter(key => record[key] !== undefined).sort().map(key => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(',')}}`;
}

function fnv1a(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).padStart(7, '0');
}

function djb2(value: string) {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash, 33) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36).padStart(7, '0');
}
