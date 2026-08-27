interface BillingUrlResponse { url?: unknown; error?: { code?: string; message?: string } }

export class BillingClientError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'BillingClientError';
  }
}

export async function createProCheckoutSession(returnTo: string) {
  return billingUrlRequest('/api/billing/create-checkout-session', {
    plan: 'pro',
    returnTo,
    checkoutAttemptId: crypto.randomUUID(),
  }, 'checkout.stripe.com');
}

export async function createBillingPortalSession(returnTo: string) {
  return billingUrlRequest('/api/billing/create-portal-session', {
    returnTo,
    portalAttemptId: crypto.randomUUID(),
  }, 'billing.stripe.com');
}

async function billingUrlRequest(path: string, body: Record<string, unknown>, expectedHost: string) {
  let response: Response;
  try {
    response = await fetch(path, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new BillingClientError('billing_unavailable', 'Billing is temporarily unavailable. Please try again.');
  }
  const payload = await response.json().catch(() => null) as BillingUrlResponse | null;
  if (!response.ok) throw new BillingClientError(
    payload?.error?.code || 'billing_unavailable',
    payload?.error?.message || 'Billing is temporarily unavailable. Please try again.',
  );
  if (typeof payload?.url !== 'string') throw new BillingClientError('invalid_billing_response', 'Billing returned an invalid redirect.');
  let redirect: URL;
  try { redirect = new URL(payload.url); } catch { throw new BillingClientError('invalid_billing_response', 'Billing returned an invalid redirect.'); }
  if (redirect.protocol !== 'https:' || redirect.hostname !== expectedHost) {
    throw new BillingClientError('invalid_billing_response', 'Billing returned an untrusted redirect.');
  }
  return redirect.toString();
}
