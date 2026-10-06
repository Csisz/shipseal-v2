import { useEffect, useState } from 'react';
import { Nav } from '@/components/agentready/Nav';
import { SurfaceState } from '@/components/agentready/SurfaceState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Overview = Record<string, number | string | null>;
type AttentionItem = {
  publicOperationId: string;
  supportReference: string | null;
  operationState: string;
  classification: string;
  reason: string;
  userUnitState: string;
  updatedAt: string | null;
};
type TimelineItem = { at: string | null; kind: string; label: string; detail: string | null };
type OperationDiagnostic = {
  publicOperationId: string;
  supportReference: string | null;
  operationKind: string;
  operationState: string;
  diagnosticState: string;
  summary: string;
  failureCategory: string | null;
  userUnitState: string;
  resultExists: boolean;
  canRetry: boolean;
  recoveryAction: string;
  leaseExpiresAt: string | null;
  updatedAt: string | null;
  reconciliationOutcome: string;
  staleRelease: {
    eligible: boolean;
    classification: 'superseded' | 'orphaned' | null;
    reason: string;
    alreadyReleased?: boolean;
  };
  timeline: TimelineItem[];
};
type SafeEvent = { category?: unknown; action?: unknown; status?: unknown; created_at?: unknown; deployment_id?: unknown };
type FeedbackRow = { id: string; surface: string; use_case: string; outcome: string; use_again: string; pricing_intent: string | null; comment: string | null; contact_allowed: boolean; created_at: string };
type FeedbackDistribution = { dimension: 'outcome' | 'use_again' | 'pricing_intent'; value: string; count: number };
type AdminPayload = { overview: Overview; needsAttention: AttentionItem[]; recentEvents: SafeEvent[]; operation: OperationDiagnostic | null; feedback?: { recent: FeedbackRow[]; distribution: FeedbackDistribution[] } };

