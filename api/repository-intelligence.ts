import type { IncomingMessage, ServerResponse } from 'node:http';
import { runRepositoryDeepIntelligence } from '../src/lib/repositoryIntelligence/deepIntelligenceExecution.js';
import {
  REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION,
  type RepositoryIntelligenceProviderApiResponse,
  type RepositoryIntelligenceProviderFailureCategory,
} from '../src/lib/repositoryIntelligence/productionProviderContract.js';
import {
  OpenAiCompatibleRepositoryDeepIntelligenceProvider,
  resolveProductionProviderConfig,
  validateProductionProviderRequest,
  type ProductionProviderLogger,
} from './_lib/repositoryDeepIntelligenceProvider.js';

const MAX_BODY_BYTES = 900 * 1024;
type VercelLikeRequest = IncomingMessage & { body?: unknown };

export interface PrepareProductionRepositoryIntelligenceOptions {
  env?: NodeJS.ProcessEnv;
  fetcher?: typeof fetch;
  logger?: ProductionProviderLogger;
  signal?: AbortSignal;
}

export async function prepareProductionRepositoryIntelligence(
  input: unknown,
  options: PrepareProductionRepositoryIntelligenceOptions = {},
): Promise<{ status: number; body: RepositoryIntelligenceProviderApiResponse }> {
  let config;
  try { config = resolveProductionProviderConfig(options.env); } catch {
    return fallback(503, 'unknown_provider_error', false);
  }
  if (!config.enabled) return fallback(200, 'provider_disabled', false);
  if (!config.apiKey || !config.model) return fallback(200, 'credentials_missing', false);
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || (input as { version?: unknown }).version !== REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION) {
    return fallback(400, 'invalid_request', false);
  }
  const requestValidation = validateProductionProviderRequest((input as { request?: unknown }).request, config.policy);
  if (!requestValidation.valid) return fallback(400, 'invalid_request', false);
  const provider = new OpenAiCompatibleRepositoryDeepIntelligenceProvider({
    config,
    fetcher: options.fetcher,
    logger: options.logger || safeOperationalLogger,
  });
  const execution = await runRepositoryDeepIntelligence({
    provider,
    request: requestValidation.request,
    signal: options.signal,
    timeoutMs: config.policy.timeoutMs,
  });
  if (execution.status === 'completed' && execution.result?.findings.length) {
    return {
      status: 200,
      body: {
        version: REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION,
        state: 'enhanced',
        result: execution.result,
        providerId: execution.result.metadata.providerId,
        modelId: execution.result.metadata.modelId,
      },
    };
  }
  if (execution.status === 'completed') return fallback(200, 'evidence_validation_failed', false);
  if (execution.status === 'timeout') return fallback(200, 'request_timeout', true);
  if (execution.status === 'cancelled') return fallback(200, 'request_cancelled', true);
  const category = mapExecutionError(execution.error?.code);
  return fallback(200, category, execution.error?.retryable === true);
}

function mapExecutionError(code?: string): RepositoryIntelligenceProviderFailureCategory {
  if (code === 'rate_limited' || code === 'provider_unavailable' || code === 'authentication_failed'
    || code === 'response_too_large' || code === 'request_cancelled') return code;
  if (code === 'response-too-large') return 'response_too_large';
  if (['malformed-response', 'unsupported-schema', 'provider-mismatch', 'unsafe-provider-metadata', 'invalid_response'].includes(code || '')) {
    return 'schema_validation_failed';
  }
  if (code === 'unsupported-capability') return 'schema_validation_failed';
  return 'unknown_provider_error';
}

function fallback(status: number, category: RepositoryIntelligenceProviderFailureCategory, retryable: boolean) {
  return {
    status,
    body: {
      version: REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION,
      state: 'fallback' as const,
      category,
      retryable,
      message: category === 'request_cancelled'
        ? 'Enhanced intelligence preparation was cancelled. Deterministic repository intelligence remains ready.'
        : 'Enhanced intelligence is unavailable. Deterministic repository intelligence remains ready for review.',
    },
  };
}

function safeOperationalLogger(event: Parameters<ProductionProviderLogger>[0]) {
  console.info(JSON.stringify(event));
}

async function readJsonBody(req: VercelLikeRequest) {
  if (req.body !== undefined) return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) throw new Error('payload-too-large');
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

function sendJson(res: ServerResponse, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

export default async function handler(req: VercelLikeRequest, res: ServerResponse) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed. Use POST.' });
  let input: unknown;
  try { input = await readJsonBody(req); } catch (error) {
    return sendJson(res, error instanceof Error && error.message === 'payload-too-large' ? 413 : 400, fallback(400, 'invalid_request', false).body);
  }
  const controller = new AbortController();
  const abort = () => controller.abort();
  req.once('aborted', abort);
  try {
    const result = await prepareProductionRepositoryIntelligence(input, { signal: controller.signal });
    return sendJson(res, result.status, result.body);
  } finally {
    req.removeListener('aborted', abort);
  }
}
