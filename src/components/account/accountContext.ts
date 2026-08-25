import { createContext, useContext } from 'react';
import type { PersistedUser } from '@/lib/persistence';
import type { AccountAiUsageSummary } from '@/lib/entitlements/contract';

export interface AccountContextValue {
  user: PersistedUser | null;
  status: 'loading' | 'anonymous' | 'authenticated' | 'unavailable';
  availabilityMessage: string;
  usage: AccountAiUsageSummary | null;
  usageStatus: 'idle' | 'loading' | 'ready' | 'unavailable';
  refresh: () => Promise<void>;
  refreshUsage: () => Promise<void>;
  beginSignIn: () => void;
  logout: () => Promise<void>;
}

export const AccountContext = createContext<AccountContextValue | null>(null);

export function useAccount() {
  const value = useContext(AccountContext);
  if (!value) throw new Error('useAccount must be used within AccountProvider.');
  return value;
}

export function useOptionalAccount(): AccountContextValue {
  const value = useContext(AccountContext);
  return value || {
    user: null,
    status: 'anonymous',
    availabilityMessage: '',
    usage: null,
    usageStatus: 'idle',
    refresh: async () => undefined,
    refreshUsage: async () => undefined,
    beginSignIn: () => window.location.assign('/api/account/login?returnTo=%2F'),
    logout: async () => undefined,
  };
}
