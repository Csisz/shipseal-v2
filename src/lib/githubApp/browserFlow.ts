export const GITHUB_FLOW_DRAFT_KEY = 'shipseal.github-flow-draft.v1';

interface BrowserFlowSurface {
  screenX: number;
  screenY: number;
  outerWidth: number;
  outerHeight: number;
  open: (url: string, name: string, features: string) => Window | null;
  navigate: (url: string) => void;
}

export function addGitHubFlowQuery(url: string, key: string, value: string) {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
}

export function launchGitHubBrowserFlow(
  input: { url: string; name: string; beforeSameTab?: () => void },
  surface: BrowserFlowSurface = {
    screenX: window.screenX,
    screenY: window.screenY,
    outerWidth: window.outerWidth,
    outerHeight: window.outerHeight,
    open: (url, name, features) => window.open(url, name, features),
    navigate: url => window.location.assign(url),
  },
) {
  const width = 620;
  const height = 720;
  const left = Math.max(0, surface.screenX + (surface.outerWidth - width) / 2);
  const top = Math.max(0, surface.screenY + (surface.outerHeight - height) / 2);
  const popup = surface.open(
    input.url,
    input.name,
    `popup=yes,width=${width},height=${height},left=${Math.round(left)},top=${Math.round(top)},resizable=yes,scrollbars=yes`,
  );
  if (popup) return { mode: 'popup' as const, popup };
  input.beforeSameTab?.();
  surface.navigate(input.url);
  return { mode: 'same-tab' as const, popup: null };
}

export function saveGitHubFlowDraft(input: { selectedPackages: string[]; agentOperatingMode: string }) {
  try {
    window.sessionStorage.setItem(GITHUB_FLOW_DRAFT_KEY, JSON.stringify(input));
  } catch {
    // Same-tab fallback still works when storage is unavailable.
  }
}

export function restoreGitHubFlowDraft() {
  try {
    const value = window.sessionStorage.getItem(GITHUB_FLOW_DRAFT_KEY);
    window.sessionStorage.removeItem(GITHUB_FLOW_DRAFT_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value) as { selectedPackages?: unknown; agentOperatingMode?: unknown };
    return {
      selectedPackages: Array.isArray(parsed.selectedPackages)
        ? parsed.selectedPackages.filter((item): item is string => typeof item === 'string')
        : [],
      agentOperatingMode: typeof parsed.agentOperatingMode === 'string' ? parsed.agentOperatingMode : '',
    };
  } catch {
    return null;
  }
}
