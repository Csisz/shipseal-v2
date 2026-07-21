export interface GitHubAppEnv {
  [key: string]: unknown;
  VITE_GITHUB_APP_SLUG?: string;
  VITE_GITHUB_APP_NAME?: string;
  VITE_GITHUB_APP_INSTALL_URL?: string;
}

export interface GitHubAppClientConfig {
  appName: string;
  appSlug: string;
  installUrl: string;
  loginUrl: string;
  isConfigured: boolean;
}

const DEFAULT_APP_NAME = 'ShipSeal';

export function getGitHubAppClientConfig(env: GitHubAppEnv = import.meta.env): GitHubAppClientConfig {
  const appName = clean(env.VITE_GITHUB_APP_NAME) || DEFAULT_APP_NAME;
  const explicitInstallUrl = clean(env.VITE_GITHUB_APP_INSTALL_URL);
  const appSlug = clean(env.VITE_GITHUB_APP_SLUG);

  if (explicitInstallUrl) {
    return {
      appName,
      appSlug,
      installUrl: explicitInstallUrl,
      loginUrl: '/api/github-app/login',
      isConfigured: true,
    };
  }

  if (appSlug) {
    return {
      appName,
      appSlug,
      installUrl: buildGitHubAppInstallUrl(appSlug),
      loginUrl: '/api/github-app/login',
      isConfigured: true,
    };
  }

  return {
    appName,
    appSlug: '',
    installUrl: '',
    loginUrl: '/api/github-app/login',
    isConfigured: false,
  };
}

export function buildGitHubAppInstallUrl(slug: string) {
  return `https://github.com/apps/${encodeURIComponent(clean(slug))}/installations/new`;
}

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}
