import { describe, expect, it } from 'vitest';
import { buildGitHubAppInstallUrl, getGitHubAppClientConfig } from '@/lib/githubApp/config';

describe('GitHub App client config', () => {
  it('uses an explicit install URL from env', () => {
    const config = getGitHubAppClientConfig({
      VITE_GITHUB_APP_NAME: 'ShipSeal Demo',
      VITE_GITHUB_APP_SLUG: 'shipseal-demo',
      VITE_GITHUB_APP_INSTALL_URL: 'https://github.com/apps/shipseal-demo/installations/new?state=demo',
    });

    expect(config).toEqual({
      appName: 'ShipSeal Demo',
      appSlug: 'shipseal-demo',
      installUrl: 'https://github.com/apps/shipseal-demo/installations/new?state=demo',
      loginUrl: '/api/github-app/login',
      isConfigured: true,
    });
  });

  it('builds an install URL from a GitHub App slug', () => {
    const config = getGitHubAppClientConfig({
      VITE_GITHUB_APP_SLUG: 'shipseal-demo',
    });

    expect(config.appName).toBe('ShipSeal');
    expect(config.installUrl).toBe('https://github.com/apps/shipseal-demo/installations/new');
    expect(config.loginUrl).toBe('/api/github-app/login');
    expect(config.isConfigured).toBe(true);
    expect(buildGitHubAppInstallUrl('shipseal-demo')).toBe(config.installUrl);
  });

  it('returns a disabled config when no install env is present', () => {
    const config = getGitHubAppClientConfig({});

    expect(config).toEqual({
      appName: 'ShipSeal',
      appSlug: '',
      installUrl: '',
      loginUrl: '/api/github-app/login',
      isConfigured: false,
    });
  });
});
