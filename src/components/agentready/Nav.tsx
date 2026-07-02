import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Braces, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const links = [
  { label: 'Why ShipSeal', href: '#why' },
  { label: 'Intelligence', href: '#intelligence' },
  { label: 'How it works', href: '#how' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Contact', href: '#contact' },
];

interface Props {
  onNavigateAnchor?: (href: string) => void;
  onHome?: () => void;
}

export function Nav({ onNavigateAnchor, onHome }: Props) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={cn(
      'fixed top-0 inset-x-0 z-50 transition-all',
      scrolled ? 'backdrop-blur-2xl bg-background/70 border-b border-border/60' : 'bg-transparent'
    )}>
      <div className="container flex h-20 items-center justify-between">

        <Link
          to="/"
          onClick={(event) => { if (onHome) { event.preventDefault(); onHome(); } }}
          className="flex items-center gap-2 group"
          aria-label="ShipSeal home"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-primary shadow-glow">
            <Braces className="h-5 w-5 text-primary-foreground" />
          </span>
          <span className="font-display text-xl font-bold tracking-tight">ShipSeal</span>
        </Link>
        <nav className="hidden md:flex items-center gap-7">
          {links.map((l) => (
            <a key={l.href} href={l.href} onClick={(event) => { if (onNavigateAnchor) { event.preventDefault(); onNavigateAnchor(l.href); } }} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="hidden md:flex items-center gap-2">
          <Button asChild variant="default" className="bg-gradient-primary hover:opacity-90 border-0 shadow-glow">
            <a href="#scan" onClick={(event) => { if (onNavigateAnchor) { event.preventDefault(); onNavigateAnchor('#scan'); } }}>Scan my repository</a>
          </Button>
        </div>
        <button onClick={() => setOpen(!open)} className="md:hidden p-2">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && (
        <div className="md:hidden border-t border-border/60 bg-background/95 backdrop-blur-xl">
          <div className="container py-4 flex flex-col gap-3">
            {links.map((l) => (
              <a key={l.href} href={l.href} onClick={(event) => { setOpen(false); if (onNavigateAnchor) { event.preventDefault(); onNavigateAnchor(l.href); } }} className="text-sm text-muted-foreground hover:text-foreground py-1.5">
                {l.label}
              </a>
            ))}
            <Button asChild className="bg-gradient-primary border-0 mt-2"><a href="#scan" onClick={(event) => { setOpen(false); if (onNavigateAnchor) { event.preventDefault(); onNavigateAnchor('#scan'); } }}>Scan my repository</a></Button>
          </div>
        </div>
      )}
    </header>
  );
}
