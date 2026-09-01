import { useState, type ComponentProps } from 'react';
import { ArrowUpRight, CreditCard, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createBillingPortalSession } from '@/lib/billing/client';
import { useUpgradeToProAction } from './useUpgradeToProAction';

type ButtonProps = Pick<ComponentProps<typeof Button>, 'size' | 'variant' | 'className'>;

export function UpgradeToProButton({
  returnTo,
  label = 'Upgrade to Pro',
  ...buttonProps
}: ButtonProps & { returnTo?: string; label?: string }) {
  const { start, state, message, authenticated } = useUpgradeToProAction(returnTo);
  return (
    <div className="flex flex-col items-start gap-2">
      <Button type="button" disabled={state === 'loading'} onClick={() => void start()} {...buttonProps}>
        {state === 'loading' && <Loader2 data-icon="inline-start" className="animate-spin motion-reduce:animate-none" />}
        {state === 'loading' ? 'Opening secure Checkout…' : authenticated ? label : 'Sign in to upgrade'}
        {state !== 'loading' && <ArrowUpRight data-icon="inline-end" />}
      </Button>
      {state === 'error' && <p role="alert" className="max-w-sm text-xs text-destructive">{message}</p>}
    </div>
  );
}

export function ManageSubscriptionButton({ returnTo, ...buttonProps }: ButtonProps & { returnTo?: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const start = async () => {
    setState('loading');
    setMessage('');
    try {
      const current = returnTo || `${window.location.pathname}${window.location.search}${window.location.hash}`;
      window.location.assign(await createBillingPortalSession(current));
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'Subscription management is temporarily unavailable.');
    }
  };
  return (
    <div className="flex flex-col items-start gap-2">
      <Button type="button" disabled={state === 'loading'} onClick={() => void start()} {...buttonProps}>
        {state === 'loading' ? <Loader2 data-icon="inline-start" className="animate-spin motion-reduce:animate-none" /> : <CreditCard data-icon="inline-start" />}
        {state === 'loading' ? 'Opening billing portal…' : 'Manage subscription'}
      </Button>
      {state === 'error' && <p role="alert" className="max-w-sm text-xs text-destructive">{message}</p>}
    </div>
  );
}
