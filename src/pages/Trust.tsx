import { Brain, CreditCard, FileArchive, Github, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SecondaryPageShell } from '@/components/agentready/SecondaryPageShell';
import { PublicPageMetadata } from '@/components/trust/PublicPageMetadata';
import { SHIPSEAL_DEEP_ANALYSIS_DISCLOSURE, SHIPSEAL_STATIC_ANALYSIS_CLAIM } from '@/lib/trust/publicTrust';

const entries = [
  { icon: ShieldCheck, title: 'Security boundaries', body: SHIPSEAL_STATIC_ANALYSIS_CLAIM, to: '/security', action: 'Review implemented controls' },
  { icon: FileArchive, title: 'Privacy and persistence', body: 'Local ZIP scanning is browser-local; signed-in completed scans save private derived snapshots. Deep Analysis sends selected evidence only after explicit action.', to: '/privacy', action: 'See the data flow' },
  { icon: Github, title: 'GitHub permissions', body: 'Scanning is read-only. Repository changes are separate, confirmed Pull Request actions on a review branch.', to: '/trust/github', action: 'Review each permission' },
  { icon: Brain, title: 'AI processing', body: SHIPSEAL_DEEP_ANALYSIS_DISCLOSURE, to: '/privacy#deterministic-ai', action: 'Understand Deep Analysis' },
  { icon: CreditCard, title: 'Billing boundary', body: 'Stripe processes card details. ShipSeal synchronizes subscription identifiers and consumes a Deep Analysis unit only after durable completion.', to: '/terms', action: 'Review subscription terms' },
] as const;

export default function Trust() {
  return (
    <>
      <PublicPageMetadata title="Trust Center" description="A concise map of ShipSeal repository access, static scanning, AI processing, persistence, billing, and legal boundaries." path="/trust" />
      <SecondaryPageShell eyebrow="Trust Center" title="Know what crosses each boundary." description="ShipSeal separates static scanning, optional AI processing, private persistence, GitHub write actions, and payments so each can be understood on its own.">
        <div className="grid gap-3 md:grid-cols-2">
          {entries.map(({ icon: Icon, title, body, to, action }) => (
            <article key={title} className="flex h-full flex-col rounded-2xl border border-border/55 bg-secondary/10 p-5">
              <Icon className="h-5 w-5 text-primary-glow" aria-hidden="true" />
              <h2 className="mt-4 font-display text-xl font-semibold">{title}</h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
              <Link className="mt-5 inline-flex min-h-10 items-center text-sm font-medium text-primary hover:underline" to={to}>{action} →</Link>
            </article>
          ))}
        </div>
        <section id="ai-processing" className="mt-5 rounded-2xl border border-primary/25 bg-primary/5 p-5 md:p-6">
          <h2 className="font-display text-xl font-semibold">Deterministic first. AI only when requested.</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Repository indexing, static intelligence, and Universe do not start paid Product Strategist execution. A Pro user explicitly starts Repository Futures. Selected bounded evidence is prepared and redacted server-side, then sent to the configured provider. The allowance unit is charged only after a complete result is validated and durably recoverable.</p>
        </section>
      </SecondaryPageShell>
    </>
  );
}
