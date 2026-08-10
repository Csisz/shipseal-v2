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
import { resolveProductionProviderConfig } from '../../api/_lib/repositoryDeepIntelligenceProvider';

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
    expect(paths.some(path => path.includes('pages/activities'))).toBe(true);
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
    expect(productPrepared.budget.selectedFiles).toBeLessThanOrEqual(18);
    expect(productPrepared.budget.estimatedInputTokens).toBeLessThanOrEqual(35_000);
    expect(productPrepared.budget.requestBytes).toBeLessThanOrEqual(PRODUCT_STRATEGIST_CONTEXT_POLICY.maximumRequestBytes);
    expect(productPrepared.request.contextItems.some(item => item.content?.includes('Product responsibility:'))).toBe(true);
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
});
