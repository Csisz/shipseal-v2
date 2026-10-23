import { useCallback, useState } from 'react';
import { useOptionalAccount } from '@/components/account/accountContext';
import { createProCheckoutSession } from '@/lib/billing/client';
import { recordProductSignal, type FeedbackSurface } from '@/lib/feedback';

export function useUpgradeToProAction(returnTo?: string, surface: FeedbackSurface = 'global') {
  const account = useOptionalAccount();
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const start = useCallback(async () => {
    void recordProductSignal('upgrade_intent', { surface }).catch(() => undefined);
    if (!account.user) {
      account.beginSignIn();
      return;
    }
    setState('loading');
    setMessage('');
    try {
      const current = returnTo || `${window.location.pathname}${window.location.search}${window.location.hash}`;
      window.location.assign(await createProCheckoutSession(current));
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'Billing is temporarily unavailable. Please try again.');
    }
  }, [account, returnTo, surface]);
  return {
    start,
    state,
    message,
    authenticated: Boolean(account.user),
    label: state === 'loading' ? 'Opening secure Checkout…' : account.user ? 'Upgrade to Pro' : 'Sign in to upgrade',
  } as const;
}
