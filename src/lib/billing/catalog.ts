export const PUBLIC_BILLING_CATALOG = {
  free: {
    id: 'free',
    name: 'Free',
    monthlyAmountCents: 0,
    currency: 'USD',
    deepAnalysisLimit: 0,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    monthlyAmountCents: 1_900,
    currency: 'USD',
    deepAnalysisLimit: 10,
  },
} as const;

export type PublicBillingPlan = keyof typeof PUBLIC_BILLING_CATALOG;

export function formatMonthlyPlanPrice(plan: PublicBillingPlan) {
  const product = PUBLIC_BILLING_CATALOG[plan];
  if (product.monthlyAmountCents === 0) return '$0';
  return `${new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: product.currency,
    maximumFractionDigits: 0,
  }).format(product.monthlyAmountCents / 100)}/month`;
}
