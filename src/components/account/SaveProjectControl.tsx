import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Cloud, Loader2, LogIn, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ReadinessReport } from '@/lib/types';
import type { RepositoryIntelligenceProviderStatus } from '@/lib/repositoryIntelligence';
import type { RepositoryIntelligenceVerificationBaseline, RepositoryIntelligenceVerificationResult } from '@/lib/repositoryIntelligence';
import { buildSaveProjectRequest, buildVerificationRelationshipInput } from '@/lib/persistence/buildSnapshot';
import { PersistenceClientError, saveProject, saveProjectScan } from '@/lib/persistence';
import { useOptionalAccount } from './accountContext';

export interface PersistedProjectContext {
  projectId: string;
  scanId: string;
}

const inFlightAutosaves = new Map<string, Promise<PersistedProjectContext>>();

export function SaveProjectControl({
  report,
  providerStatus,
  verificationBaseline,
  verificationResult,
  projectId,
  baselineScanId,
  existingContext = null,
  autoSave = true,
  onPersisted,
}: {
  report: ReadinessReport;
  providerStatus?: RepositoryIntelligenceProviderStatus;
  verificationBaseline?: RepositoryIntelligenceVerificationBaseline | null;
  verificationResult?: RepositoryIntelligenceVerificationResult | null;
  projectId?: string | null;
  baselineScanId?: string | null;
  existingContext?: PersistedProjectContext | null;
  autoSave?: boolean;
  onPersisted?: (context: PersistedProjectContext) => void;
}) {
  const account = useOptionalAccount();
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'failed'>(existingContext ? 'saved' : 'idle');
  const [message, setMessage] = useState(existingContext ? 'Saved privately in My Projects.' : '');
  const [persistedContext, setPersistedContext] = useState<PersistedProjectContext | null>(existingContext);
  const verificationRelationship = useMemo(() => verificationBaseline && baselineScanId
    ? buildVerificationRelationshipInput({ baselineScanId, report, baseline: verificationBaseline, result: verificationResult })
    : undefined, [baselineScanId, report, verificationBaseline, verificationResult]);
  const request = useMemo(() => buildSaveProjectRequest({ report, providerStatus, verificationBaseline: verificationBaseline || undefined, verificationRelationship }), [report, providerStatus, verificationBaseline, verificationRelationship]);

  const persist = useCallback(async (deduplicate: boolean) => {
    if (!account.user) return null;
    const key = `${account.user.id}:${request.idempotencyKey}`;
    const execute = async (): Promise<PersistedProjectContext> => {
      if (projectId) {
        const scan = await saveProjectScan(projectId, request);
        return { projectId, scanId: scan.id };
      }
      const saved = await saveProject(request);
      return { projectId: saved.project.id, scanId: saved.scan.id };
    };
    if (!deduplicate) return execute();
    const existing = inFlightAutosaves.get(key);
    if (existing) return existing;
    const pending = execute();
    inFlightAutosaves.set(key, pending);
    const clear = () => {
      if (inFlightAutosaves.get(key) === pending) inFlightAutosaves.delete(key);
    };
    void pending.then(clear, clear);
    return pending;
  }, [account.user, projectId, request]);

  const save = useCallback(async (deduplicate = true) => {
    if (!account.user) {
      account.beginSignIn();
      setMessage('Sign in with GitHub to keep this scan in your private workspace. This result remains open.');
      return;
    }
    setState('saving');
    setMessage('');
    try {
      const context = await persist(deduplicate);
      if (!context) return;
      setPersistedContext(context);
      setState('saved');
      setMessage(verificationRelationship
        ? 'Saved privately with its verification relationship.'
        : 'Saved privately in My Projects.');
      onPersisted?.(context);
    } catch (error) {
      setState('failed');
      if (error instanceof PersistenceClientError) {
        if (['authentication_required', 'session_expired'].includes(error.code)) {
          setMessage('Your session expired. Sign in again; the repository result is still available.');
        } else if (error.code === 'conflict') {
          setMessage('ShipSeal could not attach this scan to its private project safely. The result is still available.');
        } else if (['invalid_request', 'unsupported_version'].includes(error.code)) {
          setMessage('ShipSeal could not validate the private-save request. The repository result is still available.');
        } else {
          setMessage('Your repository result is ready, but ShipSeal could not save it privately yet.');
        }
      } else {
        setMessage('Your repository result is ready, but ShipSeal could not save it privately yet.');
      }
    }
  }, [account, onPersisted, persist, verificationRelationship]);

  useEffect(() => {
    setState(existingContext ? 'saved' : 'idle');
    setMessage(existingContext ? 'Saved privately in My Projects.' : '');
    setPersistedContext(existingContext);
  }, [existingContext, request.idempotencyKey]);

  useEffect(() => {
    if (!autoSave || !account.user || state !== 'idle') return;
    void save(true);
  }, [account.user, autoSave, save, state]);

  return (
    <div className="rounded-2xl border border-border/60 bg-background/20 p-3 text-left" data-testid="project-persistence-control">
      <div className="flex flex-wrap items-center gap-2" aria-live="polite">
        {!account.user ? (
          <Button type="button" size="sm" variant="outline" onClick={() => void save(false)}>
            <LogIn className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Sign in to save
          </Button>
        ) : state === 'failed' ? (
          <Button type="button" size="sm" variant="outline" onClick={() => void save(true)}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Retry save
          </Button>
        ) : (
          <div className="inline-flex min-h-9 items-center rounded-full border border-border/60 bg-background/45 px-3 text-xs font-medium text-muted-foreground">
            {state === 'saved'
              ? <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-primary-glow" aria-hidden="true" />
              : state === 'saving'
                ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                : <Cloud className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />}
            {state === 'saved' ? 'Saved privately' : state === 'saving' ? 'Saving privately…' : 'Preparing private save…'}
          </div>
        )}
        {account.user && <a className="text-xs text-primary-glow underline-offset-4 hover:underline" href="/projects">My Projects</a>}
      </div>
      {message && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{message}</p>}
      {account.availabilityMessage && <p role="status" className="mt-2 text-xs leading-relaxed text-warning">{account.availabilityMessage}</p>}
      {persistedContext && <a className="mt-1 block break-all text-xs text-primary-glow underline-offset-4 hover:underline" href={`/projects/${persistedContext.projectId}`}>Open project history</a>}
    </div>
  );
}
