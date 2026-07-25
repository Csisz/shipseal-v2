import { ArrowRight, CheckCircle2, FileCode2, FileText, GitBranch, Route, ShieldCheck, Sparkles } from 'lucide-react';

const sourceSignals = [
  { label: 'Source structure', icon: FileCode2 },
  { label: 'Project docs', icon: FileText },
  { label: 'Verification', icon: CheckCircle2 },
];

const workspaceSignals = [
  { label: 'Project memory', icon: Sparkles },
  { label: 'Task routes', icon: Route },
  { label: 'Evidence trail', icon: ShieldCheck },
];

export function RepositoryIntelligencePreview() {
  return (
    <div
      className="relative overflow-hidden rounded-[2rem] border border-primary/25 bg-canvas p-4 shadow-glow md:p-6"
      aria-label="Repository signals become connected workspace knowledge"
      data-testid="landing-signature-visual"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,hsl(var(--primary)/0.2),transparent_35%),radial-gradient(circle_at_82%_72%,hsl(var(--accent)/0.1),transparent_32%)]" />
      <div className="relative flex items-center justify-between gap-3 text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
        <span>Repository intelligence preview</span>
        <span className="inline-flex items-center gap-1.5 text-success">
          <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
          Static evidence
        </span>
      </div>

      <div className="relative mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center">
        <PreviewColumn label="Repository signals" items={sourceSignals} />
        <div className="flex items-center justify-center" aria-hidden="true">
          <span className="h-px w-12 bg-gradient-to-r from-border to-primary/70 md:w-16" />
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-primary/45 bg-primary/10 shadow-glow">
            <GitBranch className="h-4 w-4 text-primary-glow" />
          </span>
          <ArrowRight className="mx-2 h-4 w-4 text-primary-glow motion-safe:animate-pulse" />
          <span className="h-px w-12 bg-gradient-to-r from-primary/70 to-border md:w-16" />
        </div>
        <PreviewColumn label="AI workspace knowledge" items={workspaceSignals} emphasized />
      </div>

      <div className="relative mt-5 grid gap-2 text-xs sm:grid-cols-3">
        <PreviewFact value="Structure" label="mapped" />
        <PreviewFact value="Evidence" label="connected" />
        <PreviewFact value="Next work" label="routed" />
      </div>
    </div>
  );
}

function PreviewColumn({
  label,
  items,
  emphasized = false,
}: {
  label: string;
  items: Array<{ label: string; icon: typeof FileCode2 }>;
  emphasized?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-3 md:p-4 ${emphasized ? 'border-primary/35 bg-primary/10' : 'border-border/55 bg-background/25'}`}>
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-3 space-y-2">
        {items.map(item => (
          <div key={item.label} className="flex items-center gap-2 rounded-xl border border-border/50 bg-background/35 px-3 py-2 text-xs text-foreground/90">
            <item.icon className={`h-3.5 w-3.5 shrink-0 ${emphasized ? 'text-primary-glow' : 'text-muted-foreground'}`} aria-hidden="true" />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PreviewFact({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-border/50 bg-background/25 px-3 py-2">
      <span className="font-semibold text-foreground">{value}</span>
      <span className="ml-1 text-muted-foreground">{label}</span>
    </div>
  );
}
