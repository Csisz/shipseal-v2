import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Admin from '@/pages/Admin';

const operation = {
  publicOperationId: 'op_hidden', supportReference: 'RI-456789XYZQ', operationKind: 'repository_futures',
  operationState: 'running', diagnosticState: 'needs_recovery', summary: 'The operation is not actively running and has a safe recovery path.',
  failureCategory: 'provider_timeout', userUnitState: 'reserved', resultExists: false, canRetry: true,
  recoveryAction: 'Resume stale lease', leaseExpiresAt: null, updatedAt: '2026-09-11T10:05:00.000Z',
  reconciliationOutcome: 'not-required', timeline: [{ at: '2026-09-11T10:05:00.000Z', kind: 'stage', label: 'roots · running', detail: null }],
};

function payload(providerLimitState: 'configured' | 'not_configured' | 'invalid' = 'configured') {
  return {
    overview: {
      scans_24h: 2, scans_succeeded_24h: 2, ai_completed_24h: 1, ai_in_progress: 0,
      provider_calls_today: 0, provider_call_limit: providerLimitState === 'configured' ? 100 : null,
      provider_limit_state: providerLimitState, github_failures_24h: 0, stripe_events_24h: 1,
    },
    needsAttention: [{
      publicOperationId: 'op_hidden', supportReference: 'RI-456789XYZQ', operationState: 'running',
      classification: 'needs_recovery', reason: 'Lease expired; recovery is available', userUnitState: 'reserved', updatedAt: '2026-09-11T10:05:00.000Z',
    }],
    recentEvents: [{ category: 'stripe_webhook', action: 'invoice.paid', status: 'succeeded', created_at: '2026-09-11T10:05:00.000Z', deployment_id: null }],
    operation: null,
  };
}

function renderAdmin() {
  return render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Admin /></MemoryRouter>);
}

afterEach(() => vi.unstubAllGlobals());

describe('Admin operations presentation', () => {
  it('shows usage against the configured limit and labels stale work as recovery', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(payload()), { status: 200 })));
    renderAdmin();
    expect(await screen.findByText('0 / 100')).toBeInTheDocument();
    expect(screen.getByText('needs recovery')).toBeInTheDocument();
    expect(screen.getByText('Lease expired; recovery is available')).toBeInTheDocument();
    expect(screen.queryByText('Provider limit')).not.toBeInTheDocument();
  });

  it('does not turn a missing configured limit into zero', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(payload('not_configured')), { status: 200 })));
    renderAdmin();
    expect(await screen.findByText('Not configured')).toBeInTheDocument();
    expect(screen.queryByText('0 / 0')).not.toBeInTheDocument();
  });

  it('resolves a support reference into a readable diagnosis and timeline', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(payload()), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...payload(), operation }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    renderAdmin();
    await screen.findByText('0 / 100');
    fireEvent.change(screen.getByRole('textbox', { name: 'Support reference' }), { target: { value: 'ri-456789xyzq' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(await screen.findByRole('region', { name: 'Operation diagnosis' })).toBeInTheDocument();
    expect(screen.getByText('The operation is not actively running and has a safe recovery path.')).toBeInTheDocument();
    expect(screen.getByText('Yes · Resume stale lease')).toBeInTheDocument();
    expect(screen.getByText('roots · running')).toBeInTheDocument();
    await waitFor(() => expect(fetcher).toHaveBeenLastCalledWith('/api/admin?q=ri-456789xyzq', { credentials: 'include' }));
  });
});
