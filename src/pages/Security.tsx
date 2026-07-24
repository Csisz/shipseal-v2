import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Github, Lock, ScanLine, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

const READS = ['README', 'package.json', 'tests', 'docs', 'CI files', 'AGENTS.md', 'env examples'];
const IGNORES = ['node_modules', 'dist', 'build', 'coverage', 'large generated folders', 'binaries where possible'];

export default function Security() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="border-b border-border/60 bg-secondary/20">
        <div className="container py-10 md:py-14">
          <div className="mb-8 flex items-center justify-between gap-4">
            <Button asChild variant="ghost" className="px-0 text-muted-foreground hover:text-foreground">
              <Link to="/"><ArrowLeft className="mr-2 h-4 w-4" /> Back to ShipSeal</Link>
            </Button>
            <ThemeToggle />
          </div>
          <div className="max-w-3xl">
            <div className="font-mono text-xs uppercase tracking-[0.22em] text-primary-glow">Security</div>
            <h1 className="mt-3 font-display text-4xl font-bold tracking-tight md:text-5xl">What ShipSeal does, and does not do.</h1>
            <p className="mt-5 text-lg text-muted-foreground">
              ShipSeal performs static readiness analysis. It helps you understand project signals without running imported code.
            </p>
          </div>
        </div>
      </section>

      <section className="container py-12 md:py-16">
        <div className="grid gap-4 md:grid-cols-3">
          <BoundaryCard icon={<Lock className="h-5 w-5" />} title="Code is never executed" text="ShipSeal does not run package scripts, tests, build commands, migrations, or user application code." />
          <BoundaryCard icon={<ScanLine className="h-5 w-5" />} title="Static scan only" text="The scanner reads structure, metadata, and selected documentation/configuration signals." />
          <BoundaryCard icon={<ShieldCheck className="h-5 w-5" />} title="Secrets are not intentionally exposed" text="Env examples can be used as readiness signals. Real secrets should be redacted before upload where possible." />
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <ListPanel title="What ShipSeal reads" items={READS} />
          <ListPanel title="What ShipSeal ignores" items={IGNORES} />
        </div>

        <div className="mt-8 rounded-2xl border border-border/60 bg-card/60 p-6 md:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary-glow">
              <Github className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-2xl font-semibold">GitHub App permissions</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                GitHub access is used so you can select a repository, scan the selected ref, and optionally create a
                reviewed Readiness PR. ShipSeal cannot merge that PR for you and does not push to your main branch.
                Access is limited by the repositories and permissions you approve in GitHub.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-warning/30 bg-warning/10 p-6 text-sm leading-6 text-muted-foreground">
          ShipSeal provides technical readiness guidance and documentation support. It does not provide legal advice
          or compliance certification.
        </div>
        <div className="mt-8 rounded-2xl border border-border/60 bg-card/60 p-6 md:p-8">
          <h2 className="font-display text-2xl font-semibold">Account and saved-project security</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">ShipSeal account identity uses GitHub OAuth without storing passwords. Opaque sessions use secure HTTP-only cookies and server-side token hashes. Every persistence request verifies the session and project owner. GitHub OAuth tokens, installation tokens, provider keys, raw provider responses, repository archives, and environment values are not stored in browser-accessible project records.</p>
        </div>
      </section>
    </main>
  );
}

function BoundaryCard({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/60 p-6">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary-glow">
        {icon}
      </div>
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
    </div>
  );
}

function ListPanel({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-secondary/20 p-6">
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {items.map(item => (
          <span key={item} className="rounded-full border border-border/60 bg-background/40 px-3 py-1.5 text-xs text-muted-foreground">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
