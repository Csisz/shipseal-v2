import type { ReactNode } from 'react';
import { Database, FileArchive, Github, ShieldCheck } from 'lucide-react';
import { SecondaryPageShell } from '@/components/agentready/SecondaryPageShell';

export default function Privacy() {
  return (
    <SecondaryPageShell
      eyebrow="Privacy"
      title="Simple privacy boundaries."
      description="ShipSeal inspects repository readiness signals without presenting itself as a storage, hosting, legal, or compliance platform."
    >
      <div className="grid gap-3 md:grid-cols-2">
        <PrivacyCard
          icon={<FileArchive className="h-5 w-5" />}
          title="Uploaded ZIPs"
          text="ZIP uploads are used for the scan you start. ShipSeal reads project structure and selected bounded text signals."
        />
        <PrivacyCard
          icon={<Github className="h-5 w-5" />}
          title="GitHub repositories"
          text="GitHub access is limited to approved repositories and the scan or reviewed Pull Request actions you request."
        />
        <PrivacyCard
          icon={<Database className="h-5 w-5" />}
          title="Metadata"
          text="Results can include repository identity, branch or ref, file paths, package choice, evidence, output counts, and timestamps."
        />
        <PrivacyCard
          icon={<ShieldCheck className="h-5 w-5" />}
          title="Short-lived processing"
          text="Anonymous scans remain local or session based. Saving a project stores validated derived intelligence and safe metadata, not the repository archive by default."
        />
      </div>

      <section className="mt-6 rounded-2xl border border-border/55 bg-secondary/10 p-5 md:p-6">
        <h2 className="font-display text-xl font-semibold">User control</h2>
        <ul className="mt-4 grid gap-3 text-sm leading-relaxed text-muted-foreground md:grid-cols-2">
          <li>You choose the source, outcome, generated files, and whether to save a project.</li>
          <li>You review generated files before using them in a handoff or repository Pull Request.</li>
          <li>Saved projects are private by default and can be deleted by scan, project, or account.</li>
          <li>Opening saved history does not rescan, call an AI provider, or mutate GitHub.</li>
        </ul>
      </section>

      <details className="group mt-4 rounded-2xl border border-border/55 bg-background/25">
        <summary className="cursor-pointer px-5 py-4 text-sm font-medium text-muted-foreground hover:text-foreground">Processing and retention details</summary>
        <div className="space-y-3 border-t border-border/45 px-5 py-5 text-sm leading-relaxed text-muted-foreground">
          <p>Do not upload real secrets when they can be replaced with examples or redacted values.</p>
          <p>Live records are deleted through ShipSeal. Encrypted managed-database backups can retain data for the infrastructure provider&apos;s documented backup window.</p>
          <p>ShipSeal provides technical readiness guidance. This is not legal advice.</p>
        </div>
      </details>
    </SecondaryPageShell>
  );
}

function PrivacyCard({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <article className="rounded-2xl border border-border/55 bg-secondary/10 p-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary-glow">{icon}</div>
      <h2 className="mt-4 font-display text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
    </article>
  );
}
