import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Euro,
  FileArchive,
  FileText,
  GitBranch,
  History,
  Lock,
  Mail,
  Rocket,
  Scale,
  ScanLine,
  ShieldCheck,
  Stamp,
  Users,
} from 'lucide-react';
import { useState, type CSSProperties } from 'react';
import { Button } from '@/components/ui/button';
import { SHIPSEAL_VERSION } from '@/lib/version';
import { FounderAuditRequestDialog } from './FounderAuditRequestForm';
import { ScoreGauge } from './ScoreGauge';
import { DeliveryPackExplorer } from './landing/DeliveryPackExplorer';
import { Reveal } from './landing/Reveal';
import { SealChamberHero } from './landing/SealChamberHero';
import { SealMark } from './landing/SealMark';

interface Props {
  onSampleReport: () => void;
  onScrollScan: () => void;
}

export function Landing({ onSampleReport, onScrollScan }: Props) {
  const [auditDialogOpen, setAuditDialogOpen] = useState(false);

  return (
    <>
      {/* ============================= HERO ============================= */}
      <section className="relative pt-32 pb-16 md:pt-40 md:pb-24 overflow-hidden">
        <div className="absolute inset-0 bg-grid pointer-events-none" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[140px] pointer-events-none" />
        <div className="container relative grid lg:grid-cols-[1fr_1.1fr] gap-12 items-center">
          <div className="animate-fade-in-up">
            <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1.5 text-xs mb-6">
              <ScanLine className="h-3 w-3 text-accent" />
              <span className="text-muted-foreground font-mono text-[11px]">AI Project Delivery Pack Generator {'\u00B7'} local-first {'\u00B7'} no code execution</span>
            </div>
            <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.02] tracking-tight text-gradient">
              Seal your AI project before you ship it.
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl">
              ShipSeal scans your repository, scores its handoff readiness with deterministic checks, and generates a structured, client-ready Delivery Pack — agent instructions, tests, governance, AI Act readiness, and the report your client actually reads.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" onClick={onScrollScan} className="bg-gradient-primary border-0 shadow-glow hover:opacity-90">
                Scan a project <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={onSampleReport} className="border-border/80">
                Try sample project
              </Button>
              <Button size="lg" variant="ghost" onClick={() => setAuditDialogOpen(true)} className="text-muted-foreground hover:text-foreground">
                Request founder-reviewed audit
              </Button>
            </div>
            <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><Lock className="h-3 w-3 text-accent" /> Uploaded code is never executed</span>
              <span className="inline-flex items-center gap-1.5"><ScanLine className="h-3 w-3 text-accent" /> Scans run in your browser</span>
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3 w-3 text-accent" /> Deterministic score</span>
            </div>
          </div>

          <div className="relative animate-fade-in lg:animate-scale-in">
            <SealChamberHero />
          </div>
        </div>
      </section>

      <div className="container"><div className="ss-scanline" /></div>

      {/* ====================== THE HANDOFF PROBLEM ===================== */}
      <section id="problem" className="container py-20 md:py-24">
        <Reveal>
          <SectionHeader
            eyebrow="The handoff problem"
            title="The demo looks finished. The handoff isn't."
            lead="AI prototypes impress in a screen share — then the client asks for documentation, tests, transparency wording, and proof it was checked. That gap is where credibility, payment, and follow-up work are lost."
          />
        </Reveal>
        <Reveal className="mt-12 max-w-3xl mx-auto" delay={120}>
          {/* The shiny demo card */}
          <div className="relative z-10 glass-strong rounded-2xl p-5 md:p-6 shadow-elegant">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-gradient-primary flex items-center justify-center shrink-0">
                  <Rocket className="h-4 w-4 text-primary-foreground" />
                </div>
                <div>
                  <div className="font-display font-semibold">Client demo</div>
                  <div className="text-xs text-muted-foreground">"Looks great, when can we go live?"</div>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 border border-success/40 text-success px-3 py-1 text-xs font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" /> Impressive
              </span>
            </div>
          </div>
          {/* The risks underneath */}
          <div className="relative -mt-1 mx-3 md:mx-6 rounded-b-2xl border border-t-0 border-warning/25 bg-warning/[0.04] px-4 pt-6 pb-5">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-warning/80 mb-3">What's underneath</div>
            <div className="flex flex-wrap gap-2">
              {HIDDEN_RISKS.map((risk, index) => (
                <span
                  key={risk}
                  className="ss-risk inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-secondary/60 px-2.5 py-1.5 font-mono text-[11px] text-foreground/80"
                  style={{ '--risk-delay': `${0.15 + index * 0.1}s` } as CSSProperties}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-warning shrink-0" />
                  {risk}
                </span>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* ===================== WHAT SHIPSEAL GENERATES =================== */}
      <section id="generates" className="container py-20 md:py-24">
        <Reveal>
          <SectionHeader
            eyebrow="What ShipSeal generates"
            title="One scan. A complete Delivery Pack."
            lead="Not a checklist — a structured ZIP with seven folders and score.json, ready to hand to a client, a reviewer, or the next AI coding agent. Explore what each folder contains:"
          />
        </Reveal>
        <Reveal className="mt-10" delay={120}>
          <DeliveryPackExplorer />
        </Reveal>
        <Reveal className="mt-6 flex flex-wrap items-center gap-4" delay={200}>
          <p className="text-sm text-muted-foreground">
            Plus a client-ready PDF / HTML report, and a separate Readiness Fix Pack with files like AGENTS.md and SECURITY.md you can add back to the repository — manually or via a reviewed GitHub Pull Request. ShipSeal never pushes to main.
          </p>
        </Reveal>
      </section>

      {/* ========================= SCORE ENGINE ========================= */}
      <section id="score" className="container py-20 md:py-24">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <Reveal>
            <SectionHeader
              eyebrow="The readiness engine"
              title="A deterministic go/no-go signal, not AI-generated confidence."
              inline
            />
            <p className="text-muted-foreground mt-4">
              The ShipSeal score is calculated from concrete repository signals across six categories — structure and documentation, build/test/quality gates, agent instruction readiness, security and secret handling, token efficiency, and team workflow. A narrative explains the result; deterministic checks decide it.
            </p>
            <div className="mt-6 rounded-xl border border-border/70 bg-[hsl(240_20%_4%)] p-4 font-mono text-xs md:text-sm">
              <span className="text-muted-foreground">// the readiness rule</span><br />
              <span className="text-accent">sealed</span> = score {'\u2265'} <span className="text-primary-glow">85</span> <span className="text-muted-foreground">&&</span> criticalBlockers === <span className="text-primary-glow">0</span>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              Critical blockers are non-negotiable: suspicious secret files like committed <span className="font-mono text-foreground/80">.env</span> keys, no build/test/lint signals, no recognizable stack, or a repository drowned in generated files. One blocker means no seal — regardless of score.
            </p>
          </Reveal>
          <Reveal delay={150}>
            <div className="glass-strong rounded-3xl p-7 md:p-8 relative">
              <div className="absolute -inset-4 bg-gradient-primary/20 blur-2xl rounded-full -z-10" />
              <div className="flex items-center justify-center mb-7">
                <ScoreGauge score={82} size={200} />
              </div>
              <div className="space-y-2.5">
                {LEVELS.map((level, index) => (
                  <div key={level.label} className="flex items-center gap-3">
                    <div className="w-16 font-mono text-[11px] text-muted-foreground shrink-0">{level.range}</div>
                    <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div
                        className={`ss-bar h-full ${level.bar}`}
                        style={{ width: level.width, '--bar-delay': `${index * 0.12}s` } as CSSProperties}
                      />
                    </div>
                    <div className="w-36 text-xs md:text-sm shrink-0">{level.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ===================== SAFETY AND PRIVACY ======================= */}
      <section id="safety" className="container py-20 md:py-24">
        <Reveal>
          <SectionHeader
            eyebrow="Trust and safety"
            title="Built for the most sensitive thing you own: client code."
          />
        </Reveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-10">
          {SAFETY.map((item, index) => (
            <Reveal key={item.title} delay={index * 80}>
              <div className="glass rounded-2xl p-6 h-full hover:border-accent/40 transition-colors group">
                <item.icon className="h-5 w-5 text-accent mb-3 group-hover:scale-110 transition-transform" />
                <div className="font-display font-semibold">{item.title}</div>
                <div className="text-sm text-muted-foreground mt-1.5">{item.desc}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ===================== AI ACT READINESS ========================= */}
      <section id="aiact" className="container py-20 md:py-24">
        <div className="grid lg:grid-cols-[auto_1fr] gap-10 items-start">
          <Reveal className="hidden lg:block">
            <SealMark size={150} ringText={'AI ACT READINESS \u00B7 NOT LEGAL ADVICE \u00B7 PREPARATION \u00B7 '} />
          </Reveal>
          <div>
            <Reveal>
              <SectionHeader
                eyebrow="AI Act readiness"
                title="Organized for the legal conversation. Not a replacement for it."
                inline
              />
              <p className="text-muted-foreground mt-4 max-w-2xl">
                ShipSeal prepares the technical and product side of AI Act readiness: a preliminary readiness checklist, a transparency notice draft, human oversight questions, and concrete legal review questions you can bring to a qualified professional. It's preliminary readiness screening that makes the expert conversation faster — not a verdict.
              </p>
            </Reveal>
            <Reveal className="mt-6" delay={120}>
              <div className="rounded-xl border border-warning/30 bg-warning/[0.06] p-4 flex gap-3">
                <Scale className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground">
                  ShipSeal provides technical and product-side readiness preparation. It does not provide legal advice, legal opinions, or formal compliance certification.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ========================= AUDIENCES ============================ */}
      <section id="who" className="container py-20 md:py-24">
        <Reveal>
          <SectionHeader eyebrow="Who it is for" title="For the people whose name is on the handoff." />
        </Reveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-10">
          {AUDIENCES.map((item, index) => (
            <Reveal key={item} delay={index * 70}>
              <div className="glass rounded-2xl p-5 h-full hover:border-primary/40 transition-colors">
                <Users className="h-5 w-5 text-accent mb-3" />
                <div className="font-display text-sm font-semibold">{item}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ========================== PRICING ============================= */}
      <section id="pricing" className="container py-20 md:py-24">
        <Reveal>
          <SectionHeader eyebrow="Pilot pricing" title="Validation packages for the MVP phase." />
        </Reveal>
        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4 mt-10">
          {PRICING_TIERS.map((tier, index) => (
            <Reveal key={tier.name} delay={index * 90} className="h-full">
              <div className={`glass rounded-2xl p-6 flex flex-col h-full transition-transform hover:-translate-y-1 ${tier.featured ? 'border-primary/50 shadow-glow' : ''}`}>
                <div className="flex items-center gap-2 mb-2">
                  <tier.icon className="h-5 w-5 text-primary-glow" />
                  <div className="font-display font-semibold">{tier.name}</div>
                </div>
                <div className="text-2xl font-display font-bold">{tier.price}</div>
                <ul className="mt-5 space-y-2 text-sm text-muted-foreground flex-1">
                  {tier.features.map(feature => (
                    <li key={feature} className="flex gap-2">
                      <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal className="mt-6" delay={150}>
          <div className="rounded-2xl border border-border/60 bg-secondary/25 p-5 flex flex-col md:flex-row md:items-center gap-4">
            <div className="min-w-0 flex-1">
              <div className="font-display font-semibold">Want a founder-reviewed audit?</div>
              <p className="text-sm text-muted-foreground mt-1">Send your contact details and a short project note. We will review whether ShipSeal is a good fit for your AI project handoff.</p>
            </div>
            <Button onClick={() => setAuditDialogOpen(true)} className="bg-gradient-primary border-0 shadow-glow hover:opacity-90">
              <Mail className="h-4 w-4 mr-1.5" /> Request founder-reviewed audit
            </Button>
          </div>
        </Reveal>
      </section>

      {/* ========================= DISCLAIMER =========================== */}
      <section id="disclaimer" className="container py-20 md:py-24">
        <Reveal>
          <SectionHeader eyebrow="Important disclaimer" title="ShipSeal supports review. It does not replace experts." />
        </Reveal>
        <div className="grid md:grid-cols-2 gap-4 mt-10">
          {DISCLAIMERS.map((item, index) => (
            <Reveal key={item} delay={index * 70}>
              <div className="glass rounded-2xl p-5 flex gap-3 h-full">
                <ShieldCheck className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground">{item}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ========================= FINAL CTA ============================ */}
      <section className="container py-24">
        <Reveal>
          <div className="glass-strong rounded-3xl p-10 md:p-16 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-hero opacity-50 pointer-events-none" />
            <div className="relative">
              <div className="flex justify-center mb-6">
                <SealMark size={110} />
              </div>
              <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight">Seal your next AI handoff.</h2>
              <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
                Scan a repository ZIP or import a public GitHub repo, review the score and blockers, and walk into the client handoff with a Delivery Pack instead of a promise.
              </p>
              <div className="mt-7 flex flex-wrap justify-center gap-3">
                <Button size="lg" onClick={onScrollScan} className="bg-gradient-primary border-0 shadow-glow hover:opacity-90">
                  Generate Delivery Pack <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
                <Button size="lg" variant="outline" onClick={onSampleReport}>
                  Try sample project
                </Button>
                <Button size="lg" variant="outline" onClick={() => setAuditDialogOpen(true)}>
                  Request founder-reviewed audit
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
            <span>ShipSeal - AI Project Delivery Pack Generator.</span>
          </div>
          <div className="font-mono">ShipSeal MVP v{SHIPSEAL_VERSION}</div>
        </div>
      </footer>

      <FounderAuditRequestDialog open={auditDialogOpen} onOpenChange={setAuditDialogOpen} />
    </>
  );
}

function SectionHeader({ eyebrow, title, lead, inline }: { eyebrow: string; title: string; lead?: string; inline?: boolean }) {
  return (
    <div className={inline ? '' : 'max-w-3xl'}>
      <div className="flex items-center gap-3 mb-3">
        <span className="ss-scanline w-8 shrink-0" />
        <span className="text-xs font-mono uppercase tracking-[0.18em] text-primary-glow">{eyebrow}</span>
      </div>
      <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight">{title}</h2>
      {lead ? <p className="text-muted-foreground mt-4">{lead}</p> : null}
    </div>
  );
}

const HIDDEN_RISKS = [
  'no eval tests',
  'no red-team checks',
  'no agent instructions',
  '.env committed to the repo',
  'transparency notice missing',
  'no client handoff report',
  'no testing strategy',
  'governance: undocumented',
];

const AUDIENCES = [
  'AI freelancers',
  'Small AI agencies',
  'No-code/low-code AI builders',
  'Indie SaaS teams',
  'Consultants delivering AI automations to clients',
];

const PRICING_TIERS = [
  { name: 'Free Preview', price: 'Free', icon: ClipboardCheck, featured: false, features: ['readiness preview', 'limited recommendations', 'sample output'] },
  { name: 'Starter Report', price: '49 EUR', icon: FileText, featured: false, features: ['AGENTS.md', 'CLAUDE.md', '30 eval tests', 'mini AI Act checklist'] },
  { name: 'Pro Agency Report', price: '149 EUR', icon: Rocket, featured: true, features: ['full Delivery Pack', 'skills pack', 'red-team prompts', 'MCP governance', 'client handoff report'] },
  { name: 'Founder-reviewed Audit', price: '499 EUR+', icon: Euro, featured: false, features: ['manual expert review', 'improved client report', '60-minute review call'] },
];

const LEVELS = [
  { range: '0-39', label: 'Not Ready', bar: 'bg-destructive', width: '20%' },
  { range: '40-64', label: 'Partially Ready', bar: 'bg-warning', width: '45%' },
  { range: '65-84', label: 'Almost Ready', bar: 'bg-accent', width: '70%' },
  { range: '85-94', label: 'AI Coding Ready', bar: 'bg-success', width: '88%' },
  { range: '95-100', label: 'ShipSeal Certified', bar: 'bg-gradient-primary', width: '98%' },
];

const DISCLAIMERS = [
  'ShipSeal does not provide legal advice.',
  'AI Act readiness output is a preliminary technical and product-side checklist.',
  'Security output is not a full production security audit.',
  'The report is designed to support client handover and further expert review.',
];

const SAFETY = [
  { icon: Lock, title: 'No code execution', desc: 'ShipSeal reads repository structure and selected text metadata only. Uploaded or imported code is never run.' },
  { icon: ScanLine, title: 'Local-first scanning', desc: 'ZIP scanning happens in your browser. Your client\u2019s repository does not need to leave your machine for a scan.' },
  { icon: History, title: 'Metadata-only history', desc: 'Recent scans store lightweight source and score metadata, not raw files or code.' },
  { icon: FileArchive, title: 'Sanitized repo context', desc: 'The exported context pack is structured and sanitized; external AI providers should only ever receive sanitized context in future versions.' },
  { icon: GitBranch, title: 'Reviewed PRs only', desc: 'Readiness Fix Pack changes go to a separate branch and a pull request for human review. ShipSeal never pushes to main.' },
  { icon: ShieldCheck, title: 'Deterministic outputs', desc: 'The same repository state produces the same score, the same blockers, and the same go/no-go signal.' },
];
