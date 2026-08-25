import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AccountContext, type AccountContextValue } from '@/components/account/accountContext';
import { AccountUsageCard } from '@/components/account/AccountUsageCard';

function accountValue(overrides: Partial<AccountContextValue> = {}): AccountContextValue {
  return {
    user: { id: `usr_${'a'.repeat(24)}`, email: null, displayName: 'Ada', avatarUrl: null },
    status: 'authenticated',
    availabilityMessage: '',
    usageStatus: 'ready',
    usage: {
      plan: 'pro',
      entitlementStatus: 'active',
      capabilities: { repositoryFutures: true, executableFuturePlan: true },
      deepAnalysis: {
        limit: 10,
        used: 3,
        reserved: 1,
        remaining: 6,
        periodStart: '2026-08-01T00:00:00.000Z',
        periodEnd: '2026-09-01T00:00:00.000Z',
      },
    },
    refresh: vi.fn(async () => undefined),
    refreshUsage: vi.fn(async () => undefined),
    beginSignIn: vi.fn(),
    logout: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe('Omega 19.1 account AI usage UI', () => {
  it('shows the server allowance without exposing operational provider limits', () => {
    render(<AccountContext.Provider value={accountValue()}><AccountUsageCard /></AccountContext.Provider>);
    expect(screen.getByTestId('account-ai-usage')).toHaveTextContent('Pro');
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('3 used · 1 in progress')).toBeInTheDocument();
    expect(screen.queryByText(/provider call|in-flight|global budget/i)).not.toBeInTheDocument();
  });

  it('keeps deterministic functionality explicit for the default Free entitlement', () => {
    const free = accountValue({
      usage: {
        plan: 'free',
        entitlementStatus: 'active',
        capabilities: { repositoryFutures: false, executableFuturePlan: true },
        deepAnalysis: {
          limit: 0,
          used: 0,
          reserved: 0,
          remaining: 0,
          periodStart: '2026-08-01T00:00:00.000Z',
          periodEnd: '2026-09-01T00:00:00.000Z',
        },
      },
    });
    render(<AccountContext.Provider value={free}><AccountUsageCard /></AccountContext.Provider>);
    expect(screen.getByText('Free')).toBeInTheDocument();
    expect(screen.getByText(/deterministic scanning and Project Universe remain available/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /checkout|upgrade/i })).not.toBeInTheDocument();
  });

  it('explains an exhausted paid allowance without suggesting a rescan or checkout', () => {
    const exhausted = accountValue({
      usage: {
        plan: 'pro',
        entitlementStatus: 'active',
        capabilities: { repositoryFutures: true, executableFuturePlan: true },
        deepAnalysis: {
          limit: 4,
          used: 4,
          reserved: 0,
          remaining: 0,
          periodStart: '2026-08-01T00:00:00.000Z',
          periodEnd: '2026-09-01T00:00:00.000Z',
        },
      },
    });
    render(<AccountContext.Provider value={exhausted}><AccountUsageCard /></AccountContext.Provider>);
    expect(screen.getByText(/current Deep Analysis allowance is used/i)).toBeInTheDocument();
    expect(screen.getByText(/saved and cached results remain available/i)).toBeInTheDocument();
    expect(screen.queryByText(/rescan|checkout/i)).not.toBeInTheDocument();
  });
});
