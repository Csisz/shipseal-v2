import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Trash2 } from 'lucide-react';
import { Nav } from '@/components/agentready/Nav';
import { Button } from '@/components/ui/button';
import { useAccount } from '@/components/account/accountContext';
import { deleteProject, deleteScan, getProject, type PersistedProject, type PersistedScanSummary } from '@/lib/persistence';

export default function Project() {
  const { projectId = '' } = useParams();
  const navigate = useNavigate();
  const account = useAccount();
  const [project, setProject] = useState<PersistedProject | null>(null);
  const [scans, setScans] = useState<PersistedScanSummary[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed' | 'not-found'>('loading');
  const [confirmProjectDelete, setConfirmProjectDelete] = useState(false);
  const [confirmScanDelete, setConfirmScanDelete] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!account.user) return;
    setStatus('loading');
    try { const result = await getProject(projectId); setProject(result.project); setScans(result.scans); setStatus('ready'); }
    catch (error) { setStatus(error instanceof Error && 'status' in error && error.status === 404 ? 'not-found' : 'failed'); }
  }, [account.user, projectId]);
  useEffect(() => { void load(); }, [load]);
  const removeScan = async (scanId: string) => { try { await deleteScan(scanId); setConfirmScanDelete(null); await load(); } catch { setStatus('failed'); } };
  const removeProject = async () => { try { await deleteProject(projectId); navigate('/projects'); } catch { setStatus('failed'); } };

  return <div className="min-h-screen bg-background"><Nav /><main className="container max-w-5xl pb-20 pt-28">
    <Button variant="ghost" asChild><a href="/projects"><ArrowLeft className="mr-2 h-4 w-4" />Saved projects</a></Button>
    {!account.user && account.status !== 'loading' && <section className="mt-6 rounded-2xl border border-border/60 p-6"><h1 className="font-display text-2xl font-semibold">Sign in required</h1><Button className="mt-4" onClick={account.beginSignIn}>Sign in with GitHub</Button></section>}
    {status === 'loading' && <p className="mt-8 text-muted-foreground">Loading saved project…</p>}
    {status === 'not-found' && <p className="mt-8 text-muted-foreground">Saved project was not found.</p>}
    {status === 'failed' && <div className="mt-8 rounded-2xl border border-destructive/40 bg-destructive/10 p-5"><p>Project history could not be loaded.</p><Button className="mt-3" variant="outline" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Retry</Button></div>}
    {project && status === 'ready' && <><header className="mt-5"><div className="text-xs font-mono uppercase tracking-wider text-primary-glow">Private project</div><h1 className="mt-2 break-words font-display text-3xl font-semibold [overflow-wrap:anywhere]">{project.displayName}</h1><p className="mt-2 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">{project.repositoryOwner && project.repositoryName ? `${project.repositoryOwner}/${project.repositoryName}` : project.uploadLabel}</p><Button className="mt-5" variant="outline" asChild><a href="/">Start a new scan</a></Button></header>
      <section className="mt-10"><h2 className="font-display text-xl font-semibold">Scan history</h2><p className="mt-2 text-sm text-muted-foreground">Each saved scan is immutable. Opening one does not rescan, call a provider, or mutate GitHub.</p>{scans.length === 0 ? <p className="mt-5 rounded-2xl border border-dashed border-border/60 p-6 text-muted-foreground">No stored scans remain.</p> : <ol className="mt-5 grid gap-3">{scans.map(scan => <li key={scan.id} className="rounded-2xl border border-border/60 bg-secondary/15 p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="break-words font-medium [overflow-wrap:anywhere]">{scan.branch || 'Uploaded archive'}</div><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"><span>{new Date(scan.completedAt || scan.startedAt).toLocaleString()}</span><span>{scan.status}</span><span>{scan.intelligenceMode}</span><span>{scan.verificationState}</span>{scan.baselineScanId && <span>Rescan relationship retained</span>}</div></div><div className="flex flex-wrap gap-2"><Button asChild><a href={`/projects/${project.id}/scans/${scan.id}`}>Open scan</a></Button><Button variant="outline" onClick={() => setConfirmScanDelete(scan.id)}><Trash2 className="h-4 w-4" /><span className="sr-only">Delete scan</span></Button></div></div>{confirmScanDelete === scan.id && <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-4"><p className="text-sm">Delete this scan and any verification relationship that depends on it?</p><div className="mt-3 flex gap-2"><Button variant="destructive" onClick={() => void removeScan(scan.id)}>Delete scan</Button><Button variant="outline" onClick={() => setConfirmScanDelete(null)}>Cancel</Button></div></div>}</li>)}</ol>}</section>
      <section className="mt-12 border-t border-border/50 pt-8"><h2 className="font-display text-lg font-semibold">Delete project</h2><p className="mt-2 text-sm text-muted-foreground">Removes all stored scans and relationships. The GitHub repository is never changed.</p>{confirmProjectDelete ? <div className="mt-4 rounded-2xl border border-destructive/40 bg-destructive/10 p-4"><p className="text-sm">Delete this saved project and all of its ShipSeal history?</p><div className="mt-3 flex gap-2"><Button variant="destructive" onClick={() => void removeProject()}>Delete project</Button><Button variant="outline" onClick={() => setConfirmProjectDelete(false)}>Cancel</Button></div></div> : <Button className="mt-4" variant="outline" onClick={() => setConfirmProjectDelete(true)}><Trash2 className="mr-2 h-4 w-4" />Delete project</Button>}</section>
    </>}
  </main></div>;
}
