import { describe, expect, it } from 'vitest';
import type { RepoScanInput } from '@/lib/types';
import {
  PRODUCT_STRATEGIST_CONTEXT_POLICY,
  buildRepositoryDeepIntelligenceRequest,
  buildRepositoryIntelligenceEvidence,
  buildRepositoryProductStrategistRequest,
  prepareRepositoryIntelligenceContext,
  prepareRepositoryProductStrategistContext,
  validateRepositoryDeepIntelligenceResponse,
} from '@/lib/repositoryIntelligence';
import { prepareProductionDeepIntelligenceContext } from '../../api/_lib/repositoryDeepIntelligenceContext';
import { resolveProductionExecutionPolicy } from '../../api/repository-intelligence';
import {
  buildProductionProviderBody,
  measureProductionProviderBody,
  resolveProductionProviderConfig,
} from '../../api/_lib/repositoryDeepIntelligenceProvider';
import { buildProductStrategistProviderPayload } from '../../api/_lib/repositoryProductStrategistPayload';
import {
  buildProductStrategistResponseFormat,
  normalizeProductStrategistProviderResponse,
} from '../../api/_lib/repositoryProductStrategistResponse';

function educationalProductFixture(): RepoScanInput {
  const textContents: Record<string, string> = {
    'README.md': '# BrightSteps\nBrightSteps helps parents generate educational activities and printable worksheets for children.',
    'docs/product-overview.md': '# Product overview\nParents choose a topic, age, and difficulty, then generate and print a learning activity.',
    'src/api/activities/generate.ts': 'export async function generateActivity(topic: string) { return { title: topic, printable: true }; }',
    'src/models/LearningProfile.ts': 'export interface LearningProfile { childId: string; age: number; completedActivityIds: string[]; }',
    'src/auth/account.ts': 'export function requireParentAccount() { return { role: "parent" }; }',
    'src/state/activityHistory.ts': 'export const activityHistory = { completed: [], printable: [] };',
    'src/features/print/PrintableWorksheet.tsx': 'export function PrintableWorksheet() { return <article>Printable worksheet</article>; }',
    'src/features/export/shareWorksheet.ts': 'export function shareWorksheet() { return "share-link"; }',
  };
  for (let index = 0; index < 24; index += 1) {
    textContents[`src/pages/activities/activity-${index}.tsx`] = `export function Activity${index}Page() { return <main>Generate learning activity ${index} for a child and print worksheet</main>; }`;
  }
  for (let index = 0; index < 12; index += 1) {
    textContents[`tooling/config-${index}.ts`] = `export const buildConfig${index} = { lint: true, bundle: true, internal: true };`;
  }
  textContents['.github/workflows/ci.yml'] = 'name: CI\njobs:\n  test:\n    runs-on: ubuntu-latest';
  textContents['AGENTS.md'] = '# Repository agent instructions\nRun tests and lint before changing code.';
  return {
    repoName: 'brightsteps-fixture',
    files: Object.entries(textContents).map(([path, content]) => ({ path, size: content.length })),
    textContents,
  };
}

function saasProductFixture(): RepoScanInput {
  const textContents = {
    'README.md': '# SignalDesk\nA SaaS workspace where customer-success teams collect feedback, prioritize requests, and publish a roadmap.',
    'docs/product.md': '# Workflow\nTeams invite workspace members, import customer feedback, connect requests to accounts, and share roadmap updates.',
    'src/pages/dashboard.tsx': 'export function Dashboard() { return <main>Customer feedback and roadmap priorities</main>; }',
    'src/api/feedback.ts': 'export async function createFeedback(workspaceId: string, accountId: string) { return { workspaceId, accountId }; }',
    'src/models/Workspace.ts': 'export interface Workspace { id: string; memberIds: string[]; feedbackIds: string[]; }',
    'src/auth/workspaceMember.ts': 'export function requireWorkspaceMember() { return true; }',
    'src/services/roadmap.ts': 'export function publishRoadmap() { return { published: true }; }',
  };
  return { repoName: 'signaldesk-fixture', files: Object.entries(textContents).map(([path, content]) => ({ path, size: content.length })), textContents };
}

