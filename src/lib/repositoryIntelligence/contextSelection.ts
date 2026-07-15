import { isBinaryLikePath, isGeneratedOrVendorPath, normalizeZipPath } from '../scannerLimits';
import type { RepoScanInput } from '../types';
import type {
  FileResponsibilityRecord,
  RepositoryEvidence,
  RepositoryIntelligenceEvidenceModel,
  RepositoryRelationship,
  RepositoryResponsibility,
} from './evidence';

export const REPOSITORY_CONTEXT_BUNDLE_VERSION = 'shipseal.repository-context.v1' as const;
export const REPOSITORY_CONTEXT_SELECTION_POLICY_VERSION = 'shipseal.context-selection-policy.v1' as const;

export type RepositoryContextSelectionReason =
  | 'application-entry-point'
  | 'framework-bootstrap'
  | 'central-import-dependency'
  | 'high-relationship-centrality'
  | 'critical-configuration'
  | 'package-manifest'
  | 'root-documentation'
  | 'architecture-documentation'
  | 'existing-ai-agent-instructions'
  | 'route-or-api-surface'
  | 'authentication-or-authorization-area'
  | 'state-management'
  | 'data-access-area'
  | 'service-area'
  | 'schema-or-validation'
  | 'representative-ui-component'
  | 'test-or-verification-configuration'
  | 'ci-configuration'
  | 'build-configuration'
  | 'public-export-surface'
  | 'unique-responsibility'
  | 'folder-representative'
  | 'explicit-priority'
  | 'supporting-dependency'
  | 'coverage-fallback';

export type RepositoryContextSelectionState =
  | 'selected'
  | 'selected-with-truncation'
  | 'supporting'
  | 'deprioritized'
  | 'excluded'
  | 'unavailable'
  | 'parse-limited'
  | 'budget-rejected';

export type RepositoryContextSourceCategory =
  | 'manifest'
  | 'configuration'
  | 'documentation'
  | 'agent-instruction'
  | 'source'
  | 'test'
  | 'ci'
  | 'environment-template'
  | 'metadata';

export type RepositoryContextContentAvailability =
  | 'available'
  | 'metadata-only'
  | 'unavailable'
  | 'parse-limited'
  | 'excluded-sensitive'
  | 'excluded-generated'
  | 'excluded-binary';

export type RepositoryContextPriorityFactor =
  | 'responsibility-importance'
  | 'evidence-confidence'
  | 'validated-evidence'
  | 'relationship-centrality'
  | 'architectural-uniqueness'
  | 'explicit-priority'
  | 'parse-limitation'
  | 'size-cost'
  | 'unknown-responsibility';

export interface RepositoryContextPriorityFactorRecord {
  factor: RepositoryContextPriorityFactor;
  contribution: number;
  evidenceIds: string[];
}

export interface RepositoryContextSelectionPolicy {
  version: typeof REPOSITORY_CONTEXT_SELECTION_POLICY_VERSION;
  maximumSelectedFiles: number;
  maximumTotalCharacters: number;
  maximumCharactersPerFile: number;
  reservedCriticalConfigurationCharacters: number;
  reservedDocumentationInstructionCharacters: number;
  maximumSupportingFiles: number;
  maximumRepresentativesPerFolder: number;
  maximumFilesPerSourceRoot: number;
  maximumSourceCharactersPerRootRatio: number;
  maximumRelationshipExpansionDepth: number;
  minimumUsefulContentCharacters: number;
  truncationStrategy: 'head-tail-with-structural-outline';
  explicitPriorityPaths: string[];
}

export type RepositoryContextSelectionPolicyOverride = Partial<Omit<RepositoryContextSelectionPolicy, 'version' | 'truncationStrategy'>> & {
  version?: typeof REPOSITORY_CONTEXT_SELECTION_POLICY_VERSION;
  truncationStrategy?: RepositoryContextSelectionPolicy['truncationStrategy'];
};

export const DEFAULT_REPOSITORY_CONTEXT_SELECTION_POLICY: RepositoryContextSelectionPolicy = Object.freeze({
  version: REPOSITORY_CONTEXT_SELECTION_POLICY_VERSION,
  maximumSelectedFiles: 60,
  maximumTotalCharacters: 600_000,
  maximumCharactersPerFile: 30_000,
  reservedCriticalConfigurationCharacters: 60_000,
  reservedDocumentationInstructionCharacters: 60_000,
  maximumSupportingFiles: 12,
  maximumRepresentativesPerFolder: 3,
  maximumFilesPerSourceRoot: 12,
  maximumSourceCharactersPerRootRatio: 0.4,
  maximumRelationshipExpansionDepth: 1,
  minimumUsefulContentCharacters: 40,
  truncationStrategy: 'head-tail-with-structural-outline',
  explicitPriorityPaths: [],
});

export interface RepositoryContextCandidate {
  path: string;
  selectionId: string;
  folderPath: string;
  primaryResponsibility: RepositoryResponsibility;
  secondaryResponsibilities: RepositoryResponsibility[];
  supportingEvidenceIds: string[];
  selectionReasons: RepositoryContextSelectionReason[];
  priorityScore: number;
  priorityFactors: RepositoryContextPriorityFactorRecord[];
  sourceCategory: RepositoryContextSourceCategory;
  state: RepositoryContextSelectionState;
  eligibleForSelection: boolean;
  contentAvailability: RepositoryContextContentAvailability;
  originalReadableCharacters: number;
  budgetedCharacterLimit: number;
  incomingRelationshipCount: number;
  outgoingRelationshipCount: number;
  relationshipDepth?: number;
  selectionOrder?: number;
  limitations: string[];
  sensitiveContent: {
    classification: 'none' | 'environment-template' | 'secret-path' | 'private-key' | 'credential-material';
    contentPermitted: boolean;
  };
}

export interface RepositoryContextUncoveredArea {
  type: 'responsibility' | 'folder' | 'framework' | 'category' | 'explicit-priority';
  id: string;
  reason: 'budget' | 'unavailable' | 'insufficient-evidence';
  candidatePaths: string[];
}

