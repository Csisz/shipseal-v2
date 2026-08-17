import { describe, expect, it } from 'vitest';
import {
  calculateRepositoryRateLimitBackoffMs,
  parseProviderResetDurationMs,
  parseRetryAfterMs,
  readRepositoryRateLimitHeaders,
} from '@/lib/repositoryIntelligence/rateLimitPolicy';

describe('Repository Intelligence rate-limit policy', () => {
  it('honors Retry-After as a minimum without applying the old short cap', () => {
    expect(calculateRepositoryRateLimitBackoffMs({ rateLimitAttempt: 1, retryAfterMs: 20_000, random: () => 0 })).toBe(20_000);
    expect(calculateRepositoryRateLimitBackoffMs({ rateLimitAttempt: 1, retryAfterMs: 20_000, random: () => 1 })).toBe(20_250);
    expect(parseRetryAfterMs('20', 0)).toBe(20_000);
    expect(parseRetryAfterMs('Thu, 01 Jan 1970 00:00:20 GMT', 5_000)).toBe(15_000);
  });

  it('uses bounded exponential backoff and jitter when Retry-After is absent', () => {
    expect(calculateRepositoryRateLimitBackoffMs({ rateLimitAttempt: 1, random: () => 0 })).toBe(2_000);
    expect(calculateRepositoryRateLimitBackoffMs({ rateLimitAttempt: 2, random: () => 0 })).toBe(4_000);
    expect(calculateRepositoryRateLimitBackoffMs({ rateLimitAttempt: 3, random: () => 1 })).toBe(10_000);
    expect(calculateRepositoryRateLimitBackoffMs({ rateLimitAttempt: 9, random: () => 1 })).toBe(20_000);
  });

  it('normalizes only safe rate-limit header values', () => {
    const headers = new Headers({
      'Retry-After': '12',
      'x-ratelimit-reset-requests': '1.5s',
      'x-ratelimit-reset-tokens': '1m2s',
      'x-ratelimit-remaining-requests': '0',
      'x-ratelimit-remaining-tokens': '55',
      'x-ratelimit-limit-requests': '60',
      'x-ratelimit-limit-tokens': '150000',
      Authorization: 'Bearer must-not-appear',
    });
    const diagnostics = readRepositoryRateLimitHeaders(headers, 0);
    expect(diagnostics).toEqual({
      retryAfterMs: 12_000,
      rateLimitResetRequestsMs: 1_500,
      rateLimitResetTokensMs: 62_000,
      rateLimitRemainingRequests: 0,
      rateLimitRemainingTokens: 55,
      rateLimitLimitRequests: 60,
      rateLimitLimitTokens: 150000,
      rateLimitType: 'requests',
    });
    expect(JSON.stringify(diagnostics)).not.toContain('Bearer');
    expect(parseProviderResetDurationMs('not-a-duration')).toBeUndefined();
  });
});
