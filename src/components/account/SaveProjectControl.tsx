import { useMemo, useState } from 'react';
import { Cloud, Loader2, LogIn, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ReadinessReport } from '@/lib/types';
import type { RepositoryIntelligenceProviderStatus } from '@/lib/repositoryIntelligence';
import { buildSaveProjectRequest } from '@/lib/persistence/buildSnapshot';
import { PersistenceClientError, saveProject, type PersistedProject } from '@/lib/persistence';
import { useOptionalAccount } from './accountContext';

export function SaveProjectControl({ report, providerStatus }: { report: ReadinessReport; providerStatus?: RepositoryIntelligenceProviderStatus }) {
  const account = useOptionalAccount();
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [message, setMessage] = useState('');
  const [savedProject, setSavedProject] = useState<PersistedProject | null>(null);
  const request = useMemo(() => buildSaveProjectRequest({ report, providerStatus }), [report, providerStatus]);

  const save = async () => {
    if (!account.user) { account.beginSignIn(); setMessage('Sign in with GitHub, then choose Save project again. This scan remains open.'); return; }
    setState('saving'); setMessage('');
    try {
      const saved = await saveProject(request);
      setSavedProject(saved.project); setState('saved'); setMessage('Project and scan history saved privately.');
    } catch (error) {
      setState('failed');
      setMessage(error instanceof PersistenceClientError && error.code === 'authentication_required'
        ? 'Your session expired. Sign in again; the current scan is still available.'
        : 'Saving is temporarily unavailable. The current scan remains usable and was not rerun.');
    }
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-background/20 p-3 text-left">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={save} disabled={state === 'saving'}>
          {state === 'saving' ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : account.user ? <Cloud className="mr-1.5 h-3.5 w-3.5" /> : <LogIn className="mr-1.5 h-3.5 w-3.5" />}
          {state === 'failed' ? 'Retry save' : state === 'saved' ? 'Saved' : 'Save project'}
        </Button>
        {account.user && <a className="text-xs text-primary-glow underline-offset-4 hover:underline" href="/projects">My projects</a>}
        {state === 'failed' && <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />}
      </div>
      {message && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{message}</p>}
      {savedProject && <a className="mt-1 block break-all text-xs text-primary-glow underline-offset-4 hover:underline" href={`/projects/${savedProject.id}`}>Open saved project</a>}
    </div>
  );
}
