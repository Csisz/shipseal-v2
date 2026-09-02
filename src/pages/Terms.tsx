import { SecondaryPageShell } from '@/components/agentready/SecondaryPageShell';
import { PublicPageMetadata } from '@/components/trust/PublicPageMetadata';
import {
  SHIPSEAL_LEGAL_DISCLAIMER,
  SHIPSEAL_PUBLIC_CONTACT_EMAIL,
  SHIPSEAL_PUBLIC_GOVERNING_LAW,
  SHIPSEAL_PUBLIC_OPERATOR_NAME,
} from '@/lib/trust/publicTrust';

export default function Terms() {
  return (
    <>
      <PublicPageMetadata title="Terms of Service" description="ShipSeal service, repository authorization, subscription, AI allowance, and acceptable-use terms." path="/terms" />
      <SecondaryPageShell eyebrow="Terms" title="Terms of Service" description="Product-specific terms describing how ShipSeal accounts, repository access, subscriptions, and Deep Analysis currently work.">
        <Notice />
        <Term title="1. Service description">ShipSeal provides static repository indexing, deterministic repository intelligence, private project history, report/export tools, and—when entitled and explicitly started—AI-assisted Repository Futures. Features may use bounded evidence rather than every eligible file. ShipSeal does not execute imported repository code.</Term>
        <Term title="2. Accounts and responsibility">You are responsible for activity under your account, keeping access to your GitHub account secure, and providing accurate information. Do not share a ShipSeal session or try to access another user's projects.</Term>
        <Term title="3. Repository authorization">You may scan or connect only repositories and files you are authorized to process. A public URL must identify public content. GitHub App access is limited by the repositories and permissions approved in GitHub. Repository write actions are separate, explicit Pull Request actions and require your confirmation.</Term>
        <Term title="4. Acceptable use">Do not use ShipSeal to process illegal or malicious material, distribute malware, probe other users, evade provider safeguards, submit credentials intentionally, abuse AI/provider capacity, or infringe another person's rights. Imported code is treated as untrusted data and is not run.</Term>
        <Term title="5. Subscription and Deep Analysis">Free and Pro are the public plans. Pro is billed monthly at the price shown before Checkout and currently includes 10 Deep Analyses per Stripe billing period. A Deep Analysis unit is consumed only after a complete validated Future result is durably saved; technical failure before completion releases or refunds the allowance unit. That allowance correction is not a monetary subscription refund.</Term>
        <Term title="6. Cancellation and payment management">Stripe processes payment details and hosts subscription management. You can manage or cancel through the Customer Portal. Cancellation scheduled for period end preserves access through the paid period where Stripe reports the subscription active. A technical Deep Analysis allowance correction is not a monetary subscription refund. Any monetary refund or statutory payment right is governed by the policy and law applicable to the purchase.</Term>
        <Term title="7. Service availability and generated analysis">ShipSeal may be unavailable, rate-limited, incomplete, or wrong. Deterministic and AI-assisted outputs are evidence-based technical guidance, not guarantees. Review generated files and recommendations before using them, especially for security, privacy, legal, compliance, payment, or production work.</Term>
        <Term title="8. Repository and output rights">You retain the rights you already hold in repository material you provide. ShipSeal needs permission to process that material only to provide the requested service. ShipSeal does not claim ownership of your repository through these terms. Rights in generated material can also depend on applicable law and third-party provider terms.</Term>
        <Term title="9. Suspension and termination">Access may be limited for abuse, security risk, non-payment, or violation of the final terms. You may delete projects or your account through the product, subject to ending an active Stripe subscription first. Deletion behavior is described in the Privacy page.</Term>
        <Term title="10. Disclaimers and liability">{SHIPSEAL_LEGAL_DISCLAIMER} Mandatory rights and any limitations that apply depend on the law governing the service and cannot be reduced by this technical product description.</Term>
        <Term title="11. Operator, governing law, and contact">{SHIPSEAL_PUBLIC_OPERATOR_NAME ? `Operator: ${SHIPSEAL_PUBLIC_OPERATOR_NAME}. ` : ''}{SHIPSEAL_PUBLIC_GOVERNING_LAW ? `Governing law: ${SHIPSEAL_PUBLIC_GOVERNING_LAW}. ` : ''}Questions about these terms may be sent to <a className="text-primary underline-offset-4 hover:underline" href={`mailto:${SHIPSEAL_PUBLIC_CONTACT_EMAIL}`}>{SHIPSEAL_PUBLIC_CONTACT_EMAIL}</a>.</Term>
        <Term title="12. Changes">ShipSeal may update these terms as the service changes. Material changes should be dated and communicated through the service or another appropriate notice channel.</Term>
      </SecondaryPageShell>
    </>
  );
}

function Notice() {
  return <div className="rounded-2xl border border-border/55 bg-secondary/10 p-5 text-sm leading-relaxed text-muted-foreground"><strong className="text-foreground">Plain-language product terms.</strong> These terms describe the implemented service boundary. Repository and AI outputs remain technical guidance and should be reviewed before use in production or regulated decisions.</div>;
}

function Term({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mt-4 rounded-2xl border border-border/55 bg-background/25 p-5 md:p-6"><h2 className="font-display text-xl font-semibold">{title}</h2><p className="mt-3 text-sm leading-relaxed text-muted-foreground">{children}</p></section>;
}