export interface RepositoryContextSelectionResult {
  policy: RepositoryContextSelectionPolicy;
  candidates: RepositoryContextCandidate[];
  selectedCandidates: RepositoryContextCandidate[];
  uncoveredAreas: RepositoryContextUncoveredArea[];
  limitations: string[];
  estimatedCharactersSelected: number;
}

export interface SelectRepositoryIntelligenceContextInput {
  scanInput: RepoScanInput;
  evidenceResult: RepositoryIntelligenceEvidenceModel;
  policy?: RepositoryContextSelectionPolicyOverride;
}

interface MutableCandidate extends RepositoryContextCandidate {
  selectable?: boolean;
  rawContentLength?: number;
  sourceRoot?: string;
}

const RELATIONSHIP_TYPES_FOR_CENTRALITY = new Set<RepositoryRelationship['type']>([
  'imports', 'exports-through', 'tests', 'entry-point-loads',
]);
const SUPPORTING_RELATIONSHIP_TYPES = new Set<RepositoryRelationship['type']>([
  'imports', 'exports-through', 'tests', 'entry-point-loads',
]);
const LOCKFILE_RE = /(^|\/)(?:package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?|deno\.lock)$/i;
const ENV_TEMPLATE_RE = /(^|\/)\.env\.(?:example|sample|template)$/i;
const SECRET_ENV_RE = /(^|\/)\.env(?:\.(?!example$|sample$|template$)[^/]+)?$/i;
const PRIVATE_KEY_RE = /(^|\/)(?:id_rsa|id_dsa|id_ecdsa|id_ed25519|.*\.(?:pem|p12|pfx|key|crt|cer))$/i;
const CREDENTIAL_PATH_RE = /(^|\/)(?:credentials?|secrets?|tokens?)(?:\.[^/]+)?$/i;
const ARCHITECTURE_DOC_RE = /(^|\/)(?:architecture|system-design|design|adr(?:s)?)(?:\.[^/]+)?$/i;
const ROOT_DOC_RE = /^(?:README(?:\.md)?|CONTRIBUTING\.md|SECURITY\.md|CODEOWNERS)$/i;
const CONFIG_PATH_RE = /(^|\/)(?:package\.json|tsconfig(?:\.[^/]+)?\.json|jsconfig\.json|.*\.config\.[cm]?[jt]s|\.eslintrc(?:\.[^/]+)?|\.gitignore)$/i;

const REASON_ORDER: RepositoryContextSelectionReason[] = [
  'explicit-priority', 'package-manifest', 'application-entry-point', 'framework-bootstrap',
  'existing-ai-agent-instructions', 'critical-configuration', 'build-configuration',
  'test-or-verification-configuration', 'ci-configuration', 'route-or-api-surface',
  'authentication-or-authorization-area', 'state-management', 'data-access-area',
  'service-area', 'schema-or-validation', 'architecture-documentation', 'root-documentation',
  'public-export-surface', 'central-import-dependency', 'high-relationship-centrality',
  'representative-ui-component', 'unique-responsibility', 'folder-representative',
  'supporting-dependency', 'coverage-fallback',
];

export function resolveRepositoryContextSelectionPolicy(
  override: RepositoryContextSelectionPolicyOverride = {},
): RepositoryContextSelectionPolicy {
  const maximumTotalCharacters = override.maximumTotalCharacters ?? DEFAULT_REPOSITORY_CONTEXT_SELECTION_POLICY.maximumTotalCharacters;
  const maximumSelectedFiles = override.maximumSelectedFiles ?? DEFAULT_REPOSITORY_CONTEXT_SELECTION_POLICY.maximumSelectedFiles;
  const maximumCharactersPerFile = override.maximumCharactersPerFile
    ?? (maximumTotalCharacters > 0
      ? Math.min(DEFAULT_REPOSITORY_CONTEXT_SELECTION_POLICY.maximumCharactersPerFile, maximumTotalCharacters)
      : DEFAULT_REPOSITORY_CONTEXT_SELECTION_POLICY.maximumCharactersPerFile);
  const adjustedConfigReserve = override.reservedCriticalConfigurationCharacters
    ?? Math.min(DEFAULT_REPOSITORY_CONTEXT_SELECTION_POLICY.reservedCriticalConfigurationCharacters, Math.floor(maximumTotalCharacters * 0.1));
  const adjustedDocsReserve = override.reservedDocumentationInstructionCharacters
    ?? Math.min(DEFAULT_REPOSITORY_CONTEXT_SELECTION_POLICY.reservedDocumentationInstructionCharacters, Math.floor(maximumTotalCharacters * 0.1));
  const explicitPriorityPaths = sortedUnique((override.explicitPriorityPaths || []).map(path => {
    const normalized = normalizeZipPath(path);
    if (!normalized) throw new Error(`Invalid explicit priority path: ${path || '(empty)'}`);
    return normalized;
  }));
  const policy: RepositoryContextSelectionPolicy = {
    ...DEFAULT_REPOSITORY_CONTEXT_SELECTION_POLICY,
    ...override,
    version: REPOSITORY_CONTEXT_SELECTION_POLICY_VERSION,
    truncationStrategy: 'head-tail-with-structural-outline',
    maximumSelectedFiles,
    maximumCharactersPerFile,
    maximumSupportingFiles: override.maximumSupportingFiles
      ?? Math.min(DEFAULT_REPOSITORY_CONTEXT_SELECTION_POLICY.maximumSupportingFiles, Math.floor(maximumSelectedFiles * 0.2)),
    maximumFilesPerSourceRoot: override.maximumFilesPerSourceRoot
      ?? Math.min(DEFAULT_REPOSITORY_CONTEXT_SELECTION_POLICY.maximumFilesPerSourceRoot, maximumSelectedFiles),
    minimumUsefulContentCharacters: override.minimumUsefulContentCharacters
      ?? Math.min(DEFAULT_REPOSITORY_CONTEXT_SELECTION_POLICY.minimumUsefulContentCharacters, maximumCharactersPerFile),
    reservedCriticalConfigurationCharacters: adjustedConfigReserve,
    reservedDocumentationInstructionCharacters: adjustedDocsReserve,
    explicitPriorityPaths,
  };
  validatePolicy(policy);
  return policy;
}

