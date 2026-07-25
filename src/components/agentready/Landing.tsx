import { ArrowRight, CheckCircle2, ChevronDown, Code2, FileCheck2, Lock, Mail, Network, ScanLine, ShieldCheck } from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { SHIPSEAL_VERSION } from '@/lib/version';
import { PackageCards } from './PackageCards';
import { RepositoryIntelligencePreview } from './landing/RepositoryIntelligencePreview';
import { Reveal } from './landing/Reveal';

interface Props {
  onSampleReport: () => void;
  onScrollScan: () => void;
  onPickPackage?: (id: string) => void;
  scanSlot?: ReactNode;
}

export function Landing({ onSampleReport, onScrollScan, onPickPackage, scanSlot }: Props) {
  const pickPackage = (id: string) => {
    if (onPickPackage) onPickPackage(id);
    else onScrollScan();
  };

  return (
    <>
      <section id="why" className="relative overflow-hidden pb-16 pt-24 md:pb-24 md:pt-32">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-70" />
        <div className="pointer-events-none absolute left-1/2 top-0 h-[460px] w-[760px] -translate-x-1/2 rounded-full bg-primary/15 blur-[150px]" />
        <div className="container relative">
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(520px,1.15fr)]">
            <div className="max-w-2xl animate-fade-in-up">
              <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-primary-glow">AI repository intelligence</div>
              <h1 className="mt-4 font-display text-4xl font-bold leading-[1.03] tracking-tight text-foreground md:text-6xl">
                Turn software into knowledge.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
                ShipSeal maps your repository, reveals agent friction, and prepares evidence-backed improvements.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Button size="lg" onClick={onScrollScan} className="bg-primary text-primary-foreground shadow-glow hover:bg-primary/90">
                  Scan my repository <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
                <Button size="lg" variant="outline" onClick={onSampleReport} className="border-border/70 bg-background/30">
                  Try a sample
                </Button>
              </div>
            </div>
            <div className="animate-fade-in-up [animation-delay:120ms] [animation-fill-mode:backwards]">
              <RepositoryIntelligencePreview />
            </div>
          </div>

          <div className="mt-8 grid gap-2 sm:grid-cols-3" aria-label="ShipSeal trust boundaries">
            <Proof icon={Lock} text="Repository code is not executed." />
            <Proof icon={FileCheck2} text="Findings are tied to repository evidence." />
            <Proof icon={ShieldCheck} text="Repository changes require confirmation." />
          </div>
        </div>
      </section>

      <section id="scan" className="scroll-mt-20 border-y border-border/45 bg-secondary/10 py-14 md:py-20">
        <div className="container">
          <Reveal className="mx-auto max-w-3xl text-center">
            <Eyebrow>Start with a repository</Eyebrow>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight md:text-4xl">Choose the source you trust.</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
              Connect GitHub for the smoothest workflow, or use ZIP, a public URL, or the sample without changing repository contents.
            </p>
          </Reveal>
          <Reveal className="mx-auto mt-8 max-w-5xl" delay={80}>
            {scanSlot}
          </Reveal>
        </div>
      </section>

      <section id="intelligence" className="container scroll-mt-20 py-16 md:py-24">
        <Reveal className="mx-auto max-w-3xl text-center">
          <Eyebrow>Repository intelligence</Eyebrow>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight md:text-4xl">From scattered signals to an operating map.</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
            ShipSeal connects repository structure, project memory, task routes, verification, and delivery context in one workspace.
          </p>
        </Reveal>
        <div className="mx-auto mt-10 grid max-w-5xl gap-3 md:grid-cols-3">
          <Outcome icon={Network} title="Understand" text="Map the repository and expose the evidence behind its shape." />
          <Outcome icon={Code2} title="Improve" text="Prepare reviewable changes without implying that files were modified." />
          <Outcome icon={CheckCircle2} title="Verify and deliver" text="Compare later scans and keep reports, manifests, and handoff outputs available." />
        </div>
      </section>

      <section id="how" className="scroll-mt-20 border-y border-border/45 bg-secondary/10 py-16 md:py-24">
        <div className="container">
          <Reveal className="mx-auto max-w-3xl text-center">
            <Eyebrow>How it works</Eyebrow>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight md:text-4xl">Repository understanding in three steps.</h2>
          </Reveal>
          <ol className="mx-auto mt-10 grid max-w-5xl gap-3 md:grid-cols-3">
            <Step number="01" title="Choose a source" text="Connect GitHub, upload a ZIP, use a public URL, or open the sample." />
            <Step number="02" title="Build intelligence" text="ShipSeal reads allowed evidence and prepares the repository workspace." />
            <Step number="03" title="Act with context" text="Review improvements, verification, and delivery outputs from one result." />
          </ol>
        </div>
      </section>

      <section id="packages" className="container scroll-mt-20 py-16 md:py-24">
        <Reveal className="mx-auto max-w-3xl text-center">
          <Eyebrow>Outcomes</Eyebrow>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight md:text-4xl">Choose what the scan should prepare.</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Start with an outcome. Technical package details remain available when you need them.
          </p>
        </Reveal>
        <Reveal className="mx-auto mt-10 max-w-6xl" delay={80}>
          <PackageCards variant="landing" onPick={pickPackage} />
        </Reveal>
      </section>

      <section id="trust" className="scroll-mt-20 border-y border-border/45 bg-secondary/10 py-16 md:py-24">
        <div className="container">
          <Reveal className="mx-auto max-w-3xl text-center">
            <Eyebrow>Repository boundary</Eyebrow>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight md:text-4xl">Read evidence. Never execute imported code.</h2>
          </Reveal>
          <div className="mx-auto mt-10 grid max-w-5xl gap-3 md:grid-cols-3">
            <TrustPanel title="Static scan" text="ShipSeal reads structure, metadata, and bounded configuration, documentation, and test signals." />
            <TrustPanel title="Scoped GitHub access" text="Repository access follows the repositories and permissions approved in GitHub." />
            <TrustPanel title="Human-controlled changes" text="Generated files and Pull Requests stay reviewable. ShipSeal does not merge or push directly to main." />
          </div>
          <details className="group mx-auto mt-4 max-w-5xl rounded-2xl border border-border/55 bg-background/25">
            <summary className="flex cursor-pointer items-center justify-between gap-3 px-5 py-4 text-sm font-medium text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
              Detailed scan and trust boundaries
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <div className="grid gap-4 border-t border-border/45 px-5 py-5 text-sm text-muted-foreground md:grid-cols-2">
              <div>
                <div className="font-semibold text-foreground">Typically read</div>
                <p className="mt-2 leading-relaxed">File paths, package manifests, README and instruction files, selected configuration, tests, and workflow signals within scanner limits.</p>
              </div>
              <div>
                <div className="font-semibold text-foreground">Ignored where possible</div>
                <p className="mt-2 leading-relaxed">Generated and vendor folders such as node_modules, dist, build, .next, coverage, caches, binaries, and secret-looking files.</p>
              </div>
              <p className="md:col-span-2">ShipSeal provides technical readiness guidance and documentation support. This is not legal advice or compliance certification.</p>
            </div>
          </details>
        </div>
      </section>

      <section id="pricing" className="container scroll-mt-20 py-16 md:py-24">
        <Reveal className="mx-auto max-w-3xl text-center">
          <Eyebrow>Pricing direction</Eyebrow>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight md:text-4xl">Start with one repository.</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">Payment is not enabled in this MVP. Commercial packages remain clearly marked.</p>
        </Reveal>
        <div className="mx-auto mt-10 grid max-w-5xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PRICING.map(item => (
            <div key={item.name} className={`rounded-2xl border p-5 ${item.featured ? 'border-primary/45 bg-primary/10 shadow-sm shadow-primary/10' : 'border-border/55 bg-secondary/10'}`}>
              <div className="font-display text-lg font-semibold">{item.name}</div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
              <div className="mt-5 text-xs font-medium text-primary-glow">{item.status}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="contact" className="container scroll-mt-20 pb-16 md:pb-24">
        <div className="mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-primary/25 bg-canvas p-6 shadow-glow md:p-10">
          <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div>
              <Eyebrow>Next repository</Eyebrow>
              <h2 className="mt-3 font-display text-3xl font-semibold">Make the next AI coding session easier.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">Start with a repository scan or use the contact disclosure for commercial access conversations.</p>
            </div>
            <Button size="lg" onClick={onScrollScan} className="bg-primary text-primary-foreground hover:bg-primary/90">
              Scan my repository <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </div>
          <ContactDisclosure />
        </div>
      </section>

      <footer className="border-t border-border/45 py-8">
        <div className="container flex flex-col gap-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>ShipSeal {SHIPSEAL_VERSION} · Repository intelligence without code execution.</span>
          <div className="flex gap-4">
            <a href="/privacy" className="hover:text-foreground">Privacy</a>
            <a href="/security" className="hover:text-foreground">Security</a>
          </div>
        </div>
      </footer>
    </>
  );
}

