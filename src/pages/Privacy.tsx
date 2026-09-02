import { Database, FileArchive, Github, Sparkles } from 'lucide-react';
import { SecondaryPageShell } from '@/components/agentready/SecondaryPageShell';
import { PublicPageMetadata } from '@/components/trust/PublicPageMetadata';
import {
  SHIPSEAL_DEEP_ANALYSIS_DISCLOSURE,
  SHIPSEAL_LEGAL_DISCLAIMER,
  SHIPSEAL_PUBLIC_CONTACT_EMAIL,
  SHIPSEAL_PUBLIC_OPERATOR_NAME,
  SHIPSEAL_STATIC_ANALYSIS_CLAIM,
} from '@/lib/trust/publicTrust';

export default function Privacy() {
  return (
    <>
      <PublicPageMetadata title="Privacy" description="How ShipSeal handles account, repository, AI, project, and billing data." path="/privacy" />
      <SecondaryPageShell
        eyebrow="Privacy"
        title="Repository data, explained plainly."
        description="This page describes how ShipSeal currently processes account, repository, AI, project, and billing data."
      >
        <section className="grid gap-3 md:grid-cols-2" aria-label="Primary data boundaries">
          <FactCard icon={<Github />} title="GitHub sources">
            Connected scans use a GitHub installation token on the server to resolve an immutable commit, discover its tree, and read selected blobs. Public URL scans use the same selective evidence contract. ShipSeal does not clone or build the repository.
          </FactCard>
          <FactCard icon={<FileArchive />} title="Local ZIP sources">
            The archive is indexed and selectively decompressed in your browser for the deterministic scan. The archive itself is not uploaded by that scan. If you explicitly start Deep Analysis, selected evidence derived from the ZIP is sent to ShipSeal's server and configured AI provider.
          </FactCard>
          <FactCard icon={<Database />} title="Private project history">
            While signed in, a completed scan is automatically saved as a private derived snapshot. It can contain repository identity, paths, file metadata, evidence findings, generated guidance, coverage, scan history, and Future results. ShipSeal does not persist the repository archive or the scanner's original text-content map in that snapshot.
          </FactCard>
          <FactCard icon={<Sparkles />} title="Deep Analysis">
            {SHIPSEAL_DEEP_ANALYSIS_DISCLOSURE} Redaction is not a dedicated secret scanner and may not detect every sensitive value. Do not intentionally provide credentials or secrets.
          </FactCard>
        </section>

        <TrustSection title="Information ShipSeal processes">
          <ul className="grid gap-3 md:grid-cols-2">
            <li><strong>Account:</strong> GitHub user ID, display name, avatar URL, and an email when GitHub returns one.</li>
            <li><strong>Repository:</strong> source identity, commit/ref, paths, file sizes, selected text evidence, exclusions, and coverage counters.</li>
            <li><strong>Derived intelligence:</strong> readiness results, repository maps, recommendations, verification relationships, exports, and canonical Future analyses.</li>
            <li><strong>Usage and billing:</strong> entitlements, Deep Analysis operations and adjustments, Stripe customer/subscription identifiers, status, billing period, and webhook event identifiers.</li>
            <li><strong>Operations:</strong> request IDs, hashed/fingerprinted repository identities, stage state, timing, counts, and safe error categories in database records or hosting logs.</li>
            <li><strong>Contact:</strong> the current landing contact form prepares an email in your mail client; it does not submit the entered message to ShipSeal's server.</li>
          </ul>
        </TrustSection>

        <TrustSection title="Deterministic scan and AI processing" id="deterministic-ai">
          <p>{SHIPSEAL_STATIC_ANALYSIS_CLAIM}</p>
          <p>Repository indexing, static Repository Intelligence, and Project Universe are deterministic. Deep Analysis begins only after an explicit user action. ShipSeal selects bounded evidence, applies server-side context limits and best-effort redaction, then sends that prepared context to the configured OpenAI-compatible provider endpoint. Provider identity, processing, training use, and retention depend on the deployment's provider contract; ShipSeal does not promise provider zero retention or no training here.</p>
          <p>Large repositories may use a deterministic bounded scan. In that state, an item that was not observed is not treated as confirmed missing.</p>
        </TrustSection>

        <TrustSection title="Storage, cookies, and retention">
          <ul className="space-y-3">
            <li>The production account session is an opaque, HTTP-only, SameSite=Lax, Secure cookie. Its database record and cookie expire after 14 days unless revoked sooner. OAuth state cookies expire after 10 minutes.</li>
            <li>Browser local storage holds the theme preference, a metadata-only recent-scan list (up to five items), and the selected GitHub installation ID. These can be cleared through browser controls; recent scan history also has an in-product clear action.</li>
            <li>ShipSeal has no implemented analytics or marketing tracker and sets no analytics or marketing cookie. Google-hosted fonts are requested by public pages and may expose ordinary request metadata to Google.</li>
            <li>Account projects, snapshots, Future results, and usage records currently have no automatic age-based deletion window. They remain until the applicable project, scan, or account deletion path is used.</li>
            <li>Hosting logs and infrastructure backups follow the hosting/database provider configuration; no fixed ShipSeal retention duration is encoded. AI-provider retention is contract-dependent and must be reviewed for the configured provider.</li>
          </ul>
        </TrustSection>

        <TrustSection title="Payments">
          <p>Stripe hosts Checkout and the Customer Portal and processes payment-card information. ShipSeal does not receive or store card numbers. ShipSeal stores Stripe customer and subscription identifiers, price/status/period information, and webhook event identifiers so it can synchronize the existing entitlement system.</p>
        </TrustSection>

        <TrustSection title="Deletion and external systems">
          <ul className="space-y-3">
            <li><strong>Scan deletion</strong> removes that saved scan snapshot and dependent verification relationships. Account-level AI operation history is not deleted by scan deletion.</li>
            <li><strong>Project deletion</strong> removes the project and its saved scan history. AI usage operations and durable Future records tied to the account remain until account deletion so billing and recovery history stays coherent.</li>
            <li><strong>Account deletion</strong> requires an active, trialing, or past-due Stripe subscription to be ended first. It removes ShipSeal projects, scans, Future/AI operations, usage adjustments, entitlements, sessions, and the local Stripe customer mapping; the ShipSeal user row is retained in anonymized form. Processed Stripe webhook event identifiers can remain linked only to that anonymized internal user ID for idempotency/audit.</li>
            <li>ShipSeal deletion does not remove GitHub repositories, installations, branches, or Pull Requests, and it does not delete Stripe's customer/payment records. Remove the GitHub App in GitHub and manage Stripe through the Customer Portal where needed.</li>
          </ul>
        </TrustSection>

        <TrustSection title="Service providers, rights, and contact">
          <p>Current implementation can involve the ShipSeal hosting platform (Vercel configuration), a configured PostgreSQL database provider, GitHub, Stripe, Google Fonts, and the configured OpenAI-compatible AI endpoint. The exact provider list depends on the deployed service configuration.</p>
          <p>To request access, correction, deletion, export, restriction, or another privacy right that applies to you, contact <a className="text-primary underline-offset-4 hover:underline" href={`mailto:${SHIPSEAL_PUBLIC_CONTACT_EMAIL}`}>{SHIPSEAL_PUBLIC_CONTACT_EMAIL}</a>.</p>
          {SHIPSEAL_PUBLIC_OPERATOR_NAME ? <p>Service operator: {SHIPSEAL_PUBLIC_OPERATOR_NAME}.</p> : null}
        </TrustSection>

        <p className="mt-6 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm leading-relaxed text-muted-foreground">{SHIPSEAL_LEGAL_DISCLAIMER}</p>
      </SecondaryPageShell>
    </>
  );
}

function FactCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <article className="rounded-2xl border border-border/55 bg-secondary/10 p-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary-glow [&>svg]:h-5 [&>svg]:w-5">{icon}</div>
      <h2 className="mt-4 font-display text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{children}</p>
    </article>
  );
}

function TrustSection({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="mt-4 scroll-mt-24 rounded-2xl border border-border/55 bg-background/25 p-5 text-sm leading-relaxed text-muted-foreground md:p-6 [&_p+p]:mt-3 [&_strong]:text-foreground">
      <h2 className="mb-4 font-display text-xl font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}