export default function Admin() {
  const [data, setData] = useState<AdminPayload | null>(null);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [feedbackOutcome, setFeedbackOutcome] = useState('all');
  const [feedbackUseCase, setFeedbackUseCase] = useState('all');
  const [feedbackPricing, setFeedbackPricing] = useState('all');
  useEffect(() => { void load(); }, []);
  async function load(search = '') {
    try {
      const response = await fetch(`/api/admin${search ? `?q=${encodeURIComponent(search)}` : ''}`, { credentials: 'include' });
      if (!response.ok) throw new Error('unavailable');
      setData(await response.json() as AdminPayload);
      setError(false);
    } catch { setError(true); }
  }
  async function releaseReservation(publicOperationId: string) {
    setActionMessage('Re-checking release safeguards...');
    const response = await fetch('/api/admin?action=release-stale-reservation', {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicOperationId }),
    });
    const payload = await response.json() as { status?: string; error?: { message?: string } };
    if (!response.ok) {
      setActionMessage(payload.error?.message || 'The stale reservation could not be released safely.');
      return;
    }
    setActionMessage(payload.status === 'already_released' ? 'Reservation was already released.' : 'Stale reservation released once and recorded in the audit timeline.');
    await load(query);
  }
  if (error) return <><Nav /><main className="container max-w-5xl py-28"><SurfaceState tone="error" title="Operations surface unavailable" description="This internal surface is restricted or temporarily unavailable." /></main></>;
  if (!data) return <><Nav /><main className="container max-w-5xl py-28"><SurfaceState tone="loading" title="Loading operations" description="Reading safe operational aggregates." /></main></>;

  const metric = (key: string) => Number(data.overview[key] ?? 0);
  const providerLimitState = data.overview.provider_limit_state;
  const providerBudget = providerLimitState === 'configured'
    ? `${metric('provider_calls_today')} / ${metric('provider_call_limit')}`
    : providerLimitState === 'invalid' ? 'Invalid configuration' : 'Not configured';
  const metrics = [
    ['Scans · 24h', metric('scans_24h')],
    ['Successful scans', metric('scans_succeeded_24h')],
    ['AI completed · 24h', metric('ai_completed_24h')],
    ['AI actively leased', metric('ai_in_progress')],
    ['Provider calls today', providerBudget],
    ['GitHub failures', metric('github_failures_24h')],
    ['Stripe events · 24h', metric('stripe_events_24h')],
  ];
  const feedback = data.feedback || { recent: [], distribution: [] };
  const filteredFeedback = feedback.recent.filter(item => (feedbackOutcome === 'all' || item.outcome === feedbackOutcome)
    && (feedbackUseCase === 'all' || item.use_case === feedbackUseCase)
    && (feedbackPricing === 'all' || (feedbackPricing === 'none' ? !item.pricing_intent : item.pricing_intent === feedbackPricing)));
  const distribution = (dimension: FeedbackDistribution['dimension']) => ['yes', 'partly', 'maybe', 'no'].map(value => {
    const match = feedback.distribution.find(item => item.dimension === dimension && item.value === value);
    return match ? `${humanize(value)} ${Number(match.count).toLocaleString()}` : null;
  }).filter(Boolean).join(' · ') || 'No responses yet';

  return <div className="min-h-screen bg-background"><Nav /><main className="container max-w-7xl pb-20 pt-28">
    <div className="text-xs font-mono uppercase tracking-wider text-primary">Internal operations</div>
    <h1 className="mt-2 font-display text-3xl font-semibold">ShipSeal Operations</h1>
    <p className="mt-2 text-sm text-muted-foreground">Safe aggregates and timelines. Repository contents and provider payloads are never shown here.</p>

    <section aria-label="Operations overview" className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map(([label, value]) => <Card key={label} className="bg-card/60"><CardHeader className="p-4 pb-2"><CardDescription>{label}</CardDescription></CardHeader><CardContent className="p-4 pt-0"><div className="font-display text-2xl font-semibold">{value}</div></CardContent></Card>)}
    </section>

    <Card className="mt-8 bg-card/50">
      <CardHeader><CardTitle className="font-display text-xl">Needs attention</CardTitle><CardDescription>Only unresolved operations requiring operator action appear here. Resolved failures remain in history.</CardDescription></CardHeader>
      <CardContent>{data.needsAttention.length ? <Table><TableHeader><TableRow><TableHead>Reference</TableHead><TableHead>Status</TableHead><TableHead>Reason</TableHead><TableHead>Billing</TableHead><TableHead>Updated</TableHead></TableRow></TableHeader><TableBody>{data.needsAttention.map(item => <TableRow key={item.publicOperationId}><TableCell className="font-mono text-xs">{item.supportReference}</TableCell><TableCell><Badge variant="outline">{humanize(item.classification)}</Badge></TableCell><TableCell>{item.reason}</TableCell><TableCell>{humanize(item.userUnitState)}</TableCell><TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(item.updatedAt)}</TableCell></TableRow>)}</TableBody></Table> : <p className="text-sm text-muted-foreground">No operations currently require operator action.</p>}</CardContent>
    </Card>

    <Card className="mt-8 bg-card/50">
      <CardHeader><CardTitle className="font-display text-xl">Operation lookup</CardTitle><CardDescription>Search an RI reference, exact public operation ID, or internal operation ID.</CardDescription></CardHeader>
      <CardContent>
        <form className="flex flex-col gap-2 sm:flex-row" onSubmit={event => { event.preventDefault(); setSearched(true); void load(query); }}>
          <Input aria-label="Support reference" className="sm:max-w-sm" value={query} onChange={event => setQuery(event.target.value)} placeholder="RI-… or op_…" />
          <Button type="submit">Search</Button>
        </form>
        {searched && (data.operation ? <OperationResult operation={data.operation} actionMessage={actionMessage} onRelease={releaseReservation} /> : <p className="mt-4 text-sm text-muted-foreground">No matching operation.</p>)}
      </CardContent>
    </Card>

    <Card className="mt-8 bg-card/50">
      <CardHeader><CardTitle className="font-display text-xl">Early Access feedback</CardTitle><CardDescription>Are people getting enough value to use ShipSeal again and eventually pay for it? Partial and negative responses are shown first.</CardDescription></CardHeader>
      <CardContent>
        <dl className="grid gap-3 md:grid-cols-3">
          <FeedbackSummary label="Did it help?" value={distribution('outcome')} />
          <FeedbackSummary label="Would use again?" value={distribution('use_again')} />
          <FeedbackSummary label="$19 / 10 analyses?" value={distribution('pricing_intent')} />
        </dl>
        <div className="mt-5 grid gap-2 sm:grid-cols-3" aria-label="Feedback filters">
          <AdminFilter label="Outcome" value={feedbackOutcome} onChange={setFeedbackOutcome} options={['all', 'yes', 'partly', 'no']} />
          <AdminFilter label="Use case" value={feedbackUseCase} onChange={setFeedbackUseCase} options={['all', 'understand_repository', 'find_improvements', 'plan_future', 'prepare_agent_work', 'prepare_delivery', 'other']} />
          <AdminFilter label="Pricing intent" value={feedbackPricing} onChange={setFeedbackPricing} options={['all', 'yes', 'maybe', 'no', 'none']} />
        </div>
        {filteredFeedback.length ? <div className="mt-5 overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Outcome</TableHead><TableHead>Use again</TableHead><TableHead>Pricing</TableHead><TableHead>Use case / surface</TableHead><TableHead>Comment</TableHead><TableHead>Time</TableHead></TableRow></TableHeader><TableBody>{filteredFeedback.map(item => <TableRow key={item.id}><TableCell><Badge variant={item.outcome === 'no' ? 'destructive' : 'outline'}>{humanize(item.outcome)}</Badge></TableCell><TableCell>{humanize(item.use_again)}</TableCell><TableCell>{item.pricing_intent ? humanize(item.pricing_intent) : 'Not asked'}</TableCell><TableCell><div>{humanize(item.use_case)}</div><div className="text-xs text-muted-foreground">{humanize(item.surface)}</div></TableCell><TableCell className="min-w-64 whitespace-pre-wrap break-words">{item.comment || '—'}</TableCell><TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(item.created_at)}</TableCell></TableRow>)}</TableBody></Table></div> : <p className="mt-5 text-sm text-muted-foreground">No feedback matches these filters.</p>}
      </CardContent>
    </Card>

    <Card className="mt-8 bg-card/50">
      <CardHeader><CardTitle className="font-display text-xl">Recent safe events</CardTitle><CardDescription>Operational and Stripe event metadata only; no source, prompt, provider, or webhook payloads.</CardDescription></CardHeader>
      <CardContent><Table><TableHeader><TableRow><TableHead>Area</TableHead><TableHead>Action</TableHead><TableHead>Status</TableHead><TableHead>Deployment</TableHead><TableHead>Time</TableHead></TableRow></TableHeader><TableBody>{data.recentEvents.slice(0, 12).map((event, index) => <TableRow key={index}><TableCell>{String(event.category || 'system')}</TableCell><TableCell>{String(event.action || 'event')}</TableCell><TableCell>{String(event.status || 'unknown')}</TableCell><TableCell className="font-mono text-xs text-muted-foreground">{event.deployment_id ? String(event.deployment_id).slice(0, 12) : 'Unavailable'}</TableCell><TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(event.created_at)}</TableCell></TableRow>)}</TableBody></Table></CardContent>
    </Card>
  </main></div>;
}

