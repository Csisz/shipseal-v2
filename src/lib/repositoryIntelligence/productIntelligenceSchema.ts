import { z } from 'zod';
import { stableContextFingerprint } from './contextSelection.js';

export const REPOSITORY_PRODUCT_UNDERSTANDING_VERSION = 'shipseal.repository-product-understanding.v1' as const;
export const REPOSITORY_PRODUCT_OPPORTUNITY_VERSION = 'shipseal.repository-product-opportunity.v1' as const;
export const REPOSITORY_PRODUCT_INTELLIGENCE_RESULT_VERSION = 'shipseal.repository-product-intelligence-result.v1' as const;
export const MAXIMUM_REPOSITORY_PRODUCT_OPPORTUNITIES = 8;

export const REPOSITORY_PRODUCT_OPPORTUNITY_ORIGINS = ['evidence-backed', 'strategic', 'exploratory'] as const;
export type RepositoryProductOpportunityOrigin = typeof REPOSITORY_PRODUCT_OPPORTUNITY_ORIGINS[number];
export type RepositoryProductInferenceLevel = 'observed' | 'inferred';
export type RepositoryProductOpportunityInferenceLevel = 'evidence-linked' | 'strategic-inference' | 'exploratory-inference';
export type RepositoryProductConfidence = 'low' | 'medium' | 'high';
export type RepositoryProductUnderstandingRejectionReason =
  | 'invalid-understanding-shape'
  | 'unsafe-understanding-text'
  | 'missing-understanding-evidence'
  | 'unknown-understanding-evidence'
  | 'invalid-existing-capability-evidence'
  | 'compact-evidence-index-out-of-range'
  | 'generated-language-mismatch';

export type RepositoryProductOpportunityRejectionReason =
  | 'invalid-shape'
  | 'duplicate-provider-id'
  | 'result-limit'
  | 'prohibited-output'
  | 'unknown-evidence'
  | 'unsupported-current-capability'
  | 'invalid-current-path'
  | 'unknown-supporting-opportunity'
  | 'origin-inference-mismatch'
  | 'compact-evidence-index-out-of-range'
  | 'compact-capability-index-out-of-range'
  | 'compact-capability-reference-duplicate'
  | 'compact-path-index-out-of-range'
  | 'compact-support-index-out-of-range'
  | 'compact-support-target-invalid'
  | 'compact-support-self-reference'
  | 'compact-support-forward-reference'
  | 'compact-support-reference-duplicate'
  | 'generated-language-mismatch'
  | 'invalid-future-evolution';

export interface RepositoryProductNormalizationDiagnostics {
  understandingRejectionReason?: RepositoryProductUnderstandingRejectionReason;
  parsedOpportunityCount?: number;
  compactOpportunityContract?: 'roots' | 'full';
  compactOpportunityShapeRejectedCount?: number;
  compactOpportunityShapeIssueFields?: string[];
  opportunityRejectionReasons?: Array<RepositoryProductOpportunityRejectionReason | undefined>;
  compactEvidenceReferenceCount?: number;
  compactEvidenceReferenceRejectedCount?: number;
  compactCapabilityReferenceRejectedCount?: number;
  compactPathReferenceRejectedCount?: number;
  compactSupportReferenceRejectedCount?: number;
}

export const REPOSITORY_PRODUCT_NORMALIZATION_DIAGNOSTICS = Symbol.for('shipseal.repository-product-normalization-diagnostics');

