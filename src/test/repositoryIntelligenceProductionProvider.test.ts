import { describe, expect, it, vi } from 'vitest';
import {
  buildRepositoryDeepIntelligenceRequest,
  buildRepositoryIntelligenceEvidence,
  prepareRepositoryIntelligenceContext,
  REPOSITORY_DEEP_INTELLIGENCE_RESPONSE_VERSION,
  REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION,
} from '@/lib/repositoryIntelligence';
import { prepareProductionRepositoryIntelligence } from '../../api/repository-intelligence';
import {
  OpenAiCompatibleRepositoryDeepIntelligenceProvider,
  resolveProductionProviderConfig,
  stripSingleJsonFence,
  type ProductionProviderLogEvent,
} from '../../api/_lib/repositoryDeepIntelligenceProvider';
import type { RepoScanInput } from '@/lib/types';
import { RepositoryIntelligenceEnhancementSingleFlight } from '@/lib/repositoryIntelligence/deepIntelligenceClient';

function fixtureRequest() {
  const scanInput: RepoScanInput = {
    repoName: 'provider-fixture',
    source: { sourceType: 'github-url', githubOwner: 'example', githubRepo: 'provider-fixture', githubBranch: 'main' },
    files: [
      { path: 'package.json', size: 80 },
      { path: 'README.md', size: 30 },
      { path: 'src/main.tsx', size: 90 },
      { path: '.env', size: 30, ignored: true, ignoredReason: 'unsafe-path' },
      { path: 'node_modules/pkg/index.js', size: 20, ignored: true, ignoredReason: 'generated-vendor' },
    ],
    textContents: {
      'package.json': JSON.stringify({ scripts: { test: 'vitest' }, dependencies: { react: '^18', vite: '^5' } }),
      'README.md': '# Provider fixture',
      'src/main.tsx': "import React from 'react'; export function bootstrap() { return React.createElement('main'); }",
      '.env': 'API_KEY=never-transmit-value',
    },
  };
  const evidenceResult = buildRepositoryIntelligenceEvidence(scanInput);
  const contextBundle = prepareRepositoryIntelligenceContext({ scanInput, evidenceResult });
  const request = buildRepositoryDeepIntelligenceRequest({
    contextBundle,
    evidenceResult,
    requestedCapabilities: ['architecture-analysis', 'structured-output'],
  });
  return { request };
}

function validProviderPayload(request = fixtureRequest().request) {
  const evidence = request.evidenceReferences.find(item => item.path === 'src/main.tsx')!;
  return {
    schemaVersion: REPOSITORY_DEEP_INTELLIGENCE_RESPONSE_VERSION,
    providerId: 'openai-compatible',
    modelId: 'controlled-model',
    returnedCapabilities: [...request.requestedCapabilities],
    findings: [{
      id: 'entry-observation',
      category: 'architecture-observation',
      title: 'The selected entry module exposes the application bootstrap',
      statement: { type: 'observation', subject: 'src/main.tsx', predicate: 'exports', value: 'bootstrap' },
      referencedPaths: ['src/main.tsx'],
      referencedEvidenceIds: [evidence.id],
      providerConfidence: 0.8,
      inferenceType: 'model-inference',
      limitations: ['Static bounded context only.'],
      artifactTargets: ['architecture'],
    }],
    warnings: [],
  };
}

