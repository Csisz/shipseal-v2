import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { ManageSubscriptionButton, UpgradeToProButton } from '@/components/billing/BillingActionButton';
import { useOptionalAccount } from './accountContext';

export function AccountUsageCard() {
  const account = useOptionalAccount();
  if (!account.user) return null;
  if (account.usageStatus === 'loading' || account.usageStatus === 'idle') {
    return (
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-lg">AI allowance</CardTitle>
          <CardDescription>Loading your server-authoritative usage summary.</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  if (!account.usage || account.usageStatus === 'unavailable') {
    return (
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-lg">AI allowance unavailable</CardTitle>
          <CardDescription>Your saved projects remain available. Usage information could not be loaded.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" size="sm" variant="outline" onClick={() => void account.refreshUsage()}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  const usage = account.usage;
  const committed = usage.deepAnalysis.used + usage.deepAnalysis.reserved;
  const percentage = usage.deepAnalysis.limit > 0
    ? Math.min(100, Math.round((committed / usage.deepAnalysis.limit) * 100))
    : 0;
  return (
    <Card className="mt-8" data-testid="account-ai-usage">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <CardTitle className="text-lg">{planLabel(usage.plan)} billing</CardTitle>
            <CardDescription>{formatPeriod(usage.deepAnalysis.periodStart, usage.deepAnalysis.periodEnd)}</CardDescription>
          </div>
          <Badge variant="secondary">{planLabel(usage.plan)}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="font-display text-3xl font-semibold">{usage.deepAnalysis.remaining} of {usage.deepAnalysis.limit}</div>
            <div className="text-sm text-muted-foreground">Deep Analyses remaining</div>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <div>{usage.deepAnalysis.used} used · {usage.deepAnalysis.reserved} in progress</div>
            <div>{usage.deepAnalysis.limit} total this period</div>
          </div>
        </div>
        <Progress value={percentage} aria-label={`${committed} of ${usage.deepAnalysis.limit} Deep Analyses committed`} />
        {usage.plan === 'free' && (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-muted-foreground">Repository scanning, deterministic Repository Intelligence, Project Universe and saved projects remain available on Free.</p>
            <UpgradeToProButton size="sm" returnTo="/projects" />
          </div>
        )}
        {usage.plan !== 'free' && usage.deepAnalysis.remaining === 0 && (
          <p className="text-sm text-muted-foreground">Monthly Deep Analysis allowance used. It resets when the next billing period begins on {formatDate(usage.deepAnalysis.periodEnd)}. Existing saved and cached results remain available.</p>
        )}
        {usage.billing?.cancelAtPeriodEnd && ['active', 'trialing'].includes(usage.entitlementStatus) && (
          <p className="text-sm text-muted-foreground">Your subscription is scheduled to cancel. Pro remains active through {formatDate(usage.billing.currentPeriodEnd || usage.deepAnalysis.periodEnd)}.</p>
        )}
        {!['active', 'trialing'].includes(usage.entitlementStatus) && (
          <p className="text-sm text-muted-foreground">{usage.entitlementStatus === 'past_due' ? 'There is a payment issue. Update your payment method to resume new paid AI execution.' : `This entitlement is ${usage.entitlementStatus.replace('_', ' ')}. New Repository Futures analyses cannot start.`}</p>
        )}
        {usage.plan !== 'free' && usage.billing?.customerPortalAvailable && <ManageSubscriptionButton size="sm" variant="outline" returnTo="/projects" />}
      </CardContent>
    </Card>
  );
}

function planLabel(plan: string) {
  return plan === 'internal' ? 'Internal' : `${plan.slice(0, 1).toUpperCase()}${plan.slice(1)}`;
}

function formatPeriod(start: string, end: string) {
  const formatter = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  return `${formatter.format(new Date(start))} – ${formatter.format(new Date(end))}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(value));
}
