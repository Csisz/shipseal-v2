import type { BeforeSendEvent } from '@vercel/analytics/react';

const ATTRIBUTION_STORAGE_KEY = 'shipseal.analytics.attribution.v1';

const UTM_SOURCES = ['github', 'google', 'linkedin', 'newsletter', 'product_hunt', 'reddit', 'x', 'youtube', 'other'] as const;
const UTM_MEDIA = ['cpc', 'email', 'organic', 'paid_social', 'referral', 'social', 'other'] as const;
const UTM_CAMPAIGNS = ['early_access', 'launch', 'launch_sprint_01', 'product_launch', 'other'] as const;

export type UtmSource = typeof UTM_SOURCES[number];
export type UtmMedium = typeof UTM_MEDIA[number];
export type UtmCampaign = typeof UTM_CAMPAIGNS[number];

export interface CampaignAttribution {
  utmSource?: UtmSource;
  utmMedium?: UtmMedium;
  utmCampaign?: UtmCampaign;
}

const PUBLIC_PAGE_PATHS = new Set([
  '/',
  '/privacy',
  '/security',
  '/terms',
  '/trust',
  '/trust/github',
  '/projects',
]);

const BLOCKED_PAGE_PATHS = [/^\/admin(?:\/|$)/, /^\/account(?:\/|$)/, /^\/payment(?:\/|$)/, /^\/api(?:\/|$)/];

function canonicalUtmValue(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (normalized === 'twitter') return 'x';
  if (normalized === 'producthunt') return 'product_hunt';
  return normalized;
}

function allowlisted<T extends string>(value: string | null, allowed: readonly T[]): T | 'other' | undefined {
  if (value === null) return undefined;
  const canonical = canonicalUtmValue(value);
  return allowed.includes(canonical as T) ? canonical as T : 'other';
}

function isCampaignAttribution(value: unknown): value is CampaignAttribution {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  const keys = Object.keys(candidate);
  if (keys.some(key => !['utmSource', 'utmMedium', 'utmCampaign'].includes(key))) return false;
  const optionalAllowed = <T extends string>(entry: unknown, allowed: readonly T[]) => (
    entry === undefined || typeof entry === 'string' && allowed.includes(entry as T)
  );
  return optionalAllowed(candidate.utmSource, UTM_SOURCES)
    && optionalAllowed(candidate.utmMedium, UTM_MEDIA)
    && optionalAllowed(candidate.utmCampaign, UTM_CAMPAIGNS);
}

export function firstTouchCampaignAttribution(
  search = typeof window === 'undefined' ? '' : window.location.search,
  storage = typeof window === 'undefined' ? undefined : window.sessionStorage,
): CampaignAttribution | null {
  if (!storage) return null;
  try {
    const stored = storage.getItem(ATTRIBUTION_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as unknown;
      if (isCampaignAttribution(parsed)) return parsed;
      storage.removeItem(ATTRIBUTION_STORAGE_KEY);
    }

    const params = new URLSearchParams(search);
    if (!['utm_source', 'utm_medium', 'utm_campaign'].some(key => params.has(key))) return null;
    const attribution: CampaignAttribution = {
      utmSource: allowlisted(params.get('utm_source'), UTM_SOURCES),
      utmMedium: allowlisted(params.get('utm_medium'), UTM_MEDIA),
      utmCampaign: allowlisted(params.get('utm_campaign'), UTM_CAMPAIGNS),
    };
    if (!Object.values(attribution).some(Boolean)) return null;
    storage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(attribution));
    return attribution;
  } catch {
    return null;
  }
}

function safePagePath(pathname: string) {
  const normalized = pathname !== '/' ? pathname.replace(/\/+$/, '') : pathname;
  if (BLOCKED_PAGE_PATHS.some(pattern => pattern.test(normalized))) return null;
  if (/^\/projects\/[^/]+\/scans\/[^/]+$/.test(normalized)) return '/projects/:projectId/scans/:scanId';
  if (/^\/projects\/[^/]+$/.test(normalized)) return '/projects/:projectId';
  if (PUBLIC_PAGE_PATHS.has(normalized)) return normalized;
  return '/not-found';
}

export function filterAnalyticsPageview(event: BeforeSendEvent): BeforeSendEvent | null {
  try {
    const base = typeof window === 'undefined' ? 'https://www.getshipseal.com' : window.location.origin;
    const parsed = new URL(event.url, base);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    const pathname = safePagePath(parsed.pathname);
    if (!pathname) return null;
    parsed.pathname = pathname;
    parsed.search = '';
    parsed.hash = '';
    parsed.username = '';
    parsed.password = '';
    return { ...event, url: parsed.toString() };
  } catch {
    return null;
  }
}

export const growthAnalyticsContract = {
  utmSources: UTM_SOURCES,
  utmMedia: UTM_MEDIA,
  utmCampaigns: UTM_CAMPAIGNS,
} as const;
