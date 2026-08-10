import type { RepositoryDeepIntelligenceRequest } from '../../src/lib/repositoryIntelligence/deepIntelligenceRequest.js';
import { PRODUCT_STRATEGIST_CONTEXT_POLICY } from '../../src/lib/repositoryIntelligence/productStrategistContext.js';

export const PRODUCT_STRATEGIST_PROVIDER_PAYLOAD_VERSION = 'shipseal.product-strategist-provider-payload.v1' as const;
export const PRODUCT_STRATEGIST_COMPACT_RESPONSE_VERSION = 'shipseal.product-strategist-compact-response.v1' as const;

const PRODUCT_FLOW_RE = /(?:generate|create|upload|scan|review|export|share|print|progress|history|onboard|checkout|learn|activity|workflow)/i;
const MAXIMUM_EVIDENCE_REFERENCES = 60;
const MAXIMUM_EVIDENCE_FACT_CHARACTERS = 320;
const MAXIMUM_LIMITATIONS = 8;

export interface ProductStrategistProviderPayload {
  schemaVersion: typeof PRODUCT_STRATEGIST_PROVIDER_PAYLOAD_VERSION;
  repository: { name: string; sourceType?: string };
  objective: string;
  context: Array<{
    path: string;
    responsibility: string;
    evidenceIds: string[];
    symbols?: string[];
    exports?: string[];
    relatedPaths?: string[];
    excerpt?: string;
  }>;
  evidenceIndex: Array<{
    id: string;
    category: string;
    fact: string;
    responsibility?: string;
    confidence: number;
  }>;
  coverage: {
    productDescription: boolean;
    userSurface: boolean;
    productWorkflow: boolean;
    persistenceOrDataModel: boolean;
    accountOrAuthentication: boolean;
    apiOrService: boolean;
  };
  limitations: string[];
  responseContract: {
    schemaVersion: string;
    compactResponseVersion: typeof PRODUCT_STRATEGIST_COMPACT_RESPONSE_VERSION;
    returnedCapabilities: string[];
    opportunityCount: { minimum: 3; maximum: 5 };
    defaultOpportunityCount: 3;
    findingsMustBeEmpty: true;
    permittedEvidenceIds: string[];
    permittedCurrentPaths: string[];
  };
}