export function attachRepositoryProductNormalizationDiagnostics<T extends object>(
  value: T,
  diagnostics: RepositoryProductNormalizationDiagnostics,
): T {
  Object.defineProperty(value, REPOSITORY_PRODUCT_NORMALIZATION_DIAGNOSTICS, {
    value: { ...diagnostics },
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return value;
}

export function readRepositoryProductNormalizationDiagnostics(value: unknown): RepositoryProductNormalizationDiagnostics | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const normalized = value as { [REPOSITORY_PRODUCT_NORMALIZATION_DIAGNOSTICS]?: RepositoryProductNormalizationDiagnostics };
  return normalized[REPOSITORY_PRODUCT_NORMALIZATION_DIAGNOSTICS];
}

const boundedText = z.string().trim().min(1).max(2_000);
const evidenceIds = z.array(z.string().trim().min(1).max(240)).max(20);
const insightSchema = z.object({
  statement: boundedText,
  inferenceLevel: z.enum(['observed', 'inferred']),
  evidenceIds,
}).strict();

const existingCapabilitySchema = z.object({
  id: z.string().trim().min(1).max(160),
  title: boundedText,
  description: boundedText,
  evidenceIds,
}).strict();

export const repositoryProductUnderstandingProviderSchema = z.object({
  schemaVersion: z.literal(REPOSITORY_PRODUCT_UNDERSTANDING_VERSION),
  productSummary: insightSchema,
  primaryUsers: z.array(insightSchema).max(6),
  primaryProblem: insightSchema,
  currentProductLoop: z.array(insightSchema).max(10),
  existingCapabilities: z.array(existingCapabilitySchema).max(24),
  constraints: z.array(insightSchema).max(12),
  businessModelClues: z.array(insightSchema).max(8),
  missingCapabilityAreas: z.array(insightSchema).max(12),
  providerConfidence: z.number().finite().min(0).max(1),
  limitations: z.array(boundedText).max(16),
}).strict();

const requiredCapabilitySchema = z.object({
  title: boundedText,
  rationale: boundedText,
}).strict();

const implementationAreaSchema = z.object({
  label: boundedText,
  existingPath: z.string().trim().min(1).max(500).optional(),
  evidenceIds,
}).strict();

const futureEvolutionSchema = z.object({
  id: z.string().trim().min(1).max(160),
  parentId: z.string().trim().min(1).max(160).optional(),
  generation: z.union([z.literal(2), z.literal(3)]),
  title: z.string().trim().min(1).max(120),
  description: boundedText,
  userValue: boundedText,
}).strict();

export const repositoryProductOpportunityProviderSchema = z.object({
  schemaVersion: z.literal(REPOSITORY_PRODUCT_OPPORTUNITY_VERSION),
  id: z.string().trim().min(1).max(160),
  title: z.string().trim().min(1).max(120),
  opportunityStatement: boundedText,
  userValue: boundedText,
  whyItFits: boundedText,
  targetUsers: z.array(boundedText).min(1).max(6),
  evidenceIds: evidenceIds.min(1),
  origin: z.enum(REPOSITORY_PRODUCT_OPPORTUNITY_ORIGINS),
  inferenceLevel: z.enum(['evidence-linked', 'strategic-inference', 'exploratory-inference']),
  strategicRationale: boundedText,
  existingCapabilityIds: z.array(z.string().trim().min(1).max(160)).max(12),
  requiredNewCapabilities: z.array(requiredCapabilitySchema).max(12),
  futureEvolutions: z.array(futureEvolutionSchema).max(12).optional(),
  optionalSupportingOpportunityIds: z.array(z.string().trim().min(1).max(160)).max(6),
  knownConflicts: z.array(boundedText).max(8),
  expectedImplementationAreas: z.array(implementationAreaSchema).max(12),
  changeWeight: z.enum(['small', 'moderate', 'broad']),
  impactBreadth: z.enum(['focused', 'workflow', 'cross-product']),
  verificationConcept: boundedText,
  humanReviewRequirements: z.array(boundedText).max(8),
  limitations: z.array(boundedText).max(16),
  providerConfidence: z.number().finite().min(0).max(1),
}).strict();

export type RepositoryProductUnderstandingProviderValue = z.infer<typeof repositoryProductUnderstandingProviderSchema>;
export type RepositoryProductOpportunityProviderValue = z.infer<typeof repositoryProductOpportunityProviderSchema>;

export interface RepositoryProductEvidenceReference {
  id: string;
  path: string;
  confidence: number;
  validationState: string;
  assertionState: string;
}

export interface RepositoryProductInsight {
  statement: string;
  inferenceLevel: RepositoryProductInferenceLevel;
  evidenceIds: string[];
}

export interface RepositoryProductExistingCapability {
  id: string;
  sourceId: string;
  title: string;
  description: string;
  evidenceIds: string[];
  confidence: RepositoryProductConfidence;
}

export interface RepositoryProductUnderstanding {
  version: typeof REPOSITORY_PRODUCT_UNDERSTANDING_VERSION;
  productSummary: RepositoryProductInsight;
  primaryUsers: RepositoryProductInsight[];
  primaryProblem: RepositoryProductInsight;
  currentProductLoop: RepositoryProductInsight[];
  existingCapabilities: RepositoryProductExistingCapability[];
  constraints: RepositoryProductInsight[];
  businessModelClues: RepositoryProductInsight[];
  missingCapabilityAreas: RepositoryProductInsight[];
  evidenceIds: string[];
  confidence: RepositoryProductConfidence;
  limitations: string[];
  humanReviewState: 'not-required' | 'required';
  fingerprint: string;
}

export interface RepositoryProductRequiredCapability {
  id: string;
  title: string;
  rationale: string;
  satisfiedByExistingCapabilityId?: string;
}

export interface RepositoryProductFutureEvolution {
  id: string;
  sourceId: string;
  parentSourceId?: string;
  generation: 2 | 3;
  title: string;
  description: string;
  userValue: string;
}

export interface RepositoryProductImplementationArea {
  label: string;
  existingPath?: string;
  evidenceIds: string[];
}

export interface RepositoryProductOpportunity {
  version: typeof REPOSITORY_PRODUCT_OPPORTUNITY_VERSION;
  id: string;
  sourceId: string;
  title: string;
  opportunityStatement: string;
  userValue: string;
  whyItFits: string;
  targetUsers: string[];
  evidenceIds: string[];
  origin: RepositoryProductOpportunityOrigin;
  inferenceLevel: RepositoryProductOpportunityInferenceLevel;
  strategicRationale: string;
  existingCapabilityIds: string[];
  requiredNewCapabilities: RepositoryProductRequiredCapability[];
  futureEvolutions: RepositoryProductFutureEvolution[];
  optionalSupportingOpportunityIds: string[];
  knownConflicts: string[];
  expectedImplementationAreas: RepositoryProductImplementationArea[];
  changeWeight: 'small' | 'moderate' | 'broad';
  impactBreadth: 'focused' | 'workflow' | 'cross-product';
  verificationConcept: string;
  humanReviewRequirements: string[];
  limitations: string[];
  providerConfidence: RepositoryProductConfidence;
  acceptedConfidence: RepositoryProductConfidence;
  lifecycle: 'proposed';
  currentness: 'future';
  fingerprint: string;
}

export interface RepositoryProductOpportunityRejection {
  sourceId?: string;
  reasonCodes: RepositoryProductOpportunityRejectionReason[];
  message: string;
}

export interface RepositoryProductValidationDiagnostics {
  parsedOpportunityCount: number;
  rejectedOpportunityReasonCounts: Partial<Record<RepositoryProductOpportunityRejectionReason, number>>;
  compactOpportunityContract?: 'roots' | 'full';
  compactOpportunityShapeRejectedCount?: number;
  compactOpportunityShapeIssueFields?: string[];
  compactEvidenceReferenceCount: number;
  compactEvidenceReferenceRejectedCount: number;
  compactCapabilityReferenceRejectedCount: number;
  compactPathReferenceRejectedCount: number;
  compactSupportReferenceRejectedCount: number;
}

export interface RepositoryProductIntelligenceResult {
  version: typeof REPOSITORY_PRODUCT_INTELLIGENCE_RESULT_VERSION;
  sourceAnalysisFingerprint: string;
  understanding?: RepositoryProductUnderstanding;
  understandingRejectionReason?: RepositoryProductUnderstandingRejectionReason;
  opportunities: RepositoryProductOpportunity[];
  rejectedOpportunities: RepositoryProductOpportunityRejection[];
  validationDiagnostics: RepositoryProductValidationDiagnostics;
  evidenceReferences: RepositoryProductEvidenceReference[];
  limitations: string[];
  humanReviewRequired: boolean;
  fingerprint: string;
}

export function validateRepositoryProductIntelligence(input: {
  sourceAnalysisFingerprint: string;
  rawUnderstanding?: unknown;
  rawOpportunities?: unknown;
  evidenceReferences: readonly RepositoryProductEvidenceReference[];
  knownPaths: ReadonlySet<string>;
  knownLimitations?: readonly string[];
  maximumOpportunities?: number;
  normalizationDiagnostics?: RepositoryProductNormalizationDiagnostics;
  generatedLocale?: string;
}): RepositoryProductIntelligenceResult {
  const evidenceById = new Map(input.evidenceReferences.map(item => [item.id, item]));
  const understandingResult = repositoryProductUnderstandingProviderSchema.safeParse(input.rawUnderstanding);
  const limitations = sortedUnique([
    ...(input.knownLimitations || []),
    ...(!understandingResult.success ? ['Product Understanding was unavailable or rejected; strategic Product Opportunities were not accepted.'] : []),
  ]);
  const understandingValidation = understandingResult.success
    ? normalizeUnderstanding(understandingResult.data, evidenceById, limitations, input.generatedLocale)
    : { rejectionReason: 'invalid-understanding-shape' as const };
  const understanding = understandingValidation.understanding;
  const understandingRejectionReason = understanding
    ? undefined
    : input.normalizationDiagnostics?.understandingRejectionReason || understandingValidation.rejectionReason;
  if (understandingResult.success && !understanding) limitations.push('Product Understanding failed deterministic provenance or safety validation.');
  const rawOpportunityArray = Array.isArray(input.rawOpportunities) ? input.rawOpportunities : [];
  const maximum = Math.min(MAXIMUM_REPOSITORY_PRODUCT_OPPORTUNITIES, Math.max(0, input.maximumOpportunities ?? MAXIMUM_REPOSITORY_PRODUCT_OPPORTUNITIES));
  const parsedOpportunities: RepositoryProductOpportunityProviderValue[] = [];
  const rejectedOpportunities: RepositoryProductOpportunityRejection[] = [];
  const seenSourceIds = new Set<string>();
  for (const [index, raw] of rawOpportunityArray.slice(0, maximum).entries()) {
    const parsed = repositoryProductOpportunityProviderSchema.safeParse(raw);
    if (!parsed.success) {
      const compactReason = input.normalizationDiagnostics?.opportunityRejectionReasons?.[index];
      rejectedOpportunities.push({
        reasonCodes: [compactReason || 'invalid-shape'],
        message: compactReason
          ? 'Product Opportunity contained an invalid compact reference.'
          : 'Product Opportunity did not match the bounded schema.',
      });
      continue;
    }
    if (seenSourceIds.has(parsed.data.id)) {
      rejectedOpportunities.push({ sourceId: parsed.data.id, reasonCodes: ['duplicate-provider-id'], message: 'Duplicate Product Opportunity ID was rejected.' });
      continue;
    }
    seenSourceIds.add(parsed.data.id);
    parsedOpportunities.push(parsed.data);
  }
  if (rawOpportunityArray.length > maximum) {
    rejectedOpportunities.push({ reasonCodes: ['result-limit'], message: `Product Opportunities were bounded to ${maximum}.` });
  }

  const capabilityBySourceId = new Map(understanding?.existingCapabilities.map(item => [item.sourceId, item]) || []);
  const sourceOpportunityIds = new Set(parsedOpportunities.map(item => item.id));
  const opportunities = understanding ? parsedOpportunities.flatMap(raw => {
    const validation = validateOpportunity(raw, {
      understanding,
      capabilityBySourceId,
      sourceOpportunityIds,
      evidenceById,
      knownPaths: input.knownPaths,
      knownLimitations: limitations,
      sourceAnalysisFingerprint: input.sourceAnalysisFingerprint,
      generatedLocale: input.generatedLocale,
    });
    if ('reasonCodes' in validation) {
      rejectedOpportunities.push(validation);
      return [];
    }
    return [validation];
  }) : [];
  const acceptedSourceIds = new Map(opportunities.map(item => [item.sourceId, item.id]));
  const normalizedOpportunities = opportunities.map(opportunity => ({
    ...opportunity,
    optionalSupportingOpportunityIds: opportunity.optionalSupportingOpportunityIds.flatMap(id => acceptedSourceIds.get(id) || []).sort(),
  })).sort(compareProductOpportunities);
  const evidenceReferences = input.evidenceReferences
    .filter(item => understanding?.evidenceIds.includes(item.id) || normalizedOpportunities.some(opportunity => opportunity.evidenceIds.includes(item.id)))
    .map(item => ({ ...item }))
    .sort((left, right) => left.id.localeCompare(right.id));
  const rejectedOpportunityReasonCounts = rejectedOpportunities.reduce<Partial<Record<RepositoryProductOpportunityRejectionReason, number>>>((counts, item) => {
    for (const reason of item.reasonCodes) counts[reason] = (counts[reason] || 0) + 1;
    return counts;
  }, {});
  const validationDiagnostics: RepositoryProductValidationDiagnostics = {
    parsedOpportunityCount: input.normalizationDiagnostics?.parsedOpportunityCount ?? parsedOpportunities.length,
    rejectedOpportunityReasonCounts,
    compactOpportunityContract: input.normalizationDiagnostics?.compactOpportunityContract,
    compactOpportunityShapeRejectedCount: input.normalizationDiagnostics?.compactOpportunityShapeRejectedCount,
    compactOpportunityShapeIssueFields: input.normalizationDiagnostics?.compactOpportunityShapeIssueFields,
    compactEvidenceReferenceCount: input.normalizationDiagnostics?.compactEvidenceReferenceCount || 0,
    compactEvidenceReferenceRejectedCount: input.normalizationDiagnostics?.compactEvidenceReferenceRejectedCount || 0,
    compactCapabilityReferenceRejectedCount: input.normalizationDiagnostics?.compactCapabilityReferenceRejectedCount || 0,
    compactPathReferenceRejectedCount: input.normalizationDiagnostics?.compactPathReferenceRejectedCount || 0,
    compactSupportReferenceRejectedCount: input.normalizationDiagnostics?.compactSupportReferenceRejectedCount || 0,
  };
  const core = {
    version: REPOSITORY_PRODUCT_INTELLIGENCE_RESULT_VERSION,
    sourceAnalysisFingerprint: input.sourceAnalysisFingerprint,
    understanding,
    understandingRejectionReason,
    opportunities: normalizedOpportunities,
    rejectedOpportunities: rejectedOpportunities.sort((left, right) => `${left.sourceId || ''}:${left.reasonCodes.join(':')}`.localeCompare(`${right.sourceId || ''}:${right.reasonCodes.join(':')}`)),
    validationDiagnostics,
    evidenceReferences,
    limitations: sortedUnique([
      ...limitations,
      ...(rawOpportunityArray.length === 0 ? ['The provider returned no Product Opportunities.'] : []),
      ...(rejectedOpportunities.length ? ['One or more Product Opportunities were rejected by deterministic validation.'] : []),
    ]),
    humanReviewRequired: Boolean(understanding?.humanReviewState === 'required' || normalizedOpportunities.some(item => item.humanReviewRequirements.length > 0)),
  };
  return { ...core, fingerprint: stableContextFingerprint(core) };
}

function normalizeUnderstanding(
  raw: RepositoryProductUnderstandingProviderValue,
  evidenceById: ReadonlyMap<string, RepositoryProductEvidenceReference>,
  knownLimitations: readonly string[],
  generatedLocale?: string,
): { understanding?: RepositoryProductUnderstanding; rejectionReason?: RepositoryProductUnderstandingRejectionReason } {
  const insights = [raw.productSummary, ...raw.primaryUsers, raw.primaryProblem, ...raw.currentProductLoop, ...raw.constraints, ...raw.businessModelClues, ...raw.missingCapabilityAreas];
  const text = [raw.productSummary.statement, ...insights.map(item => item.statement), ...raw.existingCapabilities.flatMap(item => [item.title, item.description]), ...raw.limitations];
  if (text.some(unsafeProductText)) return { rejectionReason: 'unsafe-understanding-text' };
  if (requiresEnglishGeneratedText(generatedLocale) && text.some(containsCjkScript)) {
    return { rejectionReason: 'generated-language-mismatch' };
  }
  const allEvidenceIds = sortedUnique([...insights.flatMap(item => item.evidenceIds), ...raw.existingCapabilities.flatMap(item => item.evidenceIds)]);
  if (raw.existingCapabilities.some(item => item.evidenceIds.length === 0 || item.evidenceIds.some(id => !evidenceById.has(id)))) {
    return { rejectionReason: 'invalid-existing-capability-evidence' };
  }
  if (!allEvidenceIds.length || insights.some(item => item.inferenceLevel === 'observed' && item.evidenceIds.length === 0)) {
    return { rejectionReason: 'missing-understanding-evidence' };
  }
  if (insights.some(item => item.evidenceIds.some(id => !evidenceById.has(id)))) {
    return { rejectionReason: 'unknown-understanding-evidence' };
  }
  const normalizedInsight = (value: z.infer<typeof insightSchema>): RepositoryProductInsight => ({
    statement: value.statement,
    inferenceLevel: value.inferenceLevel,
    evidenceIds: sortedUnique(value.evidenceIds),
  });
  const existingCapabilities = raw.existingCapabilities.map(item => {
    const confidence = capConfidence(confidenceFromEvidence(item.evidenceIds, evidenceById), 'high');
    return {
      id: stableProductId('product-existing-capability', [item.title]),
      sourceId: item.id,
      title: item.title,
      description: item.description,
      evidenceIds: sortedUnique(item.evidenceIds),
      confidence,
    };
  }).sort((left, right) => left.id.localeCompare(right.id));
  const confidence = capConfidence(
    capConfidence(providerConfidence(raw.providerConfidence), confidenceFromEvidence(allEvidenceIds, evidenceById)),
    knownLimitations.some(limitedEvidenceText) ? 'low' : 'high',
  );
  const core = {
    version: REPOSITORY_PRODUCT_UNDERSTANDING_VERSION,
    productSummary: normalizedInsight(raw.productSummary),
    primaryUsers: raw.primaryUsers.map(normalizedInsight),
    primaryProblem: normalizedInsight(raw.primaryProblem),
    currentProductLoop: raw.currentProductLoop.map(normalizedInsight),
    existingCapabilities,
    constraints: raw.constraints.map(normalizedInsight),
    businessModelClues: raw.businessModelClues.map(normalizedInsight),
    missingCapabilityAreas: raw.missingCapabilityAreas.map(normalizedInsight),
    evidenceIds: allEvidenceIds,
    confidence,
    limitations: sortedUnique([...raw.limitations, ...knownLimitations]),
    humanReviewState: text.some(humanReviewText) ? 'required' as const : 'not-required' as const,
  };
  return { understanding: { ...core, fingerprint: stableContextFingerprint(core) } };
}

function validateOpportunity(raw: RepositoryProductOpportunityProviderValue, indexes: {
  understanding: RepositoryProductUnderstanding;
  capabilityBySourceId: ReadonlyMap<string, RepositoryProductExistingCapability>;
  sourceOpportunityIds: ReadonlySet<string>;
  evidenceById: ReadonlyMap<string, RepositoryProductEvidenceReference>;
  knownPaths: ReadonlySet<string>;
  knownLimitations: readonly string[];
  sourceAnalysisFingerprint: string;
  generatedLocale?: string;
}): RepositoryProductOpportunity | RepositoryProductOpportunityRejection {
  const text = [raw.title, raw.opportunityStatement, raw.userValue, raw.whyItFits, raw.strategicRationale, raw.verificationConcept,
    ...raw.targetUsers, ...raw.requiredNewCapabilities.flatMap(item => [item.title, item.rationale]), ...raw.knownConflicts,
    ...raw.expectedImplementationAreas.map(item => item.label), ...raw.humanReviewRequirements, ...raw.limitations,
    ...(raw.futureEvolutions || []).flatMap(item => [item.title, item.description, item.userValue])];
  if (text.some(unsafeProductText)) return rejection(raw.id, 'prohibited-output', 'Product Opportunity contained unsafe, secret-like, executable, or prompt-leaking text.');
  if (requiresEnglishGeneratedText(indexes.generatedLocale) && text.some(containsCjkScript)) {
    return rejection(raw.id, 'generated-language-mismatch', 'Generated Product Opportunity text did not follow the requested English language contract.');
  }
  if (raw.evidenceIds.some(id => !indexes.evidenceById.has(id))) return rejection(raw.id, 'unknown-evidence', 'Product Opportunity cited evidence outside the bounded request.');
  if (raw.existingCapabilityIds.some(id => !indexes.capabilityBySourceId.has(id))) return rejection(raw.id, 'unsupported-current-capability', 'Product Opportunity claimed an existing capability that Product Understanding did not validate.');
  if (raw.expectedImplementationAreas.some(area => area.evidenceIds.some(id => !indexes.evidenceById.has(id)))) return rejection(raw.id, 'unknown-evidence', 'Implementation area cited evidence outside the bounded request.');
  if (raw.expectedImplementationAreas.some(area => area.existingPath && !indexes.knownPaths.has(area.existingPath))) return rejection(raw.id, 'invalid-current-path', 'Product Opportunity claimed a current repository path that deterministic context did not contain.');
  if (raw.optionalSupportingOpportunityIds.some(id => !indexes.sourceOpportunityIds.has(id))) return rejection(raw.id, 'unknown-supporting-opportunity', 'Product Opportunity referenced an unknown supporting opportunity.');
  const expectedInference: Record<RepositoryProductOpportunityOrigin, RepositoryProductOpportunityInferenceLevel> = {
    'evidence-backed': 'evidence-linked',
    strategic: 'strategic-inference',
    exploratory: 'exploratory-inference',
  };
  if (raw.inferenceLevel !== expectedInference[raw.origin]) return rejection(raw.id, 'origin-inference-mismatch', 'Product Opportunity origin and inference level were inconsistent.');
  const existingCapabilities = raw.existingCapabilityIds.map(id => indexes.capabilityBySourceId.get(id)!);
  const existingByTitle = new Map(indexes.understanding.existingCapabilities.map(item => [normalizeTitle(item.title), item]));
  const requiredNewCapabilities = raw.requiredNewCapabilities.map(item => {
    const existing = existingByTitle.get(normalizeTitle(item.title));
    return {
      id: stableProductId('product-required-capability', [item.title]),
      title: item.title,
      rationale: item.rationale,
      satisfiedByExistingCapabilityId: existing?.id,
    };
  }).sort((left, right) => left.id.localeCompare(right.id));
  const futureEvolutions = normalizeFutureEvolutions(raw, indexes.sourceAnalysisFingerprint);
  if (!futureEvolutions) return rejection(raw.id, 'invalid-future-evolution', 'Product evolution generations contained an invalid parent or generation relationship.');
  const provider = providerConfidence(raw.providerConfidence);
  const evidence = confidenceFromEvidence(raw.evidenceIds, indexes.evidenceById);
  const originCap: RepositoryProductConfidence = raw.origin === 'evidence-backed' ? 'high' : raw.origin === 'strategic' ? 'medium' : 'low';
  const limitationCap: RepositoryProductConfidence = indexes.knownLimitations.some(limitedEvidenceText) ? 'low' : 'high';
  const acceptedConfidence = capConfidence(capConfidence(capConfidence(provider, evidence), originCap), limitationCap);
  const core = {
    version: REPOSITORY_PRODUCT_OPPORTUNITY_VERSION,
    id: stableProductId('product-opportunity', [indexes.sourceAnalysisFingerprint, raw.title, raw.opportunityStatement, raw.origin]),
    sourceId: raw.id,
    title: raw.title,
    opportunityStatement: raw.opportunityStatement,
    userValue: raw.userValue,
    whyItFits: raw.whyItFits,
    targetUsers: sortedUnique(raw.targetUsers),
    evidenceIds: sortedUnique(raw.evidenceIds),
    origin: raw.origin,
    inferenceLevel: raw.inferenceLevel,
    strategicRationale: raw.strategicRationale,
    existingCapabilityIds: existingCapabilities.map(item => item.id).sort(),
    requiredNewCapabilities,
    futureEvolutions,
    optionalSupportingOpportunityIds: [...raw.optionalSupportingOpportunityIds].sort(),
    knownConflicts: sortedUnique(raw.knownConflicts),
    expectedImplementationAreas: raw.expectedImplementationAreas.map(item => ({
      label: item.label,
      existingPath: item.existingPath,
      evidenceIds: sortedUnique(item.evidenceIds),
    })).sort((left, right) => `${left.existingPath || ''}:${left.label}`.localeCompare(`${right.existingPath || ''}:${right.label}`)),
    changeWeight: raw.changeWeight,
    impactBreadth: raw.impactBreadth,
    verificationConcept: raw.verificationConcept,
    humanReviewRequirements: sortedUnique(raw.humanReviewRequirements),
    limitations: sortedUnique(raw.limitations),
    providerConfidence: provider,
    acceptedConfidence,
    lifecycle: 'proposed' as const,
    currentness: 'future' as const,
  };
  return { ...core, fingerprint: stableContextFingerprint(core) };
}

function normalizeFutureEvolutions(
  raw: RepositoryProductOpportunityProviderValue,
  sourceAnalysisFingerprint: string,
): RepositoryProductFutureEvolution[] | undefined {
  const source = raw.futureEvolutions || [];
  if (!source.length) return [];
  const secondGeneration = source.filter(item => item.generation === 2);
  if (secondGeneration.length < 2 || secondGeneration.length > 4 || secondGeneration.some(item => item.parentId)) return undefined;
  const secondIds = new Set(secondGeneration.map(item => item.id));
  if (source.some(item => item.generation === 3 && (!item.parentId || !secondIds.has(item.parentId)))) return undefined;
  if (new Set(source.map(item => item.id)).size !== source.length) return undefined;
  return source.map(item => ({
    id: stableProductId('product-future-evolution', [sourceAnalysisFingerprint, raw.id, item.id, item.title]),
    sourceId: item.id,
    parentSourceId: item.parentId,
    generation: item.generation,
    title: item.title,
    description: item.description,
    userValue: item.userValue,
  })).sort((left, right) => left.generation - right.generation || left.sourceId.localeCompare(right.sourceId));
}

function compareProductOpportunities(left: RepositoryProductOpportunity, right: RepositoryProductOpportunity) {
  const originRank: Record<RepositoryProductOpportunityOrigin, number> = { 'evidence-backed': 0, strategic: 1, exploratory: 2 };
  const impactRank = { 'cross-product': 0, workflow: 1, focused: 2 };
  const confidenceRank = { high: 0, medium: 1, low: 2 };
  return originRank[left.origin] - originRank[right.origin]
    || impactRank[left.impactBreadth] - impactRank[right.impactBreadth]
    || confidenceRank[left.acceptedConfidence] - confidenceRank[right.acceptedConfidence]
    || right.existingCapabilityIds.length - left.existingCapabilityIds.length
    || left.requiredNewCapabilities.length - right.requiredNewCapabilities.length
    || left.id.localeCompare(right.id);
}

function confidenceFromEvidence(ids: readonly string[], evidenceById: ReadonlyMap<string, RepositoryProductEvidenceReference>): RepositoryProductConfidence {
  if (!ids.length) return 'low';
  let confidence: RepositoryProductConfidence = 'high';
  for (const id of ids) {
    const evidence = evidenceById.get(id);
    if (!evidence) return 'low';
    const current = evidence.confidence >= 0.85 && ['validated', 'observed'].includes(evidence.validationState) && evidence.assertionState !== 'limited'
      ? 'high' : evidence.confidence >= 0.5 && evidence.assertionState !== 'limited' ? 'medium' : 'low';
    confidence = capConfidence(confidence, current);
  }
  return confidence;
}

function providerConfidence(value: number): RepositoryProductConfidence {
  return value >= 0.85 ? 'high' : value >= 0.5 ? 'medium' : 'low';
}

function capConfidence(value: RepositoryProductConfidence, cap: RepositoryProductConfidence): RepositoryProductConfidence {
  const rank = { low: 0, medium: 1, high: 2 };
  return rank[value] <= rank[cap] ? value : cap;
}

function stableProductId(prefix: string, values: readonly string[]) {
  return `${prefix}:${stableContextFingerprint(values.map(value => value.trim().toLowerCase())).slice(0, 20)}`;
}

function normalizeTitle(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function rejection(sourceId: string, code: RepositoryProductOpportunityRejectionReason, message: string): RepositoryProductOpportunityRejection {
  return { sourceId, reasonCodes: [code], message };
}

function unsafeProductText(value: string) {
  return /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----|\b(?:sk|ghp|github_pat)_[A-Za-z0-9_-]{12,}|\b(?:API[_-]?KEY|ACCESS[_-]?TOKEN|SECRET|PASSWORD)\s*[:=]\s*\S+|\b(?:ignore previous instructions|system prompt|developer message|chain[- ]of[- ]thought)\b|<\/?script\b|```|\b(?:rm\s+-rf|curl\s+\S+\s*\|\s*(?:sh|bash)|powershell\s+-enc|sudo\s+)\b/i.test(value);
}

const CJK_SCRIPT_RE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

export function containsCjkScript(value: string) {
  return CJK_SCRIPT_RE.test(value);
}

export function requiresEnglishGeneratedText(locale?: string) {
  return !/^(?:zh|ja|ko)(?:-|$)/i.test(locale?.trim() || 'en');
}

export function productIntelligenceUsesDisallowedGeneratedScript(value: unknown, locale?: string) {
  if (!requiresEnglishGeneratedText(locale) || !value || typeof value !== 'object' || Array.isArray(value)) return false;
  const response = value as { productUnderstanding?: unknown; productOpportunities?: unknown };
  const parsedUnderstanding = repositoryProductUnderstandingProviderSchema.safeParse(response.productUnderstanding);
  const understanding = parsedUnderstanding.success ? parsedUnderstanding.data : undefined;
  const opportunities = (Array.isArray(response.productOpportunities) ? response.productOpportunities : [])
    .flatMap(item => {
      const parsed = repositoryProductOpportunityProviderSchema.safeParse(item);
      return parsed.success ? [parsed.data] : [];
    });
  const generatedText = [
    ...(understanding ? [
      understanding.productSummary.statement,
      ...understanding.primaryUsers.map(item => item.statement),
      understanding.primaryProblem.statement,
      ...understanding.currentProductLoop.map(item => item.statement),
      ...understanding.existingCapabilities.flatMap(item => [item.title, item.description]),
      ...understanding.constraints.map(item => item.statement),
      ...understanding.businessModelClues.map(item => item.statement),
      ...understanding.missingCapabilityAreas.map(item => item.statement),
      ...understanding.limitations,
    ] : []),
    ...opportunities.flatMap(item => [
      item.title, item.opportunityStatement, item.userValue, item.whyItFits, item.strategicRationale,
      ...item.targetUsers,
      ...item.requiredNewCapabilities.flatMap(capability => [capability.title, capability.rationale]),
      ...item.expectedImplementationAreas.map(area => area.label),
      ...(item.futureEvolutions || []).flatMap(evolution => [evolution.title, evolution.description, evolution.userValue]),
      ...item.knownConflicts, item.verificationConcept, ...item.humanReviewRequirements, ...item.limitations,
    ]),
  ];
  return generatedText.some(containsCjkScript);
}

function humanReviewText(value: string) {
  return /\b(auth(?:entication|orization)?|payments?|billing|children?|minors?|health|medical|legal|compliance|privacy|personal data|security|biometric|financial)\b/i.test(value);
}

function limitedEvidenceText(value: string) {
  return /\b(?:limited|incomplete|truncated|omitted|unavailable|partial)\b/i.test(value);
}

function sortedUnique(values: readonly string[]) {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right));
}
