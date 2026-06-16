import type React from 'react';
import { Bot, Building2, ChevronDown, Globe2, ShieldCheck, Sparkles, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import type { ProjectIntake } from '@/lib/intake';
import { SAMPLE_PROJECT_INTAKE } from '@/lib/demo/sampleProject';

interface Props {
  value: ProjectIntake;
  onChange: (value: ProjectIntake) => void;
}

export function ProjectIntakeForm({ value, onChange }: Props) {
  const update = <K extends keyof ProjectIntake>(key: K, nextValue: ProjectIntake[K]) => {
    onChange({ ...value, [key]: nextValue });
  };

  return (
    <div className="glass rounded-2xl p-6 mb-8">
      <div className="mb-6 flex flex-wrap items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-secondary/45">
          <Bot className="h-4 w-4 text-primary-glow" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-xl font-semibold">Tell ShipSeal what this AI app does</h3>
          <p className="mt-1 text-sm text-muted-foreground">Optional, but recommended for client-ready reports.</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Project name">
          <Input value={value.projectName} onChange={event => update('projectName', event.target.value)} />
        </Field>
        <Field label="Client name">
          <Input value={value.clientName || ''} onChange={event => update('clientName', event.target.value)} />
        </Field>
        <Field label="Agency name">
          <Input value={value.agencyName || ''} onChange={event => update('agencyName', event.target.value)} />
        </Field>
        <Field label="AI provider">
          <Input value={value.aiProvider} onChange={event => update('aiProvider', event.target.value)} placeholder="OpenAI, Anthropic, local, other" />
        </Field>
        <Field label="Model name">
          <Input value={value.modelName} onChange={event => update('modelName', event.target.value)} placeholder="gpt-4.1, claude, local model" />
        </Field>
        <Field label="Target users">
          <Input value={value.targetUsers} onChange={event => update('targetUsers', event.target.value)} />
        </Field>
        <Field label="What does this AI app do?" className="md:col-span-2">
          <Textarea value={value.appDescription} onChange={event => update('appDescription', event.target.value)} />
        </Field>
        <Field label="What does the AI generate or decide?" className="md:col-span-2">
          <Textarea value={value.aiUseCase} onChange={event => update('aiUseCase', event.target.value)} />
        </Field>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 mt-5">
        <ToggleRow
          icon={<Globe2 className="h-3.5 w-3.5" />}
          label="Is it intended for EU users?"
          helper="Will people in the EU use this AI system?"
          checked={value.usedInEU}
          onCheckedChange={checked => update('usedInEU', checked)}
        />
        <ToggleRow
          icon={<ShieldCheck className="h-3.5 w-3.5" />}
          label="Does it handle personal, sensitive or business-critical data?"
          helper="Does the app process data that can identify a person?"
          checked={value.handlesPersonalData}
          onCheckedChange={checked => update('handlesPersonalData', checked)}
        />
        <ToggleRow
          icon={<Building2 className="h-3.5 w-3.5" />}
          label="Does the AI output reach users?"
          helper="Can end users see AI-generated answers or content?"
          checked={value.generatesUserFacingContent}
          onCheckedChange={checked => update('generatesUserFacingContent', checked)}
        />
        <ToggleRow
          icon={<UserCheck className="h-3.5 w-3.5" />}
          label="Is there human review or approval?"
          helper="Is there a human review or escalation step?"
          checked={value.hasHumanApproval}
          onCheckedChange={checked => update('hasHumanApproval', checked)}
        />
      </div>

      <details className="group mt-5 rounded-xl border border-border/60 bg-secondary/15">
        <summary className="flex cursor-pointer select-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors [&::-webkit-details-marker]:hidden">
          <span>Advanced details</span>
          <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
        </summary>
        <div className="border-t border-border/50 px-4 py-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange({ ...SAMPLE_PROJECT_INTAKE })}
            className="border-border/60"
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Load demo project
          </Button>
        </div>
      </details>
    </div>
  );
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="block text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function ToggleRow({
  icon,
  label,
  helper,
  checked,
  onCheckedChange,
}: {
  icon: React.ReactNode;
  label: string;
  helper: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div
      className="min-w-0 rounded-lg border border-border/60 bg-secondary/25 px-3 py-3 flex items-start justify-between gap-3 cursor-pointer hover:border-primary/30 transition-colors"
      onClick={() => onCheckedChange(!checked)}
    >
      <div className="min-w-0 flex items-start gap-2 text-sm text-foreground/90">
        <span className="text-primary-glow shrink-0 mt-0.5">{icon}</span>
        <span className="min-w-0">
          <span className="block font-medium leading-snug whitespace-normal">{label}</span>
          <span className="block text-xs leading-relaxed text-muted-foreground mt-1 whitespace-normal">{helper}</span>
        </span>
      </div>
      <Switch
        aria-label={label}
        checked={checked}
        onCheckedChange={onCheckedChange}
        onClick={event => event.stopPropagation()}
        className="shrink-0 mt-0.5"
      />
    </div>
  );
}
