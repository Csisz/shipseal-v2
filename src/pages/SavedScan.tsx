import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Nav } from '@/components/agentready/Nav';
import { Button } from '@/components/ui/button';
import { useAccount } from '@/components/account/accountContext';
import { getScan, parsePersistedReadinessReport, type PersistedScanSummary, type PersistedVerificationRelationship } from '@/lib/persistence';
import type { ReadinessReport } from '@/lib/types';
import { SurfaceState } from '@/components/agentready/SurfaceState';
import {
  buildRepositoryIntelligenceEvidence,
  buildRepositoryProductStrategistRequest,
  prepareRepositoryProductStrategistContext,
  repositoryFutureFailureMessage,
  type RepositoryIntelligenceProviderStatus,
  type RepositoryProductIntelligenceResult,
} from '@/lib/repositoryIntelligence';
import {
  getPersistedRepositoryFutureResult,
  getRepositoryFutureOperationStatus,
  mergePersistedRepositoryFutureResult,
  selectRepositoryFutureRecoveryOperationId,
} from '@/lib/aiOperationRecovery';

const ResultDashboard = lazy(() => import('@/components/agentready/ResultDashboard').then(module => ({ default: module.ResultDashboard })));

export default function SavedScan() {
  const { projectId = '', scanId = '' } = useParams();
  const navigate = useNavigate();
  const account = useAccount();
  const refreshAccountUsage = account.refreshUsage;
  const [report, setReport] = useState<ReadinessReport | null>(null);
  const [scan, setScan] = useState<PersistedScanSummary | null>(null);
  const [verification, setVerification] = useState<PersistedVerificationRelationship | null>(null);
  const [error, setError] = useState('');
  const [productIntelligence, setProductIntelligence] = useState<RepositoryProductIntelligenceResult | null>(null);
  const [productStatus, setProductStatus] = useState<RepositoryIntelligenceProviderStatus>({
    state: 'preparing', deepState: 'pending', retryable: false,
    message: 'Checking for a saved Future analysis.',
  });
  useEffect(() => {
    if (!account.user) return;
    let active = true;
    getScan(scanId).then(saved => {
      if (!active) return;
      if (saved.scan.projectId !== projectId) throw new Error('Saved scan does not belong to this project.');
      const restoredReport = parsePersistedReadinessReport(saved.snapshot.report);
      setScan(saved.scan); setVerification(saved.verificationRelationship); setReport(restoredReport);
      const repositoryIdentity = restoredReport.source.githubOwner && restoredReport.source.githubRepo
        ? `github:${restoredReport.source.githubOwner.toLowerCase()}/${restoredReport.source.githubRepo.toLowerCase()}`
        : `upload:${restoredReport.repoName.trim().toLowerCase()}`;
      void getPersistedRepositoryFutureResult({ repositoryIdentity }).then(persisted => {
        if (!active) return;
        if (!persisted) {
          void getRepositoryFutureOperationStatus({ repositoryIdentity }).then(operation => {
            if (!active) return;
            if (!operation) {
              setProductStatus({
                state: 'deterministic', deepState: 'disabled', retryable: false,
                message: 'Repository evidence is ready for an explicit Future analysis.',
              });
              return;
            }
            setProductStatus({
              state: 'fallback', deepState: 'failed', category: 'operation_conflict', retryable: operation.retryable,
              message: repositoryFutureFailureMessage('operation_conflict', { costEstimate: 'unavailable', operationRecoveryAction: operation.recoveryAction }),
              diagnostics: {
                costEstimate: 'unavailable', publicOperationId: operation.publicOperationId,
                operationRecoveryAction: operation.recoveryAction,
                operationCompletionState: operation.completionState,
                operationUserUnitState: operation.userUnitState,
                ...(operation.leaseExpiresAt ? { operationLeaseExpiresAt: operation.leaseExpiresAt } : {}),
              },
            });
          }).catch(() => {
            if (!active) return;
            setProductStatus({
              state: 'fallback', deepState: 'failed', category: 'usage_temporarily_unavailable', retryable: true,
              message: 'Saved Future analysis status is temporarily unavailable.',
            });
          });
          return;
        }
        const restored = mergePersistedRepositoryFutureResult(persisted);
        if (!restored) return;
        setProductIntelligence(restored);
        setProductStatus({
          state: 'enhanced', deepState: 'completed', retryable: false,
          message: 'Your saved Future analysis is ready.', providerId: persisted.complete.providerId,
          modelId: persisted.complete.modelId,
          diagnostics: { ...persisted.complete.diagnostics, cacheUsed: true, publicOperationId: persisted.publicOperationId, operationRecoveryAction: 'open_result' },
        });
      }).catch(() => {
        if (!active) return;
        setProductStatus({
          state: 'fallback', deepState: 'failed', category: 'usage_temporarily_unavailable', retryable: true,
          message: 'Saved Future analysis status is temporarily unavailable.',
        });
      });
    }).catch(() => { if (active) setError('This saved scan is unavailable, corrupt, or uses an unsupported data version.'); });
    return () => { active = false; };
  }, [account.user, projectId, scanId]);
  const resumeFutureAnalysis = useCallback(async () => {
    if (!report) return;
    if (!report.source.githubOwner || !report.source.githubRepo) {
      setProductStatus({ state: 'fallback', deepState: 'failed', category: 'operation_conflict', retryable: false, message: 'Reopen the original local ZIP to safely resume this Future analysis.' });
      return;
    }
    setProductStatus({ state: 'preparing', deepState: 'pending', productStage: 'roots', completedBatches: 0, totalBatches: 0, message: 'Safely resuming Future analysis from the saved repository commit.', retryable: false });
    try {
      const [{ importGitHubAppEvidence, importPublicGitHubEvidence }, { requestRepositoryProductIntelligenceStaged }] = await Promise.all([
        import('@/lib/github/githubImport'), import('@/lib/repositoryIntelligence/deepIntelligenceClient'),
      ]);
      const ref = report.scanSummary.sourceCommitSha || report.source.githubBranch || report.source.githubDefaultBranch || 'HEAD';
      const imported = report.source.githubInstallationId
        ? await importGitHubAppEvidence({ installationId: report.source.githubInstallationId, owner: report.source.githubOwner, repo: report.source.githubRepo, ref })
        : await importPublicGitHubEvidence({ url: `https://github.com/${report.source.githubOwner}/${report.source.githubRepo}`, branch: ref });
      const evidenceResult = buildRepositoryIntelligenceEvidence(imported.scanInput);
      const contextBundle = prepareRepositoryProductStrategistContext({ scanInput: imported.scanInput, evidenceResult });
      const request = buildRepositoryProductStrategistRequest({ contextBundle, evidenceResult });
      const recoveryAction = productStatus && 'diagnostics' in productStatus ? productStatus.diagnostics?.operationRecoveryAction : undefined;
      const publicOperationId = productStatus && 'diagnostics' in productStatus ? productStatus.diagnostics?.publicOperationId : undefined;
      const recoveryOperationId = publicOperationId && recoveryAction
        ? selectRepositoryFutureRecoveryOperationId({ publicOperationId, recoveryAction })
        : undefined;
      const response = await requestRepositoryProductIntelligenceStaged(request, { recoveryOperationId });
      if (response.state === 'enhanced' && response.result.productIntelligence) {
        setProductIntelligence(response.result.productIntelligence);
        setProductStatus({ state: 'enhanced', deepState: response.deepState, retryable: false, message: 'Your Future analysis is ready.', providerId: response.providerId, modelId: response.modelId, diagnostics: response.diagnostics });
        void refreshAccountUsage();
      } else if (response.state === 'fallback') {
        setProductStatus({ state: 'fallback', deepState: response.deepState, category: response.category, retryable: response.retryable, message: repositoryFutureFailureMessage(response.category, response.diagnostics), diagnostics: response.diagnostics });
      }
    } catch {
      setProductStatus({ state: 'fallback', deepState: 'failed', category: 'provider_unavailable', retryable: true, message: 'Future analysis recovery is temporarily unavailable.' });
    }
  }, [productStatus, refreshAccountUsage, report]);
  return <div className="min-h-screen bg-background"><Nav />{!report ? <main className="container pt-24 md:pt-28">{error ? <SurfaceState tone="error" title="Saved scan cannot be reopened" description="This stored snapshot could not be opened safely." details={error} action={<Button onClick={() => navigate(`/projects/${projectId}`)}>Back to project</Button>} /> : <SurfaceState tone="loading" title="Validating saved scan" description="Checking the stored snapshot without rescanning the repository." />}</main> : <main className="pt-16 md:pt-20"><div className="container space-y-3 pt-4"><div className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm"><span className="font-medium">Saved scan</span><span className="ml-2 text-muted-foreground">Opened without rescanning, provider execution, or GitHub mutation. {scan?.intelligenceMode} mode.</span></div>{verification && <div className="rounded-xl border border-border/60 bg-secondary/15 px-4 py-3 text-sm" aria-label="Persisted verification relationship"><div className="font-medium capitalize">Verification: {verification.state.replace('-', ' ')}</div><div className="mt-1 break-words text-xs text-muted-foreground">Baseline and later scan are linked to this project with {verification.algorithmVersion}. Evidence is restored without rerunning verification.</div></div>}</div><Suspense fallback={<div className="container py-24"><SurfaceState tone="loading" title="Opening saved result" description="Preparing the stored workspace." /></div>}><ResultDashboard report={report} history={[]} onReset={() => navigate(`/projects/${projectId}`)} onClearHistory={() => undefined} repositoryProductIntelligence={productIntelligence} repositoryProductIntelligenceStatus={productStatus} retryRepositoryProductIntelligence={resumeFutureAnalysis} /></Suspense></main>}</div>;
}
