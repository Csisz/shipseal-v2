import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, RefreshCw } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Nav } from '@/components/agentready/Nav';
import { SurfaceState } from '@/components/agentready/SurfaceState';
import { Button } from '@/components/ui/button';
import { useAccount } from '@/components/account/accountContext';
import { getCurrentUserAiUsage } from '@/lib/persistence/sessionClient';
import { safeBillingReturnPath } from '@/lib/billing/returnPath';

const ACTIVATION_ATTEMPTS = 10;
const ACTIVATION_INTERVAL_MS = 2_000;

export default function PaymentSuccess() {
  const account = useAccount();
  const [searchParams] = useSearchParams();
  const returnTo = safeBillingReturnPath(searchParams.get('returnTo'), '/projects');
  const [state, setState] = useState<'activating' | 'active' | 'delayed' | 'error'>('activating');
  const attempts = useRef(0);
  const timer = useRef<number | null>(null);

  const check = useCallback(async () => {
    if (!account.user) { setState(account.status === 'loading' ? 'activating' : 'error'); return; }
    attempts.current += 1;
    try {
      const usage = await getCurrentUserAiUsage();
      if (usage.plan === 'pro' && ['active', 'trialing'].includes(usage.entitlementStatus)) {
        setState('active');
        await account.refreshUsage();
        timer.current = window.setTimeout(() => window.location.assign(returnTo), 900);
        return;
      }
    } catch {
      if (attempts.current >= ACTIVATION_ATTEMPTS) { setState('delayed'); return; }
    }
    if (attempts.current >= ACTIVATION_ATTEMPTS) { setState('delayed'); return; }
    timer.current = window.setTimeout(() => void check(), ACTIVATION_INTERVAL_MS);
  }, [account, returnTo]);

  useEffect(() => {
    void check();
    return () => { if (timer.current !== null) window.clearTimeout(timer.current); };
  }, [check]);

  const retry = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    attempts.current = 0;
    setState('activating');
    void check();
  };

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <main className="container max-w-2xl pb-20 pt-28" data-testid="payment-activation">
        {state === 'activating' && <SurfaceState tone="loading" title="Activating Pro…" description="Stripe is confirming the subscription with ShipSeal. Access is granted only after the verified webhook updates your account." />}
        {state === 'active' && <SurfaceState tone="empty" icon={CheckCircle2} title="Pro activated" description="Repository Futures is ready. Returning to your repository…" action={<Button onClick={() => window.location.assign(returnTo)}>Open Repository Futures</Button>} />}
        {state === 'delayed' && <SurfaceState tone="empty" title="Payment received; access is still syncing" description="Stripe webhook delivery can take a little longer. Your payment return did not grant access by itself." action={<Button onClick={retry}><RefreshCw data-icon="inline-start" />Refresh access</Button>} />}
        {state === 'error' && <SurfaceState tone="error" title="Sign in to finish activation" description="Use the ShipSeal account that started Checkout, then refresh access. No browser callback is treated as proof of payment." action={<Button onClick={account.beginSignIn}>Sign in with GitHub</Button>} />}
      </main>
    </div>
  );
}
