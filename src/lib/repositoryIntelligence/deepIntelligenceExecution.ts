import {
  resolveRepositoryDeepIntelligenceResultPolicy,
} from './deepIntelligenceSchema';
import type {
  RepositoryDeepIntelligenceExecutionResult,
  RunRepositoryDeepIntelligenceInput,
} from './deepIntelligenceProvider';
import { validateRepositoryDeepIntelligenceResponse } from './deepIntelligenceValidation';

const MAXIMUM_TIMEOUT_MS = 300_000;

export async function runRepositoryDeepIntelligence({
  provider,
  request,
  signal,
  timeoutMs,
  policy: policyOverride,
}: RunRepositoryDeepIntelligenceInput): Promise<RepositoryDeepIntelligenceExecutionResult> {
  let policy;
  try {
    policy = resolveRepositoryDeepIntelligenceResultPolicy(policyOverride ?? request.resultLimits);
  } catch {
    return failure('provider-failure', 'invalid-policy', 'Deep-intelligence execution policy is invalid.');
  }
  const requestedTimeout = timeoutMs ?? policy.defaultTimeoutMs;
  if (!Number.isSafeInteger(requestedTimeout) || requestedTimeout < 1 || requestedTimeout > MAXIMUM_TIMEOUT_MS) {
    return failure('provider-failure', 'invalid-timeout', 'Deep-intelligence timeout is outside the bounded range.');
  }
  const supported = new Set(provider.capabilities.supported);
  if (request.requestedCapabilities.some(capability => !supported.has(capability))
    || (request.requestedCapabilities.includes('structured-output') && !provider.capabilities.structuredOutput)) {
    return failure('unsupported-capability', 'unsupported-capability', 'Supplied provider does not support every requested capability.');
  }
  if (signal?.aborted) return failure('cancelled', 'cancelled', 'Deep-intelligence execution was cancelled.');

  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  let cancellationHandler: (() => void) | undefined;
  try {
    const providerPromise = Promise.resolve()
      .then(() => provider.analyze(request, { signal: controller.signal }))
      .then(value => ({ type: 'response' as const, value }))
      .catch(() => ({ type: controller.signal.aborted ? 'cancelled' as const : 'failure' as const }));
    const timeoutPromise = new Promise<{ type: 'timeout' }>(resolve => {
      timeoutHandle = setTimeout(() => {
        controller.abort();
        resolve({ type: 'timeout' });
      }, requestedTimeout);
    });
    const cancellationPromise = new Promise<{ type: 'cancelled' }>(resolve => {
      cancellationHandler = () => {
        controller.abort();
        resolve({ type: 'cancelled' });
      };
      signal?.addEventListener('abort', cancellationHandler, { once: true });
    });
    const outcome = await Promise.race([providerPromise, timeoutPromise, cancellationPromise]);
    if (outcome.type === 'timeout') return failure('timeout', 'timeout', 'Deep-intelligence provider exceeded the bounded timeout.');
    if (outcome.type === 'cancelled') return failure('cancelled', 'cancelled', 'Deep-intelligence execution was cancelled.');
    if (outcome.type === 'failure') return failure('provider-failure', 'provider-failure', 'Deep-intelligence provider failed without exposing provider error details.');
    const validation = validateRepositoryDeepIntelligenceResponse({
      request,
      rawResponse: outcome.value,
      expectedProviderId: provider.providerId,
      policy,
    });
    if (!validation.success) return { status: 'invalid-response', error: validation.error };
    return { status: 'completed', result: validation.result };
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
    signal?.removeEventListener('abort', abort);
    if (cancellationHandler) signal?.removeEventListener('abort', cancellationHandler);
  }
}

function failure(
  status: RepositoryDeepIntelligenceExecutionResult['status'],
  code: string,
  message: string,
): RepositoryDeepIntelligenceExecutionResult {
  return { status, error: { code, message } };
}
