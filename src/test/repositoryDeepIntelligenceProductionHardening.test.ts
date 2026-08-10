import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  REPOSITORY_DEEP_INTELLIGENCE_RESPONSE_VERSION,
  REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION,
  buildRepositoryDeepIntelligenceRequest,
  buildRepositoryIntelligenceEvidence,
  prepareRepositoryIntelligenceContext,
  validateRepositoryDeepIntelligenceResponse,
} from '@/lib/repositoryIntelligence';
import { stableContextFingerprint } from '@/lib/repositoryIntelligence/contextSelection';
import {
  clearRepositoryIntelligenceEnhancementSessionCache,
  requestRepositoryIntelligenceEnhancement,
} from '@/lib/repositoryIntelligence/deepIntelligenceClient';
import type { RepositoryDeepIntelligenceRequest } from '@/lib/repositoryIntelligence/deepIntelligenceRequest';
import type { RepoScanInput } from '@/lib/types';
import {
  prepareProductionDeepIntelligenceContext,
  redactSensitiveContent,
} from '../../api/_lib/repositoryDeepIntelligenceContext';
import {
  OpenAiCompatibleRepositoryDeepIntelligenceProvider,
  resolveProductionProviderConfig,
  validatePreparedProductionProviderRequest,
  validateProductionProviderRequest,
} from '../../api/_lib/repositoryDeepIntelligenceProvider';
import { prepareProductionRepositoryIntelligence } from '../../api/repository-intelligence';

const enabledEnv = {
  SHIPSEAL_DEEP_INTELLIGENCE_ENABLED: 'true',
  SHIPSEAL_DEEP_INTELLIGENCE_MODEL: 'controlled-model',
  SHIPSEAL_DEEP_INTELLIGENCE_API_KEY: 'provider-test-key',
};

const syntheticSecretSafetyCases = [
  { name: 'OpenAI project token shape', value: 'sk-proj-syntheticplaceholder12345' },
  { name: 'OpenAI token shape', value: 'sk-syntheticplaceholder12345' },
  { name: 'Stripe-shaped placeholder', value: 'sk_test_placeholder_12345' },
  { name: 'generic sk placeholder', value: 'sk_example_placeholder_12345' },
  { name: 'GitHub boundary token shape', value: 'ghp_123456789012' },
  { name: 'GitHub PAT boundary token shape', value: 'github_pat_123456789012' },
  { name: 'API key assignment', value: 'API_KEY=synthetic-placeholder-value' },
  { name: 'password assignment', value: 'password: synthetic-password-value' },
  { name: 'client secret assignment', value: 'CLIENT_SECRET=synthetic-client-value' },
  { name: 'authorization header', value: 'Authorization: Bearer syntheticBearerValue12345' },
  { name: 'connection credential', value: 'postgres://synthetic-user:synthetic-password@db.example.test/app' },
  { name: 'JWT shape', value: 'eyJsynthetic1.eyJsynthetic2.eyJsynthetic3' },
  { name: 'AWS access ID shape', value: 'AKIA1234567890ABCDEF' },
  { name: 'Google API key shape', value: 'AIzaSyntheticPlaceholderValue1234567890' },
  { name: 'Slack token shape', value: 'xoxb-synthetic-placeholder-12345' },
  { name: 'private key material', value: '-----BEGIN PRIVATE KEY-----\nsynthetic-placeholder-only' },
  { name: 'certificate material', value: '-----BEGIN CERTIFICATE-----\nsynthetic-placeholder-only' },
] as const;

