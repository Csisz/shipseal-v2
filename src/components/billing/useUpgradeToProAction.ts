import { useCallback, useState } from 'react';
import { useOptionalAccount } from '@/components/account/accountContext';
import { createProCheckoutSession } from '@/lib/billing/client';

export function useUpgradeToProAction(returnTo?: string) {
  const account = useOptionalAccount();
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const start = useCallback(async () => {
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
  }, [account, returnTo]);
  return {
    start,
    state,
    message,
    authenticated: Boolean(account.user),
    label: state === 'loading' ? 'Opening secure Checkout…' : account.user ? 'Upgrade to Pro' : 'Sign in to upgrade',
  } as const;
}
