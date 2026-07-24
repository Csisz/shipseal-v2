import type { ReactNode } from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { SHIPSEAL_THEME_STORAGE_KEY } from '@/lib/theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableColorScheme
      enableSystem
      storageKey={SHIPSEAL_THEME_STORAGE_KEY}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