export function selectRepositoryIntelligenceContext({
  scanInput,
  evidenceResult,
  policy: policyOverride,
}: SelectRepositoryIntelligenceContextInput): RepositoryContextSelectionResult {
  const policy = resolveRepositoryContextSelectionPolicy(policyOverride);
  const normalizedContents = new Map(Object.entries(scanInput.textContents)
    .map(([path, content]) => [normalizeZipPath(path), content] as const)
    .filter(([path]) => !!path));
  const scanFiles = new Map(scanInput.files
    .map(file => [normalizeZipPath(file.path), file] as const)
    .filter(([path]) => !!path));
  const evidenceById = new Map(evidenceResult.evidence.map(item => [item.id, item]));
  const degree = relationshipDegree(evidenceResult.relationships);
  const responsibilityCounts = countResponsibilities(evidenceResult.files);
  const explicitPriority = new Set(policy.explicitPriorityPaths);
  const candidates = [...evidenceResult.files]
    .sort((left, right) => left.path.localeCompare(right.path))
    .map(file => buildCandidate({
      file,
      content: normalizedContents.get(file.path),
      scanFile: scanFiles.get(file.path),
      evidenceById,
      degree: degree.get(file.path) || { incoming: 0, outgoing: 0 },
      uniqueResponsibility: responsibilityCounts.get(file.primaryResponsibility) === 1,
      explicitlyPrioritized: explicitPriority.has(file.path),
      policy,
    }));
  const candidateByPath = new Map(candidates.map(candidate => [candidate.path, candidate]));
  const ranked = candidates.filter(candidate => candidate.selectable).sort(compareCandidatePriority);
  const selected: MutableCandidate[] = [];
  const selectedPaths = new Set<string>();
  const usedPerRoot = new Map<string, number>();
  const usedCharactersPerRoot = new Map<string, number>();
  const sourceRoots = new Set(ranked.filter(candidate => candidate.sourceCategory === 'source').map(candidate => candidate.sourceRoot || '.'));
  let usedCharacters = 0;
  const primaryLimit = Math.max(0, policy.maximumSelectedFiles - Math.min(policy.maximumSupportingFiles, policy.maximumSelectedFiles));

  const trySelect = (candidate: MutableCandidate, options: { supporting?: boolean; depth?: number; representative?: boolean; finalFill?: boolean } = {}) => {
    if (selectedPaths.has(candidate.path) || !candidate.selectable) return false;
    const fileLimit = options.supporting || options.finalFill ? policy.maximumSelectedFiles : primaryLimit;
    if (selected.length >= fileLimit || selected.length >= policy.maximumSelectedFiles) return rejectForBudget(candidate);
    const sourceRoot = candidate.sourceRoot || '.';
    const rootCount = usedPerRoot.get(sourceRoot) || 0;
    if (sourceRoots.size > 1 && candidate.sourceCategory === 'source' && rootCount >= policy.maximumFilesPerSourceRoot) return rejectForBudget(candidate);

    const globalRemaining = policy.maximumTotalCharacters - usedCharacters;
    let characterLimit = Math.min(candidate.rawContentLength || 0, policy.maximumCharactersPerFile, globalRemaining);
    if (candidate.sourceCategory === 'source' && sourceRoots.size > 1) {
      const maximumRootCharacters = Math.floor(policy.maximumTotalCharacters * policy.maximumSourceCharactersPerRootRatio);
      characterLimit = Math.min(characterLimit, maximumRootCharacters - (usedCharactersPerRoot.get(sourceRoot) || 0));
    }
    const critical = isCriticalCandidate(candidate);
    const structurallyUsefulSmallFile = options.supporting || candidate.selectionReasons.includes('public-export-surface');
    if (characterLimit <= 0 || (characterLimit < policy.minimumUsefulContentCharacters && !critical && !structurallyUsefulSmallFile)) return rejectForBudget(candidate);

    candidate.budgetedCharacterLimit = characterLimit;
    candidate.state = candidate.contentAvailability === 'parse-limited'
      ? 'parse-limited'
      : options.supporting
        ? (candidate.rawContentLength || 0) > characterLimit ? 'selected-with-truncation' : 'supporting'
        : (candidate.rawContentLength || 0) > characterLimit ? 'selected-with-truncation' : 'selected';
    candidate.relationshipDepth = options.depth;
    candidate.selectionOrder = selected.length;
    if (options.supporting) addReason(candidate, 'supporting-dependency');
    if (options.representative) addReason(candidate, 'folder-representative');
    selected.push(candidate);
    selectedPaths.add(candidate.path);
    usedCharacters += characterLimit;
    usedPerRoot.set(sourceRoot, rootCount + 1);
    if (candidate.sourceCategory === 'source') {
      usedCharactersPerRoot.set(sourceRoot, (usedCharactersPerRoot.get(sourceRoot) || 0) + characterLimit);
    }
    return true;
  };

  for (const candidate of ranked.filter(item => item.selectionReasons.includes('explicit-priority'))) {
    trySelect(candidate);
  }

  const maximumReservedItems = Math.max(1, Math.floor(primaryLimit * 0.25));
  selectReserved(ranked, candidate => ['manifest', 'configuration', 'ci'].includes(candidate.sourceCategory)
    || candidate.selectionReasons.includes('test-or-verification-configuration'), policy.reservedCriticalConfigurationCharacters, maximumReservedItems, trySelect);
  selectReserved(ranked, candidate => ['documentation', 'agent-instruction'].includes(candidate.sourceCategory), policy.reservedDocumentationInstructionCharacters, maximumReservedItems, trySelect);

  const coverageGroups = new Map<string, MutableCandidate[]>();
  for (const candidate of ranked) {
    const group = coverageGroup(candidate);
    if (!coverageGroups.has(group)) coverageGroups.set(group, []);
    coverageGroups.get(group)!.push(candidate);
  }
  for (const group of [...coverageGroups.keys()].sort()) {
    const candidate = coverageGroups.get(group)!.find(item => !selectedPaths.has(item.path));
    if (candidate) trySelect(candidate);
  }

  const representativeCounts = new Map<string, number>();
  for (const folder of [...evidenceResult.folders]
    .filter(folder => !folder.generatedOrVendor && folder.importantChildFiles.length > 0)
    .sort((left, right) => right.confidence - left.confidence || left.path.localeCompare(right.path))) {
    for (const path of folder.importantChildFiles) {
      if ((representativeCounts.get(folder.path) || 0) >= policy.maximumRepresentativesPerFolder) break;
      const candidate = candidateByPath.get(path);
      if (candidate && trySelect(candidate, { representative: true })) {
        representativeCounts.set(folder.path, (representativeCounts.get(folder.path) || 0) + 1);
      }
    }
  }

  for (const candidate of ranked) {
    if (selected.length >= primaryLimit) break;
    trySelect(candidate);
  }

  expandSupportingFiles({
    selected,
    selectedPaths,
    candidateByPath,
    relationships: evidenceResult.relationships,
    policy,
    trySelect,
  });

  for (const candidate of ranked) {
    if (selected.length >= policy.maximumSelectedFiles) break;
    if (!selectedPaths.has(candidate.path)) trySelect(candidate, { finalFill: true });
  }

  for (const candidate of candidates) {
    if (candidate.selectable && !selectedPaths.has(candidate.path) && candidate.state === 'deprioritized') {
      candidate.state = selected.length >= policy.maximumSelectedFiles || usedCharacters >= policy.maximumTotalCharacters
        ? 'budget-rejected'
        : 'deprioritized';
      if (candidate.state === 'budget-rejected') candidate.limitations.push('The configured context budget did not allow this candidate to be selected.');
    }
    candidate.selectionReasons = sortReasons(candidate.selectionReasons);
    candidate.limitations = sortedUnique(candidate.limitations);
    candidate.selectionId = selectionIdFor(candidate, policy);
    delete candidate.selectable;
    delete candidate.rawContentLength;
    delete candidate.sourceRoot;
  }

  const selectedCandidates = candidates
    .filter(candidate => candidate.selectionOrder !== undefined)
    .sort((left, right) => (left.selectionOrder || 0) - (right.selectionOrder || 0));
  const uncoveredAreas = buildUncoveredAreas(candidates, evidenceResult, policy);
  const limitations = sortedUnique([
    ...evidenceResult.limitations,
    ...(scanInput.scanSummary?.limited ? [scanInput.scanSummary.limitationReason || 'The source scan was limited.'] : []),
    ...(uncoveredAreas.some(area => area.reason === 'budget') ? ['Configured context limits left evidence-backed repository areas uncovered.'] : []),
    ...(candidates.some(candidate => candidate.contentAvailability === 'excluded-generated') ? ['Generated and vendor files were excluded from context selection.'] : []),
    ...(candidates.some(candidate => candidate.contentAvailability === 'excluded-binary') ? ['Binary files were excluded from context selection.'] : []),
    ...(candidates.some(candidate => candidate.contentAvailability === 'excluded-sensitive') ? ['Sensitive-path files were recorded without including their contents.'] : []),
    ...(candidates.some(candidate => candidate.contentAvailability === 'metadata-only') ? ['Lockfile bodies remain metadata-only and were not included in provider context.'] : []),
    ...(candidates.some(candidate => candidate.contentAvailability === 'unavailable') ? ['Some repository files were inventoried but had no scanner-loaded readable content.'] : []),
    ...(candidates.some(candidate => candidate.contentAvailability === 'parse-limited') ? ['Malformed JS/TS files retain parse limitations and no invented structural facts.'] : []),
    ...(evidenceResult.folders.some(folder => folder.limitations.length > 0 && !folder.generatedOrVendor) ? ['Some folders have insufficient or mixed deterministic responsibility evidence.'] : []),
    'Module aliases, dynamic imports, CommonJS require relationships, and call graphs are outside this deterministic selector.',
  ]);

  return {
    policy,
    candidates: [...candidates].sort((left, right) => {
      if (left.selectionOrder !== undefined || right.selectionOrder !== undefined) {
        if (left.selectionOrder === undefined) return 1;
        if (right.selectionOrder === undefined) return -1;
        return left.selectionOrder - right.selectionOrder;
      }
      return compareCandidatePriority(left as MutableCandidate, right as MutableCandidate);
    }),
    selectedCandidates,
    uncoveredAreas,
    limitations,
    estimatedCharactersSelected: selectedCandidates.reduce((total, candidate) => total + candidate.budgetedCharacterLimit, 0),
  };
}

