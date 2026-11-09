import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, Check, Clipboard, Download, FileCode2, FolderTree, ListChecks, Network, ShieldCheck, Sparkles } from 'lucide-react';
import type { AgentOperatingModeId } from '@/lib/types';
import {
  executableFutureAgentLabel,
  executableFuturePlanMarkdownFilename,
  executableFuturePromptMarkdownFilename,
  renderAgentFuturePlanPrompt,
  renderExecutableFuturePlanMarkdown,
  type ExecutableFutureAgentTarget,
  type ExecutableFuturePlan,
  type ExecutableFuturePlanArea,
} from '@/lib/workspace';
import { presentEvidenceReferences } from '@/lib/workspace/evidencePresentation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { buildFuturePlanFastPathSummary } from '../fastPathPresentation';
import { useFeedback } from '@/components/feedback/feedbackContext';

const AGENT_TARGETS: ExecutableFutureAgentTarget[] = ['chatgpt', 'codex', 'claude', 'claude-code', 'cursor', 'generic'];
const AGENT_TARGET_SUMMARIES: Record<ExecutableFutureAgentTarget, string> = {
  chatgpt: 'Self-contained chat handoff',
  codex: 'Repository-aware coding agent',
  claude: 'Self-contained chat handoff',
  'claude-code': 'Repository-aware coding agent',
  cursor: 'Repository-aware editor agent',
  generic: 'Portable, access-neutral handoff',
};
const OPERATING_MODES: Array<{ id: AgentOperatingModeId; label: string; summary: string }> = [
  { id: 'balanced-productivity', label: 'Balanced Productivity', summary: 'Scoped context and proportional verification.' },
  { id: 'token-saver', label: 'Token Saver', summary: 'Narrow context without dropping safety checks.' },
  { id: 'maximum-reliability', label: 'Maximum Reliability', summary: 'Broader inspection and stronger verification.' },
];

export function ExecutableFuturePlanEntry({ plan, selectedTitle, onOpen }: { plan?: ExecutableFuturePlan; selectedTitle?: string; onOpen: () => void }) {
  return (
    <section aria-label="Prepare selected Future for an agent" data-testid="executable-future-plan-entry" className="relative mt-4 overflow-hidden rounded-[1.4rem] border border-border/55 bg-[linear-gradient(115deg,hsl(var(--card)/0.94),hsl(var(--primary)/0.055))] p-4 shadow-[0_18px_65px_hsl(var(--background)/0.16)] md:p-5">
      <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_80%_50%,hsl(var(--primary)/0.10),transparent_62%)]" aria-hidden="true" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-primary">
            <Sparkles className="size-3.5" aria-hidden="true" />
            {plan ? 'Selected path resolved' : selectedTitle ? 'Future selected' : 'Select a Future'}
          </div>
          <h2 className="mt-2 font-display text-xl font-semibold text-foreground">{plan ? plan.primaryFuture.title : selectedTitle || 'Visualize a path before preparing an agent.'}</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {plan
              ? `${plan.implementationStages.length} ordered steps · ${plan.requiredCapabilities.length} automatic prerequisites · prompt preparation does not mutate the repository.`
              : selectedTitle
                ? 'The route is visually active. Preparing resolves prerequisites and creates a deterministic prompt.'
                : 'Click a Future node to pin its evidence-backed route. Hover remains temporary.'}
          </p>
        </div>
        {(plan || selectedTitle) && <Button type="button" size="lg" onClick={onOpen} className="min-h-11 shrink-0 rounded-xl px-4" data-fast-path-action="prepare-for-agent">Prepare for agent</Button>}
      </div>
    </section>
  );
}

