import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clipboard,
  Code2,
  Download,
  FileCode2,
  FolderTree,
  GitBranch,
  ListChecks,
  Network,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  executableFuturePlanMarkdownFilename,
  renderClaudeCodeFuturePlanPrompt,
  renderCodexFuturePlanPrompt,
  renderExecutableFuturePlanMarkdown,
  type ExecutableFuturePlan,
  type ExecutableFuturePlanArea,
} from '@/lib/workspace';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type PlanReviewPhase = 'draft' | 'review' | 'ready';
type AgentTarget = 'codex' | 'claude-code';

export function ExecutableFuturePlanEntry({
  plan,
  onOpen,
}: {
  plan?: ExecutableFuturePlan;
  onOpen: () => void;
}) {
  return (
    <section
      aria-label="Executable Future Plan entry"
      data-testid="executable-future-plan-entry"
      className="relative mt-4 overflow-hidden rounded-[1.4rem] border border-border/55 bg-[linear-gradient(115deg,hsl(var(--card)/0.94),hsl(var(--primary)/0.055))] p-4 shadow-[0_18px_65px_hsl(var(--background)/0.16)] md:p-5"
    >
      <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_80%_50%,hsl(var(--primary)/0.10),transparent_62%)]" aria-hidden="true" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-primary">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Possibility converges into execution
          </div>
          <h2 className="mt-2 font-display text-xl font-semibold text-foreground">
            {plan ? 'Your selected Future can become one implementation plan.' : 'Choose one Primary Future to create an implementation plan.'}
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {plan
              ? `${plan.primaryFuture.title}${plan.supportingFutures.length ? ` + ${plan.supportingFutures.length} supporting ${plan.supportingFutures.length === 1 ? 'Future' : 'Futures'}` : ''} · ${plan.requiredCapabilities.length} automatic ${plan.requiredCapabilities.length === 1 ? 'capability' : 'capabilities'} · no additional AI request`
              : 'Select a Primary in the neural field. Optional Supports and required dependencies will converge into the same deterministic plan.'}
          </p>
        </div>
        <Button
          type="button"
          size="lg"
          disabled={!plan}
          onClick={onOpen}
          className="group min-h-12 shrink-0 rounded-xl px-5"
        >
          Build this future
          <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
        </Button>
      </div>
    </section>
  );
}

