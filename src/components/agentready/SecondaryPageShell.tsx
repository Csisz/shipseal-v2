import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Nav } from './Nav';

interface SecondaryPageShellProps {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  maxWidth?: string;
}

export function SecondaryPageShell({
  eyebrow,
  title,
  description,
  children,
  maxWidth = 'max-w-5xl',
}: SecondaryPageShellProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <main className={`container ${maxWidth} pb-20 pt-24 md:pt-28`}>
        <Link to="/" className="inline-flex min-h-10 items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
          Back to ShipSeal
        </Link>
        <header className="mt-7 max-w-3xl">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary-glow">{eyebrow}</div>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight md:text-5xl">{title}</h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">{description}</p>
        </header>
        <div className="mt-10">{children}</div>
      </main>
    </div>
  );
}
