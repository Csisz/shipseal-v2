import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FounderAuditRequestDialog } from '@/components/agentready/FounderAuditRequestForm';
import { Landing } from '@/components/agentready/Landing';

function renderDialog() {
  return render(<FounderAuditRequestDialog open onOpenChange={vi.fn()} />);
}

describe('Contact request form', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is no longer offered on the landing page', () => {
    const { container } = render(
      <Landing onSampleReport={vi.fn()} onScrollScan={vi.fn()} onPickPackage={vi.fn()} scanSlot={null} />
    );

    expect(container.querySelector('a[href^="mailto:"]')).toBeNull();
    expect(screen.queryByRole('button', { name: /founder-reviewed audit/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/founder/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ShipSeal audit/i)).not.toBeInTheDocument();
  });

  it('renders the dialog without mailto links or audit positioning', () => {
    const { container } = renderDialog();

    expect(container.querySelector('a[href^="mailto:"]')).toBeNull();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole('heading', { name: 'Contact ShipSeal' })).toBeInTheDocument();
    expect(within(dialog).getByText(/ShipSeal will use your contact details only to respond to this request/i)).toBeInTheDocument();
    expect(within(dialog).queryByText(/founder|audit/i)).not.toBeInTheDocument();
  });

  it('validates contact, email, message, and consent before submitting', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    renderDialog();
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /Send message/i }));

    expect(screen.getAllByText(/Enter an email or another contact method/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Add a short project summary or message/i)).toBeInTheDocument();
    expect(screen.getByText(/Consent is required before sending/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText('Email'), { target: { value: 'not-an-email' } });
    fireEvent.change(within(dialog).getByLabelText('Message'), { target: { value: 'Please review this AI handoff.' } });
    fireEvent.click(within(dialog).getByLabelText(/I agree to be contacted/i));
    fireEvent.click(within(dialog).getByRole('button', { name: /Send message/i }));

    expect(screen.getByText(/Enter a valid email address/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts valid requests and shows not configured message on API 503', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error: 'Contact form is not configured yet.' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    renderDialog();
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Ada' } });
    fireEvent.change(within(dialog).getByLabelText('Email'), { target: { value: 'ada@example.com' } });
    fireEvent.change(within(dialog).getByLabelText('Message'), { target: { value: 'Review this customer support RAG handoff.' } });
    fireEvent.click(within(dialog).getByLabelText(/I agree to be contacted/i));
    fireEvent.click(within(dialog).getByRole('button', { name: /Send message/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/audit-request', expect.objectContaining({ method: 'POST' })));
    expect(await screen.findByText(/Contact form sending is not configured in this demo environment/i)).toBeInTheDocument();

    const [, request] = fetchMock.mock.calls[0];
    expect(JSON.parse(request.body)).toMatchObject({
      name: 'Ada',
      email: 'ada@example.com',
      message: 'Review this customer support RAG handoff.',
      consent: true,
      source: 'shipseal-contact-request',
    });
  });
});