function fixtureRequest(
  requestedCapabilities: Parameters<typeof buildRepositoryDeepIntelligenceRequest>[0]['requestedCapabilities'] = ['architecture-analysis', 'structured-output'],
) {
  const scanInput: RepoScanInput = {
    repoName: 'production-hardening-fixture',
    source: { sourceType: 'github-url', githubOwner: 'example', githubRepo: 'production-hardening-fixture', githubBranch: 'main' },
    files: [
      { path: 'package.json', size: 100 },
      { path: 'README.md', size: 80 },
      { path: 'src/main.ts', size: 100 },
      { path: 'node_modules/pkg/index.js', size: 50, ignored: true, ignoredReason: 'generated-vendor' },
      { path: 'public/image.png', size: 50, ignored: true, ignoredReason: 'binary' },
    ],
    textContents: {
      'package.json': JSON.stringify({ scripts: { test: 'vitest' }, dependencies: { vite: '^5' } }),
      'README.md': '# Hardening fixture\nThe entry module owns bootstrap.',
      'src/main.ts': "export function bootstrap() { return 'ready'; }",
      'node_modules/pkg/index.js': 'never selected vendor content',
    },
  };
  const evidenceResult = buildRepositoryIntelligenceEvidence(scanInput);
  const contextBundle = prepareRepositoryIntelligenceContext({ scanInput, evidenceResult });
  return buildRepositoryDeepIntelligenceRequest({
    contextBundle,
    evidenceResult,
    requestedCapabilities,
  });
}

function refingerprint(request: RepositoryDeepIntelligenceRequest) {
  const { fingerprint: _old, ...withoutFingerprint } = request;
  return { ...withoutFingerprint, fingerprint: stableContextFingerprint(withoutFingerprint) } as RepositoryDeepIntelligenceRequest;
}

function providerPayload(request: RepositoryDeepIntelligenceRequest) {
  const evidence = request.evidenceReferences.find(item => item.path === 'src/main.ts')!;
  return {
    schemaVersion: REPOSITORY_DEEP_INTELLIGENCE_RESPONSE_VERSION,
    providerId: 'openai-compatible',
    modelId: 'controlled-model',
    returnedCapabilities: [...request.requestedCapabilities],
    findings: [{
      id: 'hardening-finding',
      category: 'architecture-observation',
      title: 'The entry module owns bootstrap',
      statement: { type: 'observation', subject: 'src/main.ts', predicate: 'exports', value: 'bootstrap' },
      referencedPaths: ['src/main.ts'],
      referencedEvidenceIds: [evidence.id],
      providerConfidence: 0.75,
      inferenceType: 'model-inference',
      limitations: ['Bounded static context only.'],
      artifactTargets: ['architecture'],
    }],
    warnings: [],
  };
}

function envelope(payload: unknown, headers: Record<string, string> = { 'Content-Type': 'application/json' }) {
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(payload) } }] }), { status: 200, headers });
}

afterEach(() => {
  clearRepositoryIntelligenceEnhancementSessionCache();
  vi.unstubAllGlobals();
});

