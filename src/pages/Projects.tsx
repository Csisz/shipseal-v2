import { useCallback, useEffect, useState } from 'react';
import { FolderGit2, LogIn, LogOut, RefreshCw, Trash2 } from 'lucide-react';
import { Nav } from '@/components/agentready/Nav';
import { Button } from '@/components/ui/button';
import { useAccount } from '@/components/account/accountContext';
import { deleteAccount, listProjects, type PersistedProject, PersistenceClientError } from '@/lib/persistence';

export default function Projects() {
  const account = useAccount();
  const [projects, setProjects] = useState<PersistedProject[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'failed'>('idle');
  const [confirmAccountDelete, setConfirmAccountDelete] = useState(false);

  const load = useCallback(async () => {
    if (!account.user) return;
    setStatus('loading');
    try { setProjects(await listProjects()); setStatus('ready'); } catch { setStatus('failed'); }
  }, [account.user]);
  useEffect(() => { void load(); }, [load]);

  const removeAccount = async () => {
    try {
      await deleteAccount('DELETE MY SHIPSEAL ACCOUNT');
      window.location.assign('/');
    } catch { setStatus('failed'); setConfirmAccountDelete(false); }
  };

  return (
    <div className="min-h-screen bg-background"><Nav />
      <main className="container max-w-5xl pb-20 pt-28">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div><div className="text-xs font-mono uppercase tracking-wider text-primary-glow">Private workspace</div><h1 className="mt-2 font-display text-3xl font-semibold">Saved projects</h1><p className="mt-2 text-sm text-muted-foreground">Derived repository intelligence and scan history. Projects are private by default.</p></div>
          {account.user && <div className="flex flex-wrap gap-2"><Button variant="outline" asChild><a href="/">New scan</a></Button><Button variant="ghost" onClick={() => void account.logout()}><LogOut className="mr-2 h-4 w-4" />Sign out</Button></div>}
        </div>

        {account.status === 'loading' && <p className="mt-8 text-muted-foreground">Checking your session…</p>}
        {(account.status === 'anonymous' || account.status === 'unavailable') && (
          <section className="mt-8 rounded-3xl border border-border/60 bg-secondary/20 p-6"><h2 className="font-display text-xl font-semibold">Sign in to view saved work</h2><p className="mt-2 text-sm text-muted-foreground">Anonymous scanning remains available. Sign-in is required only for durable private history.</p><Button className="mt-5" onClick={account.beginSignIn}><LogIn className="mr-2 h-4 w-4" />Sign in with GitHub</Button></section>
        )}
        {account.user && status === 'loading' && <p className="mt-8 text-muted-foreground">Loading projects…</p>}
        {account.user && status === 'failed' && <div className="mt-8 rounded-2xl border border-destructive/40 bg-destructive/10 p-5"><p>Saved projects are temporarily unavailable.</p><Button className="mt-3" variant="outline" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Retry</Button></div>}
        {account.user && status === 'ready' && projects.length === 0 && <section className="mt-8 rounded-3xl border border-dashed border-border/70 p-8 text-center"><FolderGit2 className="mx-auto h-7 w-7 text-muted-foreground" /><h2 className="mt-3 font-display text-xl font-semibold">No saved projects yet</h2><p className="mt-2 text-sm text-muted-foreground">Run a scan, then choose Save project from the result overview.</p><Button className="mt-5" asChild><a href="/">Scan a repository</a></Button></section>}
        {account.user && projects.length > 0 && <ul className="mt-8 grid gap-3">{projects.map(project => <li key={project.id} className="rounded-2xl border border-border/60 bg-secondary/15 p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><h2 className="break-words font-semibold [overflow-wrap:anywhere]">{project.displayName}</h2><p className="mt-1 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">{project.repositoryOwner && project.repositoryName ? `${project.repositoryOwner}/${project.repositoryName}` : project.uploadLabel || 'Uploaded project'}</p><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"><span>{project.sourceType}</span><span>{project.lastScanAt ? new Date(project.lastScanAt).toLocaleString() : 'No scans'}</span><span>{project.latestIntelligenceMode || 'Mode unavailable'}</span><span>{project.latestVerificationState || 'Verification unavailable'}</span></div></div><Button asChild><a href={`/projects/${project.id}`}>Open project</a></Button></div></li>)}</ul>}

        {account.user && <section className="mt-12 border-t border-border/50 pt-8"><h2 className="font-display text-lg font-semibold">Account data</h2><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Deleting your account removes ShipSeal projects, scans, snapshots, verification relationships, and sessions. It does not modify GitHub.</p>{confirmAccountDelete ? <div className="mt-4 rounded-2xl border border-destructive/40 bg-destructive/10 p-4"><p className="text-sm">Delete all ShipSeal account data? This cannot be undone.</p><div className="mt-3 flex flex-wrap gap-2"><Button variant="destructive" onClick={() => void removeAccount()}>Delete my ShipSeal account</Button><Button variant="outline" onClick={() => setConfirmAccountDelete(false)}>Cancel</Button></div></div> : <Button className="mt-4" variant="outline" onClick={() => setConfirmAccountDelete(true)}><Trash2 className="mr-2 h-4 w-4" />Delete account</Button>}</section>}
      </main>
    </div>
  );
}