function buildCandidate(input: {
  file: FileResponsibilityRecord;
  content?: string;
  scanFile?: RepoScanInput['files'][number];
  evidenceById: Map<string, RepositoryEvidence>;
  degree: { incoming: number; outgoing: number };
  uniqueResponsibility: boolean;
  explicitlyPrioritized: boolean;
  policy: RepositoryContextSelectionPolicy;
}): MutableCandidate {
  const { file, content, scanFile, evidenceById, degree, uniqueResponsibility, explicitlyPrioritized, policy } = input;
  const sourceCategory = sourceCategoryFor(file, evidenceById);
  const sensitive = sensitiveClassification(file.path);
  const generated = file.primaryResponsibility === 'generated-or-vendor-content'
    || file.extractionState === 'excluded' && (scanFile?.ignoredReason === 'generated-vendor' || isGeneratedOrVendorPath(file.path));
  const binary = scanFile?.ignoredReason === 'binary' || isBinaryLikePath(file.path);
  const lockfile = LOCKFILE_RE.test(file.path);
  const evidence = file.supportingEvidenceIds.map(id => evidenceById.get(id)).filter(Boolean) as RepositoryEvidence[];
  const reasons = reasonsFor(file, sourceCategory, degree, uniqueResponsibility, explicitlyPrioritized);
  const factors = priorityFactorsFor(file, evidence, degree, uniqueResponsibility, explicitlyPrioritized, content?.length || 0, policy);
  const limitations = [...file.limitations];
  let state: RepositoryContextSelectionState = 'deprioritized';
  let availability: RepositoryContextContentAvailability = content === undefined ? 'unavailable' : 'available';
  let selectable = content !== undefined;

  if (generated) {
    state = 'excluded'; availability = 'excluded-generated'; selectable = false;
  } else if (binary) {
    state = 'excluded'; availability = 'excluded-binary'; selectable = false;
  } else if (sensitive.classification !== 'none' && sensitive.classification !== 'environment-template') {
    state = 'excluded'; availability = 'excluded-sensitive'; selectable = false;
    limitations.push('Sensitive path metadata was retained, but file content is not eligible for provider context.');
  } else if (lockfile) {
    state = 'deprioritized'; availability = 'metadata-only'; selectable = false;
    limitations.push('Lockfile identity may support package-manager evidence, but lockfile body content is excluded from context.');
  } else if (content === undefined) {
    state = 'unavailable'; availability = 'unavailable'; selectable = false;
    limitations.push('Scanner-loaded readable content is unavailable; ShipSeal did not reread this file.');
  } else if (file.extractionState === 'parse-failed') {
    availability = 'parse-limited';
  } else if (file.primaryResponsibility === 'unknown-or-insufficient-evidence'
    && !['ci', 'environment-template'].includes(sourceCategory)
    && !explicitlyPrioritized) {
    state = 'deprioritized';
    selectable = false;
  }

  if (selectable && content!.length < policy.minimumUsefulContentCharacters && !isCriticalReasons(reasons) && file.declaredSymbols.length === 0) {
    selectable = false;
    state = 'deprioritized';
    limitations.push('Readable content is below the configured minimum useful threshold and has no structural outline.');
  }

  return {
    path: file.path,
    selectionId: '',
    folderPath: file.folderPath,
    primaryResponsibility: file.primaryResponsibility,
    secondaryResponsibilities: [...file.secondaryResponsibilities].sort(),
    supportingEvidenceIds: [...file.supportingEvidenceIds].sort(),
    selectionReasons: sortReasons(reasons),
    priorityScore: factors.reduce((total, factor) => total + factor.contribution, 0),
    priorityFactors: factors,
    sourceCategory,
    state,
    eligibleForSelection: selectable,
    contentAvailability: availability,
    originalReadableCharacters: content?.length || 0,
    budgetedCharacterLimit: 0,
    incomingRelationshipCount: degree.incoming,
    outgoingRelationshipCount: degree.outgoing,
    limitations,
    sensitiveContent: sensitive,
    selectable,
    rawContentLength: content?.length || 0,
    sourceRoot: sourceRootFor(file.path),
  };
}

