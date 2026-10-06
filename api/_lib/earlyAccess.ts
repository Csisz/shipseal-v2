import type { EntitlementSnapshot } from '../../src/lib/entitlements/contract.js';
import type { ProductModeSnapshot } from '../../src/lib/productMode.js';

const DEFAULT_EARLY_ACCESS_DEEP_ANALYSIS_LIMIT = 10;

export interface EarlyAccessConfig {
  enabled: boolean;
  deepAnalysisLimit: number;
}

export class EarlyAccessConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EarlyAccessConfigurationError';
  }
}

export function resolveEarlyAccessConfig(env: NodeJS.ProcessEnv = process.env): EarlyAccessConfig {
  const rawEnabled = env.SHIPSEAL_EARLY_ACCESS_FREE?.trim().toLowerCase();
  if (rawEnabled && rawEnabled !== 'true' && rawEnabled !== 'false') {
    throw new EarlyAccessConfigurationError('SHIPSEAL_EARLY_ACCESS_FREE must be true or false.');
  }
  const rawLimit = env.SHIPSEAL_EARLY_ACCESS_DEEP_ANALYSIS_LIMIT?.trim();
  const deepAnalysisLimit = rawLimit ? Number(rawLimit) : DEFAULT_EARLY_ACCESS_DEEP_ANALYSIS_LIMIT;
  if (!Number.isInteger(deepAnalysisLimit) || deepAnalysisLimit < 1 || deepAnalysisLimit > 10_000) {
    throw new EarlyAccessConfigurationError('SHIPSEAL_EARLY_ACCESS_DEEP_ANALYSIS_LIMIT is invalid.');
  }
  return { enabled: rawEnabled === 'true', deepAnalysisLimit };
}

export function publicProductMode(config: EarlyAccessConfig): ProductModeSnapshot {
  return config.enabled
    ? { mode: 'early_access', earlyAccessFree: true, earlyAccessDeepAnalysisLimit: config.deepAnalysisLimit }
    : { mode: 'standard', earlyAccessFree: false, earlyAccessDeepAnalysisLimit: null };
}

export function earlyAccessEntitlement(userId: string, now: Date, config: EarlyAccessConfig): EntitlementSnapshot | null {
  if (!config.enabled) return null;
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
  return {
    userId,
    plan: 'early_access',
    status: 'active',
    capabilities: { repositoryFutures: true, executableFuturePlan: true },
    deepAnalysisLimit: config.deepAnalysisLimit,
    periodStart,
    periodEnd,
    source: 'early_access',
  };
}