function developerToolFixture(): RepoScanInput {
  const textContents = {
    'README.md': '# TraceForge\nA developer tool that captures local API traces, compares contracts, and generates reproducible mock scenarios.',
    'docs/getting-started.md': '# Getting started\nDevelopers run the CLI, record a service session, inspect contract drift, then export a mock scenario.',
    'src/cli/record.ts': 'export async function recordTrace(serviceUrl: string) { return { serviceUrl, events: [] }; }',
    'src/commands/compare.ts': 'export function compareContracts(before: object, after: object) { return { changed: true }; }',
    'src/models/TraceSession.ts': 'export interface TraceSession { id: string; eventIds: string[]; createdAt: string; }',
    'src/services/mockExport.ts': 'export function exportMockScenario() { return "scenario.json"; }',
    'src/api/sessions.ts': 'export async function saveSession() { return { saved: true }; }',
  };
  return { repoName: 'traceforge-fixture', files: Object.entries(textContents).map(([path, content]) => ({ path, size: content.length })), textContents };
}

function preparedProductStrategistFixture(scanInput: RepoScanInput) {
  const evidenceResult = buildRepositoryIntelligenceEvidence(scanInput);
  const contextBundle = prepareRepositoryProductStrategistContext({ scanInput, evidenceResult });
  const request = buildRepositoryProductStrategistRequest({ contextBundle, evidenceResult });
  const config = resolveProductionProviderConfig({
    SHIPSEAL_DEEP_INTELLIGENCE_ENABLED: 'true',
    SHIPSEAL_DEEP_INTELLIGENCE_MODEL: 'fixture-model',
    SHIPSEAL_DEEP_INTELLIGENCE_API_KEY: 'fixture-key',
  });
  const policy = resolveProductionExecutionPolicy(request, config.policy);
  const prepared = prepareProductionDeepIntelligenceContext({ request, policy, maximumOutputTokens: policy.maximumOutputTokens });
  if (prepared.state !== 'ready') throw new Error(`Unexpected Product Strategist preparation state: ${prepared.state}`);
  return {
    request: prepared.request,
    projection: buildProductStrategistProviderPayload(prepared.request),
  };
}

function productProjection(scanInput: RepoScanInput) {
  return preparedProductStrategistFixture(scanInput).projection;
}

