import { z } from 'zod';
import {
  REPOSITORY_DEEP_INTELLIGENCE_RESPONSE_VERSION,
} from '../../src/lib/repositoryIntelligence/deepIntelligenceSchema.js';
import type { RepositoryDeepIntelligenceRequest } from '../../src/lib/repositoryIntelligence/deepIntelligenceRequest.js';
import {
  REPOSITORY_PRODUCT_OPPORTUNITY_VERSION,
  REPOSITORY_PRODUCT_UNDERSTANDING_VERSION,
  attachRepositoryProductNormalizationDiagnostics,
  type RepositoryProductNormalizationDiagnostics,
  type RepositoryProductOpportunityRejectionReason,
  containsCjkScript,
  requiresEnglishGeneratedText,
} from '../../src/lib/repositoryIntelligence/productIntelligenceSchema.js';
import {
  REPOSITORY_PRODUCT_PIPELINE_VERSION,
  type RepositoryProductExpansionStageResult,
  type RepositoryProductProviderStage,
} from '../../src/lib/repositoryIntelligence/productionProviderContract.js';
import {
  PRODUCT_STRATEGIST_COMPACT_RESPONSE_VERSION,
  buildProductStrategistProviderPayload,
  type ProductStrategistProviderPayload,
} from './repositoryProductStrategistPayload.js';

export { PRODUCT_STRATEGIST_COMPACT_RESPONSE_VERSION } from './repositoryProductStrategistPayload.js';
export const PRODUCT_STRATEGIST_OUTPUT_TARGET_TOKENS = 3_800;

export const PRODUCT_STRATEGIST_COMPACT_LIMITS = Object.freeze({
  evidenceIndexes: 6,
  understanding: {
    summaryCharacters: 88,
    users: 3,
    userCharacters: 32,
    problemCharacters: 64,
    loopSteps: 4,
    loopStepCharacters: 40,
    capabilities: 4,
    capabilityTitleCharacters: 32,
    capabilityDescriptionCharacters: 48,
    constraints: 2,
    businessClues: 2,
    missingAreas: 3,
    listItemCharacters: 40,
    limitations: 2,
  },
  opportunity: {
    titleCharacters: 40,
    statementCharacters: 80,
    userValueCharacters: 64,
    fitCharacters: 80,
    targetUsers: 3,
    targetUserCharacters: 32,
    existingCapabilities: 3,
    newCapabilities: 2,
    newCapabilityCharacters: 40,
    supportingOpportunities: 2,
    conflicts: 1,
    conflictCharacters: 40,
    implementationAreas: 1,
    implementationAreaCharacters: 40,
    verificationCharacters: 80,
    caveats: 1,
    caveatCharacters: 40,
    secondGenerationEvolutions: 4,
    thirdGenerationEvolutions: 2,
    evolutionTitleCharacters: 40,
    evolutionDescriptionCharacters: 72,
    evolutionUserValueCharacters: 56,
  },
});

const limits = PRODUCT_STRATEGIST_COMPACT_LIMITS;
const compactString = (maximum: number) => z.string().trim().min(1).max(maximum);
const compactEvidenceIndexesSchema = z.array(z.number().int().min(0)).min(1).max(limits.evidenceIndexes);

const compactCapabilitySchema = z.object({
  t: compactString(limits.understanding.capabilityTitleCharacters),
  d: compactString(limits.understanding.capabilityDescriptionCharacters),
  e: compactEvidenceIndexesSchema,
}).strict();

export const productStrategistCompactUnderstandingSchema = z.object({
  s: compactString(limits.understanding.summaryCharacters),
  u: z.array(compactString(limits.understanding.userCharacters)).min(1).max(limits.understanding.users),
  p: compactString(limits.understanding.problemCharacters),
  loop: z.array(compactString(limits.understanding.loopStepCharacters)).min(1).max(limits.understanding.loopSteps),
  caps: z.array(compactCapabilitySchema).min(1).max(limits.understanding.capabilities),
  constraints: z.array(compactString(limits.understanding.listItemCharacters)).max(limits.understanding.constraints),
  business: z.array(compactString(limits.understanding.listItemCharacters)).max(limits.understanding.businessClues),
  missing: z.array(compactString(limits.understanding.listItemCharacters)).max(limits.understanding.missingAreas),
  e: compactEvidenceIndexesSchema,
  notes: z.array(compactString(limits.understanding.listItemCharacters)).max(limits.understanding.limitations),
  q: z.number().finite().min(0).max(1),
}).strict();