export default function ExecutableFuturePlanView({ plan, onBack }: { plan: ExecutableFuturePlan; onBack: () => void }) {
  const { recordOutcome } = useFeedback();
  const [agentTarget, setAgentTarget] = useState<ExecutableFutureAgentTarget>('codex');
  const [operatingMode, setOperatingMode] = useState<AgentOperatingModeId>('balanced-productivity');
  const [copyStatus, setCopyStatus] = useState('');
  const summary = useMemo(() => buildFuturePlanFastPathSummary(plan), [plan]);
  const prompt = useMemo(() => renderAgentFuturePlanPrompt(plan, agentTarget, operatingMode), [agentTarget, operatingMode, plan]);

  useEffect(() => setCopyStatus(''), [agentTarget, operatingMode, plan.fingerprint]);

  const copyPrompt = async () => {
    if (!navigator.clipboard?.writeText) {
      setCopyStatus('Clipboard access is unavailable. Select the prompt text to copy it manually.');
      return;
    }
    await navigator.clipboard.writeText(prompt);
    setCopyStatus(`${executableFutureAgentLabel(agentTarget)} prompt copied.`);
    recordOutcome('agent_handoff_copied', 'agent_handoff', { premiumValue: true, prompt: true });
  };

  const download = (content: string, filename: string) => {
    const url = URL.createObjectURL(new Blob([content], { type: 'text/markdown;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <section aria-label="Agent preparation" data-testid="executable-future-plan" data-plan-fingerprint={plan.fingerprint} data-agent-target={agentTarget} data-operating-mode={operatingMode} className="future-plan-shell relative text-foreground">
      <header className="border-b border-border/45 px-4 pb-5 pt-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button type="button" variant="ghost" size="sm" className="-ml-2 min-h-11" onClick={onBack}><ArrowLeft data-icon="inline-start" aria-hidden="true" />Back to Futures</Button>
          <Badge variant="outline">Deterministic handoff</Badge>
        </div>
        <div className="mt-3 max-w-4xl">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">Prepare for agent</p>
          <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight sm:text-3xl">{plan.primaryFuture.title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{plan.objective}</p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Future Plan summary"><span>{summary.stepCount} steps</span><span>{summary.prerequisiteCount} prerequisites</span><span>{summary.reviewGateCount} human-review gates</span></div>
        </div>
      </header>

      <div className="grid min-h-0 gap-0 lg:grid-cols-[19rem_minmax(0,1fr)]">
        <aside className="border-b border-border/45 p-4 sm:p-5 lg:border-b-0 lg:border-r" aria-label="Agent prompt settings">
          <div className="text-sm font-medium" id="future-agent-label">Agent</div>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">Choose the environment that will receive this canonical plan.</p>
          <ToggleGroup
            type="single"
            value={agentTarget}
            onValueChange={value => { if (value) setAgentTarget(value as ExecutableFutureAgentTarget); }}
            variant="outline"
            className="mt-3 grid grid-cols-2 items-stretch gap-2"
            aria-labelledby="future-agent-label"
            data-testid="future-agent-selector"
          >
            {AGENT_TARGETS.map(target => (
              <ToggleGroupItem key={target} value={target} className="h-auto min-h-16 min-w-0 justify-start px-3 py-2 text-left">
                <span className="min-w-0">
                  <span className="block text-xs font-medium leading-snug">{executableFutureAgentLabel(target)}</span>
                  <span className="mt-0.5 block text-[9px] font-normal leading-snug text-muted-foreground">{AGENT_TARGET_SUMMARIES[target]}</span>
                </span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          <div className="mt-5 text-sm font-medium" id="operating-mode-label">Operating mode</div>
          <ToggleGroup type="single" value={operatingMode} onValueChange={value => { if (value) setOperatingMode(value as AgentOperatingModeId); }} variant="outline" className="mt-2 flex-col items-stretch" aria-labelledby="operating-mode-label">
            {OPERATING_MODES.map(mode => (
              <ToggleGroupItem key={mode.id} value={mode.id} className="h-auto min-h-11 justify-start px-3 py-2 text-left">
                <span><span className="block text-xs font-medium">{mode.label}</span><span className="mt-0.5 block text-[10px] font-normal text-muted-foreground">{mode.summary}</span></span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          {plan.reviewGates.length > 0 && (
            <div className="mt-5 rounded-xl border border-warning/25 bg-warning/[0.055] p-3 text-xs leading-relaxed">
              <div className="flex items-center gap-2 font-medium"><AlertTriangle className="size-4 text-warning" />Human review remains required</div>
              <p className="mt-1 text-muted-foreground">Prompt export is allowed. Execution must stop at {plan.reviewGates.length === 1 ? 'the represented gate' : `all ${plan.reviewGates.length} represented gates`} until a qualified reviewer approves continuation.</p>
            </div>
          )}
        </aside>

        <main className="min-w-0 p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="font-display text-lg font-semibold">Implementation prompt</h2><p className="mt-1 text-xs text-muted-foreground">Same canonical plan, adapted for {executableFutureAgentLabel(agentTarget)} and {OPERATING_MODES.find(mode => mode.id === operatingMode)?.label}.</p></div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={copyPrompt}><Clipboard data-icon="inline-start" aria-hidden="true" />Copy Prompt</Button>
              <Button type="button" variant="outline" onClick={() => download(prompt, executableFuturePromptMarkdownFilename(plan, agentTarget))}><Download data-icon="inline-start" aria-hidden="true" />Download Markdown</Button>
            </div>
          </div>
          <p role="status" aria-live="polite" className="mt-2 min-h-5 text-xs text-muted-foreground">{copyStatus}</p>
          <pre data-testid="agent-prompt-preview" className="max-h-[48dvh] overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-border/50 bg-muted/25 p-4 font-mono text-xs leading-relaxed text-foreground">{prompt}</pre>

          <details className="mt-4 rounded-xl border border-border/50 bg-background/30" data-testid="advanced-future-plan">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"><span>Implementation-plan details</span><span className="text-xs font-normal text-muted-foreground">Stages, evidence, gates, and preserved plan export</span></summary>
            <div className="grid gap-6 border-t border-border/40 p-4 sm:p-5">
              <section>
                <h3 className="font-mono text-[10px] uppercase tracking-[0.14em] text-primary">Ordered stages</h3>
                <ol className="mt-3 grid gap-2">{plan.implementationStages.map(stage => <li key={stage.id} className="rounded-xl border border-border/45 bg-background/45 p-3"><div className="flex items-start gap-3"><span className="font-mono text-xs text-primary">{String(stage.order).padStart(2, '0')}</span><div><div className="text-sm font-medium">{stage.title}</div><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{stage.purpose}</p></div></div></li>)}</ol>
              </section>
              <PlanAreas areas={plan.affectedRepositoryAreas} />
              <section>
                <h3 className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-primary"><ShieldCheck className="size-4" />Human-review requirements</h3>
                <ul className="mt-3 grid gap-2 text-sm">{plan.reviewGates.map(gate => <li key={gate.id} className="rounded-xl border border-warning/20 p-3"><span className="font-medium">{gate.title}</span><span className="mt-1 block text-xs text-muted-foreground">{gate.reason}</span></li>)}{!plan.reviewGates.length && <li className="text-muted-foreground">No explicit sensitive gate is represented; ordinary code review still applies.</li>}</ul>
              </section>
              <section>
                <h3 className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-primary"><ListChecks className="size-4" />Verification</h3>
                <ul className="mt-3 grid gap-2 text-sm">{plan.verificationPlan.checks.map(check => <li key={check.id} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-primary" /><span>{check.title}{check.command ? ` — ${check.command}` : ''}</span></li>)}</ul>
              </section>
              <section>
                <h3 className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-primary"><Network className="size-4" />Evidence</h3>
                <div className="mt-3 flex flex-wrap gap-2">{presentEvidenceReferences(plan.evidence.map(item => item.id), plan.evidence).map((evidence, index) => <Badge key={`${index}:${evidence.label}`} variant="secondary">{evidence.path || evidence.label}</Badge>)}</div>
              </section>
              <Button type="button" variant="outline" onClick={() => download(renderExecutableFuturePlanMarkdown(plan), executableFuturePlanMarkdownFilename(plan))}><Download data-icon="inline-start" aria-hidden="true" />Download canonical plan</Button>
            </div>
          </details>
          <p className="mt-3 text-center text-[10px] leading-relaxed text-muted-foreground">Deterministic · no provider request · no repository mutation · this is not legal advice</p>
        </main>
      </div>
    </section>
  );
}

function PlanAreas({ areas }: { areas: ExecutableFuturePlanArea[] }) {
  return (
    <section>
      <h3 className="font-mono text-[10px] uppercase tracking-[0.14em] text-primary">Repository areas</h3>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">{areas.map(area => <li key={area.id} className="flex items-start gap-2 rounded-xl border border-border/45 p-3 text-sm">{area.kind === 'existing-repository-area' ? <FileCode2 className="mt-0.5 size-4 shrink-0 text-primary" /> : <FolderTree className="mt-0.5 size-4 shrink-0 text-primary" />}<span><span className="font-medium">{area.path || area.label}</span><span className="mt-1 block text-xs text-muted-foreground">{area.kind === 'existing-repository-area' ? 'Evidence-backed existing area' : 'Likely new responsibility; no validated path asserted'}</span></span></li>)}</ul>
    </section>
  );
}
