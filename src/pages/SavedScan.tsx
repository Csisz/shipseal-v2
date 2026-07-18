import { lazy, Suspense, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Nav } from '@/components/agentready/Nav';
import { Button } from '@/components/ui/button';
import { useAccount } from '@/components/account/accountContext';
import { getScan, parsePersistedReadinessReport, type PersistedScanSummary } from '@/lib/persistence';
import type { ReadinessReport } from '@/lib/types';

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
  return <div className="min-h-screen bg-background"><Nav />{!report ? <main className="container pt-28">{error ? <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-6"><h1 className="font-display text-2xl font-semibold">Saved scan cannot be reopened</h1><p className="mt-2 text-sm text-muted-foreground">{error}</p><Button className="mt-4" onClick={() => navigate(`/projects/${projectId}`)}>Back to project</Button></div> : <p className="text-muted-foreground">Validating saved scan…</p>}</main> : <main className="pt-20"><div className="container pt-4"><div className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm"><span className="font-medium">Saved scan</span><span className="ml-2 text-muted-foreground">Opened without rescanning, provider execution, or GitHub mutation. {scan?.intelligenceMode} mode.</span></div></div><Suspense fallback={<div className="container py-24 text-muted-foreground">Loading saved result…</div>}><ResultDashboard report={report} history={[]} onReset={() => navigate(`/projects/${projectId}`)} onClearHistory={() => undefined} /></Suspense></main>}</div>;
}