const compactImplementationAreaSchema = z.object({
  l: compactString(limits.opportunity.implementationAreaCharacters),
  p: z.number().int().min(-1),
}).strict();

const compactCaveatSchema = z.object({
  t: compactString(limits.opportunity.caveatCharacters),
  r: z.boolean(),
}).strict();

const compactThirdGenerationEvolutionSchema = z.object({
  t: compactString(limits.opportunity.evolutionTitleCharacters),
  s: compactString(limits.opportunity.evolutionDescriptionCharacters),
  v: compactString(limits.opportunity.evolutionUserValueCharacters),
}).strict();

const compactSecondGenerationEvolutionSchema = compactThirdGenerationEvolutionSchema.extend({
  next: z.array(compactThirdGenerationEvolutionSchema).max(limits.opportunity.thirdGenerationEvolutions),
}).strict();

export const productStrategistCompactOpportunitySchema = z.object({
  t: compactString(limits.opportunity.titleCharacters),
  s: compactString(limits.opportunity.statementCharacters),
  v: compactString(limits.opportunity.userValueCharacters),
  f: compactString(limits.opportunity.fitCharacters),
  u: z.array(compactString(limits.opportunity.targetUserCharacters)).min(1).max(limits.opportunity.targetUsers),
  e: compactEvidenceIndexesSchema,
  o: z.enum(['evidence-backed', 'strategic', 'exploratory']),
  x: z.array(z.number().int().min(0)).max(limits.opportunity.existingCapabilities),
  n: z.array(compactString(limits.opportunity.newCapabilityCharacters)).min(1).max(limits.opportunity.newCapabilities),
  evo: z.array(compactSecondGenerationEvolutionSchema).min(2).max(limits.opportunity.secondGenerationEvolutions).optional(),
  support: z.array(z.number().int().min(0)).max(limits.opportunity.supportingOpportunities),
  conflicts: z.array(compactString(limits.opportunity.conflictCharacters)).max(limits.opportunity.conflicts),
  areas: z.array(compactImplementationAreaSchema).max(limits.opportunity.implementationAreas),
  w: z.enum(['small', 'moderate', 'broad']),
  b: z.enum(['focused', 'workflow', 'cross-product']),
  verify: compactString(limits.opportunity.verificationCharacters),
  caveats: z.array(compactCaveatSchema).max(limits.opportunity.caveats),
  q: z.number().finite().min(0).max(1),
}).strict();

/** Stage 1 intentionally returns strategic roots without deep evolution. */
export const productStrategistCompactRootOpportunitySchema = productStrategistCompactOpportunitySchema.extend({
  evo: z.array(compactSecondGenerationEvolutionSchema).length(0),
}).strict();

const compactResponseCollectionSchema = z.object({
  p: z.unknown(),
  o: z.array(z.unknown()).min(3).max(8),
}).strict();

const stringJsonSchema = (maxLength: number, description: string) => ({
  type: 'string', minLength: 1, maxLength, description,
});
const stringArrayJsonSchema = (maximumItems: number, maximumCharacters: number, description: string, minimumItems = 0) => ({
  type: 'array', minItems: minimumItems, maxItems: maximumItems,
  items: stringJsonSchema(maximumCharacters, description),
});

