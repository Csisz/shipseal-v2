import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useId } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { parseShipSealThemePreference, type ShipSealThemePreference } from '@/lib/theme';
import { cn } from '@/lib/utils';

const OPTIONS: Array<{
  value: ShipSealThemePreference;
  label: string;
  icon: typeof Sun;
}> = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

export function ThemeToggle({ className }: { className?: string }) {
  const tooltipId = useId();
  const { theme, setTheme } = useTheme();
  const preference = parseShipSealThemePreference(theme);
  const active = OPTIONS.find(option => option.value === preference) || OPTIONS[2];
  const ActiveIcon = active.icon;

  return (
    <DropdownMenu modal={false}>
      <div className="group relative">
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn('h-9 w-9 rounded-full border border-border/70 bg-floating/80 text-foreground shadow-sm', className)}
            aria-label={`Theme: ${active.label}. Change color theme`}
            aria-describedby={tooltipId}
            data-testid="theme-toggle"
          >
            <ActiveIcon className="h-4 w-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <span
          id={tooltipId}
          role="tooltip"
          className="pointer-events-none absolute right-0 top-[calc(100%+0.5rem)] z-[var(--layer-tooltip)] whitespace-nowrap rounded-md bg-tooltip px-3 py-1.5 text-xs text-background opacity-0 shadow-md transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
        >
          Color theme: {active.label}
        </span>
      </div>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        collisionPadding={12}
        className="w-44"
        data-testid="theme-menu"
      >
        <DropdownMenuLabel>Color theme</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {OPTIONS.map(option => {
          const Icon = option.icon;
          const selected = option.value === preference;
          return (
            <DropdownMenuItem
              key={option.value}
              onSelect={() => setTheme(option.value)}
              aria-checked={selected}
              role="menuitemradio"
              className="gap-2"
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span>{option.label}</span>
              {selected && <Check className="ml-auto h-4 w-4" aria-hidden="true" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
