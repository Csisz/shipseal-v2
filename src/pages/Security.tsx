import { Lock, ScanLine, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SecondaryPageShell } from '@/components/agentready/SecondaryPageShell';
import { PublicPageMetadata } from '@/components/trust/PublicPageMetadata';
import { SHIPSEAL_LEGAL_DISCLAIMER, SHIPSEAL_STATIC_ANALYSIS_CLAIM } from '@/lib/trust/publicTrust';

const READS = ['Repository paths', 'manifests', 'README and docs', 'agent instructions', 'selected config', 'tests', 'workflow signals'];
const EXCLUDES = ['node_modules', 'dist/build/out', '.next and caches', 'coverage', 'vendor/target', 'binaries/media', 'unsafe archive entries'];

export default function Security() {
  return (
    <>
      <PublicPageMetadata title="Security" description="Implemented ShipSeal repository, account, AI, database, GitHub, and payment security boundaries." path="/security" />
      <SecondaryPageShell eyebrow="Security" title="Implemented boundaries, without certification theater." description="These are controls present in the current ShipSeal implementation. They are not a certification, penetration-test result, or guarantee that every risk is eliminated.">
        <div className="grid gap-3 md:grid-cols-3">
          <Boundary icon={<Lock />} title="Static repository analysis" text={SHIPSEAL_STATIC_ANALYSIS_CLAIM} />
          <Boundary icon={<ScanLine />} title="Bounded acquisition" text="GitHub scans select commit-bound blobs. ZIP scans use bounded random-access reads and reject unsafe archive structures." />
          <Boundary icon={<ShieldCheck />} title="Owner-scoped data" text="Account, project, scan, Future, usage, and billing APIs authorize against the server-side session and account owner." />
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <ListPanel title="Static evidence commonly read" items={READS} />
          <ListPanel title="Excluded or rejected" items={EXCLUDES} />
        </div>

        <SecuritySection title="Repository-input boundary">
          ShipSeal does not install dependencies, run package scripts, execute tests or builds, evaluate imported JavaScript, run migrations, dynamically import repository modules, or pass repository code to a shell. Parsing file names, metadata, manifests, documentation, configuration, and selected source excerpts is static analysis, not execution.
        </SecuritySection>

        <SecuritySection title="Accounts and database">
          GitHub OAuth is used for identity instead of a ShipSeal password. Production sessions use random opaque tokens; only a SHA-256 token hash is stored server-side. Session cookies are HTTP-only, SameSite=Lax, Secure in deployed HTTPS environments, and scoped to the host. Database tables use row-level security, revoke PUBLIC and browser-role privileges, and are accessed by owner-scoped server routes.
        </SecuritySection>

        <SecuritySection title="AI processing">
          Provider credentials remain server-side. Selected context is limited by file, byte, token, output, attempt, timeout, and concurrency policies. Common sensitive-value patterns are redacted or excluded before transmission, but this is best-effort and is not a substitute for a dedicated secret scanner. Repository excerpts are treated as untrusted evidence. Validated Future results are persisted for recovery; prompts, API keys, and raw source archives are not persisted with project snapshots.
        </SecuritySection>

        <SecuritySection title="GitHub and repository changes">
          Normal scanning requires read access and does not write. ShipSeal writes generated files only after a separate user-confirmed Pull Request action, on a non-main branch, and never merges the Pull Request. See the <Link className="text-primary underline-offset-4 hover:underline" to="/trust/github">GitHub permissions explanation</Link> for the exact implemented boundaries.
        </SecuritySection>

        <SecuritySection title="Payments and secrets">
          Stripe webhook signatures are verified before subscription state updates. Checkout and Customer Portal sessions are created by authenticated server endpoints from an allowlisted price and trusted return origin. Stripe handles payment-card data; ShipSeal stores no card number. Stripe, GitHub, database, and AI-provider secrets are server-only and are not exposed through Vite variables.
        </SecuritySection>

        <SecuritySection title="What is not claimed">
          ShipSeal does not claim SOC 2 or ISO certification, end-to-end encryption, zero-knowledge processing, a completed penetration test, perfect secret detection, provider zero retention, or legal/compliance approval.
        </SecuritySection>

        <p className="mt-6 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-muted-foreground">{SHIPSEAL_LEGAL_DISCLAIMER}</p>
      </SecondaryPageShell>
    </>
  );
}

function Boundary({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <article className="rounded-2xl border border-border/55 bg-secondary/10 p-5"><div className="text-primary-glow [&>svg]:h-5 [&>svg]:w-5">{icon}</div><h2 className="mt-4 font-display text-lg font-semibold">{title}</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p></article>;
}

function ListPanel({ title, items }: { title: string; items: string[] }) {
  return <section className="rounded-2xl border border-border/55 bg-secondary/10 p-5"><h2 className="font-display text-lg font-semibold">{title}</h2><div className="mt-4 flex flex-wrap gap-2">{items.map(item => <span key={item} className="rounded-full border border-border/50 bg-background/30 px-3 py-1.5 text-xs text-muted-foreground">{item}</span>)}</div></section>;
}

function SecuritySection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mt-4 rounded-2xl border border-border/55 bg-background/25 p-5 text-sm leading-relaxed text-muted-foreground md:p-6"><h2 className="mb-3 font-display text-xl font-semibold text-foreground">{title}</h2><p>{children}</p></section>;
}