describe('focused Product Strategist context', () => {
  it('ranks product documentation and user-facing workflows ahead of technical noise deterministically', () => {
    const scanInput = educationalProductFixture();
    const evidenceResult = buildRepositoryIntelligenceEvidence(scanInput);
    const first = prepareRepositoryProductStrategistContext({ scanInput, evidenceResult });
    const second = prepareRepositoryProductStrategistContext({ scanInput, evidenceResult });
    const paths = first.items.map(item => item.path);

    expect(first.fingerprint).toBe(second.fingerprint);
    expect(paths).toEqual(second.items.map(item => item.path));
    expect(paths.slice(0, 5)).toContain('README.md');
    expect(paths).toContain('docs/product-overview.md');
    expect(paths.some(path => /pages\/activities|features\/print/.test(path))).toBe(true);
    expect(paths.some(path => /models|auth|state/.test(path))).toBe(true);
    expect(paths).not.toContain('AGENTS.md');
    expect(paths.some(path => path.startsWith('.github/'))).toBe(false);
    expect(paths.length).toBeLessThanOrEqual(PRODUCT_STRATEGIST_CONTEXT_POLICY.maximumSelectedFiles);
    expect(first.totalCharactersIncluded).toBeLessThanOrEqual(PRODUCT_STRATEGIST_CONTEXT_POLICY.maximumTotalCharacters);
  });

  it('builds a product-only request that is materially smaller than general Deep Intelligence', () => {
    const scanInput = educationalProductFixture();
    const evidenceResult = buildRepositoryIntelligenceEvidence(scanInput);
    const generalContext = prepareRepositoryIntelligenceContext({ scanInput, evidenceResult });
    const productContext = prepareRepositoryProductStrategistContext({ scanInput, evidenceResult });
    const generalRequest = buildRepositoryDeepIntelligenceRequest({
      contextBundle: generalContext,
      evidenceResult,
      requestedCapabilities: ['architecture-analysis', 'responsibility-refinement', 'task-routing', 'risk-identification', 'structured-output'],
    });
    const productRequest = buildRepositoryProductStrategistRequest({ contextBundle: productContext, evidenceResult });
    const config = resolveProductionProviderConfig({
      SHIPSEAL_DEEP_INTELLIGENCE_ENABLED: 'true',
      SHIPSEAL_DEEP_INTELLIGENCE_MODEL: 'fixture-model',
      SHIPSEAL_DEEP_INTELLIGENCE_API_KEY: 'fixture-key',
    });
    const generalPrepared = prepareProductionDeepIntelligenceContext({ request: generalRequest, policy: config.policy, maximumOutputTokens: config.policy.maximumOutputTokens });
    const productPolicy = resolveProductionExecutionPolicy(productRequest, config.policy);
    const productPrepared = prepareProductionDeepIntelligenceContext({ request: productRequest, policy: productPolicy, maximumOutputTokens: productPolicy.maximumOutputTokens });

    expect(generalPrepared.state).toBe('ready');
    expect(productPrepared.state).toBe('ready');
    if (generalPrepared.state !== 'ready' || productPrepared.state !== 'ready') return;
    expect(productRequest.executionProfile).toBe('product-strategist');
    expect(productRequest.requestedCapabilities).toEqual(['product-opportunity-analysis', 'structured-output']);
    expect(productRequest.resultLimits.maximumFindings).toBe(0);
    expect(productPrepared.budget.selectedFiles).toBeLessThanOrEqual(12);
    expect(productPrepared.budget.estimatedInputTokens).toBeLessThanOrEqual(35_000);
    expect(productPrepared.budget.requestBytes).toBeLessThanOrEqual(PRODUCT_STRATEGIST_CONTEXT_POLICY.maximumRequestBytes);
    expect(productPrepared.request.contextItems.some(item => item.content?.includes('Product responsibility:'))).toBe(true);

    const providerBody = buildProductionProviderBody(productPrepared.request, { ...config, policy: productPolicy });
    const measurement = measureProductionProviderBody(productPrepared.request, { ...config, policy: productPolicy }, providerBody);
    const projection = buildProductStrategistProviderPayload(productPrepared.request);
    expect(measurement.providerRequestBytes).toBeLessThanOrEqual(PRODUCT_STRATEGIST_CONTEXT_POLICY.maximumProviderBodyBytes);
    expect(measurement.providerInputTokenEstimate).toBeLessThanOrEqual(PRODUCT_STRATEGIST_CONTEXT_POLICY.targetInputTokens);
    expect(measurement.anatomy.systemPromptBytes).toBeGreaterThan(0);
    expect(measurement.anatomy.contextBytes).toBeGreaterThan(0);
    expect(measurement.anatomy.evidenceBytes).toBeGreaterThan(0);
    expect(measurement.anatomy.coverageBytes).toBeGreaterThan(0);
    expect(measurement.anatomy.responseContractBytes).toBeGreaterThan(0);
    expect(measurement.fullRequestProviderBaselineBytes).toBeGreaterThan(measurement.providerRequestBytes);
    expect(measurement.fullRequestProviderBaselineInputTokens).toBeGreaterThan(measurement.providerInputTokenEstimate);
    expect(measurement.internalAnatomy.contextItemsMetadataBytes).toBeGreaterThan(0);
    expect(measurement.internalAnatomy.contextItemsContentBytes).toBeGreaterThan(0);
    expect(measurement.internalAnatomy.responsibilitySummaryBytes).toBeGreaterThan(0);
    expect(measurement.internalAnatomy.safetyInstructionsBytes).toBeGreaterThan(0);
    expect(measurement.internalAnatomy.resultLimitsBytes).toBeGreaterThan(0);
    expect(measurement.anatomy.userMessageBytes).toBeLessThan(productPrepared.budget.requestBytes);
    expect(measurement.outputTokenCap).toBe(4_000);
    expect(projection.context).toHaveLength(productPrepared.budget.selectedFiles);
    expect(projection.coverage).toMatchObject({ productDescription: true, userSurface: true, productWorkflow: true });
    expect(projection.evidenceIndex.length).toBeGreaterThan(0);
    expect(JSON.stringify(projection)).not.toContain('safetyInstructions');
    expect(JSON.stringify(projection)).not.toContain('responsibilitySummary');
  });

  it('prevents Product Opportunity analysis from sharing a broad technical request', () => {
    const scanInput = educationalProductFixture();
    const evidenceResult = buildRepositoryIntelligenceEvidence(scanInput);
    const contextBundle = prepareRepositoryIntelligenceContext({ scanInput, evidenceResult });
    expect(() => buildRepositoryDeepIntelligenceRequest({
      contextBundle,
      evidenceResult,
      requestedCapabilities: ['architecture-analysis', 'product-opportunity-analysis', 'structured-output'],
    })).toThrow(/execute separately/i);
  });

  it('preserves useful educational-product strategy through compact deterministic normalization', () => {
    const { request, projection } = preparedProductStrategistFixture(educationalProductFixture());
    expect(projection.evidenceIndex.length).toBeGreaterThan(0);
    const responseFormat = buildProductStrategistResponseFormat(projection);
    expect(responseFormat.json_schema.schema.properties.p.properties.e.items.maximum)
      .toBe(projection.evidenceIndex.length - 1);
    expect(responseFormat.json_schema.schema.properties.o.items.properties.areas.items.properties.p.maximum)
      .toBe(projection.responseContract.permittedCurrentPaths.length - 1);
    const compactResponse = {
      p: {
        s: 'BrightSteps helps parents create printable learning activities for children.',
        u: ['Parents', 'Children'],
        p: 'Parents need age-matched activities they can use quickly.',
        loop: ['Choose topic and level', 'Generate activity', 'Print or share', 'Complete activity'],
        caps: [
          { t: 'Activity generation', d: 'Creates printable topic-based activities.', e: [0] },
          { t: 'Learning profiles', d: 'Stores child age and completed activities.', e: [0] },
        ],
        constraints: ['No outcome scoring appears in evidence.'],
        business: [],
        missing: ['Progress interpretation', 'Interactive activity state'],
        e: [0],
        notes: ['Parent validation is still required.'],
        q: 0.82,
      },
      o: [
        {
          t: 'Learning progress snapshots',
          s: 'Turn completed activity history into simple skill and topic progress views.',
          v: 'Parents see what to reinforce without reviewing every worksheet.',
          f: 'Builds on stored activity history and the existing parent workflow.',
          u: ['Parents'], e: [0], o: 'strategic', x: [1],
          n: ['Progress aggregation'], support: [], conflicts: [],
          areas: [{ l: 'Activity history analysis', p: -1 }], w: 'moderate', b: 'workflow',
          verify: 'Parents identify the next topic from a progress snapshot in one minute.',
          caveats: [{ t: 'Avoid unsupported learning claims.', r: true }], q: 0.78,
        },
        {
          t: 'Interactive activity mode',
          s: 'Let children complete selected generated activities in an interactive flow.',
          v: 'Families can use activities when printing is inconvenient.',
          f: 'Extends the existing generation flow while preserving printable output.',
          u: ['Parents', 'Children'], e: [0], o: 'strategic', x: [0],
          n: ['Interactive activity runtime'], support: [], conflicts: [],
          areas: [{ l: 'Activity experience', p: -1 }], w: 'broad', b: 'cross-product',
          verify: 'A child completes a generated activity and the result is retained.',
          caveats: [{ t: 'Validate accessibility for children.', r: true }], q: 0.74,
        },
        {
          t: 'Adaptive follow-up activities',
          s: 'Suggest a focused next activity from age and completion history.',
          v: 'Parents spend less time choosing what should come next.',
          f: 'Uses the learning profile to guide the established generation workflow.',
          u: ['Parents'], e: [0], o: 'exploratory', x: [0, 1],
          n: ['Follow-up recommendation rules'], support: [0], conflicts: [],
          areas: [{ l: 'Activity recommendations', p: -1 }], w: 'moderate', b: 'workflow',
          verify: 'Parents accept or replace a suggested follow-up and record usefulness.',
          caveats: [{ t: 'Keep recommendations explainable.', r: true }], q: 0.7,
        },
      ],
    };

    const first = normalizeProductStrategistProviderResponse(compactResponse, request, 'fixture-model');
    const second = normalizeProductStrategistProviderResponse(compactResponse, request, 'fixture-model');
    expect(first).toEqual(second);

    const validation = validateRepositoryDeepIntelligenceResponse({
      request,
      rawResponse: first,
      expectedProviderId: 'openai-compatible',
    });
    expect(validation).toEqual(expect.objectContaining({ success: true }));
    if (!validation.success) return;
    expect(validation.result.productIntelligence?.understanding).toMatchObject({
      productSummary: { statement: expect.stringContaining('printable learning activities') },
      primaryUsers: expect.arrayContaining([expect.objectContaining({ statement: 'Parents' })]),
      existingCapabilities: expect.arrayContaining([
        expect.objectContaining({ sourceId: 'cap-0' }),
        expect.objectContaining({ sourceId: 'cap-1' }),
      ]),
    });
    const opportunities = validation.result.productIntelligence?.opportunities || [];
    expect(validation.result.productIntelligence).toMatchObject({
      understandingRejectionReason: undefined,
      validationDiagnostics: {
        parsedOpportunityCount: 3,
        compactEvidenceReferenceRejectedCount: 0,
        compactCapabilityReferenceRejectedCount: 0,
        compactPathReferenceRejectedCount: 0,
        compactSupportReferenceRejectedCount: 0,
      },
    });
    expect(opportunities).toHaveLength(3);
    expect(opportunities.map(item => item.sourceId)).toEqual(expect.arrayContaining([
      'op-0',
      'op-1',
      'op-2',
    ]));
    expect(opportunities.every(item => item.userValue && item.whyItFits && item.evidenceIds.length > 0)).toBe(true);
    expect(opportunities.every(item => item.requiredNewCapabilities.length > 0)).toBe(true);
  });

  it.each([
    ['educational product', educationalProductFixture()],
    ['SaaS product', saasProductFixture()],
    ['developer tool', developerToolFixture()],
  ])('keeps product, workflow, user-surface, and implementation evidence for the %s fixture', (_name, scanInput) => {
    const first = productProjection(scanInput);
    const second = productProjection(scanInput);
    expect(first).toEqual(second);
    expect(first.context.length).toBeGreaterThanOrEqual(4);
    expect(first.context.length).toBeLessThanOrEqual(12);
    expect(first.coverage).toMatchObject({ productDescription: true, userSurface: true, productWorkflow: true });
    expect(first.coverage.persistenceOrDataModel || first.coverage.apiOrService).toBe(true);
    expect(first.evidenceIndex.length).toBeGreaterThan(0);
    expect(first.responseContract.permittedCurrentPaths).toEqual(first.context.map(item => item.path));
  });
});
