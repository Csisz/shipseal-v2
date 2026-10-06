import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountContext, type AccountContextValue } from '@/components/account/accountContext';
import { FeedbackProvider } from '@/components/feedback/FeedbackProvider';
import { useFeedback } from '@/components/feedback/feedbackContext';
import { Nav } from '@/components/agentready/Nav';

function Harness() {
  const feedback = useFeedback();
  return <div>
    <button onClick={() => feedback.openFeedback({ surface: 'global' })}>Open feedback</button>
    <button onClick={() => feedback.recordOutcome('scan_completed', 'scan_result', { prompt: true })}>Scan outcome</button>
    <button onClick={() => feedback.recordOutcome('future_opened', 'repository_futures', { prompt: true, premiumValue: true })}>Premium outcome</button>
  </div>;
}

function renderFeedback(authenticated = false) {
  const account: AccountContextValue = {
    user: authenticated ? { id: `usr_${'a'.repeat(24)}`, email: 'owner@example.test', displayName: 'Owner', avatarUrl: null } : null,
    status: authenticated ? 'authenticated' : 'anonymous', availabilityMessage: '', usage: null, usageStatus: 'idle',
    refresh: async () => undefined, refreshUsage: async () => undefined, beginSignIn: vi.fn(), logout: async () => undefined,
  };
  return render(<AccountContext.Provider value={account}><MemoryRouter><FeedbackProvider><Harness /></FeedbackProvider></MemoryRouter></AccountContext.Provider>);
}

beforeEach(() => { window.sessionStorage.clear(); vi.restoreAllMocks(); });

describe('Early Access feedback UX', () => {
  it('keeps pricing research hidden until a meaningful premium-value outcome', () => {
    renderFeedback();
    fireEvent.click(screen.getByRole('button', { name: 'Open feedback' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByText(/Would you pay \$19\/month/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Premium outcome' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    expect(screen.getByText(/Would you pay \$19\/month for 10 Deep Analyses/i)).toBeInTheDocument();
  });

  it('dismisses the micro prompt and does not repeat it in the same session', () => {
    renderFeedback();
    fireEvent.click(screen.getByRole('button', { name: 'Scan outcome' }));
    expect(screen.getByRole('region', { name: 'Quick feedback' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss feedback prompt' }));
    expect(screen.queryByRole('region', { name: 'Quick feedback' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Scan outcome' }));
    expect(screen.queryByRole('region', { name: 'Quick feedback' })).not.toBeInTheDocument();
  });

  it('provides keyboard-operable fields, bounded text, authenticated consent, and mobile-contained dialog styling', () => {
    renderFeedback(true);
    fireEvent.click(screen.getByRole('button', { name: 'Open feedback' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('w-[calc(100%-2rem)]');
    expect(screen.getByRole('combobox', { name: 'Use case' })).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(6);
    expect(screen.getByRole('textbox')).toHaveAttribute('maxlength', '2000');
    expect(screen.getByRole('checkbox', { name: 'You may contact me about this feedback' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send feedback' })).toBeDisabled();
  });

  it('keeps a persistent feedback action and calm Early Access label in navigation', () => {
    const account: AccountContextValue = { user: null, status: 'anonymous', availabilityMessage: '', usage: null, usageStatus: 'idle', refresh: async () => undefined, refreshUsage: async () => undefined, beginSignIn: vi.fn(), logout: async () => undefined };
    render(<AccountContext.Provider value={account}><MemoryRouter><FeedbackProvider><Nav /></FeedbackProvider></MemoryRouter></AccountContext.Provider>);
    expect(screen.getByText('Early Access')).toBeInTheDocument();
    expect(screen.getAllByText('Send feedback').length).toBeGreaterThan(0);
  });
});
