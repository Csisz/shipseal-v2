import { useCallback, useEffect, useState } from 'react';
import { FolderGit2, LogIn, LogOut, RefreshCw, Trash2 } from 'lucide-react';
import { Nav } from '@/components/agentready/Nav';
import { Button } from '@/components/ui/button';
import { useAccount } from '@/components/account/accountContext';
import { deleteAccount, listProjects, type PersistedProject, PersistenceClientError } from '@/lib/persistence';
import { SurfaceState } from '@/components/agentready/SurfaceState';

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

        {account.status === 'loading' && <SurfaceState className="mt-8" tone="loading" title="Checking your session" description="Preparing private project access." />}
        {(account.status === 'anonymous' || account.status === 'unavailable') && (
          <SurfaceState className="mt-8" tone={account.status === 'unavailable' ? 'error' : 'empty'} title={account.status === 'unavailable' ? 'Account sign-in is unavailable' : 'Sign in to view saved work'} description={account.availabilityMessage || 'Anonymous scanning remains available. Sign-in is required only for durable private history.'} action={<div className="flex flex-wrap justify-center gap-2"><Button onClick={account.beginSignIn}><LogIn className="mr-2 h-4 w-4" />{account.status === 'unavailable' ? 'Retry sign-in' : 'Sign in with GitHub'}</Button><Button variant="outline" asChild><a href="/#scan">Scan without an account</a></Button></div>} />
        )}
        {account.user && status === 'loading' && <SurfaceState className="mt-8" tone="loading" title="Loading projects" description="Retrieving your private project list." />}
        {account.user && status === 'failed' && <SurfaceState className="mt-8" tone="error" title="Saved projects are unavailable" description="ShipSeal could not load the project list." action={<Button variant="outline" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Retry</Button>} />}
        {account.user && status === 'ready' && projects.length === 0 && <SurfaceState className="mt-8" tone="empty" icon={FolderGit2} title="No saved projects yet" description="Run a scan, then choose Save project from the result overview." action={<Button asChild><a href="/#scan">Scan a repository</a></Button>} />}
        {account.user && projects.length > 0 && <ul className="mt-8 grid gap-3">{projects.map(project => <li key={project.id} className="rounded-2xl border border-border/60 bg-secondary/15 p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><h2 className="break-words font-semibold [overflow-wrap:anywhere]">{project.displayName}</h2><p className="mt-1 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">{project.repositoryOwner && project.repositoryName ? `${project.repositoryOwner}/${project.repositoryName}` : project.uploadLabel || 'Uploaded project'}</p><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"><span>{project.sourceType}</span><span>{project.lastScanAt ? new Date(project.lastScanAt).toLocaleString() : 'No scans'}</span><span>{project.latestIntelligenceMode || 'Mode unavailable'}</span><span>{project.latestVerificationState || 'Verification unavailable'}</span></div></div><Button asChild><a href={`/projects/${project.id}`}>Open project</a></Button></div></li>)}</ul>}

        {account.user && <section className="mt-12 border-t border-border/50 pt-8"><h2 className="font-display text-lg font-semibold">Account data</h2><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Deleting your account removes ShipSeal projects, scans, snapshots, verification relationships, and sessions. It does not modify GitHub.</p>{confirmAccountDelete ? <div className="mt-4 rounded-2xl border border-destructive/40 bg-destructive/10 p-4"><p className="text-sm">Delete all ShipSeal account data? This cannot be undone.</p><div className="mt-3 flex flex-wrap gap-2"><Button variant="destructive" onClick={() => void removeAccount()}>Delete my ShipSeal account</Button><Button variant="outline" onClick={() => setConfirmAccountDelete(false)}>Cancel</Button></div></div> : <Button className="mt-4" variant="outline" onClick={() => setConfirmAccountDelete(true)}><Trash2 className="mr-2 h-4 w-4" />Delete account</Button>}</section>}
      </main>
    </div>
  );
}
