import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

beforeEach(() => { window.sessionStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('Early Access feedback UX', () => {
  it('opens from Send feedback and closes an empty dialog with Escape', async () => {
    renderFeedback();
    const trigger = screen.getByRole('button', { name: 'Open feedback' });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Use case' }), { key: 'Escape', code: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it('closes a populated dialog with Escape and restores focus', async () => {
    renderFeedback();
    fireEvent.click(screen.getByRole('button', { name: 'Premium outcome' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    const trigger = screen.getByRole('button', { name: 'Open feedback' });
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.change(document.querySelector('select') as HTMLSelectElement, { target: { value: 'prepare_agent_work' } });
    const choices = screen.getAllByRole('radio');
    fireEvent.click(choices[0]);
    fireEvent.click(choices[3]);
    fireEvent.click(choices[6]);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'QA feedback' } });

    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape', code: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it('restores focus after the explicit Close and Cancel actions', async () => {
    renderFeedback();
    const trigger = screen.getByRole('button', { name: 'Open feedback' });

    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it('keeps Tab navigation inside the open dialog', () => {
    renderFeedback();
    fireEvent.click(screen.getByRole('button', { name: 'Open feedback' }));
    const dialog = screen.getByRole('dialog');
    const close = screen.getByRole('button', { name: 'Close' });
    close.focus();

    fireEvent.keyDown(close, { key: 'Tab', code: 'Tab' });

    expect(dialog).toContainElement(document.activeElement as HTMLElement);
  });

  it('keeps the feedback Select controlled from its initial render without React warnings', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    renderFeedback();
    fireEvent.click(screen.getByRole('button', { name: 'Open feedback' }));
    const select = screen.getByRole('combobox', { name: 'Use case' });
    expect(select).toHaveTextContent('Select a use case');

    const nativeSelect = document.querySelector('select');
    expect(nativeSelect).not.toBeNull();
    fireEvent.change(nativeSelect as HTMLSelectElement, { target: { value: 'prepare_agent_work' } });

    await waitFor(() => expect(select).toHaveTextContent('Prepare work for an AI coding agent'));
    expect(consoleError.mock.calls.flat().join(' ')).not.toMatch(/uncontrolled.*controlled|controlled.*uncontrolled/i);
  });

  it('does not dismiss feedback during an active submission', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => undefined)));
    renderFeedback();
    fireEvent.click(screen.getByRole('button', { name: 'Open feedback' }));
    fireEvent.change(document.querySelector('select') as HTMLSelectElement, { target: { value: 'prepare_agent_work' } });
    const choices = screen.getAllByRole('radio');
    fireEvent.click(choices[0]);
    fireEvent.click(choices[3]);
    fireEvent.click(screen.getByRole('button', { name: 'Send feedback' }));
    await screen.findByRole('button', { name: 'Sending…' });

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape', code: 'Escape' });

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });

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

  it('returns focus to the persistent Send feedback navigation action', async () => {
    const account: AccountContextValue = { user: null, status: 'anonymous', availabilityMessage: '', usage: null, usageStatus: 'idle', refresh: async () => undefined, refreshUsage: async () => undefined, beginSignIn: vi.fn(), logout: async () => undefined };
    render(<AccountContext.Provider value={account}><MemoryRouter><FeedbackProvider><Nav /></FeedbackProvider></MemoryRouter></AccountContext.Provider>);
    const trigger = screen.getAllByRole('button', { name: 'Send feedback' })[0];
    trigger.focus();
    fireEvent.click(trigger);

    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Use case' }), { key: 'Escape', code: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it('returns focus to the mobile Send feedback action without collapsing its navigation context', async () => {
    const account: AccountContextValue = { user: null, status: 'anonymous', availabilityMessage: '', usage: null, usageStatus: 'idle', refresh: async () => undefined, refreshUsage: async () => undefined, beginSignIn: vi.fn(), logout: async () => undefined };
    render(<AccountContext.Provider value={account}><MemoryRouter><FeedbackProvider><Nav /></FeedbackProvider></MemoryRouter></AccountContext.Provider>);
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }));
    const trigger = screen.getAllByRole('button', { name: 'Send feedback' }).at(-1) as HTMLButtonElement;
    trigger.focus();
    fireEvent.click(trigger);

    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Use case' }), { key: 'Escape', code: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('navigation', { name: 'Mobile navigation' })).toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