describe('production Deep Intelligence context and redaction', () => {
  it('keeps every representative ready preparation valid at the strict outbound invariant', () => {
    const config = resolveProductionProviderConfig(enabledEnv);
    const cases = [
      { name: 'normal repository', content: 'export function bootstrap() { return true; }' },
      { name: 'environment template', content: 'PUBLIC_ORIGIN=https://example.test', environmentTemplate: true },
      { name: 'Windows-path content', content: 'Diagnostic source C:\\Users\\operator\\workspace\\src\\main.ts' },
      { name: 'Unix-path content', content: 'Diagnostic source /home/operator/workspace/src/main.ts' },
    ];
    for (const sample of cases) {
      const request = structuredClone(fixtureRequest());
      const selected = request.contextItems.find(item => item.path === 'src/main.ts')!;
      selected.content = sample.content;
      selected.includedCharacters = sample.content.length;
      if (sample.environmentTemplate) selected.sourceCategory = 'environment-template';
      const prepared = prepareProductionDeepIntelligenceContext({
        request: refingerprint(request),
        policy: config.policy,
        maximumOutputTokens: config.policy.maximumOutputTokens,
      });
      expect(prepared.state, sample.name).toBe('ready');
      if (prepared.state !== 'ready') continue;
      expect(validatePreparedProductionProviderRequest(prepared, config.policy), sample.name).toMatchObject({ valid: true });
    }
  });

  it('selects deterministically, bounds files and excerpts, and removes duplicate content', () => {
    const request = structuredClone(fixtureRequest());
    request.contextItems.forEach(item => { item.content = 'same bounded content'; });
    const config = resolveProductionProviderConfig(enabledEnv);
    const first = prepareProductionDeepIntelligenceContext({
      request,
      policy: { ...config.policy, maximumSelectedFiles: 2, maximumExcerptBytesPerFile: 12, maximumContextBytes: 20_000 },
      maximumOutputTokens: config.policy.maximumOutputTokens,
    });
    const reversed = prepareProductionDeepIntelligenceContext({
      request: { ...request, contextItems: [...request.contextItems].reverse() },
      policy: { ...config.policy, maximumSelectedFiles: 2, maximumExcerptBytesPerFile: 12, maximumContextBytes: 20_000 },
      maximumOutputTokens: config.policy.maximumOutputTokens,
    });
    expect(first.state).toBe('ready');
    expect(reversed.state).toBe('ready');
    if (first.state !== 'ready' || reversed.state !== 'ready') return;
    expect(first.request.fingerprint).toBe(reversed.request.fingerprint);
    expect(first.budget.selectedFiles).toBe(2);
    expect(first.budget.duplicateContentsRemoved).toBe(1);
    expect(first.budget.includedContextBytes).toBeLessThanOrEqual(12);
    expect(JSON.stringify(first.request)).not.toContain('node_modules/pkg');
    expect(first.request.knownLimitations).toContain('Duplicate selected content was transmitted once.');
  });

  it('redacts common credentials and excludes suspicious unterminated key material', () => {
    const source = [
      'API_KEY="sk-proj-abcdefghijklmnop123456"',
      'password: hunter2',
      'Authorization: Bearer eyJabcdefghijk.abcdefghijk.abcdefghijk',
      'DATABASE_URL=postgres://shipseal:supersecret@db.example.test/app',
      'AWS_ACCESS_KEY_ID=AKIA1234567890ABCDEF',
      'GITHUB_TOKEN=ghp_abcdefghijklmnopqrstuvwxyz1234',
      'GOOGLE_API_KEY=AIzaabcdefghijklmnopqrstuvwxyz1234567890',
    ].join('\n');
    const redacted = redactSensitiveContent(source, true);
    expect(redacted.excluded).toBe(false);
    expect(redacted.redactedValueCount).toBeGreaterThanOrEqual(7);
    expect(redacted.content).not.toMatch(/hunter2|supersecret|sk-proj-|AKIA123|ghp_|AIza/);
    expect(redacted.content).toContain('[REDACTED:');
    expect(redactSensitiveContent('-----BEGIN PRIVATE KEY-----\nunclosed')).toMatchObject({ excluded: true });
  });

  it('keeps canonical preparation and strict outbound secret validation aligned for every synthetic family', () => {
    const config = resolveProductionProviderConfig(enabledEnv);
    for (const sample of syntheticSecretSafetyCases) {
      const request = structuredClone(fixtureRequest());
      const selected = request.contextItems.find(item => item.path === 'src/main.ts')!;
      selected.content = `export const safetyFixture = true;\n${sample.value}`;
      selected.includedCharacters = selected.content.length;
      const unsafeRequest = refingerprint(request);
      expect(validateProductionProviderRequest(unsafeRequest, config.policy), sample.name).toMatchObject({
        valid: false,
        reason: 'content-safety-secret',
      });
      const prepared = prepareProductionDeepIntelligenceContext({
        request: unsafeRequest,
        policy: config.policy,
        maximumOutputTokens: config.policy.maximumOutputTokens,
      });

      expect(prepared.state, sample.name).toBe('ready');
      if (prepared.state !== 'ready') continue;
      expect(JSON.stringify(prepared.request), sample.name).not.toContain(sample.value);
      expect(prepared.redaction.redactedValueCount + prepared.redaction.excludedContentCount, sample.name).toBeGreaterThan(0);
      expect(validatePreparedProductionProviderRequest(prepared, config.policy), sample.name).toMatchObject({ valid: true });
    }
  });

  it('preserves ordinary product copy, code identifiers, symbols, and repository-relative paths', () => {
    const ordinaryText = [
      'export function secretFeature() { return true; }',
      'export const tokenBudget = 12;',
      "export const keyLabel = 'activity-key';",
      'export function useApiKeyLabel() { return true; }',
      'Product copy: Keep your secret garden organized with token counters and keyboard shortcuts.',
      'Repository path: src/features/secret-token/page.tsx',
    ].join('\n');
    const request = structuredClone(fixtureRequest());
    const selected = request.contextItems.find(item => item.path === 'src/main.ts')!;
    selected.content = ordinaryText;
    selected.includedCharacters = ordinaryText.length;
    const config = resolveProductionProviderConfig(enabledEnv);
    const prepared = prepareProductionDeepIntelligenceContext({
      request: refingerprint(request),
      policy: config.policy,
      maximumOutputTokens: config.policy.maximumOutputTokens,
    });

    expect(prepared.state).toBe('ready');
    if (prepared.state !== 'ready') return;
    expect(prepared.request.contextItems.find(item => item.path === 'src/main.ts')?.content).toBe(ordinaryText);
    expect(prepared.redaction.redactedValueCount).toBe(0);
    expect(validatePreparedProductionProviderRequest(prepared, config.policy)).toMatchObject({ valid: true });
  });

  it('redacts Windows and Unix local absolute paths without changing repository-relative paths', () => {
    const redacted = redactSensitiveContent([
      'Windows: C:\\Users\\operator\\shipseal\\src\\main.ts',
      'Unix: /home/operator/shipseal/src/main.ts',
      'Relative: src/main.ts',
    ].join('\n'));
    expect(redacted.content).not.toMatch(/C:\\Users|\/home\/operator/);
    expect(redacted.content.match(/\[REDACTED:ABSOLUTE_PATH\]/g)).toHaveLength(2);
    expect(redacted.content).toContain('Relative: src/main.ts');
    expect(redacted.redactedValueCount).toBe(2);
    expect(redacted.kinds).toContain('absolute-local-path');
  });

  it('reduces context before provider execution and returns a typed budget-exceeded result when metadata alone cannot fit', () => {
    const request = fixtureRequest();
    const config = resolveProductionProviderConfig(enabledEnv);
    const reduced = prepareProductionDeepIntelligenceContext({
      request,
      policy: { ...config.policy, maximumInputTokens: 1 },
      maximumOutputTokens: config.policy.maximumOutputTokens,
    });
    expect(reduced.state).toBe('budget-exceeded');
    expect(reduced.budget.estimatedInputTokens).toBeGreaterThan(reduced.budget.maximumInputTokens);
    expect(reduced.budget.costEstimate).toBe('unavailable');
  });

  it('uses safe defaults for invalid numeric environment configuration', () => {
    const config = resolveProductionProviderConfig({
      ...enabledEnv,
      SHIPSEAL_DEEP_INTELLIGENCE_TIMEOUT_MS: 'unbounded',
      SHIPSEAL_DEEP_INTELLIGENCE_MAX_INPUT_TOKENS: '-1',
      SHIPSEAL_DEEP_INTELLIGENCE_MAX_ATTEMPTS: '9000',
    });
    expect(config.policy.timeoutMs).toBe(45_000);
    expect(config.policy.maximumInputTokens).toBe(80_000);
    expect(config.policy.maximumProviderAttempts).toBe(2);
    expect(config.configurationWarnings).toHaveLength(3);
  });

  it('skips the provider and returns deterministic fallback when metadata remains over budget', async () => {
    const request = structuredClone(fixtureRequest());
    request.knownLimitations = Array.from({ length: 80 }, (_, index) => `Incomplete scan boundary ${index}: ${'x'.repeat(100)}`);
    const fingerprinted = refingerprint(request);
    const fetcher = vi.fn();
    const result = await prepareProductionRepositoryIntelligence({ version: REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION, request: fingerprinted }, {
      env: { ...enabledEnv, SHIPSEAL_DEEP_INTELLIGENCE_MAX_INPUT_TOKENS: '1000' },
      fetcher: fetcher as unknown as typeof fetch,
      logger: vi.fn(),
    });
    expect(result.body).toMatchObject({ state: 'fallback', category: 'budget_exceeded', deepState: 'budget-exceeded' });
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('production Deep Intelligence transmission, response and caching', () => {
  it('never sends common secret values or logs repository content', async () => {
    const request = structuredClone(fixtureRequest());
    const selected = request.contextItems.find(item => item.path === 'src/main.ts')!;
    selected.content = "password=hunter2\nconst token = 'ghp_abcdefghijklmnopqrstuvwxyz1234';\nexport function bootstrap() {}";
    selected.includedCharacters = selected.content.length;
    request.knownLimitations = [...request.knownLimitations, 'Local diagnostic referenced /home/operator/shipseal/src/main.ts.'];
    const fingerprinted = refingerprint(request);
    const config = resolveProductionProviderConfig(enabledEnv);
    const prepared = prepareProductionDeepIntelligenceContext({ request: fingerprinted, policy: config.policy, maximumOutputTokens: config.policy.maximumOutputTokens });
    expect(prepared.state).toBe('ready');
    if (prepared.state !== 'ready') return;
    const outboundValidation = validatePreparedProductionProviderRequest(prepared, config.policy);
    if ('message' in outboundValidation) throw new Error(outboundValidation.message);
    expect(JSON.stringify(prepared.request)).toContain('[REDACTED:ABSOLUTE_PATH]');
    expect(JSON.stringify(prepared.request)).not.toContain('/home/operator');
    const { fingerprint, ...preparedWithoutFingerprint } = prepared.request;
    expect(fingerprint).toBe(stableContextFingerprint(preparedWithoutFingerprint));
    const logs: unknown[] = [];
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = String(init?.body || '');
      expect(body).not.toMatch(/hunter2|ghp_abcdefghijklmnopqrstuvwxyz1234/);
      expect(body).toContain('[REDACTED:');
      return envelope(providerPayload(fingerprinted));
    });
    await prepareProductionRepositoryIntelligence({ version: REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION, request: fingerprinted }, {
      env: enabledEnv,
      fetcher: fetcher as typeof fetch,
      logger: event => logs.push(event),
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(logs)).not.toMatch(/hunter2|ghp_|src\/main\.ts|bootstrap/);
  });

  it('rejects a successful non-JSON provider response without retrying', async () => {
    const request = fixtureRequest();
    const fetcher = vi.fn(async () => envelope(providerPayload(request), { 'Content-Type': 'text/plain' }));
    const provider = new OpenAiCompatibleRepositoryDeepIntelligenceProvider({
      config: resolveProductionProviderConfig(enabledEnv),
      fetcher: fetcher as typeof fetch,
      logger: vi.fn(),
    });
    await expect(provider.analyze(request)).rejects.toMatchObject({ code: 'provider_envelope_invalid' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('reuses a validated successful response for the same fingerprint within the current session', async () => {
    const request = fixtureRequest();
    const validated = validateRepositoryDeepIntelligenceResponse({
      request,
      rawResponse: providerPayload(request),
      expectedProviderId: 'openai-compatible',
    });
    expect(validated.success).toBe(true);
    if (!validated.success) return;
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      version: REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION,
      state: 'enhanced',
      result: validated.result,
      providerId: 'openai-compatible',
      modelId: 'controlled-model',
      deepState: 'completed-with-warnings',
      diagnostics: { costEstimate: 'unavailable', cacheUsed: false },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetcher);
    const first = await requestRepositoryIntelligenceEnhancement(request);
    const second = await requestRepositoryIntelligenceEnhancement(request);
    expect(first.state).toBe('enhanced');
    expect(second.state === 'enhanced' && second.diagnostics.cacheUsed).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('issues at most one Product Strategist request per scan fingerprint even after fallback', async () => {
    const request = fixtureRequest(['product-opportunity-analysis', 'structured-output']);
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      version: REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION,
      state: 'fallback',
      category: 'request_timeout',
      retryable: true,
      message: 'Product Strategist timed out safely.',
      deepState: 'timed-out',
      diagnostics: { costEstimate: 'unavailable', retryCount: 0, cacheUsed: false },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetcher);
    const first = await requestRepositoryIntelligenceEnhancement(request);
    const second = await requestRepositoryIntelligenceEnhancement(request);
    expect(first).toMatchObject({ state: 'fallback', category: 'request_timeout' });
    expect(second).toMatchObject({ state: 'fallback', category: 'request_timeout', diagnostics: { cacheUsed: true } });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