export function buildProductStrategistCompactJsonSchema(payload: ProductStrategistProviderPayload, options: { rootsOnly?: boolean } = {}) {
  if (!payload.evidenceIndex.length) {
    throw new Error('Product Strategist compact response requires at least one transmitted evidence item.');
  }
  const evidenceMaximum = payload.evidenceIndex.length - 1;
  const pathMaximum = payload.responseContract.permittedCurrentPaths.length - 1;
  const evidenceJsonSchema = {
    type: 'array', minItems: 1, maxItems: limits.evidenceIndexes,
    description: 'Indexes into the supplied evidenceIndex array; include only necessary support.',
    items: { type: 'integer', minimum: 0, maximum: evidenceMaximum },
  };
  return {
    type: 'object',
    additionalProperties: false,
    required: ['p', 'o'],
    properties: {
      p: {
        type: 'object', additionalProperties: false,
        required: ['s', 'u', 'p', 'loop', 'caps', 'constraints', 'business', 'missing', 'e', 'notes', 'q'],
        properties: {
          s: stringJsonSchema(limits.understanding.summaryCharacters, 'One concise product summary, one or two short sentences.'),
          u: stringArrayJsonSchema(limits.understanding.users, limits.understanding.userCharacters, 'Concise primary user group.', 1),
          p: stringJsonSchema(limits.understanding.problemCharacters, 'One concise primary problem sentence.'),
          loop: stringArrayJsonSchema(limits.understanding.loopSteps, limits.understanding.loopStepCharacters, 'Short current product-loop step.', 1),
          caps: {
            type: 'array', minItems: 1, maxItems: limits.understanding.capabilities,
            items: {
              type: 'object', additionalProperties: false, required: ['t', 'd', 'e'],
              properties: {
                t: stringJsonSchema(limits.understanding.capabilityTitleCharacters, 'Existing capability title.'),
                d: stringJsonSchema(limits.understanding.capabilityDescriptionCharacters, 'One concise existing-capability description.'),
                e: evidenceJsonSchema,
              },
            },
          },
          constraints: stringArrayJsonSchema(limits.understanding.constraints, limits.understanding.listItemCharacters, 'Material current constraint only.'),
          business: stringArrayJsonSchema(limits.understanding.businessClues, limits.understanding.listItemCharacters, 'Material business-model clue only.'),
          missing: stringArrayJsonSchema(limits.understanding.missingAreas, limits.understanding.listItemCharacters, 'Concise missing capability area.'),
          e: evidenceJsonSchema,
          notes: stringArrayJsonSchema(limits.understanding.limitations, limits.understanding.listItemCharacters, 'Material Product Understanding limitation only.'),
          q: { type: 'number', minimum: 0, maximum: 1, description: 'Provider confidence.' },
        },
      },
      o: {
        type: 'array', minItems: 6, maxItems: 8,
        description: 'Return six to eight distinct, evidence-grounded first-generation product directions when the supplied repository evidence supports them.',
        items: {
          type: 'object', additionalProperties: false,
          required: ['t', 's', 'v', 'f', 'u', 'e', 'o', 'x', 'n', 'evo', 'support', 'conflicts', 'areas', 'w', 'b', 'verify', 'caveats', 'q'],
          properties: {
            t: stringJsonSchema(limits.opportunity.titleCharacters, 'Short user-facing opportunity title.'),
            s: stringJsonSchema(limits.opportunity.statementCharacters, 'One concise opportunity statement.'),
            v: stringJsonSchema(limits.opportunity.userValueCharacters, 'One concise user-value statement.'),
            f: stringJsonSchema(limits.opportunity.fitCharacters, 'One concise explanation of product fit and strategic rationale.'),
            u: stringArrayJsonSchema(limits.opportunity.targetUsers, limits.opportunity.targetUserCharacters, 'Concise target user group.', 1),
            e: evidenceJsonSchema,
            o: { type: 'string', enum: ['evidence-backed', 'strategic', 'exploratory'] },
            x: {
              type: 'array', maxItems: limits.opportunity.existingCapabilities,
              description: 'Distinct indexes into p.caps. ShipSeal validates them against the actual returned capability count.',
              items: { type: 'integer', minimum: 0, maximum: limits.understanding.capabilities - 1 },
            },
            n: stringArrayJsonSchema(limits.opportunity.newCapabilities, limits.opportunity.newCapabilityCharacters, 'Major required new capability title.', 1),
            evo: {
              type: 'array', minItems: options.rootsOnly ? 0 : 2, maxItems: options.rootsOnly ? 0 : limits.opportunity.secondGenerationEvolutions,
              description: options.rootsOnly ? 'Stage 1 must leave deep evolution empty.' : 'Two to four product evolutions that this direction could unlock next. These are user-value futures, not implementation tasks.',
              items: {
                type: 'object', additionalProperties: false, required: ['t', 's', 'v', 'next'],
                properties: {
                  t: stringJsonSchema(limits.opportunity.evolutionTitleCharacters, 'Short second-generation product future title.'),
                  s: stringJsonSchema(limits.opportunity.evolutionDescriptionCharacters, 'What becomes possible after the parent direction succeeds.'),
                  v: stringJsonSchema(limits.opportunity.evolutionUserValueCharacters, 'Concise user value opened by this evolution.'),
                  next: {
                    type: 'array', maxItems: limits.opportunity.thirdGenerationEvolutions,
                    description: 'Optional grounded third-generation product possibilities opened by this evolution.',
                    items: {
                      type: 'object', additionalProperties: false, required: ['t', 's', 'v'],
                      properties: {
                        t: stringJsonSchema(limits.opportunity.evolutionTitleCharacters, 'Short third-generation product future title.'),
                        s: stringJsonSchema(limits.opportunity.evolutionDescriptionCharacters, 'A later product possibility grounded in the parent evolution.'),
                        v: stringJsonSchema(limits.opportunity.evolutionUserValueCharacters, 'Concise later-stage user value.'),
                      },
                    },
                  },
                },
              },
            },
            support: {
              type: 'array', maxItems: limits.opportunity.supportingOpportunities,
              description: 'Distinct indexes of earlier opportunities in o only; no self or forward references.',
              items: { type: 'integer', minimum: 0, maximum: 4 },
            },
            conflicts: stringArrayJsonSchema(limits.opportunity.conflicts, limits.opportunity.conflictCharacters, 'Material known conflict only.'),
            areas: {
              type: 'array', maxItems: limits.opportunity.implementationAreas,
              items: {
                type: 'object', additionalProperties: false, required: ['l', 'p'],
                properties: {
                  l: stringJsonSchema(limits.opportunity.implementationAreaCharacters, 'Concise implementation-area label.'),
                  p: {
                    type: 'integer', minimum: -1, maximum: Math.max(-1, pathMaximum),
                    description: 'Index into supplied permittedCurrentPaths, or -1 when no current path is claimed.',
                  },
                },
              },
            },
            w: { type: 'string', enum: ['small', 'moderate', 'broad'] },
            b: { type: 'string', enum: ['focused', 'workflow', 'cross-product'] },
            verify: stringJsonSchema(limits.opportunity.verificationCharacters, 'One concise outcome-focused verification concept.'),
            caveats: {
              type: 'array', maxItems: limits.opportunity.caveats,
              items: {
                type: 'object', additionalProperties: false, required: ['t', 'r'],
                properties: {
                  t: stringJsonSchema(limits.opportunity.caveatCharacters, 'Material limitation or review requirement.'),
                  r: { type: 'boolean', description: 'True only when this caveat requires explicit human review.' },
                },
              },
            },
            q: { type: 'number', minimum: 0, maximum: 1, description: 'Provider confidence.' },
          },
        },
      },
    },
  } as const;
}