function FeedbackSummary({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-border/60 bg-background/25 p-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-sm font-medium">{value}</dd></div>;
}

function AdminFilter({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return <label className="grid gap-1 text-xs text-muted-foreground">{label}<Select value={value} onValueChange={onChange}><SelectTrigger aria-label={label}><SelectValue /></SelectTrigger><SelectContent><SelectGroup>{options.map(option => <SelectItem key={option} value={option}>{option === 'all' ? 'All' : option === 'none' ? 'Not asked' : humanize(option)}</SelectItem>)}</SelectGroup></SelectContent></Select></label>;
}

function OperationResult({ operation, actionMessage, onRelease }: { operation: OperationDiagnostic; actionMessage: string; onRelease: (publicOperationId: string) => Promise<void> }) {
  const [confirmRelease, setConfirmRelease] = useState(false);
  const facts = [
    ['What happened?', operation.summary],
    ['Where did it fail?', operation.failureCategory ? humanize(operation.failureCategory) : 'No recorded failure'],
    ["Was the user's unit consumed?", humanize(operation.userUnitState)],
    ['Can it be retried?', operation.canRetry ? `Yes · ${operation.recoveryAction}` : operation.recoveryAction],
    ['Does a result exist?', operation.resultExists ? 'Yes · durable result saved' : 'No'],
  ];
  return <section aria-label="Operation diagnosis" className="mt-6 flex flex-col gap-5">
    <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-sm">{operation.supportReference}</span><Badge variant={operation.diagnosticState === 'needs_recovery' ? 'destructive' : 'secondary'}>{humanize(operation.diagnosticState)}</Badge><span className="text-xs text-muted-foreground">{humanize(operation.operationKind)} · {humanize(operation.operationState)}</span></div>
    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{facts.map(([label, value]) => <div key={label} className="rounded-lg border border-border/60 p-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-sm font-medium">{value}</dd></div>)}</dl>
    {operation.staleRelease.eligible && <section aria-label="Stale reservation resolution" className="flex flex-col gap-3 rounded-xl border border-border/60 p-4">
      <div><h3 className="text-sm font-semibold">Release unreachable reservation</h3><p className="mt-1 text-xs text-muted-foreground">{operation.staleRelease.reason} This only releases the held unit; it cannot create a result or edit consumed usage.</p></div>
      {confirmRelease ? <div className="flex flex-wrap items-center gap-2"><Button variant="destructive" onClick={() => { setConfirmRelease(false); void onRelease(operation.publicOperationId); }}>Confirm release</Button><Button variant="outline" onClick={() => setConfirmRelease(false)}>Cancel</Button></div> : <Button className="self-start" variant="outline" onClick={() => setConfirmRelease(true)}>Release stale reservation</Button>}
    </section>}
    {actionMessage && <p role="status" className="text-sm text-muted-foreground">{actionMessage}</p>}
    <div><h3 className="text-sm font-semibold">Safe timeline</h3>{operation.timeline.length ? <Table><TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Type</TableHead><TableHead>Event</TableHead><TableHead>Detail</TableHead></TableRow></TableHeader><TableBody>{operation.timeline.map((item, index) => <TableRow key={`${item.at}-${index}`}><TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(item.at)}</TableCell><TableCell>{humanize(item.kind)}</TableCell><TableCell>{humanize(item.label)}</TableCell><TableCell>{item.detail ? humanize(item.detail) : '—'}</TableCell></TableRow>)}</TableBody></Table> : <p className="mt-2 text-sm text-muted-foreground">No stage or operational events were recorded for this historical operation.</p>}</div>
  </section>;
}

function humanize(value: string) { return value.replace(/_/g, ' ').replace(/·/g, ' · '); }
function formatDate(value: unknown) {
  if (!value) return 'Unavailable';
  const date = new Date(String(value));
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : 'Unavailable';
}
