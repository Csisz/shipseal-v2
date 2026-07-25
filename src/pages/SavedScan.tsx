import { lazy, Suspense, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Nav } from '@/components/agentready/Nav';
import { Button } from '@/components/ui/button';
import { useAccount } from '@/components/account/accountContext';
import { getScan, parsePersistedReadinessReport, type PersistedScanSummary } from '@/lib/persistence';
import type { ReadinessReport } from '@/lib/types';
import { SurfaceState } from '@/components/agentready/SurfaceState';

const ResultDashboard = lazy(() => import('@/components/agentready/ResultDashboard').then(module => ({ default: module.ResultDashboard })));

export default function SavedScan() {
  const { projectId = '', scanId = '' } = useParams();
  const navigate = useNavigate();
  const account = useAccount();
  const [report, setReport] = useState<ReadinessReport | null>(null);
  const [scan, setScan] = useState<PersistedScanSummary | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!account.user) return;
    let active = true;
    getScan(scanId).then(saved => {
      if (!active) return;
      if (saved.scan.projectId !== projectId) throw new Error('Saved scan does not belong to this project.');
      setScan(saved.scan); setReport(parsePersistedReadinessReport(saved.snapshot.report));
    }).catch(() => { if (active) setError('This saved scan is unavailable, corrupt, or uses an unsupported data version.'); });
    return () => { active = false; };
  }, [account.user, projectId, scanId]);
  return <div className="min-h-screen bg-background"><Nav />{!report ? <main className="container pt-24 md:pt-28">{error ? <SurfaceState tone="error" title="Saved scan cannot be reopened" description="This stored snapshot could not be opened safely." details={error} action={<Button onClick={() => navigate(`/projects/${projectId}`)}>Back to project</Button>} /> : <SurfaceState tone="loading" title="Validating saved scan" description="Checking the stored snapshot without rescanning the repository." />}</main> : <main className="pt-16 md:pt-20"><div className="container pt-4"><div className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm"><span className="font-medium">Saved scan</span><span className="ml-2 text-muted-foreground">Opened without rescanning, provider execution, or GitHub mutation. {scan?.intelligenceMode} mode.</span></div></div><Suspense fallback={<div className="container py-24"><SurfaceState tone="loading" title="Opening saved result" description="Preparing the stored workspace." /></div>}><ResultDashboard report={report} history={[]} onReset={() => navigate(`/projects/${projectId}`)} onClearHistory={() => undefined} /></Suspense></main>}</div>;
}
