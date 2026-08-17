export const REPOSITORY_RATE_LIMIT_MAX_STAGE_ATTEMPTS = 2;
export const REPOSITORY_RATE_LIMIT_INITIAL_BACKOFF_MS = 2_000;
export const REPOSITORY_RATE_LIMIT_MAX_BACKOFF_MS = 16_000;
export const REPOSITORY_RATE_LIMIT_JITTER_RATIO = 0.25;

export type RepositoryRateLimitType =
  | 'requests'
  | 'tokens'
  | 'requests-and-tokens'
  | 'quota-or-billing'
  | 'unknown';

export interface RepositoryRateLimitDiagnostics {
  rateLimitAttempt?: number;
  retryAfterMs?: number;
  rateLimitResetRequestsMs?: number;
  rateLimitResetTokensMs?: number;
  rateLimitRemainingRequests?: number;
  rateLimitRemainingTokens?: number;
  rateLimitLimitRequests?: number;
  rateLimitLimitTokens?: number;
  rateLimitType?: RepositoryRateLimitType;
}

export function readRepositoryRateLimitHeaders(
  headers: Pick<Headers, 'get'>,
  now = Date.now(),
): RepositoryRateLimitDiagnostics {
  const retryAfterMs = parseRetryAfterMs(headers.get('Retry-After'), now);
  const rateLimitResetRequestsMs = parseProviderResetDurationMs(headers.get('x-ratelimit-reset-requests'));
  const rateLimitResetTokensMs = parseProviderResetDurationMs(headers.get('x-ratelimit-reset-tokens'));
  const rateLimitRemainingRequests = parseNonNegativeNumber(headers.get('x-ratelimit-remaining-requests'));
  const rateLimitRemainingTokens = parseNonNegativeNumber(headers.get('x-ratelimit-remaining-tokens'));
  const rateLimitLimitRequests = parseNonNegativeNumber(headers.get('x-ratelimit-limit-requests'));
  const rateLimitLimitTokens = parseNonNegativeNumber(headers.get('x-ratelimit-limit-tokens'));
  return {
    ...(retryAfterMs === undefined ? {} : { retryAfterMs }),
    ...(rateLimitResetRequestsMs === undefined ? {} : { rateLimitResetRequestsMs }),
    ...(rateLimitResetTokensMs === undefined ? {} : { rateLimitResetTokensMs }),
    ...(rateLimitRemainingRequests === undefined ? {} : { rateLimitRemainingRequests }),
    ...(rateLimitRemainingTokens === undefined ? {} : { rateLimitRemainingTokens }),
    ...(rateLimitLimitRequests === undefined ? {} : { rateLimitLimitRequests }),
    ...(rateLimitLimitTokens === undefined ? {} : { rateLimitLimitTokens }),
    rateLimitType: inferRateLimitType(rateLimitRemainingRequests, rateLimitRemainingTokens),
  };
}

export function calculateRepositoryRateLimitBackoffMs({
  rateLimitAttempt,
  retryAfterMs,
  random = Math.random,
}: {
  rateLimitAttempt: number;
  retryAfterMs?: number;
  random?: () => number;
}) {
  const boundedRandom = Math.min(1, Math.max(0, random()));
  if (retryAfterMs !== undefined) {
    return Math.ceil(Math.max(0, retryAfterMs) + boundedRandom * 250);
  }
  const exponential = Math.min(
    REPOSITORY_RATE_LIMIT_MAX_BACKOFF_MS,
    REPOSITORY_RATE_LIMIT_INITIAL_BACKOFF_MS * 2 ** Math.max(0, rateLimitAttempt - 1),
  );
  return Math.ceil(exponential * (1 + boundedRandom * REPOSITORY_RATE_LIMIT_JITTER_RATIO));
}

export function parseRetryAfterMs(value: string | null, now = Date.now()): number | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (/^\d+(?:\.\d+)?$/.test(trimmed)) return Math.ceil(Number(trimmed) * 1_000);
  const timestamp = Date.parse(trimmed);
  return Number.isFinite(timestamp) ? Math.max(0, timestamp - now) : undefined;
}

export function parseProviderResetDurationMs(value: string | null): number | undefined {
  if (!value) return undefined;
  const trimmed = value.trim().toLowerCase();
  if (/^\d+(?:\.\d+)?$/.test(trimmed)) return Math.ceil(Number(trimmed) * 1_000);
  const pattern = /(\d+(?:\.\d+)?)(ms|s|m|h)/g;
  let total = 0;
  let consumed = '';
  for (const match of trimmed.matchAll(pattern)) {
    consumed += match[0];
    const amount = Number(match[1]);
    const multiplier = match[2] === 'h' ? 3_600_000 : match[2] === 'm' ? 60_000 : match[2] === 's' ? 1_000 : 1;
    total += amount * multiplier;
  }
  return consumed === trimmed && Number.isFinite(total) ? Math.ceil(total) : undefined;
}

function parseNonNegativeNumber(value: string | null): number | undefined {
  if (!value || !/^\d+(?:\.\d+)?$/.test(value.trim())) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function inferRateLimitType(remainingRequests?: number, remainingTokens?: number): RepositoryRateLimitType {
  if (remainingRequests === 0 && remainingTokens === 0) return 'requests-and-tokens';
  if (remainingRequests === 0) return 'requests';
  if (remainingTokens === 0) return 'tokens';
  return 'unknown';
}
