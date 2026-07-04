import { useState, type CSSProperties } from 'react';
import { ArrowRight, Check, ChevronDown, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FULL_PACKAGE_ID, SHIPSEAL_PACKAGES, type ShipSealPackage, type ShipSealPackageId } from '@/lib/packages';

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
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const primaryIds: ShipSealPackageId[] = ['agent-readiness', 'client-handoff', 'launch-readiness', 'safety-risk', FULL_PACKAGE_ID];
  const primary = primaryIds.map(id => SHIPSEAL_PACKAGES.find(pack => pack.id === id)).filter(Boolean) as ShipSealPackage[];
  const advanced = SHIPSEAL_PACKAGES.filter(pack => !primaryIds.includes(pack.id));

  if (props.variant === 'select') {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {primary.map(pack => (
            <SelectCard key={pack.id} pack={pack} selected={props.selected.includes(pack.id)} onToggle={props.onToggle} />
          ))}
        </div>
        <AdvancedGoalPicker packs={advanced} selected={props.selected} onToggle={props.onToggle} open={advancedOpen} onOpenChange={setAdvancedOpen} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 xl:grid-cols-5 gap-4">
        {primary.map((pack, index) => (
          <PathCard key={pack.id} pack={pack} index={index} onPick={props.onPick} />
        ))}
      </div>
      <details className="group rounded-2xl border border-border/60 bg-secondary/15" open={advancedOpen} onToggle={event => setAdvancedOpen(event.currentTarget.open)}>
        <summary className="flex cursor-pointer select-none items-center justify-between gap-3 px-5 py-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
          <span>Advanced goals</span>
          <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
        </summary>
        {advancedOpen && (
          <div className="grid gap-3 border-t border-border/50 p-4 md:grid-cols-2">
            {advanced.map((pack, index) => (
              <PathCard key={pack.id} pack={pack} index={index} onPick={props.onPick} compact />
            ))}
          </div>
        )}
      </details>
    </div>
  );
}

function goalDisplay(pack: ShipSealPackage) {
  switch (pack.id) {
    case 'agent-readiness':
      return {
        title: 'Build with AI',
        sentence: 'Prepare context, instructions and safe edit guidance for AI coding agents.',
      };
    case 'client-handoff':
      return {
        title: 'Ship to Client',
        sentence: 'Prepare a focused handoff, known limitations and next steps.',
      };
    case 'launch-readiness':
      return {
        title: 'Production Readiness',
        sentence: 'Check launch blockers, verification signals and release risks.',
      };
    case 'safety-risk':
      return {
        title: 'Security Review',
        sentence: 'Inspect secrets, auth, data and tool-boundary signals.',
      };
    case 'full-package':
      return {
        title: 'Full Workspace Analysis',
        sentence: 'Run the recommended complete AI workspace optimization pass.',
      };
    default:
      return {
        title: pack.title,
        sentence: pack.sentence,
      };
  }
}

function PathCard({ pack, index, onPick, compact = false }: { pack: ShipSealPackage; index: number; onPick: (id: string) => void; compact?: boolean }) {
  const Icon = pack.icon;
  const display = goalDisplay(pack);
  return (
    <button
      type="button"
      onClick={() => onPick(pack.id)}
      className={cn(
        'ss-tick group relative flex h-full flex-col text-left transition-all',
        compact ? 'rounded-2xl p-4' : 'rounded-3xl p-6',
        'glass hover:-translate-y-1 hover:border-primary/50 hover:shadow-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
      style={{ '--tick-delay': `${index * 0.07}s` } as CSSProperties}
    >
      <span className={cn('flex items-center justify-center border border-border/70 bg-secondary/70', compact ? 'mb-3 h-9 w-9 rounded-xl' : 'mb-5 h-11 w-11 rounded-2xl')}>
        <Icon className="h-5 w-5 text-accent" />
      </span>
      <div className="font-display text-lg font-semibold leading-snug">{display.title}</div>
      <p className="mt-2 text-sm text-muted-foreground flex-1">{display.sentence}</p>
      {pack.id === FULL_PACKAGE_ID && (
        <span className="mt-3 inline-flex w-fit items-center gap-1 rounded-full border border-primary/50 bg-primary/10 px-2.5 py-1 text-[11px] text-primary-glow">
          <Sparkles className="h-3 w-3" /> Recommended
        </span>
      )}
      <div className={cn('mt-5 hidden flex-wrap gap-1.5 md:flex', compact && 'mt-3')}>
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

function SelectCard({ pack, selected, onToggle }: { pack: ShipSealPackage; selected: boolean; onToggle: (id: string) => void }) {
  const Icon = pack.icon;
  const isFull = pack.id === FULL_PACKAGE_ID;
  const display = goalDisplay(pack);
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      onClick={() => onToggle(pack.id)}
      className={cn(
        'flex min-h-32 items-start gap-3 rounded-2xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
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
          <span className="text-sm font-medium leading-snug">{display.title}</span>
        </span>
        <span className="mt-1.5 block text-xs leading-relaxed text-muted-foreground">{display.sentence}</span>
        {isFull && (
          <span className="mt-2 inline-flex rounded-full border border-primary/45 bg-primary/10 px-2 py-0.5 text-[10px] text-primary-glow">
            Recommended
          </span>
        )}
      </span>
    </button>
  );
}

function AdvancedGoalPicker({
  packs,
  selected,
  onToggle,
  open,
  onOpenChange,
}: {
  packs: ShipSealPackage[];
  selected: string[];
  onToggle: (id: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <details className="group rounded-2xl border border-border/60 bg-secondary/15" open={open} onToggle={event => onOpenChange(event.currentTarget.open)}>
      <summary className="flex cursor-pointer select-none items-center justify-between gap-3 px-5 py-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
        <span>Advanced goals</span>
        <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      {open && (
        <div className="grid gap-3 border-t border-border/50 p-4 md:grid-cols-2">
          {packs.map(pack => (
            <SelectCard key={pack.id} pack={pack} selected={selected.includes(pack.id)} onToggle={onToggle} />
          ))}
        </div>
      )}
    </details>
  );
}
