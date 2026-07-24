import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Database, FileArchive, Github, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

export default function Privacy() {
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
            <div className="font-mono text-xs uppercase tracking-[0.22em] text-primary-glow">Privacy</div>
            <h1 className="mt-3 font-display text-4xl font-bold tracking-tight md:text-5xl">Simple privacy boundaries.</h1>
            <p className="mt-5 text-lg text-muted-foreground">
              ShipSeal is designed to inspect project readiness signals without pretending to be a storage,
              hosting, or legal-compliance platform.
            </p>
          </div>
        </div>
      </section>

      <section className="container py-12 md:py-16">
        <div className="grid gap-4 md:grid-cols-2">
          <PrivacyCard
            icon={<FileArchive className="h-5 w-5" />}
            title="Uploaded ZIPs"
            text="ZIP uploads are used for the scan you start. ShipSeal reads project structure and selected text signals, then prepares reports and delivery pack outputs for you."
          />
          <PrivacyCard
            icon={<Github className="h-5 w-5" />}
            title="GitHub repositories"
            text="When you connect GitHub, ShipSeal uses the repository you select for scanning and, if you ask, for a reviewed Readiness PR."
          />
          <PrivacyCard
            icon={<Database className="h-5 w-5" />}
            title="Metadata"
            text="Readiness results may include repository name, branch or ref, file paths, package choice, scan evidence, output counts, and timestamps."
          />
          <PrivacyCard
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Short-lived processing"
            text="Anonymous scans remain local/session based. If you explicitly save a project, ShipSeal stores derived intelligence, safe repository metadata, and validated artifact outputs—not the ZIP archive or full source repository by default."
          />
        </div>

        <div className="mt-8 rounded-2xl border border-border/60 bg-card/60 p-6 md:p-8">
          <h2 className="font-display text-2xl font-semibold">User control</h2>
          <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
            <li>You choose whether to upload a ZIP, import a public GitHub URL, or connect the GitHub App.</li>
            <li>You choose the selected package before generating client reports or Delivery Pack files.</li>
            <li>You review generated files before using them in a client handoff or repository PR.</li>
            <li>Do not upload real secrets if you can avoid it. Use env examples or redacted values for review.</li>
            <li>Saved projects are private by default. You can delete individual scans, whole projects, or your ShipSeal account data.</li>
            <li>Opening saved history does not rescan the repository, call an AI provider, or mutate GitHub.</li>
            <li>Live records are deleted through ShipSeal; encrypted managed-database backups may retain data for the infrastructure provider's documented backup window.</li>
          </ul>
        </div>
      </section>
    </main>
  );
}

function PrivacyCard({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/60 p-6">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary-glow">
        {icon}
      </div>
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
    </div>
  );
}