export function buildProductStrategistResponseFormat(payload: ProductStrategistProviderPayload, options: { rootsOnly?: boolean } = {}) {
  return {
    type: 'json_schema' as const,
    json_schema: {
      name: 'shipseal_product_strategist',
      description: `Compact ${PRODUCT_STRATEGIST_COMPACT_RESPONSE_VERSION} response normalized and revalidated by ShipSeal.`,
      strict: true,
      schema: buildProductStrategistCompactJsonSchema(payload, options),
    },
  };
}

const expansionLeafSchema = z.object({
  id: compactString(80),
  t: compactString(limits.opportunity.evolutionTitleCharacters),
  s: compactString(limits.opportunity.evolutionDescriptionCharacters),
  v: compactString(limits.opportunity.evolutionUserValueCharacters),
}).strict();
const expansionBranchSchema = expansionLeafSchema.extend({
  next: z.array(expansionLeafSchema).max(limits.opportunity.thirdGenerationEvolutions),
}).strict();
const expansionResponseSchema = z.object({
  x: z.array(z.object({
    p: z.string().trim().min(8).max(200),
    evo: z.array(expansionBranchSchema).min(2).max(limits.opportunity.secondGenerationEvolutions),
  }).strict()).min(1).max(3),
}).strict();

export type ProductStrategistExpansionRepairShape = Array<{
  parentId: string;
  evolutions: Array<{ id: string; nextIds: string[] }>;
}>;

export type ProductStrategistExpansionValidationCategory =
  | 'schema'
  | 'language'
  | 'parent-identity'
  | 'duplicate-identity';

type ProductStrategistExpansionValidationSafeDiagnostics = {
  languageValidation?: {
    scriptCategories: Array<'CJK'>;
    violatingFieldCount: number;
    paths: string[];
  };
  expansionSchemaValidation?: {
    issueCount: number;
    paths: string[];
  };
};

/** Contains structural metadata only. Generated values never cross the diagnostics boundary. */
export class ProductStrategistExpansionValidationError extends Error {
  constructor(
    public readonly category: ProductStrategistExpansionValidationCategory,
    public readonly safeDiagnostics: ProductStrategistExpansionValidationSafeDiagnostics = {},
    public readonly repairShape?: ProductStrategistExpansionRepairShape,
  ) {
    super(category === 'language' ? 'Expansion response violated the English generated-language contract.'
      : category === 'schema' ? 'Expansion response did not match its bounded schema.'
        : category === 'parent-identity' ? 'Expansion response did not preserve stable parent identities.'
          : 'Expansion response contained duplicate stage-local identities.');
    this.name = 'ProductStrategistExpansionValidationError';
  }
}

