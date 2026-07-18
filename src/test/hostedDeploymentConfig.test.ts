import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SHIPSEAL_VERSION, appVersion } from '@/lib/version';

const root = resolve(__dirname, '..', '..');

describe('hosted deployment configuration', () => {
  it('has Vercel config for Vite dev, API routes, and SPA fallback', () => {
    const vercelJsonPath = resolve(root, 'vercel.json');

    expect(existsSync(vercelJsonPath)).toBe(true);

    const config = JSON.parse(readFileSync(vercelJsonPath, 'utf8'));

    expect(config.framework).toBe('vite');
    expect(config.buildCommand).toBe('npm run build');
    expect(config.outputDirectory).toBe('dist');
    expect(config.devCommand).toContain('vite');
    expect(config.devCommand).toContain('--host 0.0.0.0');
    expect(config.devCommand).toContain('--port $PORT');
    expect(config.routes).toBeUndefined();
    expect(config.rewrites).toEqual([
      { source: '/api/account/:route(login|callback|session|logout|delete)', destination: '/api/account-router?route=:route' },
      { source: '/api/projects/:projectId/scans', destination: '/api/persistence-router?route=project-scans&projectId=:projectId' },
      { source: '/api/projects/:projectId', destination: '/api/persistence-router?route=project&projectId=:projectId' },
      { source: '/api/projects', destination: '/api/persistence-router?route=projects' },
      { source: '/api/scans/:scanId', destination: '/api/persistence-router?route=scan&scanId=:scanId' },
      { source: '/api/github-app/:route(archive|callback|create-readiness-pr|create-repository-intelligence-pr|installations|login|oauth-callback|repositories|start)', destination: '/api/github-app-router?route=:route' },
      { source: '/(.*)', destination: '/index.html' },
    ]);
  });

  it('keeps Vite package scripts explicit for local and hosted dev', () => {
    const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));

    expect(packageJson.scripts.dev).toBe('vite');
    expect(packageJson.scripts.build).toBe('vite build');
    expect(packageJson.scripts.preview).toBe('vite preview');
    expect(packageJson.scripts.test).toBe('vitest run');
  });

  it('uses the ShipSeal RC version constant consistently', () => {
    expect(SHIPSEAL_VERSION).toBe('0.1.0-rc1');
    expect(appVersion).toBe(SHIPSEAL_VERSION);
  });
});
