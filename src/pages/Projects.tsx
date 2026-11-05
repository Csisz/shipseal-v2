import { useCallback, useEffect, useState } from 'react';
import { FolderGit2, Github, LogIn, LogOut, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
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
  const [githubIdentity, setGitHubIdentity] = useState<{ status: 'loading' | 'connected' | 'disconnected'; login?: string }>({ status: 'loading' });

  const load = useCallback(async () => {
    if (!account.user) return;
    setStatus('loading');
    try { setProjects(await listProjects()); setStatus('ready'); } catch { setStatus('failed'); }
  }, [account.user]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    let active = true;
    if (!account.user) {
      setGitHubIdentity({ status: 'disconnected' });
      return () => { active = false; };
    }
    setGitHubIdentity({ status: 'loading' });
    void fetch('/api/github-app/connection', { headers: { Accept: 'application/json' }, credentials: 'same-origin' })
      .then(async response => {
        const body = await response.json().catch(() => null) as { connection?: { githubLogin?: unknown } } | null;
        if (!active) return;
        const login = body?.connection?.githubLogin;
        setGitHubIdentity(response.ok && typeof login === 'string' && login.trim()
          ? { status: 'connected', login: login.trim() }
          : { status: 'disconnected' });
      })
      .catch(() => { if (active) setGitHubIdentity({ status: 'disconnected' }); });
    return () => { active = false; };
  }, [account.user]);

  const removeAccount = async () => {
    try {
      setAccountDeleteError('');
      await deleteAccount('DELETE MY SHIPSEAL ACCOUNT');
      window.location.assign('/');
    } catch (error) {
      setAccountDeleteError(error instanceof PersistenceClientError && error.status === 409
        ? account.productMode?.earlyAccessFree
          ? 'An existing active Stripe subscription must be ended before account deletion. Early Access itself does not require payment.'
          : 'End the active Stripe subscription through Manage subscription, then try account deletion again.'
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

        {account.user && <section aria-label="Identity boundary" className="mt-5 rounded-2xl border border-border/55 bg-secondary/10 p-4"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" /><div className="min-w-0"><h2 className="text-sm font-semibold">Identity boundary</h2><div className="mt-2 grid gap-2 text-xs sm:grid-cols-2"><div className="rounded-xl border border-border/40 bg-background/30 p-3"><div className="font-mono uppercase tracking-wider text-muted-foreground">ShipSeal account</div><div className="mt-1 break-words font-medium text-foreground">{account.user.displayName || account.user.email || 'Signed-in account'}</div>{account.user.email && account.user.displayName && <div className="mt-0.5 break-all text-muted-foreground">{account.user.email}</div>}</div><div className="rounded-xl border border-border/40 bg-background/30 p-3"><div className="flex items-center gap-1.5 font-mono uppercase tracking-wider text-muted-foreground"><Github className="h-3.5 w-3.5" aria-hidden="true" />Connected GitHub</div><div className="mt-1 font-medium text-foreground">{githubIdentity.status === 'loading' ? 'Checking connection…' : githubIdentity.status === 'connected' ? `@${githubIdentity.login}` : 'Not connected'}</div></div></div><p className="mt-2 text-xs leading-relaxed text-muted-foreground">Projects belong to this ShipSeal account and may come from more than one GitHub identity. The connected GitHub identity controls fresh repository access and GitHub changes; it does not change project ownership.</p></div></div></section>}

        {account.status === 'loading' && <SurfaceState className="mt-8" tone="loading" title="Checking your session" description="Preparing private project access." />}
        {(account.status === 'anonymous' || account.status === 'unavailable') && (
          <SurfaceState className="mt-8" tone={account.status === 'unavailable' ? 'error' : 'empty'} title={account.status === 'unavailable' ? 'Account sign-in is unavailable' : 'Sign in to view saved work'} description={account.availabilityMessage || 'Anonymous scanning remains available. Sign-in is required only for durable private history.'} action={<div className="flex flex-wrap justify-center gap-2"><Button onClick={account.beginSignIn}><LogIn className="mr-2 h-4 w-4" />{account.status === 'unavailable' ? 'Retry sign-in' : 'Sign in with GitHub'}</Button><Button variant="outline" asChild><a href="/#scan">Scan without an account</a></Button></div>} />
        )}
        {account.user && status === 'loading' && <SurfaceState className="mt-8" tone="loading" title="Loading projects" description="Retrieving your private project list." />}
        {account.user && status === 'failed' && <SurfaceState className="mt-8" tone="error" title="My Projects is unavailable" description="ShipSeal could not load the private project list." action={<Button variant="outline" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Retry</Button>} />}
        {account.user && status === 'ready' && projects.length === 0 && <SurfaceState className="mt-8" tone="empty" icon={FolderGit2} title="No projects yet" description="Completed repository scans are saved here automatically while you are signed in." action={<Button asChild><a href="/#scan">Scan a repository</a></Button>} />}
        {account.user && projects.length > 0 && <ul className="mt-8 grid gap-3">{projects.map(project => <li key={project.id} className="rounded-2xl border border-border/60 bg-secondary/15 p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><h2 className="break-words font-semibold [overflow-wrap:anywhere]">{project.displayName}</h2><p className="mt-1 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">{project.repositoryOwner && project.repositoryName ? `${project.repositoryOwner}/${project.repositoryName}` : project.uploadLabel || 'Uploaded project'}</p><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"><span>{sourceLabel(project.sourceType)}</span><span>{project.scanCount.toLocaleString()} {project.scanCount === 1 ? 'scan' : 'scans'}</span><span>{project.lastScanAt ? `Last scanned ${new Date(project.lastScanAt).toLocaleString()}` : 'No scans'}</span><span>{project.latestScanStatus ? `Latest ${project.latestScanStatus}` : 'Status unavailable'}</span><span>{project.latestIntelligenceMode ? `${project.latestIntelligenceMode} intelligence` : 'Mode unavailable'}</span><span>{project.latestVerificationState ? `Verification ${project.latestVerificationState}` : 'Verification unavailable'}</span></div></div><Button asChild><a href={`/projects/${project.id}`}>Open project</a></Button></div></li>)}</ul>}

        {account.user && <section className="mt-12 border-t border-border/50 pt-8"><h2 className="font-display text-lg font-semibold">Account data</h2><div className="mt-2 flex max-w-2xl flex-col gap-2 text-sm leading-relaxed text-muted-foreground">{account.productMode?.earlyAccessFree ? <p>Early Access does not require payment. Existing Stripe billing history remains unchanged; an active historical subscription must still be ended before account deletion.</p> : <p><strong className="text-foreground">1.</strong> If a Stripe subscription is active, trialing, or past due, use Manage subscription above and end it first.</p>}<p>{!account.productMode?.earlyAccessFree && <strong className="text-foreground">2. </strong>}Delete the ShipSeal account to remove private projects, scans, derived snapshots, Future/AI operations, entitlements, usage adjustments, billing mappings, and sessions, and anonymize the account identity row.</p><p>Deletion does not cancel or erase Stripe records, uninstall the GitHub App, revoke GitHub-side authorization, or remove GitHub branches and Pull Requests. See the <a className="text-primary hover:underline" href="/privacy">Privacy page</a> for the complete boundary.</p></div>{accountDeleteError && <p role="alert" className="mt-4 max-w-2xl rounded-xl border border-destructive/35 bg-destructive/10 px-4 py-3 text-sm text-muted-foreground">{accountDeleteError}</p>}{confirmAccountDelete ? <div className="mt-4 rounded-2xl border border-destructive/40 bg-destructive/10 p-4"><p className="text-sm">Delete all ShipSeal account data? This cannot be undone. External GitHub and Stripe data is not deleted.</p><div className="mt-3 flex flex-wrap gap-2"><Button variant="destructive" onClick={() => void removeAccount()}>Delete my ShipSeal account</Button><Button variant="outline" onClick={() => { setConfirmAccountDelete(false); setAccountDeleteError(''); }}>Cancel</Button></div></div> : <Button className="mt-4" variant="outline" onClick={() => { setConfirmAccountDelete(true); setAccountDeleteError(''); }}><Trash2 className="mr-2 h-4 w-4" />Delete account</Button>}</section>}
      </main>
    </div>
  );
}

function sourceLabel(sourceType: PersistedProject['sourceType']) {
  if (sourceType === 'github-app') return 'Connected GitHub';
  if (sourceType === 'github-public' || sourceType === 'github-url') return 'Public GitHub';
  return 'Local ZIP';
}
