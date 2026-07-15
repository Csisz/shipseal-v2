import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSampleReport } from '@/lib/readiness';
import type { RepositoryIntelligenceVerificationBaseline } from '@/lib/repositoryIntelligence';
import type { RepoScanInput } from '@/lib/types';

const scanMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/scanEngine', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/scanEngine')>();
  return { ...actual, localScanEngine: { scan: scanMock } };
});

import { useRepoScan } from '@/hooks/useRepoScan';

const scanInput: RepoScanInput = {
  repoName: 'demo',
  source: { sourceType: 'zip-upload' },
  files: [{ path: 'AGENTS.md', size: 28 }],
  textContents: { 'AGENTS.md': '# Repository instructions\n' },
  scanSummary: { scanMode: 'full', limited: false, totalFilesFound: 1, filesAnalyzed: 1, filesExcluded: 0, filesSkippedByLimit: 0, readableTextBytesAnalyzed: 28, warnings: [] },
};

const baseline: RepositoryIntelligenceVerificationBaseline = {
  schemaVersion: 'shipseal.repository-intelligence-verification-baseline.v1',
  applySchemaVersion: 'shipseal.repository-intelligence-github-apply.v1',
  pathPolicyVersion: 'shipseal.repository-path-policy.v1',
  repository: { owner: 'acme', repo: 'demo' },
  baseBranch: 'main',
  prBranch: 'shipseal/repository-intelligence-12345678',
  selectedPlanFingerprint: '12345678',
  artifacts: [{ artifactId: 'artifact-root', category: 'root-agent-instructions', artifactFingerprint: 'artifact12345678', targetPath: 'AGENTS.md', operation: 'create', finalContentFingerprint: 'content12345678', preservedLineFingerprints: [], humanReviewRequired: false, statements: [] }],
  prUrl: 'https://github.com/acme/demo/pull/42',
  prNumber: 42,
};

describe('Repository Intelligence rescan session integration', () => {
  beforeEach(() => scanMock.mockReset());

  it('computes once from scanner-loaded input, preserves the prior safe result while scanning and on failure, and retains no source input in state', async () => {
    const report = buildSampleReport();
    scanMock.mockImplementationOnce(async (_input, callbacks) => {
      callbacks?.onScanInput?.(scanInput);
      return report;
    });
    const { result } = renderHook(() => useRepoScan(baseline));
    await act(async () => { await result.current.startScan(new File(['zip'], 'demo.zip')); });
    const firstVerification = result.current.repositoryIntelligenceVerification;
    expect(firstVerification).not.toBeNull();
    expect(result.current.repositoryIntelligenceVerificationStatus).toBe('completed');
    expect(result.current).not.toHaveProperty('repositoryIntelligenceScanInput');
    expect(JSON.stringify(firstVerification)).not.toContain('# Repository instructions');

    let rejectScan: (error: Error) => void = () => undefined;
    scanMock.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectScan = reject; }));
    let pending: Promise<unknown>;
    act(() => { pending = result.current.startScan(new File(['zip'], 'demo.zip')); });
    expect(result.current.repositoryIntelligenceVerificationStatus).toBe('scanning');
    expect(result.current.repositoryIntelligenceVerification?.fingerprint).toBe(firstVerification?.fingerprint);
    await act(async () => { rejectScan(new Error('Archive unavailable')); await pending!; });
    expect(result.current.repositoryIntelligenceVerificationStatus).toBe('failed');
    expect(result.current.repositoryIntelligenceVerification?.fingerprint).toBe(firstVerification?.fingerprint);
    expect(result.current.repositoryIntelligenceVerificationError).toMatch(/could not be completed/i);
  });
});
