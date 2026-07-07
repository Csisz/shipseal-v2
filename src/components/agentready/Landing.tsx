import { ArrowRight, Bot, ChevronDown, FlaskConical, Lock, Mail, Megaphone, PackageCheck, ScanLine, ShieldAlert, Stamp } from 'lucide-react';
import type { CSSProperties, FormEvent, ReactNode } from 'react';
import { Fragment, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { SHIPSEAL_VERSION } from '@/lib/version';
import { PackageCards } from './PackageCards';
import { Reveal } from './landing/Reveal';
import { SealChamberHero } from './landing/SealChamberHero';
import { SealMark } from './landing/SealMark';

interface Props {
  onSampleReport: () => void;
  onScrollScan: () => void;
  /** Preselects a package and brings the user to the scan input. */
  onPickPackage?: (id: string) => void;
  /** The live upload / GitHub import area, rendered directly inside the hero. */
  scanSlot?: ReactNode;
}

export function Landing({ onSampleReport, onScrollScan, onPickPackage, scanSlot }: Props) {
  const pickPackage = (id: string) => {
    if (onPickPackage) onPickPackage(id);
    else onScrollScan();
  };

  return (
    <>
      {/* ============================= HERO ============================= */}
      <section className="relative pt-28 pb-16 md:pt-40 md:pb-24 overflow-hidden">
        <div className="absolute inset-0 bg-grid pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[520px] bg-primary/20 rounded-full blur-[150px] pointer-events-none" />
        <div className="container relative mx-auto text-center">
          <div className="mx-auto max-w-3xl animate-fade-in-up">
            <h1 className="font-display text-4xl md:text-6xl font-bold leading-[1.05] tracking-tight text-gradient">
              Stop wasting AI context.
            </h1>
            <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              ShipSeal scans your repository and prepares it for Claude Code, Codex, Cursor, Windsurf and other
              AI coding agents.
            </p>
            <p className="mt-4 text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
              Instead of rereading your entire codebase every session, agents receive structured project memory,
              context compression, routing guidance and repository intelligence.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Button size="lg" onClick={onScrollScan} className="bg-gradient-primary border-0 shadow-glow hover:opacity-90">
                Scan my repository <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={onSampleReport}>
                Try sample project
              </Button>
            </div>
          </div>

          {/* The scan input lives directly in the hero. */}
          <div className="mx-auto mt-10 max-w-5xl text-left animate-fade-in-up" style={{ animationDelay: '0.12s', animationFillMode: 'backwards' } as CSSProperties}>
            {scanSlot}
          </div>

          <div className="mt-8 flex flex-wrap justify-center items-center gap-x-6 gap-y-2 font-mono text-[11px] text-muted-foreground animate-fade-in" style={{ animationDelay: '0.25s', animationFillMode: 'backwards' } as CSSProperties}>
            <span className="inline-flex items-center gap-1.5"><Lock className="h-3 w-3 text-accent" /> Your code is never executed</span>
            <span className="inline-flex items-center gap-1.5"><ScanLine className="h-3 w-3 text-accent" /> Static scan only</span>
            <span>Optimizes the repository, not the AI model</span>
            <span>Generated/vendor folders are ignored where possible</span>
            <span>GitHub App permissions are used for repository access</span>
            <button type="button" onClick={onSampleReport} className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline transition-colors">
              Or try sample project
            </button>
          </div>
        </div>
      </section>

      <div className="container"><div className="ss-scanline" /></div>

      {/* ======================== WHY ======================== */}
      <section id="why" className="container py-20 md:py-24 scroll-mt-20">
        <Reveal>
          <SectionHeader
            title="AI coding gets expensive when the repository has no memory."
            lead="The model is not the bottleneck. The repository is."
          />
        </Reveal>
        <Reveal className="mt-12 max-w-4xl mx-auto" delay={100}>
          <div className="glass rounded-3xl p-7 md:p-9">
            <div className="grid gap-5 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-center text-center">
              {JOURNEY.map((item, index) => (
                <Fragment key={item.title}>
                  <div className="min-w-0">
                    <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent/90">{item.kicker}</div>
                    <div className="mt-2 font-display text-lg md:text-xl font-semibold">{item.title}</div>
                  </div>
                  {index < JOURNEY.length - 1 && <div className="hidden md:block ss-scanline w-12" aria-hidden="true" />}
                </Fragment>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* ======================== PROBLEM / SOLUTION ======================== */}
      <section id="problems" className="container py-20 md:py-24 scroll-mt-20">
        <Reveal>
          <SectionHeader title="Fix the repository context first." lead="ShipSeal turns common AI coding failure modes into reusable repository intelligence." />
        </Reveal>
        <div className="mt-12 grid md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto">
          {PROBLEM_SOLUTIONS.map((item, index) => (
            <Reveal key={item.problem} delay={index * 70}>
              <div className="glass rounded-2xl p-6 h-full">
                <div className="text-sm text-muted-foreground">{item.problem}</div>
                <div className="my-5 ss-scanline" aria-hidden="true" />
                <div className="font-display text-xl font-semibold">{item.solution}</div>
                <p className="mt-2 text-sm text-muted-foreground">{item.benefit}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ======================== REPOSITORY INTELLIGENCE ======================== */}
      <section id="intelligence" className="container py-24 md:py-32 scroll-mt-20">
        <Reveal>
          <SectionHeader
            title="Repository Intelligence"
            lead="One system that gives AI agents the right context before they start editing."
          />
        </Reveal>
        <Reveal className="mt-12 max-w-5xl mx-auto" delay={100}>
          <div className="glass rounded-3xl p-7 md:p-9">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {REPOSITORY_INTELLIGENCE.map(item => (
                <div key={item} className="rounded-xl border border-border/60 bg-secondary/20 px-4 py-3 text-sm text-foreground/90">
                  {item}
                </div>
              ))}
            </div>
            <p className="mt-6 text-sm leading-6 text-muted-foreground text-center">
              These are not disconnected features. Together they form the missing layer between a Git repository and AI coding agents.
            </p>
          </div>
        </Reveal>
      </section>

      {/* ========================= HOW IT WORKS ========================= */}
      <section id="how" className="container py-24 md:py-32 scroll-mt-20">
        <Reveal>
          <SectionHeader title="How it works." />
        </Reveal>
        <div className="mt-14 grid md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
          {STEPS.map((step, index) => (
            <Reveal key={step.title} delay={index * 100}>
              <div className="relative glass rounded-3xl p-7 h-full text-center">
                <div className="mx-auto mb-5 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-primary font-display text-sm font-bold text-primary-foreground shadow-glow">
                  {index + 1}
                </div>
                <div className="font-display text-lg font-semibold">{step.title}</div>
                <p className="mt-1.5 text-sm text-muted-foreground">{step.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ======================== DEMO PATHS ======================== */}
      <section id="sample-demo" className="container py-20 md:py-24 scroll-mt-20">
        <Reveal>
          <SectionHeader title="See it on a sample repository." lead="Preview the agent-ready workspace layer before connecting GitHub or uploading your own ZIP." />
        </Reveal>
        <div className="mt-10 grid md:grid-cols-2 gap-4 max-w-4xl mx-auto">
          <DemoAction
            title="Try sample project"
            desc="Open a prepared repository and see the ShipSeal workflow without setup."
            cta="Try sample project"
            onClick={onSampleReport}
          />
          <div className="glass rounded-3xl p-6 h-full">
            <div className="font-display text-lg font-semibold">View before/after context</div>
            <p className="mt-2 text-sm text-muted-foreground">
              See how scattered project knowledge becomes repository intelligence agents can use.
            </p>
            <Button asChild variant="outline" className="mt-5 border-border/70">
              <a href="#before-after">View before/after</a>
            </Button>
          </div>
        </div>
      </section>

      {/* ================== WHAT DO YOU WANT SHIPSEAL TO HELP WITH ================== */}
      <section id="packages" className="container py-24 md:py-32 scroll-mt-20">
        <Reveal>
          <SectionHeader title="Choose what to optimize first." lead="Start with the outcome you need. ShipSeal keeps the repository intelligence underneath consistent." />
        </Reveal>
        <Reveal className="mt-14 max-w-5xl mx-auto" delay={120}>
          <PackageCards variant="landing" onPick={pickPackage} />
        </Reveal>
      </section>

      {/* ========================= TRUST BOUNDARIES ========================= */}
      <section id="trust" className="container py-20 md:py-24 scroll-mt-20">
        <Reveal>
          <SectionHeader
            title="Clear scan boundaries."
            lead="ShipSeal reads project signals to optimize the repository for AI agents. It does not run imported code."
          />
        </Reveal>
        <div className="mt-10 grid gap-4 md:grid-cols-3 max-w-6xl mx-auto">
          <TrustPanel title="What ShipSeal reads" items={SCAN_READS} />
          <TrustPanel title="What ShipSeal ignores" items={SCAN_IGNORES} />
          <Reveal delay={120}>
            <div className="glass rounded-3xl p-6 h-full">
              <div className="font-display text-lg font-semibold">GitHub App permissions</div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                GitHub access is used to list approved repositories, scan the selected ref, and optionally open a reviewed
                Readiness PR. ShipSeal does not merge PRs or push to your main branch.
              </p>
              <div className="mt-5 rounded-xl border border-border/60 bg-secondary/25 px-4 py-3 text-xs text-muted-foreground">
                ShipSeal provides technical readiness guidance and documentation support. It does not provide legal advice or compliance certification.
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ======================== OUTPUT PREVIEW ======================== */}
      <section id="preview" className="container py-24 md:py-32 scroll-mt-20">
        <Reveal>
          <SectionHeader title="The workspace layer agents were missing." lead="A calm, structured layer of repository knowledge before the next AI coding session begins." />
        </Reveal>
        <Reveal className="mt-14 max-w-5xl mx-auto" delay={100}>
          <SealChamberHero />
        </Reveal>
        <div className="mt-8 grid grid-cols-2 md:grid-cols-5 gap-3 max-w-5xl mx-auto">
          {PACKAGE_GROUPS.map((group, index) => (
            <Reveal key={group.title} delay={index * 70}>
              <div className="glass rounded-2xl p-5 h-full text-center hover:border-accent/40 transition-colors">
                <group.icon className="h-5 w-5 text-accent mx-auto mb-3" />
                <div className="font-display text-sm font-semibold">{group.title}</div>
                <p className="mt-1 text-xs text-muted-foreground">{group.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal className="mt-8 max-w-5xl mx-auto" delay={150}>
          <details className="group rounded-2xl border border-border/60 bg-secondary/15">
            <summary className="flex cursor-pointer select-none items-center justify-between gap-3 px-6 py-4 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors [&::-webkit-details-marker]:hidden">
              <span>Advanced details - what Repository Intelligence can include</span>
              <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
            </summary>
            <div className="px-6 pb-5 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
              <p>Context packs, agent operating guidance, and folder-level instructions help AI tools work with less repeated discovery.</p>
              <p>Delivery Pack exports, reports, manifests, and reviewed PR workflows remain available when you need client-ready documentation.</p>
            </div>
          </details>
        </Reveal>
      </section>

      {/* ======================== BEFORE / AFTER ======================== */}
      <section id="before-after" className="container py-24 md:py-32 scroll-mt-20">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <div className="glass rounded-3xl p-8 md:p-10">
              <div className="grid md:grid-cols-[1fr_auto_1fr] gap-6 md:items-center text-left">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-warning/90 mb-3">Before ShipSeal</div>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>Scattered docs and no shared project memory.</li>
                    <li>Agents waste tokens rediscovering the same context.</li>
                    <li>Guidance, ownership, and delivery notes are inconsistent.</li>
                  </ul>
                </div>
                <div className="flex items-center justify-center gap-3" aria-hidden="true">
                  <span className="hidden md:block ss-scanline w-10" />
                  <SealMark size={56} ringText={'SHIPSEAL - '} />
                  <span className="hidden md:block ss-scanline w-10" />
                </div>
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-success/90 mb-3">After ShipSeal</div>
                  <ul className="space-y-2 text-sm text-foreground/90">
                    <li>Repository intelligence is generated once.</li>
                    <li>Agents receive compact memory and routing guidance.</li>
                    <li>Delivery-ready documentation stays available when needed.</li>
                  </ul>
                </div>
              </div>
              <div className="mt-8 text-center">
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-warning/90 mb-2">Before</div>
              <p className="font-display text-xl md:text-2xl text-muted-foreground">Repository, scattered context, repeated AI discovery.</p>
              <div className="my-7 flex items-center justify-center gap-3" aria-hidden="true">
                <span className="ss-scanline w-16" />
                  <SealMark size={56} ringText={'SHIPSEAL - '} />
                <span className="ss-scanline w-16" />
              </div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-success/90 mb-2">After</div>
              <p className="font-display text-xl md:text-2xl text-foreground">Repository Intelligence, cleaner AI sessions, delivery-ready output.</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ========================= AUDIENCES ============================ */}
      <section id="who" className="container py-24 md:py-32 scroll-mt-20">
        <Reveal>
          <SectionHeader title="Built for people who build with AI." />
        </Reveal>
        <Reveal className="mt-10 flex flex-wrap justify-center gap-2.5 max-w-3xl mx-auto" delay={100}>
          {AUDIENCES.map(item => (
            <span key={item} className="rounded-full glass px-4 py-2 text-sm text-foreground/85">
              {item}
            </span>
          ))}
        </Reveal>
      </section>

      {/* ========================== PRICING ============================= */}
      <section id="pricing" className="container py-24 md:py-32 scroll-mt-20">
        <Reveal>
          <SectionHeader title="Optimize the workflow, not just the report." lead="Start with one repository. Scale the same intelligence across teams and clients." />
        </Reveal>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mt-14 max-w-6xl mx-auto">
          {PRICING_TIERS.map((tier, index) => (
            <Reveal key={tier.name} delay={index * 90} className="h-full">
              <div className={`glass rounded-3xl p-7 flex flex-col h-full transition-transform hover:-translate-y-1 ${tier.featured ? 'border-primary/50 shadow-glow' : ''}`}>
                <div className="font-display font-semibold">{tier.name}</div>
                <div className="text-3xl font-display font-bold mt-2">{tier.price}</div>
                <p className="mt-4 text-sm text-foreground/90">{tier.outcome}</p>
                <ul className="mt-6 space-y-2.5 text-sm text-muted-foreground flex-1">
                  {tier.features.map(feature => (
                    <li key={feature} className="flex gap-2">
                      <span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={onScrollScan}
                  variant={tier.featured ? 'default' : 'outline'}
                  className={`mt-7 ${tier.featured ? 'bg-gradient-primary border-0 shadow-glow hover:opacity-90' : 'border-border/70'}`}
                >
                  {tier.cta}
                </Button>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal className="mt-10 max-w-4xl mx-auto" delay={150}>
          <details className="group rounded-2xl border border-border/60 bg-secondary/15">
            <summary className="flex cursor-pointer select-none items-center justify-between gap-3 px-6 py-4 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors [&::-webkit-details-marker]:hidden">
              <span>The honest fine print</span>
              <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
            </summary>
            <ul className="px-6 pb-5 space-y-2 text-sm text-muted-foreground">
              {DISCLAIMERS.map(item => (
                <li key={item} className="flex gap-2">
                  <span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-warning shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </details>
        </Reveal>
      </section>

      {/* ========================== CONTACT ============================= */}
      <section id="contact" className="container py-24 md:py-32 scroll-mt-20">
        <Reveal>
          <SectionHeader title="Bring ShipSeal into your workflow." lead="Tell us what kind of repositories you want to make easier for AI agents." />
        </Reveal>
        <Reveal className="mt-10 max-w-3xl mx-auto" delay={100}>
          <ContactLeadForm />
        </Reveal>
      </section>

      {/* ========================= FINAL CTA ============================ */}
      <section className="container py-24 md:py-32">
        <Reveal>
          <div className="glass-strong rounded-3xl p-10 md:p-16 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-hero opacity-50 pointer-events-none" />
            <div className="relative">
              <div className="flex justify-center mb-6">
                <SealMark size={110} />
              </div>
              <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight">Turn your repository into an AI-optimized workspace.</h2>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Button size="lg" onClick={onScrollScan} className="bg-gradient-primary border-0 shadow-glow hover:opacity-90">
                  Scan my repository <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
                <Button size="lg" variant="outline" onClick={onSampleReport}>
                  Try sample project
                </Button>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-border/60 py-8">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded bg-gradient-primary flex items-center justify-center"><Stamp className="h-3 w-3 text-primary-foreground" /></div>
            <span>ShipSeal - turn repositories into AI-optimized workspaces.</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <a href="/privacy" className="hover:text-foreground transition-colors">Privacy</a>
            <a href="/security" className="hover:text-foreground transition-colors">Security</a>
            <span className="font-mono">ShipSeal MVP v{SHIPSEAL_VERSION}</span>
          </div>
        </div>
      </footer>
    </>
  );
}

function SectionHeader({ title, lead }: { title: string; lead?: string }) {
  return (
    <div className="max-w-2xl mx-auto text-center">
      <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight">{title}</h2>
      {lead ? <p className="text-lg text-muted-foreground mt-4">{lead}</p> : null}
    </div>
  );
}

function DemoAction({ title, desc, cta, onClick }: { title: string; desc: string; cta: string; onClick: () => void }) {
  return (
    <div className="glass rounded-3xl p-6 h-full">
      <div className="font-display text-lg font-semibold">{title}</div>
      <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
      <Button type="button" onClick={onClick} className="mt-5 bg-gradient-primary border-0 shadow-glow hover:opacity-90">
        {cta}
      </Button>
    </div>
  );
}

function TrustPanel({ title, items }: { title: string; items: string[] }) {
  return (
    <Reveal>
      <div className="glass rounded-3xl p-6 h-full">
        <div className="font-display text-lg font-semibold">{title}</div>
        <div className="mt-4 flex flex-wrap gap-2">
          {items.map(item => (
            <span key={item} className="rounded-full border border-border/60 bg-secondary/25 px-3 py-1.5 text-xs text-muted-foreground">
              {item}
            </span>
          ))}
        </div>
      </div>
    </Reveal>
  );
}

function ContactLeadForm() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    company: '',
    projectType: '',
    interest: INTEREST_OPTIONS[0],
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);

  const mailtoHref = useMemo(() => {
    const subject = encodeURIComponent(`ShipSeal workspace request - ${form.interest}`);
    const body = encodeURIComponent([
      `Name: ${form.name}`,
      `Email: ${form.email}`,
      `Company / agency: ${form.company || 'Not provided'}`,
      `Project type: ${form.projectType || 'Not provided'}`,
      `Interest: ${form.interest}`,
      '',
      form.message,
    ].join('\n'));
    return `mailto:hello@shipseal.dev?subject=${subject}&body=${body}`;
  }, [form]);

  const update = (key: keyof typeof form, value: string) => {
    setForm(current => ({ ...current, [key]: value }));
    setSubmitted(false);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
  };

  return (
    <form onSubmit={submit} className="glass rounded-3xl p-6 md:p-8 space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <LeadField label="Name">
          <Input required aria-label="Contact name" value={form.name} onChange={event => update('name', event.target.value)} autoComplete="name" />
        </LeadField>
        <LeadField label="Email">
          <Input required type="email" aria-label="Contact email" value={form.email} onChange={event => update('email', event.target.value)} autoComplete="email" />
        </LeadField>
        <LeadField label="Company / agency optional">
          <Input aria-label="Company or agency" value={form.company} onChange={event => update('company', event.target.value)} autoComplete="organization" />
        </LeadField>
        <LeadField label="Project type optional">
          <Input aria-label="Project type" value={form.projectType} onChange={event => update('projectType', event.target.value)} placeholder="AI SaaS, chatbot, internal tool..." />
        </LeadField>
        <LeadField label="Selected interest" className="sm:col-span-2">
          <select
            aria-label="Selected interest"
            value={form.interest}
            onChange={event => update('interest', event.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {INTEREST_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
          </select>
        </LeadField>
        <LeadField label="Message" className="sm:col-span-2">
          <Textarea
            required
            aria-label="Contact message"
            value={form.message}
            onChange={event => update('message', event.target.value)}
            rows={5}
            placeholder="Tell us what you want ShipSeal to package or make easier for AI agents."
          />
        </LeadField>
      </div>
      <div className="rounded-xl border border-border/60 bg-secondary/25 px-4 py-3 text-xs text-muted-foreground">
        No backend delivery is configured in this demo. ShipSeal does not store this message. After submit, open your email draft and send it yourself.
      </div>
      {submitted && (
        <div role="status" className="rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          No message was sent to a server. Use the email draft link below to send your request.
        </div>
      )}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <Button type="submit" variant="outline" className="border-border/70">
          Prepare email draft
        </Button>
        {submitted && (
          <Button asChild className="bg-gradient-primary border-0 shadow-glow hover:opacity-90">
            <a href={mailtoHref}><Mail className="h-4 w-4 mr-1.5" /> Open email draft</a>
          </Button>
        )}
      </div>
    </form>
  );
}

function LeadField({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="block text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1.5">{label}</span>
      {children}
    </label>
  );
}

const JOURNEY = [
  { kicker: 'You have', title: 'A repository' },
  { kicker: 'AI coding costs rise', title: 'Context waste' },
  { kicker: 'ShipSeal adds', title: 'Repository Intelligence' },
  { kicker: 'Agents get', title: 'Cleaner sessions' },
];

const PROBLEM_SOLUTIONS = [
  {
    problem: 'AI rereads the whole repository every session.',
    solution: 'Context Compression',
    benefit: 'Agents start with the signal instead of rediscovering the map.',
  },
  {
    problem: 'AI edits the wrong files.',
    solution: 'Folder-level AGENTS',
    benefit: 'Local instructions route work to the right folders and boundaries.',
  },
  {
    problem: 'AI forgets project architecture.',
    solution: 'Agent Memory',
    benefit: 'Stable project facts survive beyond one chat window.',
  },
  {
    problem: 'AI lacks project-specific guidance.',
    solution: 'Skills + MCP Recommendations',
    benefit: 'Agents get scoped tool guidance without unsafe assumptions.',
  },
  {
    problem: 'AI coding burns through limits.',
    solution: 'Agent Cost Optimizer',
    benefit: 'Operating modes help match context depth to the work.',
  },
  {
    problem: 'You still need professional documentation.',
    solution: 'Delivery Pack',
    benefit: 'Reports and handoff files remain available as an output.',
  },
];

const REPOSITORY_INTELLIGENCE = [
  'Context Compression',
  'Folder-level AGENTS',
  'Specialized Context Packs',
  'Agent Cost Optimizer',
  'Skill Recommendations',
  'MCP Recommendations',
  'Agent Memory',
];

const STEPS = [
  { title: 'Scan repository', desc: 'Connect GitHub or upload a ZIP.' },
  { title: 'Generate Repository Intelligence', desc: 'ShipSeal builds the workspace layer.' },
  { title: 'Optimize AI coding workflow', desc: 'Agents receive memory, routes, and context guidance.' },
  { title: 'Export delivery-ready documentation', desc: 'Reports and Delivery Packs stay available.' },
];

const SCAN_READS = ['README', 'package.json', 'tests', 'docs', 'CI files', 'AGENTS.md', 'env examples'];

const SCAN_IGNORES = ['node_modules', 'dist', 'build', 'coverage', 'large generated folders', 'binaries where possible'];

const PACKAGE_GROUPS = [
  { icon: Bot, title: 'Memory', desc: 'Compact project context' },
  { icon: PackageCheck, title: 'Compression', desc: 'Less context waste' },
  { icon: FlaskConical, title: 'Packs', desc: 'Task-focused context' },
  { icon: ShieldAlert, title: 'Guidance', desc: 'Agent boundaries' },
  { icon: Megaphone, title: 'Delivery', desc: 'Reports and exports' },
];

const AUDIENCES = [
  'Vibe coders',
  'AI freelancers',
  'Small AI agencies',
  'No-code builders',
  'Indie SaaS makers',
  'Teams preparing a pilot',
];

const PRICING_TIERS = [
  {
    name: 'Free Demo',
    price: 'Free',
    featured: false,
    cta: 'Try demo',
    outcome: 'Understand the ShipSeal workflow.',
    features: ['Sample repository', 'Repository Intelligence preview', 'Example output'],
  },
  {
    name: 'Builder',
    price: 'Request access',
    featured: false,
    cta: 'Scan my repository',
    outcome: 'Optimize one repository.',
    features: ['Repository scan', 'Context waste reduction', 'Delivery-ready export'],
  },
  {
    name: 'AI Workspace Pro',
    price: 'Coming soon',
    featured: true,
    cta: 'Scan my repository',
    outcome: 'Optimize your AI development workflow.',
    features: ['Reusable repository intelligence', 'Agent operating guidance', 'Context packs for repeated work'],
  },
  {
    name: 'Agency / White-label',
    price: 'Coming soon',
    featured: false,
    cta: 'Contact us',
    outcome: 'Optimize AI development across multiple repositories.',
    features: ['Multi-project workflow', 'White-label-ready delivery', 'Client handoff exports'],
  },
];

const DISCLAIMERS = [
  'ShipSeal provides technical readiness guidance and documentation support. It does not provide legal advice or compliance certification.',
  'AI usage and transparency notes are drafts and questions for legal review - not legal advice or compliance certification.',
  'The risk check highlights obvious issues. It is not a full production security audit.',
  'ShipSeal reads your project structure and selected text - it never runs your code.',
  'Everything ShipSeal generates supports review and decision-making. It does not replace it.',
];

const INTEREST_OPTIONS = [
  'Client handoff package',
  'AI agent development pack',
  'Token/cost optimization',
  'AI workspace optimization',
  'Security/data pre-screen',
  'White-label reports',
  'General feedback',
];
