import type { RepoScanInput } from '../types.js';
import type { RepositoryIntelligenceEvidenceModel, RepositoryResponsibility } from './evidence.js';
import { prepareRepositoryIntelligenceContext, type RepositoryIntelligenceContextBundle } from './contextPreparation.js';
import { stableContextFingerprint } from './contextSelection.js';
import { buildRepositoryDeepIntelligenceRequest, type RepositoryDeepIntelligenceRequest } from './deepIntelligenceRequest.js';

export const PRODUCT_STRATEGIST_CONTEXT_POLICY_VERSION = 'shipseal.product-strategist-context-policy.v1' as const;
export const PRODUCT_STRATEGIST_REQUEST_PROFILE = 'product-strategist' as const;

export const PRODUCT_STRATEGIST_CONTEXT_POLICY = Object.freeze({
  version: PRODUCT_STRATEGIST_CONTEXT_POLICY_VERSION,
  maximumSelectedFiles: 12,
  maximumTotalCharacters: 24_000,
  maximumCharactersPerFile: 3_200,
  targetInputTokens: 15_000,
  maximumInputTokens: 35_000,
  maximumProviderInputTokens: 20_000,
  maximumExcerptBytesPerFile: 3_200,
  maximumContextBytes: 24_000,
  maximumRequestBytes: 160_000,
  maximumProviderBodyBytes: 60_000,
  maximumOutputTokens: 4_000,
  timeoutMs: 45_000,
});

const PRODUCT_RESPONSIBILITY_WEIGHT: Partial<Record<RepositoryResponsibility, number>> = {
  'route-or-page': 3_400, layout: 3_100, 'ui-component': 3_000,
  'api-route-or-request-handler': 2_850, 'schema-or-model': 2_700,
  'repository-or-data-access-layer': 2_650, 'authentication-or-authorization-area': 2_600,
  'state-management': 2_500, service: 2_300, integration: 2_150, hook: 2_000,
  'application-entry-point': 1_900, 'test-or-fixture': 1_500, documentation: 1_400,
  validation: 1_200, 'export-barrel': 900, configuration: -1_200, utility: -1_400,
  'build-configuration': -3_500, 'test-configuration': -3_200, 'ai-agent-instruction': -5_000,
  'generated-or-vendor-content': -10_000, 'unknown-or-insufficient-evidence': -4_000,
};

const PRODUCT_DOC_RE = /(^|\/)(?:readme(?:\.md)?|product|features?|user-guide|getting-started|overview|about)(?:[._/-]|$)/i;
const USER_SURFACE_RE = /(^|\/)(?:pages?|routes?|screens?|views?|features?|components?|app|web|ui|dashboard|landing|home)(?:\/|$)/i;
const DATA_SURFACE_RE = /(^|\/)(?:schema|schemas|models?|entities|database|db|storage|persistence|auth|accounts?)(?:\/|[._-])/i;
const PRODUCT_FLOW_RE = /(?:generate|activity|worksheet|print|export|share|progress|history|lesson|learning|onboarding|checkout|upload|scan)/i;
const TECHNICAL_NOISE_RE = /(^|\/)(?:\.github|\.circleci|scripts?|tooling|config|configs|infra|deployment|devops|migrations?)(?:\/|$)|(?:^|\/)(?:eslint|prettier|vite|vitest|jest|playwright|tsconfig|tailwind|postcss)\b/i;

