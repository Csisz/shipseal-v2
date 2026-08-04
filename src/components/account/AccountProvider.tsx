import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { PersistedUser } from '@/lib/persistence/schema';
import { getCurrentUserSession, logoutCurrentUserSession } from '@/lib/persistence/sessionClient';
import { AccountContext, type AccountContextValue } from './accountContext';

export function AccountProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PersistedUser | null>(null);
  const [status, setStatus] = useState<AccountContextValue['status']>('loading');
  const [availabilityMessage, setAvailabilityMessage] = useState('');
  const refresh = useCallback(async () => {
    try {
      const current = await getCurrentUserSession();
      setUser(current);
      setStatus(current ? 'authenticated' : 'anonymous');
      setAvailabilityMessage('');
    } catch {
      setUser(null);
      setStatus('unavailable');
      setAvailabilityMessage('Account services are temporarily unavailable. Anonymous scanning remains available.');
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const listener = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.data?.source !== 'shipseal-account') return;
      if (event.data?.status === 'authenticated') void refresh();
      if (event.data?.status === 'unavailable') {
        setUser(null);
        setStatus('unavailable');
        setAvailabilityMessage(typeof event.data.message === 'string' ? event.data.message : 'Account sign-in is temporarily unavailable. Anonymous scanning remains available.');
      }
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, [refresh]);

  const beginSignIn = useCallback(() => {
    setAvailabilityMessage('');
    const popup = window.open('/api/account/login?returnTo=%2Faccount%2Fcomplete', 'shipseal-account', 'popup=yes,width=620,height=720,resizable=yes,scrollbars=yes');
    if (!popup) window.location.assign('/api/account/login?returnTo=%2F');
  }, []);
  const logout = useCallback(async () => { await logoutCurrentUserSession(); setUser(null); setStatus('anonymous'); }, []);
  const value = useMemo(() => ({ user, status, availabilityMessage, refresh, beginSignIn, logout }), [user, status, availabilityMessage, refresh, beginSignIn, logout]);
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}