function envelope(payload: unknown, fenced = false) {
  const content = JSON.stringify(payload);
  return new Response(JSON.stringify({ choices: [{ message: { content: fenced ? `\`\`\`json\n${content}\n\`\`\`` : content } }] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

const enabledEnv = {
  SHIPSEAL_DEEP_INTELLIGENCE_ENABLED: 'true',
  SHIPSEAL_DEEP_INTELLIGENCE_PROVIDER: 'openai-compatible',
  SHIPSEAL_DEEP_INTELLIGENCE_MODEL: 'controlled-model',
  SHIPSEAL_DEEP_INTELLIGENCE_API_KEY: 'test-provider-key-do-not-log',
};

describe('production Repository Intelligence provider', () => {
  it('coalesces repeated enhancement actions into one in-flight request', async () => {
    const singleFlight = new RepositoryIntelligenceEnhancementSingleFlight();
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const task = vi.fn(async () => gate);
    const first = singleFlight.run(task);
    const second = singleFlight.run(task);
    expect(first).toBe(second);
    expect(task).toHaveBeenCalledTimes(1);
    release();
    await first;
    await singleFlight.run(async () => undefined);
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('uses only the validated bounded request and returns validated enhancement data', async () => {
    const { request } = fixtureRequest();
    const logs: ProductionProviderLogEvent[] = [];
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = String(init?.body || '');
      expect(body).toContain(request.fingerprint);
      expect(body).not.toContain('never-transmit-value');
      expect(body).not.toContain('node_modules/pkg');
      expect(body).not.toContain('installationToken');
      expect(body).not.toContain('zip archive');
      return envelope(validProviderPayload(request));
    });
    const result = await prepareProductionRepositoryIntelligence({
      version: REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION,
      request,
    }, { env: enabledEnv, fetcher: fetcher as typeof fetch, logger: event => logs.push(event) });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.status).toBe(200);
    expect(result.body.state).toBe('enhanced');
    expect(result.body.state === 'enhanced' && result.body.result.findings).toHaveLength(1);
    expect(JSON.stringify(logs)).not.toContain(enabledEnv.SHIPSEAL_DEEP_INTELLIGENCE_API_KEY);
    expect(JSON.stringify(logs)).not.toContain('src/main.tsx');
  });

  it('accepts one mechanical JSON fence and rejects prose or malformed JSON', async () => {
    const { request } = fixtureRequest();
    expect(stripSingleJsonFence('```json\n{"ok":true}\n```')).toBe('{"ok":true}');
    const fenced = await prepareProductionRepositoryIntelligence({ version: REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION, request }, {
      env: enabledEnv,
      fetcher: vi.fn(async () => envelope(validProviderPayload(request), true)) as unknown as typeof fetch,
      logger: vi.fn(),
    });
    expect(fenced.body.state).toBe('enhanced');
    const malformedFetcher = vi.fn(async () => envelope('not-json'));
    const malformed = await prepareProductionRepositoryIntelligence({ version: REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION, request }, {
      env: enabledEnv,
      fetcher: malformedFetcher as unknown as typeof fetch,
      logger: vi.fn(),
    });
    expect(malformed.body).toMatchObject({ state: 'fallback', category: 'schema_validation_failed' });
    expect(malformedFetcher).toHaveBeenCalledTimes(1);
  });

  it('rejects missing fields and unsupported artifact targets through the existing schema', async () => {
    const { request } = fixtureRequest();
    const missingProvider = validProviderPayload(request) as Partial<ReturnType<typeof validProviderPayload>>;
    delete missingProvider.providerId;
    const missing = await prepareProductionRepositoryIntelligence({ version: REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION, request }, {
      env: enabledEnv,
      fetcher: vi.fn(async () => envelope(missingProvider)) as unknown as typeof fetch,
      logger: vi.fn(),
    });
    expect(missing.body).toMatchObject({ state: 'fallback', category: 'schema_validation_failed' });

    const unsupported = validProviderPayload(request);
    unsupported.findings[0].artifactTargets = ['not-a-supported-artifact'];
    const invalidTarget = await prepareProductionRepositoryIntelligence({ version: REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION, request }, {
      env: enabledEnv,
      fetcher: vi.fn(async () => envelope(unsupported)) as unknown as typeof fetch,
      logger: vi.fn(),
    });
    expect(invalidTarget.body).toMatchObject({ state: 'fallback', category: 'schema_validation_failed' });
  });

  it('returns deterministic fallback when disabled or credentials are missing', async () => {
    const { request } = fixtureRequest();
    const disabled = await prepareProductionRepositoryIntelligence({ version: REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION, request }, { env: {}, fetcher: vi.fn() as unknown as typeof fetch });
    const missing = await prepareProductionRepositoryIntelligence({ version: REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION, request }, { env: { SHIPSEAL_DEEP_INTELLIGENCE_ENABLED: 'true' }, fetcher: vi.fn() as unknown as typeof fetch });
    expect(disabled.body).toMatchObject({ state: 'fallback', category: 'provider_disabled', retryable: false });
    expect(missing.body).toMatchObject({ state: 'fallback', category: 'credentials_missing', retryable: false });
  });

  it('retries one transient failure but never retries authentication', async () => {
    const { request } = fixtureRequest();
    const transient = vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(envelope(validProviderPayload(request)));
    const recovered = await prepareProductionRepositoryIntelligence({ version: REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION, request }, {
      env: enabledEnv, fetcher: transient as typeof fetch, logger: vi.fn(),
    });
    expect(recovered.body.state).toBe('enhanced');
    expect(transient).toHaveBeenCalledTimes(2);
    const auth = vi.fn(async () => new Response('', { status: 401 }));
    const rejected = await prepareProductionRepositoryIntelligence({ version: REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION, request }, {
      env: enabledEnv, fetcher: auth as typeof fetch, logger: vi.fn(),
    });
    expect(rejected.body).toMatchObject({ state: 'fallback', category: 'authentication_failed' });
    expect(auth).toHaveBeenCalledTimes(1);

    const rateLimited = vi.fn(async () => new Response('', { status: 429, headers: { 'Retry-After': '0' } }));
    const limited = await prepareProductionRepositoryIntelligence({ version: REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION, request }, {
      env: enabledEnv, fetcher: rateLimited as typeof fetch, logger: vi.fn(),
    });
    expect(limited.body).toMatchObject({ state: 'fallback', category: 'rate_limited', retryable: true });
    expect(rateLimited).toHaveBeenCalledTimes(2);

    const network = vi.fn()
      .mockRejectedValueOnce(new TypeError('network unavailable'))
      .mockResolvedValueOnce(envelope(validProviderPayload(request)));
    const networkRecovered = await prepareProductionRepositoryIntelligence({ version: REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION, request }, {
      env: enabledEnv, fetcher: network as typeof fetch, logger: vi.fn(),
    });
    expect(networkRecovered.body.state).toBe('enhanced');
    expect(network).toHaveBeenCalledTimes(2);
  });

  it('falls back for unknown evidence and oversized output without leaking partial provider content', async () => {
    const { request } = fixtureRequest();
    const invalid = validProviderPayload(request);
    invalid.findings[0].referencedEvidenceIds = ['evidence:not-present'];
    const evidenceFailure = await prepareProductionRepositoryIntelligence({ version: REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION, request }, {
      env: enabledEnv, fetcher: vi.fn(async () => envelope(invalid)) as unknown as typeof fetch, logger: vi.fn(),
    });
    expect(evidenceFailure.body).toMatchObject({ state: 'fallback', category: 'evidence_validation_failed' });

    const config = resolveProductionProviderConfig(enabledEnv);
    config.policy.maximumResponseBytes = 64;
    const provider = new OpenAiCompatibleRepositoryDeepIntelligenceProvider({
      config,
      fetcher: vi.fn(async () => envelope(validProviderPayload(request))) as unknown as typeof fetch,
      logger: vi.fn(),
    });
    await expect(provider.analyze(request)).rejects.toMatchObject({ code: 'response_too_large' });
  });

  it('supports cancellation and emits only privacy-safe operational metadata', async () => {
    const { request } = fixtureRequest();
    const logs: ProductionProviderLogEvent[] = [];
    const controller = new AbortController();
    const config = resolveProductionProviderConfig(enabledEnv);
    const provider = new OpenAiCompatibleRepositoryDeepIntelligenceProvider({
      config,
      fetcher: vi.fn(async (_url, init) => {
        controller.abort();
        if (init?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        return envelope(validProviderPayload(request));
      }) as unknown as typeof fetch,
      logger: event => logs.push(event),
    });
    await expect(provider.analyze(request, { signal: controller.signal })).rejects.toMatchObject({ code: 'request_cancelled' });
    const serialized = JSON.stringify(logs);
    expect(serialized).not.toContain(enabledEnv.SHIPSEAL_DEEP_INTELLIGENCE_API_KEY);
    expect(serialized).not.toContain('src/main.tsx');
    expect(serialized).not.toContain('bootstrap');
  });

  it('enforces the configured timeout without converting the repository scan into a failure', async () => {
    const { request } = fixtureRequest();
    const fetcher = vi.fn((_url: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    }));
    const result = await prepareProductionRepositoryIntelligence({ version: REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION, request }, {
      env: { ...enabledEnv, SHIPSEAL_DEEP_INTELLIGENCE_TIMEOUT_MS: '1000' },
      fetcher: fetcher as typeof fetch,
      logger: vi.fn(),
    });
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ state: 'fallback', category: 'request_timeout', retryable: true });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('rejects unsafe or unbounded inbound requests before making a provider call', async () => {
    const { request } = fixtureRequest();
    const fetcher = vi.fn();
    const unsafe = structuredClone(request);
    unsafe.contextItems[0].content = 'PASSWORD=do-not-send';
    const result = await prepareProductionRepositoryIntelligence({ version: REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION, request: unsafe }, {
      env: enabledEnv, fetcher: fetcher as unknown as typeof fetch, logger: vi.fn(),
    });
    expect(result.body).toMatchObject({ state: 'fallback', category: 'invalid_request' });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
