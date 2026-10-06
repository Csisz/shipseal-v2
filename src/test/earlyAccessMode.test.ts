import { afterEach, describe, expect, it, vi } from 'vitest';
import checkoutHandler from '../../api/_routes/billing/create-checkout-session';
import {
  earlyAccessEntitlement,
  publicProductMode,
  resolveEarlyAccessConfig,
} from '../../api/_lib/earlyAccess';
import { setAccountPersistenceStoreForTests } from '../../api/_lib/accountPersistence';
import { InMemoryAccountPersistenceStore } from '../../api/_lib/inMemoryAccountPersistence';

const originalEarlyAccess = process.env.SHIPSEAL_EARLY_ACCESS_FREE;
const originalLimit = process.env.SHIPSEAL_EARLY_ACCESS_DEEP_ANALYSIS_LIMIT;

afterEach(() => {
  restoreEnv('SHIPSEAL_EARLY_ACCESS_FREE', originalEarlyAccess);
  restoreEnv('SHIPSEAL_EARLY_ACCESS_DEEP_ANALYSIS_LIMIT', originalLimit);
  setAccountPersistenceStoreForTests(null);
  vi.restoreAllMocks();
});

describe('server-authoritative free Early Access mode', () => {
  it('grants an explicit bounded Early Access entitlement without billing state', () => {
    const config = resolveEarlyAccessConfig({ SHIPSEAL_EARLY_ACCESS_FREE: 'true' });
    const entitlement = earlyAccessEntitlement('usr_early_access', new Date('2026-10-06T12:00:00.000Z'), config);

    expect(config).toEqual({ enabled: true, deepAnalysisLimit: 10 });
    expect(entitlement).toMatchObject({
      plan: 'early_access',
      status: 'active',
      source: 'early_access',
      capabilities: { repositoryFutures: true, executableFuturePlan: true },
      deepAnalysisLimit: 10,
      periodStart: '2026-10-01T00:00:00.000Z',
      periodEnd: '2026-11-01T00:00:00.000Z',
    });
    expect(publicProductMode(config)).toEqual({
      mode: 'early_access',
      earlyAccessFree: true,
      earlyAccessDeepAnalysisLimit: 10,
    });
  });

  it('keeps the configured allowance bounded and rejects ambiguous configuration', () => {
    expect(resolveEarlyAccessConfig({
      SHIPSEAL_EARLY_ACCESS_FREE: 'true',
      SHIPSEAL_EARLY_ACCESS_DEEP_ANALYSIS_LIMIT: '25',
    }).deepAnalysisLimit).toBe(25);
    expect(() => resolveEarlyAccessConfig({ SHIPSEAL_EARLY_ACCESS_FREE: 'yes' })).toThrow(/true or false/i);
    expect(() => resolveEarlyAccessConfig({
      SHIPSEAL_EARLY_ACCESS_FREE: 'true',
      SHIPSEAL_EARLY_ACCESS_DEEP_ANALYSIS_LIMIT: '0',
    })).toThrow(/invalid/i);
  });

  it('disables Checkout before account or Stripe work can begin', async () => {
    process.env.SHIPSEAL_EARLY_ACCESS_FREE = 'true';
    delete process.env.SHIPSEAL_EARLY_ACCESS_DEEP_ANALYSIS_LIMIT;
    const res = responseRecorder();

    await checkoutHandler({ method: 'POST', body: {} } as never, res as never);

    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({
      error: {
        code: 'early_access_free',
        message: 'Full ShipSeal access is free during Early Access. Checkout is disabled.',
      },
    });
  });

  it('restores the standard product mode when the feature flag is disabled', () => {
    const config = resolveEarlyAccessConfig({ SHIPSEAL_EARLY_ACCESS_FREE: 'false' });
    expect(publicProductMode(config)).toEqual({
      mode: 'standard',
      earlyAccessFree: false,
      earlyAccessDeepAnalysisLimit: null,
    });
    expect(earlyAccessEntitlement('usr_standard', new Date('2026-10-06T12:00:00.000Z'), config)).toBeNull();
  });

  it('returns to the normal authenticated Checkout path when Early Access is disabled', async () => {
    process.env.SHIPSEAL_EARLY_ACCESS_FREE = 'false';
    setAccountPersistenceStoreForTests(new InMemoryAccountPersistenceStore());
    const res = responseRecorder();

    await checkoutHandler({ method: 'POST', headers: {}, body: {} } as never, res as never);

    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ error: { code: 'authentication_required' } });
  });
});

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function responseRecorder() {
  let body = '';
  return {
    statusCode: 200,
    headersSent: false,
    setHeader: vi.fn(),
    end: vi.fn((value?: string) => { body = value || ''; }),
    json: () => JSON.parse(body),
  };
}