function safeIssuePath(path: PropertyKey[]) {
  const formatted = path.reduce<string>((result, segment) => typeof segment === 'number'
    ? `${result}[${segment}]`
    : result ? `${result}.${String(segment)}` : String(segment), '');
  return formatted.slice(0, 160);
}

function uniqueBoundedPaths(paths: string[]) {
  return [...new Set(paths)].filter(Boolean).slice(0, 24);
}

function expansionRepairShape(input: z.infer<typeof expansionResponseSchema>): ProductStrategistExpansionRepairShape {
  return input.x.map(item => ({
    parentId: item.p,
    evolutions: item.evo.map(evolution => ({ id: evolution.id, nextIds: evolution.next.map(next => next.id) })),
  }));
}

function sameExpansionRepairShape(actual: ProductStrategistExpansionRepairShape, expected: ProductStrategistExpansionRepairShape) {
  return actual.length === expected.length && actual.every((parent, parentIndex) => {
    const expectedParent = expected[parentIndex];
    return parent.parentId === expectedParent?.parentId
      && parent.evolutions.length === expectedParent.evolutions.length
      && parent.evolutions.every((evolution, evolutionIndex) => evolution.id === expectedParent.evolutions[evolutionIndex]?.id
        && evolution.nextIds.length === expectedParent.evolutions[evolutionIndex]?.nextIds.length
        && evolution.nextIds.every((id, nextIndex) => id === expectedParent.evolutions[evolutionIndex]?.nextIds[nextIndex]));
  });
}

function generatedLanguageViolationPaths(input: z.infer<typeof expansionResponseSchema>) {
  const paths: string[] = [];
  input.x.forEach((item, parentIndex) => item.evo.forEach((evolution, evolutionIndex) => {
    (['t', 's', 'v'] as const).forEach(field => {
      if (containsCjkScript(evolution[field])) paths.push(`x[${parentIndex}].evo[${evolutionIndex}].${field}`);
    });
    evolution.next.forEach((next, nextIndex) => (['t', 's', 'v'] as const).forEach(field => {
      if (containsCjkScript(next[field])) paths.push(`x[${parentIndex}].evo[${evolutionIndex}].next[${nextIndex}].${field}`);
    }));
  }));
  return uniqueBoundedPaths(paths);
}

export function buildProductStrategistExpansionResponseFormat(stage: Extract<RepositoryProductProviderStage, { kind: 'expansion' }>) {
  const leaf = {
    type: 'object', additionalProperties: false, required: ['id', 't', 's', 'v'],
    properties: {
      id: stringJsonSchema(80, 'Stable stage-local slug identifier.'),
      t: stringJsonSchema(limits.opportunity.evolutionTitleCharacters, 'Short product-future title.'),
      s: stringJsonSchema(limits.opportunity.evolutionDescriptionCharacters, 'Grounded product evolution, not an implementation task.'),
      v: stringJsonSchema(limits.opportunity.evolutionUserValueCharacters, 'Concise user value.'),
    },
  };
  return {
    type: 'json_schema' as const,
    json_schema: {
      name: 'shipseal_future_expansion_batch', strict: true,
      description: 'One independently validated Future expansion batch.',
      schema: {
        type: 'object', additionalProperties: false, required: ['x'],
        properties: {
          x: {
            type: 'array', minItems: stage.parents.length, maxItems: stage.parents.length,
            items: {
              type: 'object', additionalProperties: false, required: ['p', 'evo'],
              properties: {
                p: { type: 'string', enum: stage.parents.map(parent => parent.id), description: 'Exact stable parent Future ID.' },
                evo: {
                  type: 'array', minItems: 2, maxItems: 4,
                  items: {
                    ...leaf,
                    required: [...leaf.required, 'next'],
                    properties: { ...leaf.properties, next: { type: 'array', maxItems: 2, items: leaf } },
                  },
                },
              },
            },
          },
        },
      },
    },
  };
}

