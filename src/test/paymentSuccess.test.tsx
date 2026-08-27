import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountContext, type AccountContextValue } from '@/components/account/accountContext';

vi.mock('@/lib/persistence/sessionClient', () => ({
  getCurrentUserAiUsage: vi.fn(),
}));

import { getCurrentUserAiUsage } from '@/lib/persistence/sessionClient';
import PaymentSuccess from '@/pages/PaymentSuccess';

function accountValue(): AccountContextValue {
  return {
    user: { id: `usr_${'a'.repeat(24)}`, email: null, displayName: 'Ada', avatarUrl: null },
    status: 'authenticated', availabilityMessage: '', usage: null, usageStatus: 'ready',
    refresh: vi.fn(async () => undefined), refreshUsage: vi.fn(async () => undefined),
    beginSignIn: vi.fn(), logout: vi.fn(async () => undefined),
  };
}

afterEach(() => vi.restoreAllMocks());

describe('Omega 19.2 checkout return', () => {
  it('activates only after the authoritative usage endpoint reports Pro', async () => {
    vi.mocked(getCurrentUserAiUsage).mockResolvedValue({
      plan: 'pro', entitlementStatus: 'active',
      capabilities: { repositoryFutures: true, executableFuturePlan: true },
      deepAnalysis: {
        limit: 10, used: 0, reserved: 0, remaining: 10,
        periodStart: '2026-08-01T00:00:00.000Z', periodEnd: '2026-09-01T00:00:00.000Z',
      },
    });
    const account = accountValue();
    render(
      <MemoryRouter initialEntries={['/payment/success?session_id=cs_test_browser_claim&returnTo=%2Fprojects%2Fprj_safe']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AccountContext.Provider value={account}><PaymentSuccess /></AccountContext.Provider>
      </MemoryRouter>,
    );
    expect(screen.getByText('Activating Pro…')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Pro activated')).toBeInTheDocument());
    expect(getCurrentUserAiUsage).toHaveBeenCalledTimes(1);
    expect(account.refreshUsage).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Repository Futures is ready/i)).toBeInTheDocument();
  });
});
