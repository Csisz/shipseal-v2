import { describe, expect, it } from 'vitest';
import {
  buildRepositoryDeepIntelligenceRequest,
  buildRepositoryIntelligenceEvidence,
  prepareRepositoryIntelligenceContext,
  REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION,
} from '../src/lib/repositoryIntelligence';
import { prepareProductionRepositoryIntelligence } from '../api/repository-intelligence';
import type { RepoScanInput } from '../src/lib/types';

describe('controlled production-provider smoke test', () => {
  it('makes exactly one explicitly authorized bounded request and validates the result', async () => {
    if (process.env.SHIPSEAL_DEEP_INTELLIGENCE_SMOKE !== 'true') {
      throw new Error('Smoke test not authorized. Set SHIPSEAL_DEEP_INTELLIGENCE_SMOKE=true explicitly.');
    }
    const scanInput: RepoScanInput = {
      repoName: 'shipseal-provider-smoke-fixture',
      source: { sourceType: 'zip-upload' },
      files: [
        { path: 'package.json', size: 78 },
        { path: 'README.md', size: 46 },
        { path: 'src/main.ts', size: 50 },
      ],
      textContents: {
        'package.json': JSON.stringify({ scripts: { test: 'vitest' }, dependencies: { vite: '^5' } }),
        'README.md': '# Controlled provider smoke fixture',
        'src/main.ts': 'export function start() { return true; }',
      },
    };
    const evidenceResult = buildRepositoryIntelligenceEvidence(scanInput);
    const contextBundle = prepareRepositoryIntelligenceContext({
      scanInput,
      evidenceResult,
      policy: { maximumSelectedFiles: 3, maximumTotalCharacters: 4_000 },
    });
    const request = buildRepositoryDeepIntelligenceRequest({
      contextBundle,
      evidenceResult,
      requestedCapabilities: ['architecture-analysis', 'structured-output'],
      policy: { maximumFindings: 4, maximumRawResponseCharacters: 100_000 },
    });
    const startedAt = Date.now();
    const result = await prepareProductionRepositoryIntelligence({
      version: REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION,
      request,
    });
    expect(result.body.state, result.body.state === 'fallback' ? result.body.category : undefined).toBe('enhanced');
    if (result.body.state === 'enhanced') {
      expect(result.body.result.findings.length).toBeGreaterThan(0);
      console.info(JSON.stringify({ state: result.body.state, providerId: result.body.providerId, durationMs: Date.now() - startedAt, validationState: 'validated' }));
    }
  }, 120_000);
});
