import { useEffect, useState } from 'react';
import { Nav } from '@/components/agentready/Nav';
import { SurfaceState } from '@/components/agentready/SurfaceState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

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
  timeline: TimelineItem[];
};
type SafeEvent = { category?: unknown; action?: unknown; status?: unknown; created_at?: unknown; deployment_id?: unknown };
type AdminPayload = { overview: Overview; needsAttention: AttentionItem[]; recentEvents: SafeEvent[]; operation: OperationDiagnostic | null };

export default function Admin() {
  const [data, setData] = useState<AdminPayload | null>(null);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState(false);
  useEffect(() => { void load(); }, []);
  async function load(search = '') {
    try {
      const response = await fetch(`/api/admin${search ? `?q=${encodeURIComponent(search)}` : ''}`, { credentials: 'include' });
      if (!response.ok) throw new Error('unavailable');
      setData(await response.json() as AdminPayload);
      setError(false);
    } catch { setError(true); }
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
        {searched && (data.operation ? <OperationResult operation={data.operation} /> : <p className="mt-4 text-sm text-muted-foreground">No matching operation.</p>)}
      </CardContent>
    </Card>

    <Card className="mt-8 bg-card/50">
      <CardHeader><CardTitle className="font-display text-xl">Recent safe events</CardTitle><CardDescription>Operational and Stripe event metadata only; no source, prompt, provider, or webhook payloads.</CardDescription></CardHeader>
      <CardContent><Table><TableHeader><TableRow><TableHead>Area</TableHead><TableHead>Action</TableHead><TableHead>Status</TableHead><TableHead>Deployment</TableHead><TableHead>Time</TableHead></TableRow></TableHeader><TableBody>{data.recentEvents.slice(0, 12).map((event, index) => <TableRow key={index}><TableCell>{String(event.category || 'system')}</TableCell><TableCell>{String(event.action || 'event')}</TableCell><TableCell>{String(event.status || 'unknown')}</TableCell><TableCell className="font-mono text-xs text-muted-foreground">{event.deployment_id ? String(event.deployment_id).slice(0, 12) : 'Unavailable'}</TableCell><TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(event.created_at)}</TableCell></TableRow>)}</TableBody></Table></CardContent>
    </Card>
  </main></div>;
}

function OperationResult({ operation }: { operation: OperationDiagnostic }) {
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
    <div><h3 className="text-sm font-semibold">Safe timeline</h3>{operation.timeline.length ? <Table><TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Type</TableHead><TableHead>Event</TableHead><TableHead>Detail</TableHead></TableRow></TableHeader><TableBody>{operation.timeline.map((item, index) => <TableRow key={`${item.at}-${index}`}><TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(item.at)}</TableCell><TableCell>{humanize(item.kind)}</TableCell><TableCell>{humanize(item.label)}</TableCell><TableCell>{item.detail ? humanize(item.detail) : '—'}</TableCell></TableRow>)}</TableBody></Table> : <p className="mt-2 text-sm text-muted-foreground">No stage or operational events were recorded for this historical operation.</p>}</div>
  </section>;
}

function humanize(value: string) { return value.replace(/_/g, ' ').replace(/·/g, ' · '); }
function formatDate(value: unknown) {
  if (!value) return 'Unavailable';
  const date = new Date(String(value));
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : 'Unavailable';
}