function reasonsFor(
  file: FileResponsibilityRecord,
  sourceCategory: RepositoryContextSourceCategory,
  degree: { incoming: number; outgoing: number },
  uniqueResponsibility: boolean,
  explicitlyPrioritized: boolean,
) {
  const reasons: RepositoryContextSelectionReason[] = [];
  const responsibility = file.primaryResponsibility;
  if (explicitlyPrioritized) reasons.push('explicit-priority');
  if (file.path === 'package.json') reasons.push('package-manifest');
  if (responsibility === 'application-entry-point') reasons.push('application-entry-point');
  if (file.secondaryResponsibilities.includes('framework-bootstrap')) reasons.push('framework-bootstrap');
  if (responsibility === 'ai-agent-instruction') reasons.push('existing-ai-agent-instructions');
  if (responsibility === 'build-configuration') reasons.push('build-configuration', 'critical-configuration');
  if (responsibility === 'test-configuration') reasons.push('test-or-verification-configuration', 'critical-configuration');
  if (responsibility === 'configuration') reasons.push('critical-configuration');
  if (sourceCategory === 'ci') reasons.push('ci-configuration');
  if (responsibility === 'route-or-page' || responsibility === 'layout' || responsibility === 'api-route-or-request-handler') reasons.push('route-or-api-surface');
  if (responsibility === 'authentication-or-authorization-area') reasons.push('authentication-or-authorization-area');
  if (responsibility === 'state-management') reasons.push('state-management');
  if (responsibility === 'repository-or-data-access-layer') reasons.push('data-access-area');
  if (responsibility === 'service') reasons.push('service-area');
  if (responsibility === 'schema-or-model' || responsibility === 'validation') reasons.push('schema-or-validation');
  if (responsibility === 'ui-component') reasons.push('representative-ui-component');
  if (responsibility === 'export-barrel') reasons.push('public-export-surface');
  if (sourceCategory === 'documentation' && ARCHITECTURE_DOC_RE.test(file.path)) reasons.push('architecture-documentation');
  if (sourceCategory === 'documentation' && ROOT_DOC_RE.test(file.path)) reasons.push('root-documentation');
  if (degree.incoming >= 2) reasons.push('central-import-dependency');
  if (degree.incoming + degree.outgoing >= 3) reasons.push('high-relationship-centrality');
  if (uniqueResponsibility && responsibility !== 'unknown-or-insufficient-evidence') reasons.push('unique-responsibility');
  return sortedUnique(reasons);
}

function priorityFactorsFor(
  file: FileResponsibilityRecord,
  evidence: RepositoryEvidence[],
  degree: { incoming: number; outgoing: number },
  uniqueResponsibility: boolean,
  explicitlyPrioritized: boolean,
  contentLength: number,
  policy: RepositoryContextSelectionPolicy,
): RepositoryContextPriorityFactorRecord[] {
  const evidenceIds = [...file.supportingEvidenceIds].sort();
  const factors: RepositoryContextPriorityFactorRecord[] = [{
    factor: 'responsibility-importance',
    contribution: responsibilityWeight(file.primaryResponsibility),
    evidenceIds,
  }, {
    factor: 'evidence-confidence',
    contribution: Math.round(file.confidence * 100),
    evidenceIds,
  }];
  if (evidence.some(item => item.validation.state === 'validated' || item.validation.state === 'observed')) {
    factors.push({ factor: 'validated-evidence', contribution: 80, evidenceIds });
  }
  const centrality = Math.min(200, degree.incoming * 25 + degree.outgoing * 10);
  if (centrality) factors.push({ factor: 'relationship-centrality', contribution: centrality, evidenceIds });
  if (uniqueResponsibility && file.primaryResponsibility !== 'unknown-or-insufficient-evidence') {
    factors.push({ factor: 'architectural-uniqueness', contribution: 100, evidenceIds });
  }
  if (explicitlyPrioritized) factors.push({ factor: 'explicit-priority', contribution: 1_200, evidenceIds });
  if (file.extractionState === 'parse-failed') factors.push({ factor: 'parse-limitation', contribution: -250, evidenceIds });
  if (contentLength > policy.maximumCharactersPerFile) factors.push({ factor: 'size-cost', contribution: -50, evidenceIds });
  if (file.primaryResponsibility === 'unknown-or-insufficient-evidence') factors.push({ factor: 'unknown-responsibility', contribution: -600, evidenceIds });
  return factors.sort((left, right) => left.factor.localeCompare(right.factor));
}