export function normalizeProductStrategistExpansionResponse(
  input: unknown,
  stage: Extract<RepositoryProductProviderStage, { kind: 'expansion' }>,
  locale?: string,
  options: { repairShape?: ProductStrategistExpansionRepairShape } = {},
): RepositoryProductExpansionStageResult {
  const parsed = expansionResponseSchema.safeParse(input);
  if (!parsed.success) {
    const paths = uniqueBoundedPaths(parsed.error.issues.map(issue => safeIssuePath(issue.path)));
    throw new ProductStrategistExpansionValidationError('schema', {
      expansionSchemaValidation: { issueCount: parsed.error.issues.length, paths },
    });
  }
  const expected = new Set(stage.parents.map(parent => parent.id));
  if (parsed.data.x.length !== expected.size || new Set(parsed.data.x.map(item => item.p)).size !== expected.size
    || parsed.data.x.some(item => !expected.has(item.p))) throw new ProductStrategistExpansionValidationError('parent-identity');
  if (parsed.data.x.some(item => {
    const ids = item.evo.flatMap(evolution => [evolution.id, ...evolution.next.map(next => next.id)]);
    return new Set(ids).size !== ids.length;
  })) throw new ProductStrategistExpansionValidationError('duplicate-identity');
  const shape = expansionRepairShape(parsed.data);
  if (options.repairShape && !sameExpansionRepairShape(shape, options.repairShape)) {
    throw new ProductStrategistExpansionValidationError('parent-identity');
  }
  const violationPaths = requiresEnglishGeneratedText(locale) ? generatedLanguageViolationPaths(parsed.data) : [];
  if (violationPaths.length) {
    throw new ProductStrategistExpansionValidationError('language', {
      languageValidation: { scriptCategories: ['CJK'], violatingFieldCount: violationPaths.length, paths: violationPaths },
    }, shape);
  }
  return {
    pipelineVersion: REPOSITORY_PRODUCT_PIPELINE_VERSION,
    stage: 'expansion',
    fingerprint: stage.fingerprint,
    batchIndex: stage.batchIndex,
    totalBatches: stage.totalBatches,
    expansions: parsed.data.x.map(item => ({
      parentId: item.p,
      evolutions: item.evo.flatMap(evolution => [
        { sourceId: evolution.id, generation: 2 as const, title: evolution.t, description: evolution.s, userValue: evolution.v },
        ...evolution.next.map(next => ({ sourceId: next.id, parentSourceId: evolution.id, generation: 3 as const, title: next.t, description: next.s, userValue: next.v })),
      ]),
    })),
  };
}

export type ProductStrategistCompactUnderstanding = z.infer<typeof productStrategistCompactUnderstandingSchema>;
export type ProductStrategistCompactOpportunity = z.infer<typeof productStrategistCompactOpportunitySchema>;

