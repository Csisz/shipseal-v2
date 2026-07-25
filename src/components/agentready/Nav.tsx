import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Braces, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

const links = [
  { label: 'Product', href: '#intelligence' },
  { label: 'How it works', href: '#how' },
  { label: 'Pricing', href: '#pricing' },
];

interface Props {
  onNavigateAnchor?: (href: string) => void;
  onHome?: () => void;
}

export function Nav({ onNavigateAnchor, onHome }: Props) {
  const location = useLocation();
  const onLanding = location.pathname === '/';
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <header className={cn(
      'fixed inset-x-0 top-0 z-[var(--layer-toolbar)] border-b transition-all',
      scrolled || open ? 'border-border/55 bg-background/80 backdrop-blur-2xl' : 'border-transparent bg-background/35 backdrop-blur-md'
    )}>
      <div className="container flex h-16 items-center justify-between md:h-[4.5rem]">

        <Link
          to="/"
          onClick={(event) => { if (onHome) { event.preventDefault(); onHome(); } }}
          className="flex items-center gap-2 group"
          aria-label="ShipSeal home"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-primary shadow-glow sm:h-9 sm:w-9">
            <Braces className="h-4 w-4 text-primary-foreground sm:h-5 sm:w-5" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight sm:text-xl">ShipSeal</span>
        </Link>
        <nav className="hidden items-center gap-6 lg:flex" aria-label="Primary navigation">
          {links.map((l) => (
            <a key={l.href} href={onLanding ? l.href : `/${l.href}`} onClick={(event) => { if (onNavigateAnchor) { event.preventDefault(); onNavigateAnchor(l.href); } }} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          <ThemeToggle />
          <Button asChild variant="ghost">
            <Link to="/projects" aria-current={location.pathname.startsWith('/projects') ? 'page' : undefined}>My projects</Link>
          </Button>
          <Button asChild variant="default" className="bg-primary text-primary-foreground shadow-sm shadow-primary/20 hover:bg-primary/90">
            <a href={onLanding ? '#scan' : '/#scan'} onClick={(event) => { if (onNavigateAnchor) { event.preventDefault(); onNavigateAnchor('#scan'); } }}>Scan my repository</a>
          </Button>
        </div>
        <div className="flex items-center gap-1 lg:hidden">
          <ThemeToggle />
          <button type="button" onClick={() => setOpen(!open)} className="flex min-h-11 min-w-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={open ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={open} aria-controls="shipseal-mobile-navigation">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {open && (
        <div id="shipseal-mobile-navigation" className="border-t border-border/60 bg-background/95 backdrop-blur-xl lg:hidden">
          <nav className="container flex flex-col gap-1 py-3" aria-label="Mobile navigation">
            {links.map((l) => (
              <a key={l.href} href={onLanding ? l.href : `/${l.href}`} onClick={(event) => { setOpen(false); if (onNavigateAnchor) { event.preventDefault(); onNavigateAnchor(l.href); } }} className="flex min-h-11 items-center rounded-lg px-2 text-sm text-muted-foreground hover:bg-secondary/30 hover:text-foreground">
                {l.label}
              </a>
            ))}
            <Link to="/projects" onClick={() => setOpen(false)} aria-current={location.pathname.startsWith('/projects') ? 'page' : undefined} className="flex min-h-11 items-center rounded-lg px-2 text-sm text-muted-foreground hover:bg-secondary/30 hover:text-foreground">My projects</Link>
            <Button asChild className="mt-2 bg-primary text-primary-foreground hover:bg-primary/90"><a href={onLanding ? '#scan' : '/#scan'} onClick={(event) => { setOpen(false); if (onNavigateAnchor) { event.preventDefault(); onNavigateAnchor('#scan'); } }}>Scan my repository</a></Button>
          </nav>
        </div>
      )}
    </header>
  );
}