function responsibilityWeight(responsibility: RepositoryResponsibility) {
  const weights: Partial<Record<RepositoryResponsibility, number>> = {
    'application-entry-point': 1_000,
    'framework-bootstrap': 960,
    'ai-agent-instruction': 940,
    'build-configuration': 900,
    'test-configuration': 860,
    'api-route-or-request-handler': 840,
    'authentication-or-authorization-area': 830,
    'state-management': 800,
    'repository-or-data-access-layer': 790,
    'route-or-page': 780,
    layout: 770,
    service: 740,
    'schema-or-model': 710,
    validation: 700,
    documentation: 680,
    'export-barrel': 650,
    integration: 620,
    hook: 580,
    'ui-component': 560,
    'test-or-fixture': 520,
    configuration: 500,
    utility: 360,
    'unknown-or-insufficient-evidence': 0,
    'generated-or-vendor-content': -2_000,
  };
  return weights[responsibility] || 0;
}

function sourceCategoryFor(file: FileResponsibilityRecord, evidenceById: Map<string, RepositoryEvidence>): RepositoryContextSourceCategory {
  if (file.path === 'package.json' || LOCKFILE_RE.test(file.path)) return 'manifest';
  if (ENV_TEMPLATE_RE.test(file.path)) return 'environment-template';
  const sourceTypes = new Set(file.supportingEvidenceIds.map(id => evidenceById.get(id)?.sourceType).filter(Boolean));
  if (sourceTypes.has('ci-config') || file.path.includes('.github/workflows/')) return 'ci';
  if (file.primaryResponsibility === 'ai-agent-instruction') return 'agent-instruction';
  if (file.primaryResponsibility === 'documentation') return 'documentation';
  if (file.primaryResponsibility === 'test-or-fixture' || file.primaryResponsibility === 'test-configuration') return 'test';
  if (['configuration', 'build-configuration'].includes(file.primaryResponsibility) || CONFIG_PATH_RE.test(file.path)) return 'configuration';
  if (/\.[cm]?[jt]sx?$/i.test(file.path)) return 'source';
  return 'metadata';
}

function sensitiveClassification(path: string): RepositoryContextCandidate['sensitiveContent'] {
  if (ENV_TEMPLATE_RE.test(path)) return { classification: 'environment-template', contentPermitted: true };
  if (SECRET_ENV_RE.test(path)) return { classification: 'secret-path', contentPermitted: false };
  if (PRIVATE_KEY_RE.test(path)) return { classification: 'private-key', contentPermitted: false };
  if (CREDENTIAL_PATH_RE.test(path) || /(^|\/)\.npmrc$/i.test(path)) return { classification: 'credential-material', contentPermitted: false };
  return { classification: 'none', contentPermitted: true };
}

function relationshipDegree(relationships: RepositoryRelationship[]) {
  const result = new Map<string, { incoming: number; outgoing: number }>();
  for (const relationship of relationships) {
    if (!RELATIONSHIP_TYPES_FOR_CENTRALITY.has(relationship.type)) continue;
    const source = result.get(relationship.sourcePath) || { incoming: 0, outgoing: 0 };
    const target = result.get(relationship.targetPath) || { incoming: 0, outgoing: 0 };
    source.outgoing += 1;
    target.incoming += 1;
    result.set(relationship.sourcePath, source);
    result.set(relationship.targetPath, target);
  }
  return result;
}

function expandSupportingFiles(input: {
  selected: MutableCandidate[];
  selectedPaths: Set<string>;
  candidateByPath: Map<string, MutableCandidate>;
  relationships: RepositoryRelationship[];
  policy: RepositoryContextSelectionPolicy;
  trySelect: (candidate: MutableCandidate, options?: { supporting?: boolean; depth?: number; representative?: boolean; finalFill?: boolean }) => boolean;
}) {
  if (!input.policy.maximumSupportingFiles || !input.policy.maximumRelationshipExpansionDepth) return;
  const adjacency = new Map<string, string[]>();
  for (const relationship of [...input.relationships].sort(compareRelationships)) {
    if (!SUPPORTING_RELATIONSHIP_TYPES.has(relationship.type)) continue;
    if (!adjacency.has(relationship.sourcePath)) adjacency.set(relationship.sourcePath, []);
    adjacency.get(relationship.sourcePath)!.push(relationship.targetPath);
    if (relationship.type === 'exports-through' || relationship.type === 'tests') {
      if (!adjacency.has(relationship.targetPath)) adjacency.set(relationship.targetPath, []);
      adjacency.get(relationship.targetPath)!.push(relationship.sourcePath);
    }
  }
  for (const [path, targets] of adjacency) adjacency.set(path, sortedUnique(targets));
  const queue = input.selected.map(candidate => ({ path: candidate.path, depth: 0 }));
  const visited = new Set(queue.map(item => item.path));
  let supportingCount = 0;
  for (let index = 0; index < queue.length && supportingCount < input.policy.maximumSupportingFiles; index += 1) {
    const current = queue[index];
    if (current.depth >= input.policy.maximumRelationshipExpansionDepth) continue;
    for (const target of adjacency.get(current.path) || []) {
      if (visited.has(target)) continue;
      visited.add(target);
      const candidate = input.candidateByPath.get(target);
      if (!candidate) continue;
      if (input.trySelect(candidate, { supporting: true, depth: current.depth + 1 })) {
        supportingCount += 1;
        queue.push({ path: target, depth: current.depth + 1 });
      }
      if (supportingCount >= input.policy.maximumSupportingFiles) break;
    }
  }
}