export function normalizeProductStrategistProviderResponse(
  input: unknown,
  request: RepositoryDeepIntelligenceRequest,
  modelId?: string,
  options: { rootsOnly?: boolean } = {},
): unknown {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return input;
  const record = input as Record<string, unknown>;
  if (record.schemaVersion === REPOSITORY_DEEP_INTELLIGENCE_RESPONSE_VERSION) return input;
  const { usage, ...candidate } = record;
  const collection = compactResponseCollectionSchema.safeParse(candidate);
  if (!collection.success) return input;
  const payload = buildProductStrategistProviderPayload(request);
  const diagnostics: RepositoryProductNormalizationDiagnostics = {
    parsedOpportunityCount: 0,
    compactOpportunityContract: options.rootsOnly ? 'roots' : 'full',
    compactOpportunityShapeRejectedCount: 0,
    compactOpportunityShapeIssueFields: [],
    opportunityRejectionReasons: Array.from({ length: collection.data.o.length }),
    compactEvidenceReferenceCount: 0,
    compactEvidenceReferenceRejectedCount: 0,
    compactCapabilityReferenceRejectedCount: 0,
    compactPathReferenceRejectedCount: 0,
    compactSupportReferenceRejectedCount: 0,
  };
  const understandingResult = productStrategistCompactUnderstandingSchema.safeParse(collection.data.p);
  if (!payload.evidenceIndex.length) diagnostics.understandingRejectionReason = 'missing-understanding-evidence';
  if (!understandingResult.success) diagnostics.understandingRejectionReason = 'invalid-understanding-shape';
  if (understandingResult.success) {
    const understandingEvidence = [understandingResult.data.e, ...understandingResult.data.caps.map(capability => capability.e)];
    diagnostics.compactEvidenceReferenceCount = understandingEvidence.reduce((count, indexes) => count + indexes.length, 0);
    const rejected = countOutOfRange(understandingEvidence.flat(), payload.evidenceIndex.length);
    diagnostics.compactEvidenceReferenceRejectedCount = rejected;
    if (rejected) diagnostics.understandingRejectionReason = 'compact-evidence-index-out-of-range';
  }

  const opportunitySchema = options.rootsOnly
    ? productStrategistCompactRootOpportunitySchema
    : productStrategistCompactOpportunitySchema;
  const parsedOpportunities = collection.data.o.map(raw => opportunitySchema.safeParse(raw));
  diagnostics.parsedOpportunityCount = parsedOpportunities.filter(result => result.success).length;
  const opportunityValues = parsedOpportunities.map(result => result.success ? result.data : undefined);
  const opportunityResults = parsedOpportunities.map((result, index) => {
    if (!result.success) {
      diagnostics.opportunityRejectionReasons![index] = 'invalid-shape';
      diagnostics.compactOpportunityShapeRejectedCount = (diagnostics.compactOpportunityShapeRejectedCount || 0) + 1;
      diagnostics.compactOpportunityShapeIssueFields = [...new Set([
        ...(diagnostics.compactOpportunityShapeIssueFields || []),
        ...result.error.issues.map(issue => issue.path.slice(0, 2).map(String).join('.')).filter(Boolean),
      ])].sort();
      return collection.data.o[index];
    }
    diagnostics.compactEvidenceReferenceCount = (diagnostics.compactEvidenceReferenceCount || 0) + result.data.e.length;
    const reason = auditOpportunityReferences(result.data, index, {
      evidenceCount: payload.evidenceIndex.length,
      capabilityCount: understandingResult.success ? understandingResult.data.caps.length : 0,
      pathCount: payload.responseContract.permittedCurrentPaths.length,
      opportunities: opportunityValues,
      diagnostics,
    });
    if (reason) {
      diagnostics.opportunityRejectionReasons![index] = reason;
      return collection.data.o[index];
    }
    return normalizeOpportunity(
      result.data,
      index,
      payload,
    );
  });
  const normalized = {
    schemaVersion: REPOSITORY_DEEP_INTELLIGENCE_RESPONSE_VERSION,
    providerId: 'openai-compatible',
    ...(modelId ? { modelId } : {}),
    returnedCapabilities: [...request.requestedCapabilities],
    findings: [],
    productUnderstanding: understandingResult.success && !diagnostics.understandingRejectionReason
      ? normalizeUnderstanding(understandingResult.data, payload)
      : undefined,
    productOpportunities: opportunityResults,
    warnings: [],
    ...(usage === undefined ? {} : { usage }),
  };
  return attachRepositoryProductNormalizationDiagnostics(normalized, diagnostics);
}

function normalizeUnderstanding(
  value: ProductStrategistCompactUnderstanding,
  payload: ProductStrategistProviderPayload,
) {
  const evidenceIds = resolveEvidenceIndexes(value.e, payload);
  const insight = (statement: string) => ({ statement, inferenceLevel: 'inferred' as const, evidenceIds });
  return {
    schemaVersion: REPOSITORY_PRODUCT_UNDERSTANDING_VERSION,
    productSummary: insight(value.s),
    primaryUsers: value.u.map(insight),
    primaryProblem: insight(value.p),
    currentProductLoop: value.loop.map(insight),
    existingCapabilities: value.caps.map((capability, index) => ({
      id: `cap-${index}`,
      title: capability.t,
      description: capability.d,
      evidenceIds: resolveEvidenceIndexes(capability.e, payload),
    })),
    constraints: value.constraints.map(insight),
    businessModelClues: value.business.map(insight),
    missingCapabilityAreas: value.missing.map(insight),
    providerConfidence: value.q,
    limitations: [...value.notes],
  };
}

