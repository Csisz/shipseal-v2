import type { ReactNode } from 'react';
import { Github, Lock, ScanLine, ShieldCheck } from 'lucide-react';
import { SecondaryPageShell } from '@/components/agentready/SecondaryPageShell';

const READS = ['File paths', 'package manifests', 'README', 'instruction files', 'selected config', 'tests', 'workflow signals'];
const IGNORES = ['node_modules', 'dist', 'build', '.next', 'coverage', 'caches', 'binaries', 'secret-looking files'];

export default function Security() {
  return (
    <SecondaryPageShell
      eyebrow="Security"
      title="What ShipSeal does, and does not do."
      description="ShipSeal performs static readiness analysis and builds repository intelligence without running imported application code."
    >
      <div className="grid gap-3 md:grid-cols-3">
        <BoundaryCard icon={<Lock className="h-5 w-5" />} title="Code is never executed" text="Package scripts, tests, builds, migrations, and user application code are not run." />
        <BoundaryCard icon={<ScanLine className="h-5 w-5" />} title="Static scan only" text="The scanner reads structure, metadata, and selected bounded documentation and configuration signals." />
        <BoundaryCard icon={<ShieldCheck className="h-5 w-5" />} title="Secrets stay out of scope" text="Secret-looking files are flagged by path and should be redacted before upload whenever possible." />
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2">
        <ListPanel title="What ShipSeal reads" items={READS} />
        <ListPanel title="What ShipSeal ignores" items={IGNORES} />
      </div>

      <section className="mt-6 rounded-2xl border border-primary/25 bg-primary/5 p-5 md:p-6">
        <div className="flex items-start gap-3">
          <Github className="mt-1 h-5 w-5 shrink-0 text-primary-glow" aria-hidden="true" />
          <div>
            <h2 className="font-display text-xl font-semibold">GitHub App permissions</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Access is limited to approved repositories and permissions. ShipSeal can scan a selected ref and, after confirmation, create a reviewed Pull Request. It does not merge or push directly to main.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-border/55 bg-secondary/10 p-5 md:p-6">
        <h2 className="font-display text-xl font-semibold">Deep analysis boundary</h2>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
          <li>Provider calls happen server-side with bounded file, excerpt, context, token, output, timeout, and attempt limits.</li>
          <li>Common credentials, authorization headers, connection strings, environment values, keys, and certificates are redacted or excluded before transmission.</li>
          <li>Redaction is best-effort: ShipSeal is not a secret scanner, and users should not submit live credentials.</li>
          <li>Deep analysis does not execute code, mutate repositories, override deterministic evidence, certify compliance, or mark work Applied or Verified.</li>
        </ul>
      </section>

      <details className="group mt-4 rounded-2xl border border-border/55 bg-background/25">
        <summary className="cursor-pointer px-5 py-4 text-sm font-medium text-muted-foreground hover:text-foreground">Account and saved-project security</summary>
        <div className="border-t border-border/45 px-5 py-5 text-sm leading-relaxed text-muted-foreground">
          GitHub OAuth identity avoids stored passwords. Opaque sessions use secure HTTP-only cookies and server-side token hashes. Persistence requests verify the session and project owner. GitHub tokens, provider keys, raw provider responses, archives, and environment values are not stored in browser-accessible project records.
        </div>
      </details>

      <p className="mt-6 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-muted-foreground">
        ShipSeal provides technical readiness guidance and documentation support. It does not provide legal advice or compliance certification.
      </p>
    </SecondaryPageShell>
  );
}

function BoundaryCard({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <article className="rounded-2xl border border-border/55 bg-secondary/10 p-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary-glow">{icon}</div>
      <h2 className="mt-4 font-display text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
    </article>
  );
}

function ListPanel({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-2xl border border-border/55 bg-secondary/10 p-5">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {items.map(item => <span key={item} className="rounded-full border border-border/50 bg-background/30 px-3 py-1.5 text-xs text-muted-foreground">{item}</span>)}
      </div>
    </section>
  );
}
