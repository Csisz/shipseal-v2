import type { CSSProperties } from 'react';
import { ArrowRight, Check, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FULL_PACKAGE_ID, SHIPSEAL_PACKAGES, type ShipSealPackage } from '@/lib/packages';

interface LandingGridProps {
  variant: 'landing';
  /** Called with the package id when a card is chosen on the landing page. */
  onPick: (id: string) => void;
  selected?: never;
  onToggle?: never;
}

interface SelectGridProps {
  variant: 'select';
  selected: string[];
  onToggle: (id: string) => void;
  onPick?: never;
}

type Props = LandingGridProps | SelectGridProps;

/**
 * The outcome choice. Individual goals are visually separated from the
 * recommended full-package shortcut. Both variants read from lib/packages.ts.
 */
export function PackageCards(props: Props) {
  const paths = SHIPSEAL_PACKAGES.filter(pack => pack.id !== FULL_PACKAGE_ID);
  const full = SHIPSEAL_PACKAGES.find(pack => pack.id === FULL_PACKAGE_ID)!;

  if (props.variant === 'select') {
    return (
      <div className="space-y-4">
        <div className="grid md:grid-cols-2 gap-3">
          {paths.map(pack => (
            <SelectCard key={pack.id} pack={pack} selected={props.selected.includes(pack.id)} onToggle={props.onToggle} />
          ))}
        </div>
        <FullSelectCard pack={full} selected={props.selected.includes(full.id)} onToggle={props.onToggle} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        {paths.map((pack, index) => (
          <PathCard key={pack.id} pack={pack} index={index} onPick={props.onPick} />
        ))}
      </div>
      <FullPackageCard pack={full} onPick={props.onPick} />
    </div>
  );
}

function PathCard({ pack, index, onPick }: { pack: ShipSealPackage; index: number; onPick: (id: string) => void }) {
  const Icon = pack.icon;
  return (
    <button
      type="button"
      onClick={() => onPick(pack.id)}
      className={cn(
        'ss-tick group relative flex h-full flex-col rounded-3xl p-7 text-left transition-all',
        'glass hover:-translate-y-1 hover:border-primary/50 hover:shadow-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
      style={{ '--tick-delay': `${index * 0.07}s` } as CSSProperties}
    >
      <span className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl border border-border/70 bg-secondary/70">
        <Icon className="h-5 w-5 text-accent" />
      </span>
      <div className="font-display text-lg font-semibold leading-snug">{pack.title}</div>
      <p className="mt-2 text-sm text-muted-foreground flex-1">{pack.sentence}</p>
      <div className="mt-5 hidden flex-wrap gap-1.5 md:flex">
        {pack.chips.map(chip => (
          <span key={chip} className="rounded-full border border-border/60 bg-secondary/50 px-2.5 py-1 text-[11px] text-foreground/80">
            {chip}
          </span>
        ))}
      </div>
      <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-primary-glow opacity-0 transition-opacity group-hover:opacity-100">
        Start here <ArrowRight className="h-3.5 w-3.5" />
      </span>
    </button>
  );
}

function FullPackageCard({ pack, onPick }: { pack: ShipSealPackage; onPick: (id: string) => void }) {
  const Icon = pack.icon;
  return (
    <button
      type="button"
      onClick={() => onPick(pack.id)}
      className={cn(
        'group relative flex w-full flex-col sm:flex-row sm:items-center gap-5 rounded-3xl p-7 text-left transition-all overflow-hidden',
        'glass-strong border-primary/40 hover:-translate-y-1 hover:shadow-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      <div className="absolute -inset-12 bg-gradient-primary opacity-[0.08] blur-3xl pointer-events-none" />
      <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-primary shadow-glow">
        <Icon className="h-5 w-5 text-primary-foreground" />
      </span>
      <span className="relative min-w-0 flex-1">
        <span className="block font-display text-xl font-semibold">{pack.title}</span>
        <span className="mt-1 block text-sm text-muted-foreground">{pack.sentence}</span>
      </span>
      <span className="relative flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-full border border-primary/50 bg-primary/10 px-2.5 py-1 text-[11px] text-foreground/90">
          <Sparkles className="h-3 w-3" /> Recommended
        </span>
        {pack.chips.map(chip => (
          chip === 'Recommended' ? null :
          <span key={chip} className="rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[11px] text-foreground/90">
            {chip}
          </span>
        ))}
        <ArrowRight className="ml-1 h-4 w-4 text-primary-glow transition-transform group-hover:translate-x-1" />
      </span>
    </button>
  );
}

function SelectCard({ pack, selected, onToggle }: { pack: ShipSealPackage; selected: boolean; onToggle: (id: string) => void }) {
  const Icon = pack.icon;
  const isFull = pack.id === FULL_PACKAGE_ID;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      onClick={() => onToggle(pack.id)}
      className={cn(
        'flex min-h-36 items-start gap-3 rounded-xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected
          ? 'border-primary/60 bg-primary/10'
          : 'border-border/60 bg-secondary/25 hover:border-border hover:bg-secondary/45',
        isFull && !selected && 'border-primary/30',
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors',
          selected ? 'border-0 bg-gradient-primary' : 'border-border/80 bg-background/40',
        )}
        aria-hidden="true"
      >
        {selected && <Check className="h-3.5 w-3.5 text-primary-foreground" />}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-accent shrink-0" />
          <span className="text-sm font-medium leading-snug">{pack.title}</span>
        </span>
        <span className="mt-1.5 block text-xs leading-relaxed text-muted-foreground">{pack.sentence}</span>
      </span>
    </button>
  );
}

function FullSelectCard({ pack, selected, onToggle }: { pack: ShipSealPackage; selected: boolean; onToggle: (id: string) => void }) {
  const Icon = pack.icon;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      onClick={() => onToggle(pack.id)}
      className={cn(
        'group flex w-full items-start gap-4 rounded-2xl border p-5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected
          ? 'border-primary/70 bg-primary/10 shadow-glow'
          : 'border-primary/35 bg-primary/5 hover:border-primary/55 hover:bg-primary/10',
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors',
          selected ? 'border-0 bg-gradient-primary' : 'border-primary/50 bg-background/40',
        )}
        aria-hidden="true"
      >
        {selected && <Check className="h-4 w-4 text-primary-foreground" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <Icon className="h-4 w-4 text-primary-glow shrink-0" />
          <span className="font-display text-base font-semibold">{pack.title}</span>
          <span className="rounded-full border border-primary/45 bg-primary/10 px-2 py-0.5 text-[11px] text-primary-glow">
            Recommended shortcut
          </span>
        </span>
        <span className="mt-2 block text-sm leading-relaxed text-muted-foreground">{pack.sentence}</span>
      </span>
    </button>
  );
}
