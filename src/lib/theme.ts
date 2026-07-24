export const SHIPSEAL_THEME_STORAGE_KEY = 'shipseal-theme';

export const SHIPSEAL_THEME_PREFERENCES = ['light', 'dark', 'system'] as const;

export type ShipSealThemePreference = (typeof SHIPSEAL_THEME_PREFERENCES)[number];
export type ShipSealResolvedTheme = Exclude<ShipSealThemePreference, 'system'>;

export function parseShipSealThemePreference(value: unknown): ShipSealThemePreference {
  return typeof value === 'string' && SHIPSEAL_THEME_PREFERENCES.includes(value as ShipSealThemePreference)
    ? value as ShipSealThemePreference
    : 'system';
}

export function resolveShipSealTheme(
  preference: ShipSealThemePreference,
  systemPrefersDark: boolean,
): ShipSealResolvedTheme {
  return preference === 'system' ? (systemPrefersDark ? 'dark' : 'light') : preference;
}
