import {
  REPOSITORY_DEEP_INTELLIGENCE_CAPABILITIES,
  REPOSITORY_DEEP_INTELLIGENCE_RESPONSE_VERSION,
  resolveRepositoryDeepIntelligenceResultPolicy,
  type RepositoryDeepIntelligenceCapability,
} from '../../src/lib/repositoryIntelligence/deepIntelligenceSchema.js';
import type { RepositoryDeepIntelligenceRequest } from '../../src/lib/repositoryIntelligence/deepIntelligenceRequest.js';
import { stableContextFingerprint } from '../../src/lib/repositoryIntelligence/contextSelection.js';
import {
  RepositoryDeepIntelligenceProviderError,
  type RepositoryDeepIntelligenceCapabilities,
  type RepositoryDeepIntelligenceProvider,
  type RepositoryDeepIntelligenceRunOptions,
} from '../../src/lib/repositoryIntelligence/deepIntelligenceProvider.js';

export const PRODUCTION_PROVIDER_POLICY_VERSION = 'shipseal.production-provider-policy.v1' as const;

export interface ProductionProviderPolicy {
  version: typeof PRODUCTION_PROVIDER_POLICY_VERSION;
  maximumRequestBytes: number;
  maximumContextCharacters: number;
  maximumResponseBytes: number;
  maximumOutputTokens: number;
  timeoutMs: number;
  maximumRetryCount: 0 | 1;
  maximumRetryDelayMs: number;
}

export interface ProductionProviderConfig {
  enabled: boolean;
  provider: 'openai-compatible';
  model: string;
  apiKey: string;
  endpoint: string;
  environmentLabel?: string;
  policy: ProductionProviderPolicy;
}

export type ProductionProviderLogEvent = {
  event: 'repository_intelligence_provider';
  requestId: string;
  providerId: string;
  modelId: string;
  outcome: 'success' | 'retry' | 'failure';
  durationMs: number;
  requestBytes: number;
  retryCount: number;
  statusCategory?: string;
  validationCategory?: string;
};

export type ProductionProviderLogger = (event: ProductionProviderLogEvent) => void;

const DEFAULT_POLICY: ProductionProviderPolicy = Object.freeze({
  version: PRODUCTION_PROVIDER_POLICY_VERSION,
  maximumRequestBytes: 700_000,
  maximumContextCharacters: 350_000,
  maximumResponseBytes: 1_000_000,
  maximumOutputTokens: 6_000,
  timeoutMs: 45_000,
  maximumRetryCount: 1,
  maximumRetryDelayMs: 1_500,
});

const SECRET_VALUE_RE = /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----|\b(?:sk|ghp|github_pat)_[A-Za-z0-9_-]{12,}|\b(?:API[_-]?KEY|ACCESS[_-]?TOKEN|SECRET|PASSWORD)\s*[:=]\s*\S+/i;
const ABSOLUTE_PATH_RE = /(?:[A-Za-z]:[\\/](?:Users|Documents|home)[\\/]|file:\/\/\/|\/Users\/[^/]+\/|\/home\/[^/]+\/)/i;

export function resolveProductionProviderConfig(env: NodeJS.ProcessEnv = process.env): ProductionProviderConfig {
  const provider = (env.SHIPSEAL_DEEP_INTELLIGENCE_PROVIDER || 'openai-compatible').trim();
  if (provider !== 'openai-compatible') throw configurationError('Unsupported deep-intelligence provider configuration.');
  const endpoint = normalizeEndpoint(env.SHIPSEAL_DEEP_INTELLIGENCE_BASE_URL || 'https://api.openai.com/v1');
  return {
    enabled: env.SHIPSEAL_DEEP_INTELLIGENCE_ENABLED === 'true',
    provider,
    model: cleanConfig(env.SHIPSEAL_DEEP_INTELLIGENCE_MODEL, 160),
    apiKey: cleanConfig(env.SHIPSEAL_DEEP_INTELLIGENCE_API_KEY, 8_000),
    endpoint,
    environmentLabel: cleanConfig(env.SHIPSEAL_DEEP_INTELLIGENCE_ENVIRONMENT, 80) || undefined,
    policy: {
      ...DEFAULT_POLICY,
      timeoutMs: boundedInteger(env.SHIPSEAL_DEEP_INTELLIGENCE_TIMEOUT_MS, DEFAULT_POLICY.timeoutMs, 1_000, 120_000),
      maximumOutputTokens: boundedInteger(env.SHIPSEAL_DEEP_INTELLIGENCE_MAX_OUTPUT_TOKENS, DEFAULT_POLICY.maximumOutputTokens, 256, 16_000),
      maximumRequestBytes: boundedInteger(env.SHIPSEAL_DEEP_INTELLIGENCE_MAX_REQUEST_BYTES, DEFAULT_POLICY.maximumRequestBytes, 32_000, 900_000),
      maximumResponseBytes: boundedInteger(env.SHIPSEAL_DEEP_INTELLIGENCE_MAX_RESPONSE_BYTES, DEFAULT_POLICY.maximumResponseBytes, 16_000, 1_000_000),
    },
  };
}

