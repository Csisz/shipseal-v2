import { Link } from 'react-router-dom';
import { SHIPSEAL_PUBLIC_CONTACT_EMAIL } from '@/lib/trust/publicTrust';

const TRUST_LINKS = [
  { to: '/trust', label: 'Trust center' },
  { to: '/privacy', label: 'Privacy' },
  { to: '/terms', label: 'Terms' },
  { to: '/security', label: 'Security' },
  { to: '/trust/github', label: 'GitHub permissions' },
] as const;

export function PublicTrustFooter() {
  return (
    <footer className="border-t border-border/45 py-8" aria-label="Trust and legal links">
      <div className="container flex max-w-5xl flex-col gap-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>ShipSeal · Static repository intelligence with explicit AI boundaries.</span>
        <nav className="flex flex-wrap gap-x-4 gap-y-2" aria-label="Trust and legal">
          {TRUST_LINKS.map(link => <Link key={link.to} to={link.to} className="hover:text-foreground">{link.label}</Link>)}
          <a href={`mailto:${SHIPSEAL_PUBLIC_CONTACT_EMAIL}`} className="hover:text-foreground">Contact</a>
        </nav>
      </div>
    </footer>
  );
}
