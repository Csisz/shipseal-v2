export const SHIPSEAL_PLANS = ['free', 'pro', 'team', 'internal'] as const;
export type ShipSealPlan = typeof SHIPSEAL_PLANS[number];

export const ENTITLEMENT_STATUSES = ['active', 'trialing', 'past_due', 'expired', 'disabled'] as const;
export type EntitlementStatus = typeof ENTITLEMENT_STATUSES[number];

export const ENTITLEMENT_SOURCES = ['default', 'internal', 'billing'] as const;
export type EntitlementSource = typeof ENTITLEMENT_SOURCES[number];

export const AI_USAGE_DENIAL_CATEGORIES = [
  'authentication_required',
  'upgrade_required',
  'allowance_exhausted',
  'entitlement_inactive',
  'usage_temporarily_unavailable',
  'global_ai_budget_exhausted',
  'global_ai_capacity_reached',
  'operation_conflict',
] as const;
export type AiUsageDenialCategory = typeof AI_USAGE_DENIAL_CATEGORIES[number];

export interface EntitlementSnapshot {
  userId: string;
  plan: ShipSealPlan;
  status: EntitlementStatus;
  capabilities: {
    repositoryFutures: boolean;
    executableFuturePlan: boolean;
  };
  deepAnalysisLimit: number;
  periodStart: string;
  periodEnd: string;
  source: EntitlementSource;
}

export interface AccountAiUsageSummary {
  plan: ShipSealPlan;
  entitlementStatus: EntitlementStatus;
  capabilities: EntitlementSnapshot['capabilities'];
  deepAnalysis: {
    limit: number;
    used: number;
    reserved: number;
    remaining: number;
    periodStart: string;
    periodEnd: string;
  };
}

export function isAccountAiUsageSummary(value: unknown): value is AccountAiUsageSummary {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const summary = value as Partial<AccountAiUsageSummary>;
  const usage = summary.deepAnalysis;
  const capabilities = summary.capabilities;
  return SHIPSEAL_PLANS.includes(summary.plan as ShipSealPlan)
    && ENTITLEMENT_STATUSES.includes(summary.entitlementStatus as EntitlementStatus)
    && Boolean(capabilities)
    && typeof capabilities?.repositoryFutures === 'boolean'
    && typeof capabilities?.executableFuturePlan === 'boolean'
    && Boolean(usage)
    && [usage?.limit, usage?.used, usage?.reserved, usage?.remaining].every(item => Number.isInteger(item) && Number(item) >= 0)
    && isIsoDate(usage?.periodStart)
    && isIsoDate(usage?.periodEnd);
}

function isIsoDate(value: unknown) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}
