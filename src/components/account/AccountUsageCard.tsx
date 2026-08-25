import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
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
            <CardTitle className="text-lg">Deep Analysis allowance</CardTitle>
            <CardDescription>{formatPeriod(usage.deepAnalysis.periodStart, usage.deepAnalysis.periodEnd)}</CardDescription>
          </div>
          <Badge variant="secondary">{planLabel(usage.plan)}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="font-display text-3xl font-semibold">{usage.deepAnalysis.remaining}</div>
            <div className="text-sm text-muted-foreground">analyses remaining</div>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <div>{usage.deepAnalysis.used} used · {usage.deepAnalysis.reserved} in progress</div>
            <div>{usage.deepAnalysis.limit} total this period</div>
          </div>
        </div>
        <Progress value={percentage} aria-label={`${committed} of ${usage.deepAnalysis.limit} Deep Analyses committed`} />
        {usage.plan === 'free' && (
          <p className="text-sm text-muted-foreground">Full Repository Futures is a paid AI feature. Checkout is not available yet; deterministic scanning and Project Universe remain available.</p>
        )}
        {usage.plan !== 'free' && usage.deepAnalysis.remaining === 0 && (
          <p className="text-sm text-muted-foreground">Your current Deep Analysis allowance is used. Existing saved and cached results remain available.</p>
        )}
        {!['active', 'trialing'].includes(usage.entitlementStatus) && (
          <p className="text-sm text-muted-foreground">This entitlement is {usage.entitlementStatus.replace('_', ' ')}. New Repository Futures analyses cannot start.</p>
        )}
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