export function prepareRepositoryProductStrategistContext(input: {
  scanInput: RepoScanInput;
  evidenceResult: RepositoryIntelligenceEvidenceModel;
}): RepositoryIntelligenceContextBundle {
  const ranked = [...input.evidenceResult.files]
    .filter(file => file.primaryResponsibility !== 'generated-or-vendor-content')
    .sort((left, right) => productContextScore(right) - productContextScore(left) || left.path.localeCompare(right.path));
  const priorityFiles: typeof ranked = [];
  const add = (file: typeof ranked[number] | undefined) => {
    if (file && !priorityFiles.some(item => item.path === file.path)) priorityFiles.push(file);
  };
  ranked.filter(file => /^readme(?:\.md)?$/i.test(file.path) || PRODUCT_DOC_RE.test(file.path)).slice(0, 2).forEach(add);
  const responsibilityGroups: RepositoryResponsibility[][] = [
    ['route-or-page', 'layout'], ['ui-component'], ['api-route-or-request-handler'],
    ['schema-or-model', 'repository-or-data-access-layer'], ['authentication-or-authorization-area'],
    ['state-management'], ['service', 'integration'], ['test-or-fixture'],
  ];
  responsibilityGroups.forEach(group => add(ranked.find(file => group.includes(file.primaryResponsibility))));
  ranked.filter(file => productContextScore(file) >= 2_000).forEach(file => {
    if (priorityFiles.length < PRODUCT_STRATEGIST_CONTEXT_POLICY.maximumSelectedFiles) add(file);
  });
  const explicitPriorityPaths = priorityFiles.map(file => file.path);
  const focusedPaths = new Set(explicitPriorityPaths);
  const focusedEvidenceResult: RepositoryIntelligenceEvidenceModel = {
    ...input.evidenceResult,
    files: input.evidenceResult.files.filter(file => focusedPaths.has(file.path)),
    evidence: input.evidenceResult.evidence.filter(evidence => focusedPaths.has(evidence.repositoryRelativePath)),
    relationships: input.evidenceResult.relationships.filter(relationship => focusedPaths.has(relationship.sourcePath) && focusedPaths.has(relationship.targetPath)),
    folders: input.evidenceResult.folders
      .map(folder => ({
        ...folder,
        importantChildFiles: folder.importantChildFiles.filter(path => focusedPaths.has(path)),
        supportingEvidenceIds: folder.supportingEvidenceIds.filter(id => input.evidenceResult.evidence.some(evidence => evidence.id === id && focusedPaths.has(evidence.repositoryRelativePath))),
      }))
      .filter(folder => folder.importantChildFiles.length > 0 || [...focusedPaths].some(path => folder.path === '.' || path.startsWith(`${folder.path}/`))),
  };
  return prepareRepositoryIntelligenceContext({
    scanInput: input.scanInput,
    evidenceResult: focusedEvidenceResult,
    policy: {
      maximumSelectedFiles: PRODUCT_STRATEGIST_CONTEXT_POLICY.maximumSelectedFiles,
      maximumTotalCharacters: PRODUCT_STRATEGIST_CONTEXT_POLICY.maximumTotalCharacters,
      maximumCharactersPerFile: PRODUCT_STRATEGIST_CONTEXT_POLICY.maximumCharactersPerFile,
      maximumSupportingFiles: 0,
      maximumRepresentativesPerFolder: 1,
      maximumFilesPerSourceRoot: PRODUCT_STRATEGIST_CONTEXT_POLICY.maximumSelectedFiles,
      maximumSourceCharactersPerRootRatio: 0.7,
      maximumRelationshipExpansionDepth: 0,
      reservedCriticalConfigurationCharacters: 0,
      reservedDocumentationInstructionCharacters: 0,
      explicitPriorityPaths,
    },
  });
}

export function buildRepositoryProductStrategistRequest(input: {
  contextBundle: RepositoryIntelligenceContextBundle;
  evidenceResult: RepositoryIntelligenceEvidenceModel;
  locale?: string;
}): RepositoryDeepIntelligenceRequest {
  const request = buildRepositoryDeepIntelligenceRequest({
    ...input,
    requestedCapabilities: ['product-opportunity-analysis', 'structured-output'],
    policy: {
      maximumFindings: 0,
      maximumPathsPerFinding: 8,
      maximumEvidenceReferencesPerFinding: 12,
      maximumRelationshipsPerFinding: 4,
      maximumArtifactTargets: 0,
      maximumFutureDependencies: 0,
      maximumCompatibilityHints: 0,
      maximumWarnings: 8,
      maximumRawResponseCharacters: 300_000,
      defaultTimeoutMs: PRODUCT_STRATEGIST_CONTEXT_POLICY.timeoutMs,
    },
  });
  const withoutFingerprint = {
    ...request,
    executionProfile: PRODUCT_STRATEGIST_REQUEST_PROFILE,
    contextItems: request.contextItems.map(item => summarizeProductContextItem(item)),
    knownLimitations: sortedUnique([
      ...request.knownLimitations,
      'Product Strategist context uses deterministic structural summaries and bounded product-relevant excerpts.',
      `Product Strategist selection is bounded by ${PRODUCT_STRATEGIST_CONTEXT_POLICY_VERSION}.`,
    ]),
  };
  const { fingerprint: _fingerprint, ...canonical } = withoutFingerprint;
  return { ...canonical, fingerprint: stableContextFingerprint(canonical) };
}