function Proof({ icon: Icon, text }: { icon: typeof Lock; text: string }) {
  return (
    <div className="flex min-h-11 items-center gap-2 rounded-xl border border-border/50 bg-background/25 px-3 py-2 text-xs text-muted-foreground">
      <Icon className="h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" />
      <span>{text}</span>
    </div>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary-glow">{children}</div>;
}

function Outcome({ icon: Icon, title, text }: { icon: typeof Network; title: string; text: string }) {
  return (
    <Reveal>
      <div className="h-full rounded-2xl border border-border/55 bg-secondary/10 p-5">
        <Icon className="h-5 w-5 text-primary-glow" aria-hidden="true" />
        <h3 className="mt-4 font-display text-lg font-semibold">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
      </div>
    </Reveal>
  );
}

function Step({ number, title, text }: { number: string; title: string; text: string }) {
  return (
    <li className="rounded-2xl border border-border/55 bg-background/25 p-5">
      <div className="font-mono text-xs text-primary-glow">{number}</div>
      <h3 className="mt-3 font-display text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
    </li>
  );
}

function TrustPanel({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-border/55 bg-background/25 p-5">
      <ScanLine className="h-5 w-5 text-primary-glow" aria-hidden="true" />
      <h3 className="mt-4 font-display text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
    </div>
  );
}

const PRICING = [
  { name: 'Free Demo', description: 'Explore ShipSeal with a sample and repository scan.', status: 'Available now' },
  { name: 'Builder', description: 'Optimize one repository and prepare focused outputs.', status: 'Coming soon', featured: true },
  { name: 'AI Workspace Pro', description: 'Support a deeper AI development workflow.', status: 'Coming soon' },
  { name: 'Agency / White-label', description: 'Prepare repository intelligence across client work.', status: 'Request access' },
];

function ContactDisclosure() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({
    name: '',
    email: '',
    company: '',
    projectType: '',
    interest: '',
    message: '',
  });
  const [prepared, setPrepared] = useState(false);
  const mailto = useMemo(() => {
    const subject = `ShipSeal access request${draft.company ? ` - ${draft.company}` : ''}`;
    const body = [
      `Name: ${draft.name}`,
      `Email: ${draft.email}`,
      `Company or agency: ${draft.company || 'Not provided'}`,
      `Project type: ${draft.projectType || 'Not provided'}`,
      `Interest: ${draft.interest || 'Not provided'}`,
      '',
      draft.message,
    ].join('\n');
    return `mailto:hello@shipseal.dev?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }, [draft]);

  const prepare = (event: FormEvent) => {
    event.preventDefault();
    setPrepared(true);
  };

  return (
    <div className="mt-6 rounded-2xl border border-border/55 bg-background/20">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
        className="flex min-h-11 w-full items-center justify-between gap-3 px-5 py-3 text-left text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        Contact and commercial access
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <form onSubmit={prepare} className="grid gap-4 border-t border-border/45 p-5 md:grid-cols-2">
          <ContactField label="Contact name"><Input required value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></ContactField>
          <ContactField label="Contact email"><Input required type="email" value={draft.email} onChange={event => setDraft({ ...draft, email: event.target.value })} /></ContactField>
          <ContactField label="Company or agency"><Input value={draft.company} onChange={event => setDraft({ ...draft, company: event.target.value })} /></ContactField>
          <ContactField label="Project type"><Input value={draft.projectType} onChange={event => setDraft({ ...draft, projectType: event.target.value })} /></ContactField>
          <ContactField label="Selected interest" className="md:col-span-2"><Input value={draft.interest} onChange={event => setDraft({ ...draft, interest: event.target.value })} /></ContactField>
          <ContactField label="Contact message" className="md:col-span-2"><Textarea value={draft.message} onChange={event => setDraft({ ...draft, message: event.target.value })} /></ContactField>
          <div className="md:col-span-2">
            <p className="text-xs text-muted-foreground">No backend delivery is configured in this demo. Preparing a draft does not send or store the message.</p>
            <Button type="submit" variant="outline" className="mt-3"><Mail className="mr-2 h-4 w-4" />Prepare email draft</Button>
            {prepared && (
              <div className="mt-3 rounded-xl border border-primary/25 bg-primary/10 p-3 text-sm">
                <p className="text-muted-foreground">No message was sent to a server.</p>
                <a href={mailto} className="mt-2 inline-flex font-medium text-primary-glow hover:underline">Open email draft</a>
              </div>
            )}
          </div>
        </form>
      )}
    </div>
  );
}

function ContactField({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={className}>
      <span className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