function selectReserved(
  candidates: MutableCandidate[],
  predicate: (candidate: MutableCandidate) => boolean,
  reserve: number,
  maximumItems: number,
  trySelect: (candidate: MutableCandidate) => boolean,
) {
  if (reserve <= 0) return;
  let reserved = 0;
  let selectedItems = 0;
  for (const candidate of candidates) {
    if (!predicate(candidate)) continue;
    const cost = Math.min(candidate.rawContentLength || 0, candidate.budgetedCharacterLimit || Number.MAX_SAFE_INTEGER);
    if (reserved > 0 && reserved + cost > reserve) continue;
    if (trySelect(candidate)) {
      reserved += candidate.budgetedCharacterLimit;
      selectedItems += 1;
    }
    if (reserved >= reserve || selectedItems >= maximumItems) break;
  }
}

function coverageGroup(candidate: MutableCandidate) {
  if (candidate.path === 'package.json') return '01-manifest';
  if (candidate.sourceCategory === 'agent-instruction') return '02-instructions';
  if (candidate.sourceCategory === 'documentation') return '03-documentation';
  if (['configuration', 'ci'].includes(candidate.sourceCategory) || candidate.selectionReasons.includes('test-or-verification-configuration')) return '04-configuration';
  if (candidate.selectionReasons.includes('application-entry-point')) return '05-entry';
  if (candidate.selectionReasons.includes('route-or-api-surface')) return '06-routing';
  if (['service', 'repository-or-data-access-layer', 'schema-or-model', 'validation'].includes(candidate.primaryResponsibility)) return '07-service-data';
  if (['ui-component', 'layout', 'hook'].includes(candidate.primaryResponsibility)) return '08-ui';
  if (candidate.sourceCategory === 'test') return '09-test';
  if (['authentication-or-authorization-area', 'state-management'].includes(candidate.primaryResponsibility)) return '10-state-auth';
  return `20-${candidate.primaryResponsibility}`;
}