export function buildProductStrategistProviderPayload(request: RepositoryDeepIntelligenceRequest): ProductStrategistProviderPayload {
  if (request.executionProfile !== 'product-strategist') {
    throw new Error('Product Strategist provider projection requires the focused execution profile.');
  }
  const selected = [...request.contextItems]
    .sort((left, right) => (left.selectionOrder ?? Number.MAX_SAFE_INTEGER) - (right.selectionOrder ?? Number.MAX_SAFE_INTEGER)
      || left.path.localeCompare(right.path))
    .slice(0, PRODUCT_STRATEGIST_CONTEXT_POLICY.maximumSelectedFiles);
  const selectedPaths = new Set(selected.map(item => item.path));
  const candidateEvidenceIds = unique([
    ...selected.flatMap(item => item.supportingEvidenceIds),
    ...request.evidenceReferences.filter(item => selectedPaths.has(item.path)).map(item => item.id),
  ]);
  const evidenceById = new Map(request.evidenceReferences.map(item => [item.id, item]));
  const seenFacts = new Set<string>();
  const evidenceIndex: ProductStrategistProviderPayload['evidenceIndex'] = [];
  for (const id of candidateEvidenceIds) {
    const evidence = evidenceById.get(id);
    if (!evidence || evidenceIndex.length >= MAXIMUM_EVIDENCE_REFERENCES) continue;
    const fact = compactText(evidence.extractedFact, MAXIMUM_EVIDENCE_FACT_CHARACTERS);
    const semanticKey = `${evidence.category}:${fact.toLocaleLowerCase()}`;
    if (!fact || seenFacts.has(semanticKey)) continue;
    seenFacts.add(semanticKey);
    evidenceIndex.push({
      id: evidence.id,
      category: evidence.category,
      fact,
      responsibility: evidence.responsibility,
      confidence: evidence.confidence,
    });
  }
  const permittedEvidenceIds = new Set(evidenceIndex.map(item => item.id));
  const context = selected.map(item => {
    const outline = item.structuralOutline;
    const excerpt = compactExcerpt(item.content || '', item.sourceCategory === 'documentation' ? 1_800 : 1_400);
    return {
      path: item.path,
      responsibility: item.responsibility.primary,
      evidenceIds: item.supportingEvidenceIds.filter(id => permittedEvidenceIds.has(id)).slice(0, 12),
      ...(outline?.declaredSymbols.length ? { symbols: unique(outline.declaredSymbols.map(symbol => symbol.name)).slice(0, 12) } : {}),
      ...(outline?.namedExports.length ? { exports: unique(outline.namedExports).slice(0, 12) } : {}),
      ...(item.relatedSelectedFiles.length ? { relatedPaths: unique(item.relatedSelectedFiles).slice(0, 6) } : {}),
      ...(excerpt ? { excerpt } : {}),
    };
  });
  const searchable = context.map(item => `${item.path}\n${item.responsibility}\n${item.excerpt || ''}`).join('\n');
  const responsibilities = new Set(context.map(item => item.responsibility));
  return {
    schemaVersion: PRODUCT_STRATEGIST_PROVIDER_PAYLOAD_VERSION,
    repository: { name: request.repository.name, ...(request.repository.sourceType ? { sourceType: request.repository.sourceType } : {}) },
    objective: 'Infer the current user-facing product and propose three to five evidence-grounded next product capabilities.',
    context,
    evidenceIndex,
    coverage: {
      productDescription: context.some(item => item.responsibility === 'documentation'),
      userSurface: [...responsibilities].some(value => ['route-or-page', 'layout', 'ui-component', 'application-entry-point'].includes(value))
        || /(?:^|\/)(?:pages?|routes?|screens?|views?|features?|components?|app|ui|cli|commands?)(?:\/|$)|<\w+|\b(?:users?|customers?|teams?|developers?|parents?|members?|workspace)\b/im.test(searchable),
      productWorkflow: PRODUCT_FLOW_RE.test(searchable),
      persistenceOrDataModel: [...responsibilities].some(value => ['schema-or-model', 'repository-or-data-access-layer', 'state-management'].includes(value)),
      accountOrAuthentication: responsibilities.has('authentication-or-authorization-area') || /(?:auth|account|user|profile)/i.test(searchable),
      apiOrService: [...responsibilities].some(value => ['api-route-or-request-handler', 'service', 'integration'].includes(value)),
    },
    limitations: unique(request.knownLimitations.map(value => compactText(value, 240))).filter(Boolean).slice(0, MAXIMUM_LIMITATIONS),
    responseContract: {
      schemaVersion: request.responseSchemaVersion,
      compactResponseVersion: PRODUCT_STRATEGIST_COMPACT_RESPONSE_VERSION,
      returnedCapabilities: [...request.requestedCapabilities],
      opportunityCount: { minimum: 3, maximum: 5 },
      defaultOpportunityCount: 3,
      findingsMustBeEmpty: true,
      permittedEvidenceIds: evidenceIndex.map(item => item.id),
      permittedCurrentPaths: context.map(item => item.path),
    },
  };
}

function compactExcerpt(content: string, maximumCharacters: number) {
  const marker = 'Bounded product-relevant source excerpt:\n';
  const markerIndex = content.indexOf(marker);
  const source = markerIndex >= 0 ? content.slice(markerIndex + marker.length) : content;
  return compactText(source, maximumCharacters);
}

function compactText(value: string, maximumCharacters: number) {
  const compact = value.replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return compact.length <= maximumCharacters ? compact : `${compact.slice(0, Math.max(0, maximumCharacters - 1)).trimEnd()}…`;
}

function unique<T extends string>(values: T[]): T[] {
  return [...new Set(values.filter(Boolean))];
}
