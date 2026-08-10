import { describe, expect, it } from 'vitest';
import type { RepoScanInput } from '@/lib/types';
import {
  PRODUCT_STRATEGIST_CONTEXT_POLICY,
  buildRepositoryDeepIntelligenceRequest,
  buildRepositoryIntelligenceEvidence,
  buildRepositoryProductStrategistRequest,
  prepareRepositoryIntelligenceContext,
  prepareRepositoryProductStrategistContext,
} from '@/lib/repositoryIntelligence';
import { prepareProductionDeepIntelligenceContext } from '../../api/_lib/repositoryDeepIntelligenceContext';
import { resolveProductionExecutionPolicy } from '../../api/repository-intelligence';
import {
  buildProductionProviderBody,
  measureProductionProviderBody,
  resolveProductionProviderConfig,
} from '../../api/_lib/repositoryDeepIntelligenceProvider';
import { buildProductStrategistProviderPayload } from '../../api/_lib/repositoryProductStrategistPayload';

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

function productProjection(scanInput: RepoScanInput) {
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
  return buildProductStrategistProviderPayload(prepared.request);
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
    expect(measurement.outputTokenCap).toBe(2_500);
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
