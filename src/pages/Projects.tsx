import { useCallback, useEffect, useState } from 'react';
import { FolderGit2, LogIn, LogOut, RefreshCw, Trash2 } from 'lucide-react';
import { Nav } from '@/components/agentready/Nav';
import { Button } from '@/components/ui/button';
import { useAccount } from '@/components/account/accountContext';
import { deleteAccount, listProjects, type PersistedProject, PersistenceClientError } from '@/lib/persistence';
import { SurfaceState } from '@/components/agentready/SurfaceState';
import { AccountUsageCard } from '@/components/account/AccountUsageCard';

export default function Projects() {
  const account = useAccount();
  const [projects, setProjects] = useState<PersistedProject[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'failed'>('idle');
  const [confirmAccountDelete, setConfirmAccountDelete] = useState(false);
  const [accountDeleteError, setAccountDeleteError] = useState('');

  const load = useCallback(async () => {
    if (!account.user) return;
    setStatus('loading');
    try { setProjects(await listProjects()); setStatus('ready'); } catch { setStatus('failed'); }
  }, [account.user]);
  useEffect(() => { void load(); }, [load]);

  const removeAccount = async () => {
    try {
      setAccountDeleteError('');
      await deleteAccount('DELETE MY SHIPSEAL ACCOUNT');
      window.location.assign('/');
    } catch (error) {
      setAccountDeleteError(error instanceof PersistenceClientError && error.status === 409
        ? 'End the active Stripe subscription through Manage subscription, then try account deletion again.'
        : 'ShipSeal could not delete the account. No account data was removed; please retry.');
    }
  };

  return (
    <div className="min-h-screen bg-background"><Nav />
      <main className="container max-w-5xl pb-20 pt-28">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div><div className="text-xs font-mono uppercase tracking-wider text-primary-glow">Private workspace</div><h1 className="mt-2 font-display text-3xl font-semibold">My Projects</h1><p className="mt-2 text-sm text-muted-foreground">Repositories you have worked with in ShipSeal, saved privately with their scan history.</p></div>
          {account.user && <div className="flex flex-wrap gap-2"><Button variant="outline" asChild><a href="/">New scan</a></Button><Button variant="ghost" onClick={() => void account.logout()}><LogOut className="mr-2 h-4 w-4" />Sign out</Button></div>}
        </div>

        {account.user && <AccountUsageCard />}

        {account.status === 'loading' && <SurfaceState className="mt-8" tone="loading" title="Checking your session" description="Preparing private project access." />}
        {(account.status === 'anonymous' || account.status === 'unavailable') && (
          <SurfaceState className="mt-8" tone={account.status === 'unavailable' ? 'error' : 'empty'} title={account.status === 'unavailable' ? 'Account sign-in is unavailable' : 'Sign in to view saved work'} description={account.availabilityMessage || 'Anonymous scanning remains available. Sign-in is required only for durable private history.'} action={<div className="flex flex-wrap justify-center gap-2"><Button onClick={account.beginSignIn}><LogIn className="mr-2 h-4 w-4" />{account.status === 'unavailable' ? 'Retry sign-in' : 'Sign in with GitHub'}</Button><Button variant="outline" asChild><a href="/#scan">Scan without an account</a></Button></div>} />
        )}
        {account.user && status === 'loading' && <SurfaceState className="mt-8" tone="loading" title="Loading projects" description="Retrieving your private project list." />}
        {account.user && status === 'failed' && <SurfaceState className="mt-8" tone="error" title="My Projects is unavailable" description="ShipSeal could not load the private project list." action={<Button variant="outline" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Retry</Button>} />}
        {account.user && status === 'ready' && projects.length === 0 && <SurfaceState className="mt-8" tone="empty" icon={FolderGit2} title="No projects yet" description="Completed repository scans are saved here automatically while you are signed in." action={<Button asChild><a href="/#scan">Scan a repository</a></Button>} />}
        {account.user && projects.length > 0 && <ul className="mt-8 grid gap-3">{projects.map(project => <li key={project.id} className="rounded-2xl border border-border/60 bg-secondary/15 p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><h2 className="break-words font-semibold [overflow-wrap:anywhere]">{project.displayName}</h2><p className="mt-1 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">{project.repositoryOwner && project.repositoryName ? `${project.repositoryOwner}/${project.repositoryName}` : project.uploadLabel || 'Uploaded project'}</p><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"><span>{sourceLabel(project.sourceType)}</span><span>{project.scanCount.toLocaleString()} {project.scanCount === 1 ? 'scan' : 'scans'}</span><span>{project.lastScanAt ? `Last scanned ${new Date(project.lastScanAt).toLocaleString()}` : 'No scans'}</span><span>{project.latestScanStatus ? `Latest ${project.latestScanStatus}` : 'Status unavailable'}</span><span>{project.latestIntelligenceMode ? `${project.latestIntelligenceMode} intelligence` : 'Mode unavailable'}</span><span>{project.latestVerificationState ? `Verification ${project.latestVerificationState}` : 'Verification unavailable'}</span></div></div><Button asChild><a href={`/projects/${project.id}`}>Open project</a></Button></div></li>)}</ul>}

        {account.user && <section className="mt-12 border-t border-border/50 pt-8"><h2 className="font-display text-lg font-semibold">Account data</h2><div className="mt-2 max-w-2xl space-y-2 text-sm leading-relaxed text-muted-foreground"><p><strong className="text-foreground">1.</strong> If a Stripe subscription is active, trialing, or past due, use Manage subscription above and end it first.</p><p><strong className="text-foreground">2.</strong> Then delete the ShipSeal account. This removes private projects, scans, derived snapshots, Future/AI operations, entitlements, usage adjustments, billing mappings, and sessions, and anonymizes the account identity row.</p><p>Deletion does not cancel or erase Stripe records, uninstall the GitHub App, revoke GitHub-side authorization, or remove GitHub branches and Pull Requests. See the <a className="text-primary hover:underline" href="/privacy">Privacy page</a> for the complete boundary.</p></div>{accountDeleteError && <p role="alert" className="mt-4 max-w-2xl rounded-xl border border-destructive/35 bg-destructive/10 px-4 py-3 text-sm text-muted-foreground">{accountDeleteError}</p>}{confirmAccountDelete ? <div className="mt-4 rounded-2xl border border-destructive/40 bg-destructive/10 p-4"><p className="text-sm">Delete all ShipSeal account data? This cannot be undone. External GitHub and Stripe data is not deleted.</p><div className="mt-3 flex flex-wrap gap-2"><Button variant="destructive" onClick={() => void removeAccount()}>Delete my ShipSeal account</Button><Button variant="outline" onClick={() => { setConfirmAccountDelete(false); setAccountDeleteError(''); }}>Cancel</Button></div></div> : <Button className="mt-4" variant="outline" onClick={() => { setConfirmAccountDelete(true); setAccountDeleteError(''); }}><Trash2 className="mr-2 h-4 w-4" />Delete account</Button>}</section>}
      </main>
    </div>
  );
}

function sourceLabel(sourceType: PersistedProject['sourceType']) {
  if (sourceType === 'github-app') return 'Connected GitHub';
  if (sourceType === 'github-public' || sourceType === 'github-url') return 'Public GitHub';
  return 'Local ZIP';
}