function buildUncoveredAreas(
  candidates: RepositoryContextCandidate[],
  evidenceResult: RepositoryIntelligenceEvidenceModel,
  policy: RepositoryContextSelectionPolicy,
) {
  const selectedPaths = new Set(candidates.filter(candidate => candidate.selectionOrder !== undefined).map(candidate => candidate.path));
  const areas: RepositoryContextUncoveredArea[] = [];
  const byResponsibility = new Map<RepositoryResponsibility, RepositoryContextCandidate[]>();
  const byFolder = new Map<string, RepositoryContextCandidate[]>();
  for (const candidate of candidates.filter(candidate => candidate.primaryResponsibility !== 'unknown-or-insufficient-evidence' && candidate.primaryResponsibility !== 'generated-or-vendor-content')) {
    if (!byResponsibility.has(candidate.primaryResponsibility)) byResponsibility.set(candidate.primaryResponsibility, []);
    byResponsibility.get(candidate.primaryResponsibility)!.push(candidate);
  }
  for (const candidate of candidates) {
    for (const folder of ancestorFolderPaths(candidate.path)) {
      if (!byFolder.has(folder)) byFolder.set(folder, []);
      byFolder.get(folder)!.push(candidate);
    }
  }
  for (const [responsibility, items] of [...byResponsibility.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    if (items.some(item => selectedPaths.has(item.path))) continue;
    areas.push({
      type: 'responsibility', id: responsibility,
      reason: items.some(item => item.state === 'budget-rejected') ? 'budget' : items.some(item => item.state === 'unavailable' || item.state === 'excluded') ? 'unavailable' : 'insufficient-evidence',
      candidatePaths: items.map(item => item.path).sort(),
    });
  }
  for (const folder of [...evidenceResult.folders].filter(folder => folder.path !== '.' && !folder.generatedOrVendor && folder.dominantResponsibilities.length > 0).sort((left, right) => left.path.localeCompare(right.path))) {
    const items = byFolder.get(folder.path) || [];
    if (!items.length || items.some(item => selectedPaths.has(item.path))) continue;
    areas.push({
      type: 'folder', id: folder.path,
      reason: items.some(item => item.state === 'budget-rejected') ? 'budget' : items.some(item => item.state === 'unavailable' || item.state === 'excluded') ? 'unavailable' : 'insufficient-evidence',
      candidatePaths: items.map(item => item.path).sort(),
    });
  }
  const frameworkEvidence = evidenceResult.evidence.filter(item => item.category === 'stack' && typeof item.metadata?.framework === 'string');
  for (const item of frameworkEvidence.sort((left, right) => String(left.metadata?.framework).localeCompare(String(right.metadata?.framework)))) {
    if (!selectedPaths.has(item.repositoryRelativePath)) {
      areas.push({ type: 'framework', id: String(item.metadata?.framework), reason: 'budget', candidatePaths: [item.repositoryRelativePath] });
    }
  }
  const knownPaths = new Set(candidates.map(candidate => candidate.path));
  const candidateByPath = new Map(candidates.map(candidate => [candidate.path, candidate]));
  for (const path of policy.explicitPriorityPaths) {
    const candidate = candidateByPath.get(path);
    if (!knownPaths.has(path)) {
      areas.push({ type: 'explicit-priority', id: path, reason: 'unavailable', candidatePaths: [] });
    } else if (!selectedPaths.has(path)) {
      areas.push({
        type: 'explicit-priority', id: path,
        reason: candidate?.state === 'budget-rejected' ? 'budget' : 'unavailable',
        candidatePaths: [path],
      });
    }
  }
  return uniqueBy(areas, area => `${area.type}:${area.id}`).sort((left, right) => `${left.type}:${left.id}`.localeCompare(`${right.type}:${right.id}`));
}

function validatePolicy(policy: RepositoryContextSelectionPolicy) {
  const nonNegativeIntegers: Array<[string, number]> = [
    ['maximumSelectedFiles', policy.maximumSelectedFiles],
    ['maximumTotalCharacters', policy.maximumTotalCharacters],
    ['reservedCriticalConfigurationCharacters', policy.reservedCriticalConfigurationCharacters],
    ['reservedDocumentationInstructionCharacters', policy.reservedDocumentationInstructionCharacters],
    ['maximumSupportingFiles', policy.maximumSupportingFiles],
    ['maximumRepresentativesPerFolder', policy.maximumRepresentativesPerFolder],
    ['maximumFilesPerSourceRoot', policy.maximumFilesPerSourceRoot],
    ['maximumRelationshipExpansionDepth', policy.maximumRelationshipExpansionDepth],
    ['minimumUsefulContentCharacters', policy.minimumUsefulContentCharacters],
  ];
  for (const [name, value] of nonNegativeIntegers) {
    if (!Number.isInteger(value) || value < 0) throw new Error(`Invalid context selection policy: ${name} must be a non-negative integer.`);
  }
  if (!Number.isInteger(policy.maximumCharactersPerFile) || policy.maximumCharactersPerFile <= 0) {
    throw new Error('Invalid context selection policy: maximumCharactersPerFile must be a positive integer.');
  }
  if (policy.maximumCharactersPerFile > policy.maximumTotalCharacters && policy.maximumTotalCharacters > 0) {
    throw new Error('Invalid context selection policy: maximumCharactersPerFile cannot exceed maximumTotalCharacters.');
  }
  if (policy.reservedCriticalConfigurationCharacters + policy.reservedDocumentationInstructionCharacters > policy.maximumTotalCharacters) {
    throw new Error('Invalid context selection policy: reserved character budgets exceed maximumTotalCharacters.');
  }
  if (policy.maximumSupportingFiles > policy.maximumSelectedFiles) {
    throw new Error('Invalid context selection policy: maximumSupportingFiles cannot exceed maximumSelectedFiles.');
  }
  if (policy.maximumRelationshipExpansionDepth > 3) {
    throw new Error('Invalid context selection policy: relationship expansion depth cannot exceed 3.');
  }
  if (!(policy.maximumSourceCharactersPerRootRatio > 0 && policy.maximumSourceCharactersPerRootRatio <= 1)) {
    throw new Error('Invalid context selection policy: maximumSourceCharactersPerRootRatio must be greater than 0 and at most 1.');
  }
}

function selectionIdFor(candidate: RepositoryContextCandidate, policy: RepositoryContextSelectionPolicy) {
  return `context-selection:${stableHash(stableSerialize({
    policyVersion: policy.version,
    path: candidate.path,
    state: candidate.state,
    reasons: candidate.selectionReasons,
    score: candidate.priorityScore,
    order: candidate.selectionOrder,
    limit: candidate.budgetedCharacterLimit,
  }))}`;
}

export function stableContextFingerprint(value: unknown) {
  return `${stableHash(stableSerialize(value))}${stableHash(`secondary:${stableSerialize(value)}`)}`;
}

function compareCandidatePriority(left: MutableCandidate, right: MutableCandidate) {
  return right.priorityScore - left.priorityScore
    || compareReasonPriority(left.selectionReasons, right.selectionReasons)
    || left.path.localeCompare(right.path);
}

function compareReasonPriority(left: RepositoryContextSelectionReason[], right: RepositoryContextSelectionReason[]) {
  const leftRank = Math.min(...left.map(reason => REASON_ORDER.indexOf(reason)).filter(rank => rank >= 0), REASON_ORDER.length);
  const rightRank = Math.min(...right.map(reason => REASON_ORDER.indexOf(reason)).filter(rank => rank >= 0), REASON_ORDER.length);
  return leftRank - rightRank;
}

function compareRelationships(left: RepositoryRelationship, right: RepositoryRelationship) {
  return `${left.sourcePath}:${left.type}:${left.targetPath}`.localeCompare(`${right.sourcePath}:${right.type}:${right.targetPath}`);
}

function isCriticalCandidate(candidate: RepositoryContextCandidate) {
  return isCriticalReasons(candidate.selectionReasons);
}

function isCriticalReasons(reasons: RepositoryContextSelectionReason[]) {
  return reasons.some(reason => ['explicit-priority', 'package-manifest', 'application-entry-point', 'critical-configuration', 'existing-ai-agent-instructions'].includes(reason));
}

function addReason(candidate: MutableCandidate, reason: RepositoryContextSelectionReason) {
  candidate.selectionReasons = sortReasons([...candidate.selectionReasons, reason]);
}

function rejectForBudget(candidate: MutableCandidate) {
  candidate.state = 'budget-rejected';
  if (!candidate.limitations.includes('The configured context budget did not allow this candidate to be selected.')) {
    candidate.limitations.push('The configured context budget did not allow this candidate to be selected.');
  }
  return false;
}

function countResponsibilities(files: FileResponsibilityRecord[]) {
  const counts = new Map<RepositoryResponsibility, number>();
  for (const file of files) counts.set(file.primaryResponsibility, (counts.get(file.primaryResponsibility) || 0) + 1);
  return counts;
}

function sourceRootFor(path: string) {
  return path.split('/')[0] || '.';
}

function ancestorFolderPaths(path: string) {
  const parts = path.split('/');
  parts.pop();
  const result: string[] = [];
  for (let index = 1; index <= parts.length; index += 1) result.push(parts.slice(0, index).join('/'));
  return result;
}

function sortReasons(reasons: RepositoryContextSelectionReason[]) {
  return sortedUnique(reasons).sort((left, right) => REASON_ORDER.indexOf(left) - REASON_ORDER.indexOf(right) || left.localeCompare(right));
}

function sortedUnique<T extends string>(values: T[]): T[] {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function uniqueBy<T>(items: T[], keyFor: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = keyFor(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function stableSerialize(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).filter(key => record[key] !== undefined).sort().map(key => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(',')}}`;
}

function stableHash(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).padStart(7, '0');
}
