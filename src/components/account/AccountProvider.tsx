import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { PersistedUser } from '@/lib/persistence/schema';
import { getCurrentUserAiUsage, getCurrentUserSession, logoutCurrentUserSession } from '@/lib/persistence/sessionClient';
import type { AccountAiUsageSummary } from '@/lib/entitlements/contract';
import { AccountContext, type AccountContextValue } from './accountContext';

export function AccountProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PersistedUser | null>(null);
  const [status, setStatus] = useState<AccountContextValue['status']>('loading');
  const [availabilityMessage, setAvailabilityMessage] = useState('');
  const [usage, setUsage] = useState<AccountAiUsageSummary | null>(null);
  const [usageStatus, setUsageStatus] = useState<AccountContextValue['usageStatus']>('idle');
  const lastResumeRefresh = useRef(0);
  const refreshUsage = useCallback(async () => {
    setUsageStatus('loading');
    try { setUsage(await getCurrentUserAiUsage()); setUsageStatus('ready'); }
    catch { setUsage(null); setUsageStatus('unavailable'); }
  }, []);
  const refresh = useCallback(async () => {
    try {
      const current = await getCurrentUserSession();
      setUser(current);
      setStatus(current ? 'authenticated' : 'anonymous');
      setAvailabilityMessage('');
      if (current) await refreshUsage();
      else { setUsage(null); setUsageStatus('idle'); }
    } catch {
      setUser(null);
      setStatus('unavailable');
      setAvailabilityMessage('Account services are temporarily unavailable. Anonymous scanning remains available.');
      setUsage(null);
      setUsageStatus('unavailable');
    }
  }, [refreshUsage]);

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
  useEffect(() => {
    const resume = () => {
      if (!user || document.visibilityState === 'hidden' || Date.now() - lastResumeRefresh.current < 15_000) return;
      lastResumeRefresh.current = Date.now();
      void refreshUsage();
    };
    window.addEventListener('focus', resume);
    document.addEventListener('visibilitychange', resume);
    return () => {
      window.removeEventListener('focus', resume);
      document.removeEventListener('visibilitychange', resume);
    };
  }, [refreshUsage, user]);

  const beginSignIn = useCallback(() => {
    setAvailabilityMessage('');
    const popup = window.open('/api/account/login?returnTo=%2Faccount%2Fcomplete', 'shipseal-account', 'popup=yes,width=620,height=720,resizable=yes,scrollbars=yes');
    if (!popup) window.location.assign('/api/account/login?returnTo=%2F');
  }, []);
  const logout = useCallback(async () => { await logoutCurrentUserSession(); setUser(null); setStatus('anonymous'); setUsage(null); setUsageStatus('idle'); }, []);
  const value = useMemo(() => ({ user, status, availabilityMessage, usage, usageStatus, refresh, refreshUsage, beginSignIn, logout }), [user, status, availabilityMessage, usage, usageStatus, refresh, refreshUsage, beginSignIn, logout]);
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}
