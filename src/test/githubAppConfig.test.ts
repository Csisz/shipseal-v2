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
      installUrl: '/api/github-app/login?flow=install',
      loginUrl: '/api/github-app/login',
      isConfigured: true,
    });
  });

  it('builds an install URL from a GitHub App slug', () => {
    const config = getGitHubAppClientConfig({
      VITE_GITHUB_APP_SLUG: 'shipseal-demo',
    });

    expect(config.appName).toBe('ShipSeal');
    expect(config.installUrl).toBe('/api/github-app/login?flow=install');
    expect(config.loginUrl).toBe('/api/github-app/login');
    expect(config.isConfigured).toBe(true);
    expect(buildGitHubAppInstallUrl('shipseal-demo')).toBe('https://github.com/apps/shipseal-demo/installations/new');
  });

  it('uses server-routed install and connect endpoints without exposing client configuration', () => {
    const config = getGitHubAppClientConfig({});

    expect(config).toEqual({
      appName: 'ShipSeal',
      appSlug: '',
      installUrl: '/api/github-app/login?flow=install',
      loginUrl: '/api/github-app/login',
      isConfigured: true,
    });
  });
});
