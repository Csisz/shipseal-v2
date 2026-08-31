import { describe, expect, it } from 'vitest';
import { InMemoryAccountPersistenceStore } from '../../api/_lib/inMemoryAccountPersistence';
import { buildSampleReport } from '@/lib/readiness';
import { buildSaveProjectRequest } from '@/lib/persistence/buildSnapshot';

async function owner(store: InMemoryAccountPersistenceStore) {
  return store.upsertOAuthUser({
    providerSubject: 'autosave-owner',
    email: 'autosave@example.test',
    displayName: 'Autosave Owner',
    avatarUrl: null,
  });
}

describe('authenticated project autosave persistence', () => {
  it('upserts connected rescans into one project, appends history, and deduplicates a repeated save', async () => {
    const store = new InMemoryAccountPersistenceStore();
    const user = await owner(store);
    const firstReport = {
      ...buildSampleReport(),
      scannedAt: '2026-08-31T10:00:00.000Z',
      source: {
        sourceType: 'github-app' as const,
        githubOwner: 'Csisz',
        githubRepo: 'Cantu',
        githubBranch: 'main',
        githubInstallationId: 'installation-1',
      },
    };
    const secondReport = {
      ...firstReport,
      scannedAt: '2026-08-31T11:00:00.000Z',
      sampleFiles: [...firstReport.sampleFiles, { path: 'src/new-capability.ts', size: 420 }],
    };
    const firstRequest = buildSaveProjectRequest({ report: firstReport });
    const secondRequest = buildSaveProjectRequest({ report: secondReport });

    const first = await store.saveProjectAndScan(user.id, firstRequest);
    const second = await store.saveProjectAndScan(user.id, secondRequest);
    const repeated = await store.saveProjectAndScan(user.id, secondRequest);

    expect(second.project.id).toBe(first.project.id);
    expect(repeated.scan.id).toBe(second.scan.id);
    expect(await store.listScans(user.id, first.project.id, 50, 0)).toHaveLength(2);
    expect(await store.listProjects(user.id, 50, 0)).toEqual([
      expect.objectContaining({ id: first.project.id, scanCount: 2, lastScanAt: secondReport.scannedAt }),
    ]);
  });

  it('does not merge unrelated local uploads solely because their filenames match', async () => {
    const store = new InMemoryAccountPersistenceStore();
    const user = await owner(store);
    const firstReport = { ...buildSampleReport(), repoName: 'workspace.zip' };
    const secondReport = {
      ...buildSampleReport(),
      repoName: 'workspace.zip',
      analyzedFiles: [{ path: 'unrelated/application.py', size: 9_001 }],
      sampleFiles: [{ path: 'unrelated/application.py', size: 9_001 }],
    };

    await store.saveProjectAndScan(user.id, buildSaveProjectRequest({ report: firstReport }));
    await store.saveProjectAndScan(user.id, buildSaveProjectRequest({ report: secondReport }));

    expect(await store.listProjects(user.id, 50, 0)).toHaveLength(2);
  });
});
