import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import {
  parseShipSealThemePreference,
  resolveShipSealTheme,
  SHIPSEAL_THEME_STORAGE_KEY,
} from '@/lib/theme';

describe('ShipSeal semantic theme foundation', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-theme-preference');
  });

  it('defaults first visits and invalid storage to Dark while keeping System resolvable', () => {
    expect(parseShipSealThemePreference(null)).toBe('dark');
    expect(parseShipSealThemePreference('sepia')).toBe('dark');
    expect(resolveShipSealTheme('system', false)).toBe('light');
    expect(resolveShipSealTheme('system', true)).toBe('dark');
  });

  it('presents Dark as the first-load appearance without writing unrelated storage', async () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );

    expect(await screen.findByRole('button', { name: /Appearance theme: Dark. Change appearance/i })).toBeInTheDocument();
    expect(window.localStorage.length).toBeLessThanOrEqual(1);
  });

  it('persists explicit light and dark selections with an accessible selected state', async () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );

    const trigger = screen.getByRole('button', { name: /Appearance theme: Dark. Change appearance/i });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Light' }));

    await waitFor(() => expect(window.localStorage.getItem(SHIPSEAL_THEME_STORAGE_KEY)).toBe('light'));
    expect(screen.getByRole('button', { name: /Appearance theme: Light. Change appearance/i })).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole('button', { name: /Appearance theme: Light. Change appearance/i }), { key: 'ArrowDown' });
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Dark' }));

    await waitFor(() => expect(window.localStorage.getItem(SHIPSEAL_THEME_STORAGE_KEY)).toBe('dark'));
    expect(screen.getByRole('button', { name: /Appearance theme: Dark. Change appearance/i })).toBeInTheDocument();
  });

  it('restores a persisted Light selection after a fresh provider mount', async () => {
    window.localStorage.setItem(SHIPSEAL_THEME_STORAGE_KEY, 'light');
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );

    expect(await screen.findByRole('button', { name: /Appearance theme: Light. Change appearance/i })).toBeInTheDocument();
  });

  it('restores System and exposes every appearance choice to keyboard users', async () => {
    window.localStorage.setItem(SHIPSEAL_THEME_STORAGE_KEY, 'system');
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );

    const trigger = await screen.findByRole('button', { name: /Appearance theme: System. Change appearance/i });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });

    expect(await screen.findByRole('menuitemradio', { name: 'Light' })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('menuitemradio', { name: 'System' })).toHaveAttribute('aria-checked', 'true');

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('theme-menu')).not.toBeInTheDocument());
    fireEvent.blur(trigger);
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
  });

  it('initializes stored preferences or the Dark default before the application module runs', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    const initializerIndex = html.indexOf('shipseal-theme');
    const applicationIndex = html.indexOf('/src/main.tsx');

    expect(initializerIndex).toBeGreaterThan(0);
    expect(initializerIndex).toBeLessThan(applicationIndex);
    expect(html).toContain('let preference = "dark"');
    expect(html).toContain('prefers-color-scheme: dark');
    expect(html).toContain('root.classList.toggle("dark", dark)');
  });
});