export default function ExecutableFuturePlanView({ plan, onBack }: { plan: ExecutableFuturePlan; onBack: () => void }) {
  const [phase, setPhase] = useState<PlanReviewPhase>('draft');
  const [acknowledgedGateIds, setAcknowledgedGateIds] = useState<Set<string>>(new Set());
  const [activeTarget, setActiveTarget] = useState<AgentTarget>();
  const [copyStatus, setCopyStatus] = useState('');
  const allGatesAcknowledged = plan.reviewGates.every(gate => acknowledgedGateIds.has(gate.id));
  const prompt = useMemo(() => activeTarget === 'codex'
    ? renderCodexFuturePlanPrompt(plan)
    : activeTarget === 'claude-code'
      ? renderClaudeCodeFuturePlanPrompt(plan)
      : '', [activeTarget, plan]);

  useEffect(() => {
    setPhase('draft');
    setAcknowledgedGateIds(new Set());
    setActiveTarget(undefined);
    setCopyStatus('');
  }, [plan.fingerprint]);

  const toggleGate = (gateId: string, checked: boolean) => {
    setAcknowledgedGateIds(current => {
      const next = new Set(current);
      if (checked) next.add(gateId);
      else next.delete(gateId);
      return next;
    });
  };

  const copyAgentPrompt = async () => {
    if (!prompt || !navigator.clipboard?.writeText) {
      setCopyStatus('Clipboard access is unavailable. Select the prompt text to copy it manually.');
      return;
    }
    await navigator.clipboard.writeText(prompt);
    setCopyStatus(`${activeTarget === 'codex' ? 'Codex' : 'Claude Code'} prompt copied.`);
  };

  const downloadPlan = () => {
    const blob = new Blob([renderExecutableFuturePlanMarkdown(plan)], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = executableFuturePlanMarkdownFilename(plan);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <section
      aria-label="Executable Future Plan"
      data-testid="executable-future-plan"
      data-plan-fingerprint={plan.fingerprint}
      data-review-phase={phase}
      className="future-plan-shell relative min-h-[72vh] overflow-hidden rounded-[1.75rem] border border-border/55 bg-card/75 text-foreground shadow-[0_24px_90px_hsl(var(--background)/0.2)] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-300 motion-reduce:animate-none"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(ellipse_at_18%_0%,hsl(var(--primary)/0.12),transparent_60%)]" aria-hidden="true" />
      <header className="relative border-b border-border/45 px-4 py-5 sm:px-6 md:px-8 md:py-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button type="button" variant="ghost" size="sm" className="-ml-2 min-h-11" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
            Back to Futures
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-primary/25 bg-primary/5">{phaseLabel(phase, plan.humanReviewRequired)}</Badge>
            <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">{plan.fingerprint.slice(0, 12)}</span>
          </div>
        </div>

        <div className="mt-7 max-w-4xl">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">Executable Future Plan</p>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">A concrete mission for {plan.repository.name}</h1>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted-foreground md:text-lg">{plan.objective}</p>
        </div>

        <div className="mt-7 grid gap-3 border-t border-border/35 pt-5 sm:grid-cols-3" aria-label="Future Plan selection">
          <PlanSelectionItem label="Primary" value={plan.primaryFuture.title} icon={<Sparkles className="h-4 w-4" />} />
          <PlanSelectionItem label="Supporting" value={plan.supportingFutures.length ? plan.supportingFutures.map(goal => goal.title).join(' · ') : 'None selected'} icon={<GitBranch className="h-4 w-4" />} />
          <PlanSelectionItem label="Required capabilities" value={`${plan.requiredCapabilities.length} ordered prerequisite${plan.requiredCapabilities.length === 1 ? '' : 's'}`} icon={<Network className="h-4 w-4" />} />
        </div>
      </header>

      <div className="relative mx-auto grid max-w-[1180px] gap-10 px-4 py-7 sm:px-6 md:px-8 md:py-10 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-12">
        <main className="min-w-0 space-y-12">
          <section aria-labelledby="implementation-plan-heading">
            <SectionHeading eyebrow="Implementation sequence" title="From foundation to verification" description="Dependencies come first. Each later stage inherits the repository scope and evidence established before it." />
            <ol id="implementation-plan-heading" className="mt-6 space-y-3">
              {plan.implementationStages.map(stage => (
                <li key={stage.id} data-plan-stage-kind={stage.kind}>
                  <details className="group overflow-hidden rounded-2xl border border-border/50 bg-background/30 open:border-primary/25 open:bg-background/55">
                    <summary className="flex min-h-[5.5rem] cursor-pointer list-none items-start gap-4 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:p-5">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-primary/25 bg-primary/[0.055] font-mono text-sm text-primary">{String(stage.order).padStart(2, '0')}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-display text-lg font-semibold sm:text-xl">{stage.title}</span>
                        <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{stage.purpose}</span>
                      </span>
                      <ArrowRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-90 motion-reduce:transition-none" aria-hidden="true" />
                    </summary>
                    <div className="grid gap-6 border-t border-border/35 px-4 py-5 sm:px-5 md:grid-cols-2">
                      <PlanDetail title="Why now" items={[stage.whyNow]} />
                      <PlanDetail title="What changes" items={stage.changes} />
                      <PlanAreas areas={stage.repositoryAreaIds.flatMap(id => plan.affectedRepositoryAreas.find(area => area.id === id) || [])} />
                      <PlanDetail title="Completion criteria" items={stage.completionCriteria} checked />
                      {stage.evidenceIds.length > 0 && <div className="md:col-span-2"><EvidenceChips evidenceIds={stage.evidenceIds} plan={plan} /></div>}
                    </div>
                  </details>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="affected-areas-heading">
            <SectionHeading eyebrow="Repository grounding" title="Likely affected areas" description="Existing paths are shown only when they were present in validated scan evidence. Conceptual work remains path-free." />
            <div id="affected-areas-heading" className="mt-5 grid gap-3 sm:grid-cols-2">
              {plan.affectedRepositoryAreas.map(area => <AreaCard key={area.id} area={area} />)}
            </div>
          </section>

          <section aria-labelledby="review-gates-heading" className={`rounded-2xl border p-5 sm:p-6 ${plan.reviewGates.length ? 'border-warning/25 bg-warning/[0.035]' : 'border-border/45 bg-background/25'}`}>
            <SectionHeading
              eyebrow="Human control"
              title={plan.reviewGates.length ? `${plan.reviewGates.length} review ${plan.reviewGates.length === 1 ? 'gate' : 'gates'}` : 'No explicit review gate'}
              description={plan.reviewGates.length ? 'These are stop points, not automated approvals. A qualified person must decide whether work may continue.' : 'The selected intelligence does not mark a sensitive review boundary. The plan still requires ordinary code review.'}
            />
            <div id="review-gates-heading" className="mt-5 space-y-3">
              {plan.reviewGates.map(gate => (
                <article key={gate.id} className="rounded-xl border border-warning/20 bg-background/45 p-4">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
                    <div><h3 className="font-semibold">{gate.title}</h3><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{gate.reason}</p><p className="mt-2 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">Evidence · {gate.evidenceIds.length}</p></div>
                  </div>
                </article>
              ))}
              {!plan.reviewGates.length && <p className="text-sm text-muted-foreground">No gate was added beyond repository code review and the verification sequence.</p>}
            </div>
          </section>

          <section aria-labelledby="verification-heading">
            <SectionHeading eyebrow="Completion contract" title="Verification" description={plan.verificationPlan.completionStatement} />
            <div id="verification-heading" className="mt-5 divide-y divide-border/35 rounded-2xl border border-border/50 bg-background/30">
              {plan.verificationPlan.checks.map(check => (
                <article key={check.id} className="flex gap-3 p-4 sm:p-5">
                  <ListChecks className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                  <div className="min-w-0"><h3 className="font-semibold">{check.title}</h3><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{check.rationale}</p>{check.command && <code className="mt-2 inline-block max-w-full break-words rounded-md border border-border/45 bg-muted/45 px-2 py-1 font-mono text-xs">{check.command}</code>}</div>
                </article>
              ))}
            </div>
          </section>

          <section aria-labelledby="risks-heading">
            <SectionHeading eyebrow="Bounded claims" title="Risks & assumptions" description="Only limitations represented by the selected graph, scan, or validated Product Intelligence are included." />
            <ul id="risks-heading" className="mt-5 space-y-2 text-sm text-muted-foreground">
              {plan.risks.map(risk => <li key={risk.id} className="flex gap-3 rounded-xl border border-border/40 bg-background/25 p-3"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" aria-hidden="true" /><span>{risk.statement}</span></li>)}
              {!plan.risks.length && <li className="rounded-xl border border-border/40 bg-background/25 p-3">No additional grounded risk is represented by this selection.</li>}
            </ul>
          </section>

          <AgentHandoff plan={plan} phase={phase} onOpenTarget={setActiveTarget} />
        </main>

        <aside className="self-start lg:sticky lg:top-20" aria-label="Future Plan review state">
          <div className="rounded-2xl border border-border/50 bg-background/45 p-4 shadow-sm">
            <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-muted-foreground">Review before execution</p>
            <ol className="mt-4 space-y-3" aria-label="Future Plan review progression">
              <ReviewStep label="Draft Future Plan" active={phase === 'draft'} complete={phase !== 'draft'} />
              <ReviewStep label={plan.humanReviewRequired ? 'Review required' : 'Review'} active={phase === 'review'} complete={phase === 'ready'} />
              <ReviewStep label="Ready for agent" active={phase === 'ready'} complete={false} />
            </ol>

            {phase === 'draft' && <Button type="button" className="mt-5 min-h-11 w-full" onClick={() => setPhase('review')}>Review plan</Button>}
            {phase === 'review' && (
              <div className="mt-5 space-y-3">
                {plan.reviewGates.map(gate => (
                  <label key={gate.id} className="flex cursor-pointer items-start gap-2 rounded-lg border border-border/45 p-3 text-xs leading-relaxed">
                    <Checkbox checked={acknowledgedGateIds.has(gate.id)} onCheckedChange={value => toggleGate(gate.id, value === true)} aria-label={`Acknowledge ${gate.title}`} />
                    <span><span className="font-medium text-foreground">Reviewer identified</span><span className="mt-0.5 block text-muted-foreground">{gate.title} remains a stop point in the handoff.</span></span>
                  </label>
                ))}
                <Button type="button" className="min-h-11 w-full" disabled={!allGatesAcknowledged} onClick={() => setPhase('ready')}>Mark ready for agent</Button>
                {plan.reviewGates.length > 0 && !allGatesAcknowledged && <p className="text-xs text-muted-foreground">Identify a reviewer for each gate before preparing the handoff. This does not approve the gate itself.</p>}
              </div>
            )}
            {phase === 'ready' && <div className="mt-5 rounded-xl border border-primary/25 bg-primary/5 p-3 text-sm"><div className="flex items-center gap-2 font-medium"><CheckCircle2 className="h-4 w-4 text-primary" />Handoff ready</div><p className="mt-1 text-xs leading-relaxed text-muted-foreground">The agent prompt still instructs the implementer to stop at human-review gates.</p></div>}

            <Button type="button" variant="outline" className="mt-3 min-h-11 w-full" onClick={downloadPlan}>
              <Download className="mr-2 h-4 w-4" aria-hidden="true" />
              Download plan
            </Button>
            <p className="mt-3 text-center text-[10px] leading-relaxed text-muted-foreground">Markdown · deterministic · no provider request · no repository mutation</p>
          </div>
        </aside>
      </div>

      <Dialog open={Boolean(activeTarget)} onOpenChange={open => { if (!open) { setActiveTarget(undefined); setCopyStatus(''); } }}>
        <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-3xl rounded-2xl bg-background p-0 shadow-[var(--shadow-lg-semantic)] motion-reduce:animate-none sm:w-[calc(100%-2rem)]">
          <DialogHeader className="border-b border-border/45 px-5 pb-4 pt-5 pr-12 text-left sm:px-6 sm:pt-6">
            <DialogTitle>{activeTarget === 'codex' ? 'Codex' : 'Claude Code'} handoff</DialogTitle>
            <DialogDescription>Copy this reviewed, repository-grounded prompt into the agent. ShipSeal does not execute it.</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 px-4 pb-5 sm:px-6 sm:pb-6">
            <pre data-testid="agent-prompt-preview" className="max-h-[56dvh] overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-border/50 bg-muted/25 p-4 font-mono text-xs leading-relaxed text-foreground">{prompt}</pre>
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p role="status" aria-live="polite" className="min-h-5 text-xs text-muted-foreground">{copyStatus}</p>
              <Button type="button" className="min-h-11" onClick={copyAgentPrompt}><Clipboard className="mr-2 h-4 w-4" />Copy for {activeTarget === 'codex' ? 'Codex' : 'Claude Code'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function PlanSelectionItem({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return <div className="flex min-w-0 items-start gap-3"><span className="mt-0.5 text-primary">{icon}</span><div className="min-w-0"><div className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div><div className="mt-1 text-sm font-medium leading-snug">{value}</div></div></div>;
}

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div><p className="font-mono text-[9px] uppercase tracking-[0.16em] text-primary">{eyebrow}</p><h2 className="mt-2 font-display text-2xl font-semibold sm:text-3xl">{title}</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p></div>;
}

function PlanDetail({ title, items, checked = false }: { title: string; items: string[]; checked?: boolean }) {
  return <section><h3 className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">{title}</h3><ul className="mt-2 space-y-2 text-sm leading-relaxed">{items.map((item, index) => <li key={`${index}:${item}`} className="flex gap-2">{checked ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> : <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />}<span>{item}</span></li>)}</ul></section>;
}

function PlanAreas({ areas }: { areas: ExecutableFuturePlanArea[] }) {
  return <section><h3 className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Repository areas</h3>{areas.length ? <ul className="mt-2 space-y-2">{areas.map(area => <li key={area.id} className="text-sm"><span className="font-medium">{area.kind === 'existing-repository-area' ? 'Existing' : 'Likely new'}</span><span className="ml-2 break-words text-muted-foreground">{area.path || area.label}</span></li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">No additional repository area is asserted for this stage.</p>}</section>;
}

function EvidenceChips({ evidenceIds, plan }: { evidenceIds: string[]; plan: ExecutableFuturePlan }) {
  return <div><h3 className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Why ShipSeal thinks this matters</h3><div className="mt-2 flex flex-wrap gap-2">{evidenceIds.map(id => { const evidence = plan.evidence.find(item => item.id === id); return <span key={id} title={id} className="max-w-full truncate rounded-full border border-border/45 bg-background/60 px-2.5 py-1 font-mono text-[10px] text-muted-foreground">{evidence?.path || id}</span>; })}</div></div>;
}

function AreaCard({ area }: { area: ExecutableFuturePlanArea }) {
  return <article className="rounded-xl border border-border/45 bg-background/30 p-4"><div className="flex items-center gap-2 text-primary">{area.kind === 'existing-repository-area' ? <FileCode2 className="h-4 w-4" /> : <FolderTree className="h-4 w-4" />}<span className="font-mono text-[9px] uppercase tracking-[0.13em]">{area.kind === 'existing-repository-area' ? 'Existing repository area' : 'Likely new responsibility'}</span></div><h3 className="mt-2 break-words text-sm font-semibold">{area.path || area.label}</h3>{area.path && area.label !== area.path && <p className="mt-1 text-xs text-muted-foreground">{area.label}</p>}{!area.path && <p className="mt-1 text-xs text-muted-foreground">No validated current path is asserted.</p>}</article>;
}

function ReviewStep({ label, active, complete }: { label: string; active: boolean; complete: boolean }) {
  return <li className="flex items-center gap-3 text-sm"><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border ${complete ? 'border-primary bg-primary text-primary-foreground' : active ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>{complete ? <Check className="h-3.5 w-3.5" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}</span><span className={active || complete ? 'font-medium text-foreground' : 'text-muted-foreground'}>{label}</span></li>;
}

function AgentHandoff({ plan, phase, onOpenTarget }: { plan: ExecutableFuturePlan; phase: PlanReviewPhase; onOpenTarget: (target: AgentTarget) => void }) {
  const disabled = phase !== 'ready';
  return (
    <section aria-labelledby="agent-handoff-heading" data-testid="agent-handoff-section" className="rounded-[1.5rem] border border-primary/20 bg-[linear-gradient(145deg,hsl(var(--primary)/0.075),hsl(var(--background)/0.38))] p-5 sm:p-6">
      <SectionHeading eyebrow="Reviewed handoff" title="Agent handoff" description="Codex and Claude Code receive the same canonical plan with target-specific working guidance. Nothing runs remotely." />
      <div id="agent-handoff-heading" className="mt-5 grid gap-3 sm:grid-cols-2">
        <HandoffCard icon={<Code2 className="h-5 w-5" />} title="Codex" description="Repository-native implementation order, checks, and stop conditions." buttonLabel="Copy for Codex" disabled={disabled} onOpen={() => onOpenTarget('codex')} />
        <HandoffCard icon={<FileCode2 className="h-5 w-5" />} title="Claude Code" description="The same plan context rendered for Claude Code's repository workflow." buttonLabel="Copy for Claude Code" disabled={disabled} onOpen={() => onOpenTarget('claude-code')} />
      </div>
      {disabled && <p className="mt-3 text-xs text-muted-foreground">Review the plan before opening an agent handoff. Human-review gates remain explicit stop conditions.</p>}
      <p className="mt-4 font-mono text-[9px] uppercase tracking-[0.13em] text-muted-foreground">Canonical handoff · {plan.agentHandoffs.version}</p>
    </section>
  );
}

function HandoffCard({ icon, title, description, buttonLabel, disabled, onOpen }: { icon: React.ReactNode; title: string; description: string; buttonLabel: string; disabled: boolean; onOpen: () => void }) {
  return <article className="rounded-xl border border-border/50 bg-background/55 p-4"><div className="text-primary">{icon}</div><h3 className="mt-3 font-display text-lg font-semibold">{title}</h3><p className="mt-1 min-h-10 text-sm leading-relaxed text-muted-foreground">{description}</p><Button type="button" variant="outline" className="mt-4 min-h-11 w-full" disabled={disabled} onClick={onOpen}>{buttonLabel}</Button></article>;
}

function phaseLabel(phase: PlanReviewPhase, humanReviewRequired: boolean) {
  if (phase === 'ready') return 'Ready for agent';
  if (phase === 'review') return humanReviewRequired ? 'Review required' : 'In review';
  return 'Draft Future Plan';
}
