import { ArrowRight, Bot, ChevronDown, FlaskConical, Lock, Mail, Megaphone, PackageCheck, ScanLine, ShieldAlert, Stamp } from 'lucide-react';
import type { CSSProperties, FormEvent, ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { SHIPSEAL_VERSION } from '@/lib/version';
import { PackageCards } from './PackageCards';
import { DeliveryPackExplorer } from './landing/DeliveryPackExplorer';
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
        <div className="container relative max-w-3xl mx-auto text-center">
          <div className="animate-fade-in-up">
            <h1 className="font-display text-4xl md:text-6xl font-bold leading-[1.05] tracking-tight text-gradient">
              Stop wasting AI context.
            </h1>
            <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              ShipSeal scans your repository and generates agent memory, context compression, folder-level
              instructions, operating modes, skills, MCP recommendations, and delivery packs so AI coding tools
              waste less context and work more consistently.
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
          <div className="mt-10 text-left animate-fade-in-up" style={{ animationDelay: '0.12s', animationFillMode: 'backwards' } as CSSProperties}>
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

      {/* ======================== DEMO PATHS ======================== */}
      <section id="sample-demo" className="container py-20 md:py-24 scroll-mt-20">
        <Reveal>
          <SectionHeader title="Try ShipSeal without connecting GitHub." lead="Use the bundled sample project to see score, scan evidence, package focus, reports, and generated outputs." />
        </Reveal>
        <div className="mt-10 grid md:grid-cols-2 gap-4 max-w-4xl mx-auto">
          <DemoAction
            title="Try sample project"
            desc="Skip setup and preview what ShipSeal produces before uploading a ZIP or connecting GitHub."
            cta="Try sample project"
            onClick={onSampleReport}
          />
          <div className="glass rounded-3xl p-6 h-full">
            <div className="font-display text-lg font-semibold">View before/after readiness example</div>
            <p className="mt-2 text-sm text-muted-foreground">
              See how ShipSeal turns scattered context into compact project memory, agent guidance, a Delivery Pack, and clearer next steps.
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
          <SectionHeader title="What do you want ShipSeal to help with?" lead="Pick one simple goal. ShipSeal handles the rest." />
        </Reveal>
        <Reveal className="mt-14 max-w-5xl mx-auto" delay={120}>
          <PackageCards variant="landing" onPick={pickPackage} />
        </Reveal>
      </section>

      {/* ========================= HOW IT WORKS ========================= */}
      <section id="how" className="container py-24 md:py-32 scroll-mt-20">
        <Reveal>
          <SectionHeader title="How ShipSeal works." />
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
          <SectionHeader title="Agent-ready context. Delivery-ready output." lead="ShipSeal prepares compact workspace memory first, then packages the outputs you need." />
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
              <span>Advanced details - explore the generated files</span>
              <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
            </summary>
            <div className="px-3 pb-3 md:px-5 md:pb-5">
              <DeliveryPackExplorer />
              <p className="mt-4 px-2 text-xs text-muted-foreground">
                You also get a client-ready report (PDF / HTML) and a fix pack you can add back to your project -
                manually or through a reviewed GitHub pull request. ShipSeal never pushes to your main branch.
              </p>
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
                    <li>Scattered docs and unclear handoff readiness.</li>
                    <li>Agents waste tokens rediscovering project context.</li>
                    <li>Missing tests, reports, owner notes, and delivery files.</li>
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
                    <li>Scan evidence, readiness score, and next actions.</li>
                    <li>Compact project memory, context compression, and folder guidance.</li>
                    <li>Delivery Pack, client report, and safer review boundaries.</li>
                  </ul>
                </div>
              </div>
              <div className="mt-8 text-center">
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-warning/90 mb-2">Before</div>
              <p className="font-display text-xl md:text-2xl text-muted-foreground">Prototype, scattered context, unclear risks.</p>
              <div className="my-7 flex items-center justify-center gap-3" aria-hidden="true">
                <span className="ss-scanline w-16" />
                  <SealMark size={56} ringText={'SHIPSEAL - '} />
                <span className="ss-scanline w-16" />
              </div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-success/90 mb-2">After</div>
              <p className="font-display text-xl md:text-2xl text-foreground">Compact memory, AI-ready context, cleaner handoff.</p>
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
          <SectionHeader title="Start free. Pay for what you need." lead="Run one package, a few, or everything." />
        </Reveal>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mt-14 max-w-6xl mx-auto">
          {PRICING_TIERS.map((tier, index) => (
            <Reveal key={tier.name} delay={index * 90} className="h-full">
              <div className={`glass rounded-3xl p-7 flex flex-col h-full transition-transform hover:-translate-y-1 ${tier.featured ? 'border-primary/50 shadow-glow' : ''}`}>
                <div className="font-display font-semibold">{tier.name}</div>
                <div className="text-3xl font-display font-bold mt-2">{tier.price}</div>
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
          <SectionHeader title="Contact ShipSeal." lead="Tell us about your project. This demo form stores nothing unless you open and send the email draft." />
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

const STEPS = [
  { title: 'Connect GitHub or upload ZIP', desc: 'Choose the source that fits your project.' },
  { title: 'ShipSeal performs static analysis', desc: 'Project structure, metadata, docs, config, and test signals are reviewed without executing code.' },
  { title: 'Generate agent-ready context', desc: 'Create compact memory, context compression, folder guidance, and specialized context packs.' },
  { title: 'Export reports or a Readiness PR', desc: 'Download Delivery Pack outputs or open a reviewed ShipSeal PR through the GitHub App.' },
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
    features: ['Sample project', 'Readiness preview', 'Example outputs'],
  },
  {
    name: 'Builder',
    price: 'Request access',
    featured: false,
    cta: 'Scan my repository',
    features: ['Repository scan', 'Context preview', 'Delivery Pack export'],
  },
  {
    name: 'AI Workspace Pro',
    price: 'Coming soon',
    featured: true,
    cta: 'Scan my repository',
    features: ['Agent Cost Optimizer', 'Context Compression Pack', 'Folder-level AGENTS', 'Specialized Context Packs', 'Skill & MCP recommendations', 'Delivery Pack export'],
  },
  {
    name: 'Agency / White-label',
    price: 'Coming soon',
    featured: false,
    cta: 'Contact us',
    features: ['Multi-project workspace flow', 'White-label-ready reports', 'Client handoff exports', 'Reviewed Readiness PR workflow'],
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
