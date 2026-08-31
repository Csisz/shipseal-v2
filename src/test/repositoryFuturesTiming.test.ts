import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  REPOSITORY_FUTURES_TIMING,
  repositoryProductClientTimeoutMs,
  repositoryProductProviderTimeoutMs,
  validateRepositoryFuturesTimingPolicy,
} from '@/lib/repositoryIntelligence/productFuturesTiming';
import { PRODUCT_STRATEGIST_CONTEXT_POLICY } from '@/lib/repositoryIntelligence/productStrategistContext';

describe('Repository Futures canonical timing policy', () => {
  it('keeps provider, function, and browser deadlines in a safe finite order', () => {
    expect(validateRepositoryFuturesTimingPolicy()).toEqual({
      valid: true,
      finitePositive: true,
      providerFitsFunction: true,
      browserOutlivesFunction: true,
    });
    expect(repositoryProductProviderTimeoutMs('roots')).toBe(80_000);
    expect(repositoryProductProviderTimeoutMs('expansion')).toBe(70_000);
    expect(repositoryProductClientTimeoutMs()).toBe(135_000);
    expect(PRODUCT_STRATEGIST_CONTEXT_POLICY.timeoutMs).toBe(repositoryProductProviderTimeoutMs('roots'));
  });

  it('matches the explicitly configured Vercel function deadline', () => {
    const config = JSON.parse(readFileSync(resolve(__dirname, '..', '..', 'vercel.json'), 'utf8'));
    expect(config.functions['api/repository-intelligence.ts'].maxDuration * 1_000)
      .toBe(REPOSITORY_FUTURES_TIMING.functionMaxDurationMs);
    expect(REPOSITORY_FUTURES_TIMING.rootProviderTimeoutMs)
      .toBeLessThan(REPOSITORY_FUTURES_TIMING.functionMaxDurationMs - REPOSITORY_FUTURES_TIMING.functionSafetyMarginMs);
    expect(REPOSITORY_FUTURES_TIMING.browserStageTimeoutMs)
      .toBeGreaterThanOrEqual(REPOSITORY_FUTURES_TIMING.functionMaxDurationMs + REPOSITORY_FUTURES_TIMING.browserResponseMarginMs);
  });
});

