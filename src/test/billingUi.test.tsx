import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountContext, type AccountContextValue } from '@/components/account/accountContext';
import { UpgradeToProButton } from '@/components/billing/BillingActionButton';
import { createBillingPortalSession, createProCheckoutSession } from '@/lib/billing/client';
import { PostScanViewSelector } from '@/components/agentready/result-dashboard/PostScanViewSelector';
import { buildSampleReport } from '@/lib/readiness';

function accountValue(overrides: Partial<AccountContextValue> = {}): AccountContextValue {
  return {
    user: { id: `usr_${'a'.repeat(24)}`, email: null, displayName: 'Ada', avatarUrl: null },
    status: 'authenticated',
    availabilityMessage: '',
    usageStatus: 'ready',
    usage: null,
    refresh: vi.fn(async () => undefined),
    refreshUsage: vi.fn(async () => undefined),
    beginSignIn: vi.fn(),
    logout: vi.fn(async () => undefined),
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Omega 19.2 billing UI', () => {
  it('turns the upgrade_required Futures denial into a Pro conversion surface', () => {
    render(
      <AccountContext.Provider value={accountValue()}>
        <PostScanViewSelector
          report={buildSampleReport()}
          futuresAvailable={false}
          futuresStatus={{
            state: 'fallback', deepState: 'failed', category: 'upgrade_required', retryable: false,
            message: 'Full Repository Futures is a paid AI feature.',
            diagnostics: { costEstimate: 'unavailable' },
          }}
          onSelect={vi.fn()}
        />
      </AccountContext.Provider>,
    );
    expect(screen.getByTestId('futures-degraded-status')).toHaveTextContent('Repository Futures');
    expect(screen.getAllByText('Pro feature').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Upgrade to Pro' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Upgrade to Pro above' })).toBeDisabled();
  });

  it('asks an anonymous visitor to sign in instead of opening Checkout', () => {
    const account = accountValue({ user: null, status: 'anonymous' });
    render(<AccountContext.Provider value={account}><UpgradeToProButton /></AccountContext.Provider>);
    fireEvent.click(screen.getByRole('button', { name: 'Sign in to upgrade' }));
    expect(account.beginSignIn).toHaveBeenCalledTimes(1);
  });

  it('sends only plan, safe return context, and an attempt ID to Checkout', async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ url: 'https://checkout.stripe.com/c/pay/test' }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetcher);
    await expect(createProCheckoutSession('/projects/prj_safe')).resolves.toMatch(/^https:\/\/checkout\.stripe\.com\//);
    const body = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body));
    expect(body).toMatchObject({ plan: 'pro', returnTo: '/projects/prj_safe' });
    expect(body.checkoutAttemptId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(body).not.toHaveProperty('priceId');
  });

  it('rejects an untrusted Checkout or Portal redirect from the API', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ url: 'https://evil.example/redirect' }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })));
    await expect(createProCheckoutSession('/')).rejects.toMatchObject({ code: 'invalid_billing_response' });
    await expect(createBillingPortalSession('/projects')).rejects.toMatchObject({ code: 'invalid_billing_response' });
  });

  it('keeps allowance_exhausted distinct from an upgrade prompt', () => {
    render(
      <AccountContext.Provider value={accountValue()}>
        <PostScanViewSelector
          report={buildSampleReport()}
          futuresAvailable={false}
          futuresStatus={{
            state: 'fallback', deepState: 'failed', category: 'allowance_exhausted', retryable: false,
            message: 'Your current Deep Analysis allowance has been used.',
            diagnostics: { costEstimate: 'unavailable' },
          }}
          onSelect={vi.fn()}
        />
      </AccountContext.Provider>,
    );
    expect(screen.getByText(/allowance has been used/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Upgrade to Pro' })).not.toBeInTheDocument();
  });
});