export function validateProductionProviderRequest(
  input: unknown,
  policy: ProductionProviderPolicy,
): { valid: true; request: RepositoryDeepIntelligenceRequest; requestBytes: number } | { valid: false; message: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { valid: false, message: 'Bounded intelligence request is invalid.' };
  let serialized: string;
  try { serialized = JSON.stringify(input); } catch { return { valid: false, message: 'Bounded intelligence request could not be serialized.' }; }
  const requestBytes = Buffer.byteLength(serialized, 'utf8');
  if (requestBytes > policy.maximumRequestBytes) return { valid: false, message: 'Bounded intelligence request exceeds the server request budget.' };
  if (SECRET_VALUE_RE.test(serialized) || ABSOLUTE_PATH_RE.test(serialized)) return { valid: false, message: 'Bounded intelligence request failed content safety validation.' };
  const request = input as Partial<RepositoryDeepIntelligenceRequest>;
  if (request.schemaVersion !== 'shipseal.deep-intelligence-request.v1'
    || request.responseSchemaVersion !== REPOSITORY_DEEP_INTELLIGENCE_RESPONSE_VERSION
    || request.promptContractVersion !== 'shipseal.deep-intelligence-contract.v1'
    || typeof request.fingerprint !== 'string'
    || request.fingerprint.length < 8
    || !Array.isArray(request.contextItems)
    || !Array.isArray(request.evidenceReferences)
    || !Array.isArray(request.requestedCapabilities)
    || !request.resultLimits) return { valid: false, message: 'Bounded intelligence request schema is unsupported.' };
  try { resolveRepositoryDeepIntelligenceResultPolicy(request.resultLimits); } catch { return { valid: false, message: 'Bounded intelligence result policy is invalid.' }; }
  const capabilities = new Set<string>(REPOSITORY_DEEP_INTELLIGENCE_CAPABILITIES);
  if (!request.requestedCapabilities.length || request.requestedCapabilities.some(item => !capabilities.has(item))) {
    return { valid: false, message: 'Bounded intelligence capabilities are invalid.' };
  }
  if (request.contextItems.length > 120 || request.evidenceReferences.length > 4_000) {
    return { valid: false, message: 'Bounded intelligence request exceeds structural limits.' };
  }
  const contextCharacters = request.contextItems.reduce((total, item) => total + (typeof item?.content === 'string' ? item.content.length : 0), 0);
  if (contextCharacters > policy.maximumContextCharacters) return { valid: false, message: 'Bounded repository context exceeds the transmission budget.' };
  const evidenceIds = new Set(request.evidenceReferences.map(item => item?.id).filter((id): id is string => typeof id === 'string'));
  if (evidenceIds.size !== request.evidenceReferences.length
    || request.contextItems.some(item => !safeRelativePath(item?.path)
      || item.supportingEvidenceIds.some(id => !evidenceIds.has(id)))) {
    return { valid: false, message: 'Bounded intelligence request contains invalid paths or evidence references.' };
  }
  const { fingerprint, ...requestWithoutFingerprint } = request as RepositoryDeepIntelligenceRequest;
  if (stableContextFingerprint(requestWithoutFingerprint) !== fingerprint) {
    return { valid: false, message: 'Bounded intelligence request fingerprint is invalid.' };
  }
  return { valid: true, request: request as RepositoryDeepIntelligenceRequest, requestBytes };
}

export class OpenAiCompatibleRepositoryDeepIntelligenceProvider implements RepositoryDeepIntelligenceProvider {
  readonly providerId = 'openai-compatible';
  readonly capabilities: RepositoryDeepIntelligenceCapabilities = {
    supported: [...REPOSITORY_DEEP_INTELLIGENCE_CAPABILITIES],
    structuredOutput: true,
  };

