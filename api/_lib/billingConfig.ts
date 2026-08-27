import { PUBLIC_BILLING_CATALOG } from '../../src/lib/billing/catalog.js';

export interface ShipSealBillingConfig {
  appOrigin: string;
  stripeSecretKey: string;
  stripeWebhookSecret: string;
  proPriceId: string;
  proDeepAnalysisLimit: number;
}

export class BillingConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BillingConfigurationError';
  }
}

export function resolveBillingConfig(env: NodeJS.ProcessEnv = process.env): ShipSealBillingConfig {
  const appOrigin = trustedAppOrigin(env.SHIPSEAL_APP_ORIGIN);
  const stripeSecretKey = required(env.STRIPE_SECRET_KEY, 'STRIPE_SECRET_KEY');
  const stripeWebhookSecret = required(env.STRIPE_WEBHOOK_SECRET, 'STRIPE_WEBHOOK_SECRET');
  const proPriceId = required(env.SHIPSEAL_STRIPE_PRO_PRICE_ID, 'SHIPSEAL_STRIPE_PRO_PRICE_ID');
  if (!/^(?:sk|rk)_(?:test|live)_/.test(stripeSecretKey)) throw new BillingConfigurationError('STRIPE_SECRET_KEY is invalid.');
  if (!stripeWebhookSecret.startsWith('whsec_')) throw new BillingConfigurationError('STRIPE_WEBHOOK_SECRET is invalid.');
  if (!proPriceId.startsWith('price_')) throw new BillingConfigurationError('SHIPSEAL_STRIPE_PRO_PRICE_ID is invalid.');
  return {
    appOrigin,
    stripeSecretKey,
    stripeWebhookSecret,
    proPriceId,
    proDeepAnalysisLimit: boundedAllowance(env.SHIPSEAL_PRO_DEEP_ANALYSIS_LIMIT),
  };
}

function required(value: string | undefined, name: string) {
  const normalized = (value || '').trim();
  if (!normalized) throw new BillingConfigurationError(`${name} is not configured.`);
  return normalized;
}

function trustedAppOrigin(value: string | undefined) {
  const normalized = required(value, 'SHIPSEAL_APP_ORIGIN');
  let parsed: URL;
  try { parsed = new URL(normalized); } catch { throw new BillingConfigurationError('SHIPSEAL_APP_ORIGIN is invalid.'); }
  const localHttp = parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname);
  if (parsed.protocol !== 'https:' && !localHttp) throw new BillingConfigurationError('SHIPSEAL_APP_ORIGIN must use HTTPS.');
  if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') {
    throw new BillingConfigurationError('SHIPSEAL_APP_ORIGIN must be an origin without credentials, path, query, or hash.');
  }
  return parsed.origin;
}

function boundedAllowance(value: string | undefined) {
  if (!value?.trim()) return PUBLIC_BILLING_CATALOG.pro.deepAnalysisLimit;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 10_000) {
    throw new BillingConfigurationError('SHIPSEAL_PRO_DEEP_ANALYSIS_LIMIT is invalid.');
  }
  return parsed;
}