function normalizeOpportunity(
  value: ProductStrategistCompactOpportunity,
  opportunityIndex: number,
  payload: ProductStrategistProviderPayload,
) {
  const evidenceIds = resolveEvidenceIndexes(value.e, payload);
  const inferenceLevel = value.o === 'evidence-backed'
    ? 'evidence-linked' as const
    : value.o === 'strategic' ? 'strategic-inference' as const : 'exploratory-inference' as const;
  const futureEvolutions = (value.evo || []).flatMap((evolution, evolutionIndex) => {
    const secondId = `op-${opportunityIndex}-evolution-${evolutionIndex}`;
    return [{
      id: secondId,
      generation: 2 as const,
      title: evolution.t,
      description: evolution.s,
      userValue: evolution.v,
    }, ...evolution.next.map((next, nextIndex) => ({
      id: `${secondId}-next-${nextIndex}`,
      parentId: secondId,
      generation: 3 as const,
      title: next.t,
      description: next.s,
      userValue: next.v,
    }))];
  });
  return {
    schemaVersion: REPOSITORY_PRODUCT_OPPORTUNITY_VERSION,
    id: `op-${opportunityIndex}`,
    title: value.t,
    opportunityStatement: value.s,
    userValue: value.v,
    whyItFits: value.f,
    targetUsers: [...value.u],
    evidenceIds,
    origin: value.o,
    inferenceLevel,
    strategicRationale: value.f,
    existingCapabilityIds: value.x.map(index => `cap-${index}`),
    requiredNewCapabilities: value.n.map(title => ({ title, rationale: value.f })),
    futureEvolutions,
    optionalSupportingOpportunityIds: value.support.map(index => `op-${index}`),
    knownConflicts: [...value.conflicts],
    expectedImplementationAreas: value.areas.map(area => {
      const existingPath = area.p === -1 ? undefined : payload.responseContract.permittedCurrentPaths[area.p];
      return {
        label: area.l,
        ...(existingPath ? { existingPath } : {}),
        evidenceIds,
      };
    }),
    changeWeight: value.w,
    impactBreadth: value.b,
    verificationConcept: value.verify,
    humanReviewRequirements: value.caveats.filter(caveat => caveat.r).map(caveat => caveat.t),
    limitations: value.caveats.map(caveat => caveat.t),
    providerConfidence: value.q,
  };
}

function auditOpportunityReferences(
  value: ProductStrategistCompactOpportunity,
  opportunityIndex: number,
  context: {
    evidenceCount: number;
    capabilityCount: number;
    pathCount: number;
    opportunities: Array<ProductStrategistCompactOpportunity | undefined>;
    diagnostics: RepositoryProductNormalizationDiagnostics;
  },
): RepositoryProductOpportunityRejectionReason | undefined {
  const evidenceRejected = countOutOfRange(value.e, context.evidenceCount);
  context.diagnostics.compactEvidenceReferenceRejectedCount = (context.diagnostics.compactEvidenceReferenceRejectedCount || 0) + evidenceRejected;
  const capabilityOutOfRange = value.x.filter(index => index >= context.capabilityCount).length;
  const capabilityDuplicates = duplicateCount(value.x);
  context.diagnostics.compactCapabilityReferenceRejectedCount = (context.diagnostics.compactCapabilityReferenceRejectedCount || 0)
    + capabilityOutOfRange + capabilityDuplicates;
  const pathRejected = value.areas.filter(area => area.p < -1 || area.p >= context.pathCount && area.p !== -1).length;
  context.diagnostics.compactPathReferenceRejectedCount = (context.diagnostics.compactPathReferenceRejectedCount || 0) + pathRejected;
  const supportOutOfRange = value.support.filter(index => index >= context.opportunities.length).length;
  const supportInvalidTarget = value.support.filter(index => index < context.opportunities.length && !context.opportunities[index]).length;
  const supportSelf = value.support.filter(index => index === opportunityIndex).length;
  const supportForward = value.support.filter(index => index > opportunityIndex && index < context.opportunities.length).length;
  const supportDuplicates = duplicateCount(value.support);
  context.diagnostics.compactSupportReferenceRejectedCount = (context.diagnostics.compactSupportReferenceRejectedCount || 0)
    + supportOutOfRange + supportInvalidTarget + supportSelf + supportForward + supportDuplicates;
  if (evidenceRejected) return 'compact-evidence-index-out-of-range';
  if (capabilityOutOfRange) return 'compact-capability-index-out-of-range';
  if (capabilityDuplicates) return 'compact-capability-reference-duplicate';
  if (pathRejected) return 'compact-path-index-out-of-range';
  if (supportOutOfRange) return 'compact-support-index-out-of-range';
  if (supportInvalidTarget) return 'compact-support-target-invalid';
  if (supportSelf) return 'compact-support-self-reference';
  if (supportForward) return 'compact-support-forward-reference';
  if (supportDuplicates) return 'compact-support-reference-duplicate';
  return undefined;
}

function resolveEvidenceIndexes(indexes: readonly number[], payload: ProductStrategistProviderPayload) {
  return indexes.map(index => payload.evidenceIndex[index]!.id);
}

function countOutOfRange(indexes: readonly number[], length: number) {
  return indexes.filter(index => index < 0 || index >= length).length;
}

function duplicateCount(indexes: readonly number[]) {
  return indexes.length - new Set(indexes).size;
}