  constructor(private readonly options: {
    config: ProductionProviderConfig;
    fetcher?: typeof fetch;
    logger?: ProductionProviderLogger;
    now?: () => number;
    random?: () => number;
  }) {}

  async analyze(request: RepositoryDeepIntelligenceRequest, runOptions?: RepositoryDeepIntelligenceRunOptions): Promise<unknown> {
    const { config } = this.options;
    const validation = validateProductionProviderRequest(request, config.policy);
    if ('message' in validation) throw new RepositoryDeepIntelligenceProviderError('invalid_response', validation.message);
    const requestId = `ri-${request.fingerprint.slice(0, 16)}`;
    const startedAt = (this.options.now || Date.now)();
    const fetcher = this.options.fetcher || fetch;
    let retryCount = 0;
    for (;;) {
      if (runOptions?.signal?.aborted) throw new RepositoryDeepIntelligenceProviderError('request_cancelled', 'Deep-intelligence request was cancelled.');
      try {
        const response = await fetcher(`${config.endpoint}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(buildProviderBody(request, config)),
          signal: runOptions?.signal,
        });
        if (!response.ok) {
          const failure = httpFailure(response.status);
          if (failure.retryable && retryCount < config.policy.maximumRetryCount) {
            retryCount += 1;
            this.log(requestId, 'retry', startedAt, validation.requestBytes, retryCount, failure.code);
            await boundedRetryDelay(response.headers.get('Retry-After'), config.policy.maximumRetryDelayMs, runOptions?.signal, this.options.random);
            continue;
          }
          throw failure;
        }
        const rawText = await readBoundedResponseText(response, config.policy.maximumResponseBytes, runOptions?.signal);
        const payload = parseProviderEnvelope(rawText);
        this.log(requestId, 'success', startedAt, validation.requestBytes, retryCount);
        return payload;
      } catch (error) {
        if (error instanceof RepositoryDeepIntelligenceProviderError) {
          this.log(requestId, 'failure', startedAt, validation.requestBytes, retryCount, error.code);
          throw error;
        }
        if (runOptions?.signal?.aborted) throw new RepositoryDeepIntelligenceProviderError('request_cancelled', 'Deep-intelligence request was cancelled.');
        if (retryCount < config.policy.maximumRetryCount) {
          retryCount += 1;
          this.log(requestId, 'retry', startedAt, validation.requestBytes, retryCount, 'provider_unavailable');
          await boundedRetryDelay(null, config.policy.maximumRetryDelayMs, runOptions?.signal, this.options.random);
          continue;
        }
        this.log(requestId, 'failure', startedAt, validation.requestBytes, retryCount, 'provider_unavailable');
        throw new RepositoryDeepIntelligenceProviderError('provider_unavailable', 'Deep-intelligence provider is temporarily unavailable.', true);
      }
    }
  }

  private log(requestId: string, outcome: ProductionProviderLogEvent['outcome'], startedAt: number, requestBytes: number, retryCount: number, statusCategory?: string) {
    this.options.logger?.({
      event: 'repository_intelligence_provider', requestId, providerId: this.providerId,
      modelId: this.options.config.model, outcome,
      durationMs: Math.max(0, (this.options.now || Date.now)() - startedAt), requestBytes, retryCount, statusCategory,
    });
  }
}

function buildProviderBody(request: RepositoryDeepIntelligenceRequest, config: ProductionProviderConfig) {
  return {
    model: config.model,
    max_completion_tokens: config.policy.maximumOutputTokens,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: [
          'Return one JSON object only. Do not use Markdown.',
          `The object must use schemaVersion ${REPOSITORY_DEEP_INTELLIGENCE_RESPONSE_VERSION} and providerId openai-compatible.`,
          'Use only the supplied bounded request. Every repository-specific finding must cite supplied paths and evidence IDs.',
          'Deterministic evidence is authoritative. Mark interpretation as model-inference. Never claim code execution or certification.',
          'Required top-level keys: schemaVersion, providerId, modelId, returnedCapabilities, findings, warnings.',
          'Each finding requires id, category, title, statement, referencedPaths, referencedEvidenceIds, providerConfidence, inferenceType, limitations, and artifactTargets.',
        ].join(' '),
      },
      { role: 'user', content: JSON.stringify(request) },
    ],
  };
}

function parseProviderEnvelope(rawText: string): unknown {
  let envelope: unknown;
  try { envelope = JSON.parse(rawText); } catch { throw new RepositoryDeepIntelligenceProviderError('invalid_response', 'Provider returned malformed JSON.'); }
  const content = extractMessageContent(envelope);
  if (typeof content !== 'string') throw new RepositoryDeepIntelligenceProviderError('invalid_response', 'Provider response did not contain structured message content.');
  const normalized = stripSingleJsonFence(content);
  try { return JSON.parse(normalized); } catch { throw new RepositoryDeepIntelligenceProviderError('invalid_response', 'Provider structured content was not valid JSON.'); }
}

function extractMessageContent(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const choices = (value as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== 'object') return undefined;
  const message = (choices[0] as { message?: unknown }).message;
  return message && typeof message === 'object' && !Array.isArray(message)
    ? (message as { content?: unknown }).content
    : undefined;
}

export function stripSingleJsonFence(value: string) {
  const trimmed = value.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1].trim() : trimmed;
}

async function readBoundedResponseText(response: Response, maximumBytes: number, signal?: AbortSignal) {
  const declared = Number(response.headers.get('Content-Length') || 0);
  if (declared > maximumBytes) throw new RepositoryDeepIntelligenceProviderError('response_too_large', 'Provider response exceeded the output-size budget.');
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    if (signal?.aborted) { await reader.cancel(); throw new RepositoryDeepIntelligenceProviderError('request_cancelled', 'Deep-intelligence request was cancelled.'); }
    const next = await reader.read();
    if (next.done) break;
    total += next.value.byteLength;
    if (total > maximumBytes) { await reader.cancel(); throw new RepositoryDeepIntelligenceProviderError('response_too_large', 'Provider response exceeded the output-size budget.'); }
    chunks.push(next.value);
  }
  const joined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(joined);
}

function httpFailure(status: number) {
  if (status === 401 || status === 403) return new RepositoryDeepIntelligenceProviderError('authentication_failed', 'Deep-intelligence provider authentication failed.');
  if (status === 429) return new RepositoryDeepIntelligenceProviderError('rate_limited', 'Deep-intelligence provider rate limit was reached.', true);
  if (status >= 500) return new RepositoryDeepIntelligenceProviderError('provider_unavailable', 'Deep-intelligence provider is temporarily unavailable.', true);
  return new RepositoryDeepIntelligenceProviderError('invalid_response', 'Deep-intelligence provider rejected the bounded request.');
}

async function boundedRetryDelay(retryAfter: string | null, maximumMs: number, signal?: AbortSignal, random: () => number = Math.random) {
  const retryAfterMs = retryAfter && /^\d+(?:\.\d+)?$/.test(retryAfter) ? Number(retryAfter) * 1_000 : 0;
  const delayMs = Math.min(maximumMs, Math.max(200 + Math.floor(random() * 100), retryAfterMs));
  await new Promise<void>((resolve, reject) => {
    const finish = () => { signal?.removeEventListener('abort', abort); resolve(); };
    const timer = setTimeout(finish, delayMs);
    const abort = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); reject(new RepositoryDeepIntelligenceProviderError('request_cancelled', 'Deep-intelligence request was cancelled.')); };
    signal?.addEventListener('abort', abort, { once: true });
  });
}

function safeRelativePath(value: unknown) {
  return typeof value === 'string' && value.length > 0 && value.length <= 500
    && !value.startsWith('/') && !/^[A-Za-z]:[\\/]/.test(value)
    && !value.split(/[\\/]/).includes('..') && !value.includes('\\');
}

function normalizeEndpoint(value: string) {
  let parsed: URL;
  try { parsed = new URL(value); } catch { throw configurationError('Deep-intelligence base URL is invalid.'); }
  if (parsed.protocol !== 'https:') throw configurationError('Deep-intelligence base URL must use HTTPS.');
  return parsed.toString().replace(/\/$/, '');
}

function boundedInteger(value: string | undefined, fallback: number, minimum: number, maximum: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) throw configurationError('Deep-intelligence numeric configuration is outside safe bounds.');
  return parsed;
}

function cleanConfig(value: string | undefined, maximumLength: number) {
  return (value || '').trim().slice(0, maximumLength);
}

function configurationError(message: string) {
  return new RepositoryDeepIntelligenceProviderError('unknown_provider_error', message);
}

export function supportedProviderCapabilities(): RepositoryDeepIntelligenceCapability[] {
  return [...REPOSITORY_DEEP_INTELLIGENCE_CAPABILITIES];
}
