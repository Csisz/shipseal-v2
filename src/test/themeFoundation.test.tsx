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

  it('uses system preference on first visit and defensively rejects invalid storage', () => {
    expect(parseShipSealThemePreference(null)).toBe('system');
    expect(parseShipSealThemePreference('sepia')).toBe('system');
    expect(resolveShipSealTheme('system', false)).toBe('light');
    expect(resolveShipSealTheme('system', true)).toBe('dark');
  });

  it('persists explicit light and dark selections with an accessible selected state', async () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );

    const trigger = screen.getByRole('button', { name: /Theme: System. Change color theme/i });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Light' }));

    await waitFor(() => expect(window.localStorage.getItem(SHIPSEAL_THEME_STORAGE_KEY)).toBe('light'));
    expect(screen.getByRole('button', { name: /Theme: Light. Change color theme/i })).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole('button', { name: /Theme: Light. Change color theme/i }), { key: 'ArrowDown' });
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Dark' }));

    await waitFor(() => expect(window.localStorage.getItem(SHIPSEAL_THEME_STORAGE_KEY)).toBe('dark'));
    expect(screen.getByRole('button', { name: /Theme: Dark. Change color theme/i })).toBeInTheDocument();
  });

  it('restores a persisted selection and exposes all choices to keyboard users', async () => {
    window.localStorage.setItem(SHIPSEAL_THEME_STORAGE_KEY, 'dark');
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );

    const trigger = await screen.findByRole('button', { name: /Theme: Dark. Change color theme/i });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });

    expect(await screen.findByRole('menuitemradio', { name: 'Light' })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('menuitemradio', { name: 'System' })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('theme-menu')).not.toBeInTheDocument());
    fireEvent.blur(trigger);
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
  });

  it('initializes the stored or system theme before the application module runs', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    const initializerIndex = html.indexOf('shipseal-theme');
    const applicationIndex = html.indexOf('/src/main.tsx');

    expect(initializerIndex).toBeGreaterThan(0);
    expect(initializerIndex).toBeLessThan(applicationIndex);
    expect(html).toContain('prefers-color-scheme: dark');
    expect(html).toContain('root.classList.toggle("dark", dark)');
  });
});