export function productContextScore(file: RepositoryIntelligenceEvidenceModel['files'][number]) {
  const path = file.path.toLowerCase();
  let score = PRODUCT_RESPONSIBILITY_WEIGHT[file.primaryResponsibility] || 0;
  if (/^readme(?:\.md)?$/i.test(file.path)) score += 6_000;
  else if (PRODUCT_DOC_RE.test(file.path)) score += 3_800;
  if (USER_SURFACE_RE.test(file.path)) score += 2_200;
  if (DATA_SURFACE_RE.test(file.path)) score += 1_900;
  if (PRODUCT_FLOW_RE.test(path)) score += 1_600;
  if (/\.(?:tsx|jsx|vue|svelte)$/i.test(file.path)) score += 700;
  if (/(?:\.test|\.spec|__tests__|fixtures?)/i.test(file.path)) score += file.primaryResponsibility === 'test-or-fixture' && PRODUCT_FLOW_RE.test(path) ? 500 : -700;
  if (TECHNICAL_NOISE_RE.test(file.path)) score -= 3_500;
  return score + Math.round(file.confidence * 100);
}

function summarizeProductContextItem(item: RepositoryDeepIntelligenceRequest['contextItems'][number]) {
  if (item.sourceCategory === 'documentation') return item;
  const outline = item.structuralOutline;
  const summary = [
    `Path: ${item.path}`,
    `Product responsibility: ${item.responsibility.primary}`,
    item.responsibility.secondary.length ? `Secondary responsibilities: ${item.responsibility.secondary.join(', ')}` : '',
    outline?.declaredSymbols.length ? `Feature symbols: ${outline.declaredSymbols.slice(0, 16).map(symbol => symbol.name).join(', ')}` : '',
    outline?.namedExports.length ? `Public feature surface: ${outline.namedExports.slice(0, 16).join(', ')}` : '',
    item.relatedSelectedFiles.length ? `Related selected product files: ${item.relatedSelectedFiles.slice(0, 12).join(', ')}` : '',
  ].filter(Boolean).join('\n');
  const productFacing = ['route-or-page', 'layout', 'ui-component', 'api-route-or-request-handler', 'authentication-or-authorization-area', 'state-management', 'schema-or-model', 'repository-or-data-access-layer', 'service']
    .includes(item.responsibility.primary);
  const excerpt = productFacing && item.content ? item.content.slice(0, 1_800) : '';
  const content = `${summary}${excerpt ? `\n\nBounded product-relevant source excerpt:\n${excerpt}` : ''}`.slice(0, PRODUCT_STRATEGIST_CONTEXT_POLICY.maximumCharactersPerFile);
  const omitted = Math.max(0, (item.content?.length || 0) - excerpt.length);
  return {
    ...item,
    content: content || undefined,
    includedCharacters: content.length,
    truncation: {
      ...item.truncation,
      truncated: item.truncation.truncated || omitted > 0,
      omittedCharacters: item.truncation.omittedCharacters + omitted,
      includedLineRanges: excerpt ? item.truncation.includedLineRanges.slice(0, 1) : [],
    },
    limitations: sortedUnique([...item.limitations, ...(omitted > 0 ? ['Source was represented by a deterministic product summary and bounded excerpt.'] : [])]),
  };
}

function sortedUnique(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}
