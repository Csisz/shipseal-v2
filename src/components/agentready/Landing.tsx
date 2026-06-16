import { ArrowRight, Bot, ChevronDown, FlaskConical, Lock, Megaphone, PackageCheck, ScanLine, ShieldAlert, Stamp } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
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
              Seal your AI project before you ship it.
            </h1>
            <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Upload your project, choose the outcome you need, and ShipSeal prepares a cleaner, safer,
              easier-to-handoff delivery pack.
            </p>
          </div>

          {/* The scan input lives directly in the hero. */}
          <div className="mt-10 text-left animate-fade-in-up" style={{ animationDelay: '0.12s', animationFillMode: 'backwards' } as CSSProperties}>
            {scanSlot}
          </div>

          <div className="mt-8 flex flex-wrap justify-center items-center gap-x-6 gap-y-2 font-mono text-[11px] text-muted-foreground animate-fade-in" style={{ animationDelay: '0.25s', animationFillMode: 'backwards' } as CSSProperties}>
            <span className="inline-flex items-center gap-1.5"><Lock className="h-3 w-3 text-accent" /> Your code is never executed</span>
            <span className="inline-flex items-center gap-1.5"><ScanLine className="h-3 w-3 text-accent" /> Scans run in your browser</span>
            <button type="button" onClick={onSampleReport} className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline transition-colors">
              Or try a sample project
            </button>
          </div>
        </div>
      </section>

      <div className="container"><div className="ss-scanline" /></div>

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
          <SectionHeader title="Three steps. One package." />
        </Reveal>
        <div className="mt-14 grid md:grid-cols-3 gap-4 max-w-4xl mx-auto">
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

      {/* ======================== OUTPUT PREVIEW ======================== */}
      <section id="preview" className="container py-24 md:py-32 scroll-mt-20">
        <Reveal>
          <SectionHeader title="One package. Everything in its place." lead="ShipSeal quietly prepares a lot behind the scenes." />
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
              <span>Advanced details — explore the generated files</span>
              <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
            </summary>
            <div className="px-3 pb-3 md:px-5 md:pb-5">
              <DeliveryPackExplorer />
              <p className="mt-4 px-2 text-xs text-muted-foreground">
                You also get a client-ready report (PDF / HTML) and a fix pack you can add back to your project —
                manually or through a reviewed GitHub pull request. ShipSeal never pushes to your main branch.
              </p>
            </div>
          </details>
        </Reveal>
      </section>

      {/* ======================== BEFORE / AFTER ======================== */}
      <section id="before-after" className="container py-24 md:py-32 scroll-mt-20">
        <div className="max-w-3xl mx-auto">
          <Reveal>
            <div className="glass rounded-3xl p-8 md:p-10 text-center">
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-warning/90 mb-2">Before</div>
              <p className="font-display text-xl md:text-2xl text-muted-foreground">Prototype, scattered context, unclear risks.</p>
              <div className="my-7 flex items-center justify-center gap-3" aria-hidden="true">
                <span className="ss-scanline w-16" />
                <SealMark size={56} ringText={'SHIPSEAL · '} />
                <span className="ss-scanline w-16" />
              </div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-success/90 mb-2">After</div>
              <p className="font-display text-xl md:text-2xl text-foreground">Clear package, AI-ready context, safer handoff.</p>
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
        <div className="grid md:grid-cols-3 gap-4 mt-14 max-w-4xl mx-auto">
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

      {/* ========================= FINAL CTA ============================ */}
      <section className="container py-24 md:py-32">
        <Reveal>
          <div className="glass-strong rounded-3xl p-10 md:p-16 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-hero opacity-50 pointer-events-none" />
            <div className="relative">
              <div className="flex justify-center mb-6">
                <SealMark size={110} />
              </div>
              <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight">Ready when your project is.</h2>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Button size="lg" onClick={onScrollScan} className="bg-gradient-primary border-0 shadow-glow hover:opacity-90">
                  Scan my project <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
                <Button size="lg" variant="outline" onClick={onSampleReport}>
                  Try a sample project
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
            <span>ShipSeal — turn AI-built projects into project-ready packages.</span>
          </div>
          <div className="font-mono">ShipSeal MVP v{SHIPSEAL_VERSION}</div>
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

const STEPS = [
  { title: 'Upload your project', desc: 'ZIP or GitHub link. Nothing is executed.' },
  { title: 'Choose your goal', desc: 'One simple goal - or everything at once.' },
  { title: 'Download your ShipSeal pack', desc: 'A clean, ready-to-use project package.' },
];

const PACKAGE_GROUPS = [
  { icon: PackageCheck, title: 'Handoff', desc: 'Reports and summaries' },
  { icon: Bot, title: 'AI guidance', desc: 'Files AI tools understand' },
  { icon: FlaskConical, title: 'Tests', desc: 'Failure checks and QA' },
  { icon: ShieldAlert, title: 'Risk notes', desc: 'What to fix before shipping' },
  { icon: Megaphone, title: 'Product notes', desc: 'Explain and present it' },
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
    name: 'Free Scan',
    price: 'Free',
    featured: false,
    cta: 'Scan for free',
    features: ['Project overview', 'Simple readiness score', 'Key findings'],
  },
  {
    name: 'Individual Packs',
    price: 'from 49 EUR',
    featured: false,
    cta: 'Choose a pack',
    features: ['One package of your choice', 'All generated files included', 'Re-run after fixes'],
  },
  {
    name: 'Full ShipSeal Package',
    price: '149 EUR',
    featured: true,
    cta: 'Get the full package',
    features: ['All three paths together', 'Client-ready report (PDF / HTML)', 'Readiness score + fix pack'],
  },
];

const DISCLAIMERS = [
  'AI usage and transparency notes are drafts and questions for legal review — not legal advice or compliance certification.',
  'The risk check highlights obvious issues. It is not a full production security audit.',
  'ShipSeal reads your project structure and selected text — it never runs your code.',
  'Everything ShipSeal generates supports expert review. It does not replace it.',
];
