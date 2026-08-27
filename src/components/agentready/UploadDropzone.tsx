import type React from 'react';
import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { GitBranch, Github, Search, Upload, FileArchive, Plug, ShieldCheck, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { validateZipUpload } from '@/lib/uploadValidation';
import { parseGitHubUrl } from '@/lib/github/parseGitHubUrl';
import { getGitHubAppClientConfig, type GitHubAppClientConfig } from '@/lib/githubApp/config';
import type { GitHubAppInstallation, GitHubAppRepository, GitHubAppRepositoryListStatus } from '@/lib/githubApp/types';

interface Props {
  onFile: (file: File) => void;
  onGitHubImport?: (url: string, branch?: string) => void;
  onSampleReport?: () => void;
  disabled?: boolean;
  githubAppConfig?: GitHubAppClientConfig;
  githubInstallationId?: string;
  repositoryListStatus?: GitHubAppRepositoryListStatus;
  repositories?: GitHubAppRepository[];
  repositoryListMessage?: string;
  githubInstallations?: GitHubAppInstallation[];
  onGitHubAppRepositorySelect?: (repository: GitHubAppRepository) => void;
  onGitHubConnect?: () => void;
  onGitHubInstall?: () => void;
  onGitHubDisconnect?: () => void;
  onGitHubRepositoryRetry?: () => void;
  onGitHubInstallationSelect?: (installationId: string) => void;
}

export function UploadDropzone({
  onFile,
  onGitHubImport,
  onSampleReport,
  disabled,
  githubAppConfig,
  githubInstallationId,
  repositoryListStatus = 'idle',
  repositories = [],
  repositoryListMessage,
  githubInstallations = [],
  onGitHubAppRepositorySelect,
  onGitHubConnect,
  onGitHubInstall,
  onGitHubDisconnect,
  onGitHubRepositoryRetry,
  onGitHubInstallationSelect,
}: Props) {
  const appConfig = useMemo(() => githubAppConfig || getGitHubAppClientConfig(), [githubAppConfig]);
  const [mode, setMode] = useState<'github-app' | 'github' | 'zip'>('github-app');
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [githubUrl, setGithubUrl] = useState('');
  const [githubBranch, setGithubBranch] = useState('');
  const [selectedRepositoryFullName, setSelectedRepositoryFullName] = useState('');
  const [repositorySearch, setRepositorySearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const detectedRepository = useMemo(() => {
    if (!githubUrl.trim()) return '';
    try {
      const parsed = parseGitHubUrl(githubUrl);
      return `${parsed.owner}/${parsed.repo}`;
    } catch {
      return '';
    }
  }, [githubUrl]);

  const handle = useCallback((f: File) => {
    const validation = validateZipUpload(f);
    if (!validation.valid) {
      setError(validation.error || 'That ZIP did not pass validation. Choose a repository .zip file under the local size limit.');
      return;
    }
    setError(null);
    onFile(f);
  }, [onFile]);

  useEffect(() => {
    if (selectedRepositoryFullName && !repositories.some(repository => repository.fullName === selectedRepositoryFullName)) {
      setSelectedRepositoryFullName('');
    }
  }, [repositories, selectedRepositoryFullName]);

  const filteredRepositories = useMemo(() => {
    const query = repositorySearch.trim().toLowerCase();
    if (!query) return repositories;
    return repositories.filter(repository => {
      const haystack = [
        repository.fullName,
        repository.owner,
        repository.name,
        repository.defaultBranch,
        repository.private ? 'private' : 'public',
      ].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [repositories, repositorySearch]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handle(f);
  };

  return (
    <div className="w-full">
      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4" aria-label="Repository source choices">
        <SourceOption
          active={mode === 'github-app'}
          icon={<Plug className="h-4 w-4" />}
          title="GitHub"
          description="Select approved repositories and keep the PR path available."
          recommended
          disabled={disabled}
          onClick={() => { setMode('github-app'); setError(null); }}
        />
        <SourceOption
          active={mode === 'github'}
          icon={<Github className="h-4 w-4" />}
          title="Public URL"
          description="Scan a supported public GitHub repository."
          disabled={disabled}
          onClick={() => { setMode('github'); setError(null); }}
        />
        <SourceOption
          active={mode === 'zip'}
          icon={<FileArchive className="h-4 w-4" />}
          title="Upload ZIP"
          description="Scan a local archive without connecting GitHub."
          disabled={disabled}
          onClick={() => { setMode('zip'); setError(null); }}
        />
        <SourceOption
          active={false}
          icon={<Play className="h-4 w-4" />}
          title="Try sample"
          description="Open a clearly labeled demonstration repository."
          disabled={disabled || !onSampleReport}
          onClick={() => onSampleReport?.()}
        />
      </div>

      <TrustHintStrip />

      {mode === 'github-app' ? (
        <div className={cn('glass rounded-2xl p-6', disabled && 'opacity-60 pointer-events-none')}>
          <div className="flex flex-wrap items-start gap-3 mb-5">
            <div className="h-11 w-11 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
              <Plug className="h-5 w-5 text-primary-glow" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-display text-lg font-semibold">Connect GitHub</div>
              <div className="text-sm text-muted-foreground">
                Connect before scanning so ShipSeal can later create a Pull Request for the same selected repository.
              </div>
              {githubInstallationId && repositoryListStatus === 'loading' && (
                <div className="mt-2 text-xs text-primary-glow">
                  GitHub App installation detected. Loading repositories...
                </div>
              )}
              {githubInstallationId && repositoryListStatus === 'loaded' && (
                <div className="mt-2 text-xs text-success">
                  GitHub connected. Select a repository to scan.
                </div>
              )}
              {repositoryListStatus === 'not_configured' && (
                <div className="mt-2 text-xs text-warning">
                  {repositoryListMessage || 'GitHub connection is unavailable on this deployment. Upload a ZIP or use a public repository URL.'}
                </div>
              )}
              {repositoryListStatus === 'error' && repositoryListMessage && (
                <div className="mt-2 text-xs text-destructive">{repositoryListMessage}</div>
              )}
              {repositoryListStatus === 'loaded' && repositories.length === 0 && (
                <div className="mt-2 text-xs text-warning">
                  {repositoryListMessage || 'No repositories are available for this GitHub App installation. Configure the ShipSeal GitHub App and choose All repositories or add the missing repository.'}
                </div>
              )}
            </div>
            {!githubInstallationId && repositoryListStatus !== 'loading' && (
              <Button type="button" disabled={disabled} onClick={onGitHubConnect}>
                <Plug className="mr-2 h-4 w-4" /> Connect GitHub
              </Button>
            )}
          </div>
          {githubInstallations.length > 1 && (
            <label className="mb-4 block">
              <span className="block text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1.5">GitHub account</span>
              <Select value={githubInstallationId || undefined} onValueChange={value => onGitHubInstallationSelect?.(value)}>
                <SelectTrigger aria-label="Select GitHub installation" className={shipSealSelectTriggerClass}>
                  <SelectValue placeholder="Select GitHub account" />
                </SelectTrigger>
                <SelectContent className={shipSealSelectContentClass}>
                  {githubInstallations.map(installation => (
                    <SelectItem key={installation.id} value={installation.id} className={shipSealSelectItemClass}>
                      {installation.accountLogin}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          )}
          <div className="block">
            <span className="block text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1.5">Select repository</span>
            {repositoryListStatus === 'loaded' && repositories.length > 0 ? (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    aria-label="Search repositories"
                    value={repositorySearch}
                    onChange={event => setRepositorySearch(event.target.value)}
                    placeholder="Search repositories"
                    className="h-10 rounded-xl border-primary/25 bg-secondary/25 pl-9"
                  />
                </div>
                <Select
                  value={selectedRepositoryFullName}
                  onValueChange={value => {
                    setSelectedRepositoryFullName(value);
                    const repository = repositories.find(candidate => candidate.fullName === value);
                    if (repository) onGitHubAppRepositorySelect?.(repository);
                  }}
                >
                  <SelectTrigger aria-label="Select repository" className={shipSealSelectTriggerClass}>
                    <SelectValue placeholder={filteredRepositories.length ? 'Choose a repository' : 'No matching repositories'} />
                  </SelectTrigger>
                  <SelectContent className={shipSealSelectContentClass}>
                    {filteredRepositories.map(repository => (
                      <SelectItem key={repository.fullName} value={repository.fullName} className={shipSealSelectItemClass}>
                        <div className="flex min-w-0 flex-col gap-1">
                          <span className="truncate font-medium">{repository.fullName}</span>
                          <span className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                            <span>{repository.private ? 'Private' : 'Public'}</span>
                            <span className="inline-flex items-center gap-1">
                              <GitBranch className="h-3 w-3" /> {repository.defaultBranch || 'default branch'}
                            </span>
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {filteredRepositories.length === 0 && (
                  <div className="rounded-lg border border-border/60 bg-secondary/20 px-3 py-2 text-xs text-muted-foreground">
                    No repositories match that search.
                  </div>
                )}
              </div>
            ) : (
              <Input aria-label="Select repository" disabled placeholder="Connect GitHub to list repositories" />
            )}
          </div>
          {(repositoryListStatus === 'error' || repositoryListStatus === 'not_configured') && (
            <div className="mt-4 rounded-xl border border-warning/25 bg-warning/5 p-3">
              <p className="mb-2 text-xs text-muted-foreground">Your scan is not blocked. Continue without connected GitHub:</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" disabled={disabled || !githubInstallationId} onClick={onGitHubRepositoryRetry}>
                  Retry repository listing
                </Button>
                <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={onGitHubConnect}>
                  Reconnect GitHub
                </Button>
                <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => setMode('github')}>
                  Use public URL
                </Button>
                <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => setMode('zip')}>
                  Upload ZIP
                </Button>
              </div>
            </div>
          )}
          {(githubInstallationId || appConfig.installUrl) && (
            <details className="group mt-4 rounded-xl border border-border/50 bg-background/20">
              <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground">GitHub connection controls</summary>
              <div className="flex flex-wrap gap-2 border-t border-border/45 p-3">
                {githubInstallationId && (
                  <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={onGitHubConnect}>Reconnect</Button>
                )}
                <Button type="button" variant="ghost" size="sm" disabled={disabled || !githubInstallationId} onClick={onGitHubDisconnect}>Disconnect</Button>
                {appConfig.installUrl && (
                  <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={onGitHubInstall}>
                    Install or configure ShipSeal GitHub App
                  </Button>
                )}
              </div>
            </details>
          )}
        </div>
      ) : mode === 'zip' ? (
        <label
          htmlFor="agentready-file"
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            'relative flex flex-col items-center justify-center w-full rounded-2xl border-2 border-dashed cursor-pointer transition-all p-10 text-center',
            'glass hover:border-primary/60 hover:bg-card/60',
            dragging && 'border-primary bg-primary/5 scale-[1.01]',
            !dragging && 'border-border/80',
            disabled && 'opacity-60 pointer-events-none'
          )}
        >
          <div className="mb-4 h-14 w-14 rounded-2xl bg-gradient-primary/20 border border-primary/30 flex items-center justify-center shadow-glow">
            <Upload className="h-6 w-6 text-primary-glow" />
          </div>
          <div className="font-display text-lg font-semibold">Drop your repository ZIP here</div>
          <div className="text-sm text-muted-foreground mt-1.5">or click to browse - up to 2 GB, .zip only</div>
          <div className="text-xs text-muted-foreground/70 mt-4 max-w-md">
            ShipSeal does not execute uploaded code. Browser-local indexing reads only selected repository evidence.
          </div>
          <div className="mt-4 rounded-lg border border-border/60 bg-secondary/25 px-3 py-2 text-xs text-muted-foreground">
            Choosing a valid repository ZIP starts the scan immediately.
          </div>
          <input
            ref={inputRef}
            id="agentready-file"
            type="file"
            accept=".zip"
            className="sr-only"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handle(f); }}
          />
        </label>
      ) : (
        <div className={cn('glass rounded-2xl p-6', disabled && 'opacity-60 pointer-events-none')}>
          <div className="flex items-center gap-3 mb-5">
            <div className="h-11 w-11 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
              <Github className="h-5 w-5 text-primary-glow" />
            </div>
            <div>
              <div className="font-display text-lg font-semibold">Import a public GitHub repo</div>
              <div className="text-sm text-muted-foreground">Paste a public GitHub repository URL.</div>
            </div>
          </div>
          <div className="space-y-3">
            <Input
              aria-label="Public GitHub repository URL"
              value={githubUrl}
              onChange={event => setGithubUrl(event.target.value)}
              placeholder="https://github.com/Csisz/shipseal"
              disabled={disabled}
            />
            <Input
              aria-label="Optional GitHub branch or ref"
              value={githubBranch}
              onChange={event => setGithubBranch(event.target.value)}
              placeholder="Optional branch, for example main"
              disabled={disabled}
            />
          </div>
          {detectedRepository && (
            <div className="mt-3 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-foreground/85">
              Detected repository: {detectedRepository}
            </div>
          )}
          <div className="mt-3 text-xs text-muted-foreground">
            Supported example: <span className="font-mono text-foreground/80">https://github.com/Csisz/shipseal</span>. Public repositories only.
          </div>
          <details className="mt-3 rounded-xl border border-border/50 bg-background/20 text-xs text-muted-foreground">
            <summary className="cursor-pointer px-3 py-2 font-medium hover:text-foreground">Public import limits and fallback</summary>
            <div className="space-y-2 border-t border-border/45 px-3 py-3">
              <p>Local browser import may be blocked by CORS or network policy. Hosted demos can use the ShipSeal archive proxy.</p>
              <p>If import fails, download the repository ZIP from GitHub and upload it here.</p>
            </div>
          </details>
          <Button
            className="mt-5 w-full sm:w-auto"
            onClick={() => onGitHubImport?.(githubUrl, githubBranch || undefined)}
            disabled={disabled || !githubUrl.trim()}
          >
            <Github className="h-4 w-4 mr-2" /> Import public repo
          </Button>
        </div>
      )}

      {error && (
        <div role="alert" className="mt-3 rounded-xl border border-destructive/35 bg-destructive/10 p-4">
          <div className="text-sm font-semibold text-foreground">ZIP could not be used</div>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()}>Choose another ZIP</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => { setMode('github'); setError(null); }}>Use public URL</Button>
          </div>
        </div>
      )}

    </div>
  );
}

function TrustHintStrip() {
  return (
    <div className="mb-4 flex items-start gap-2 rounded-xl border border-border/55 bg-secondary/15 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
      <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" />
      <span>ShipSeal performs a static scan of allowed repository evidence. Imported code is never executed.</span>
    </div>
  );
}

const shipSealSelectTriggerClass = cn(
  'h-11 rounded-xl border-primary/30 bg-secondary/35 px-4 text-sm text-foreground shadow-elegant ring-offset-0 transition-all',
  'hover:border-primary/60 hover:bg-secondary/50 focus:ring-2 focus:ring-primary/50 focus:ring-offset-0',
  'data-[placeholder]:text-muted-foreground',
);

const shipSealSelectContentClass = cn(
  'max-h-80 rounded-xl border-primary/30 bg-card/95 text-foreground shadow-glow backdrop-blur-xl',
);

const shipSealSelectItemClass = cn(
  'rounded-lg py-2.5 pr-3 text-sm text-foreground/90 focus:bg-primary/20 focus:text-foreground',
  'data-[state=checked]:bg-primary/20 data-[state=checked]:text-primary-glow',
);

function SourceOption({
  active,
  icon,
  title,
  description,
  recommended = false,
  disabled,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  description: string;
  recommended?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'min-h-24 text-left rounded-xl border p-3.5 transition-colors bg-secondary/20 hover:border-primary/40',
        active ? 'border-primary/50 bg-primary/10' : 'border-border/60',
        disabled && 'opacity-60 pointer-events-none'
      )}
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        <span className="text-primary-glow">{icon}</span>
        <span>{title}</span>
        {recommended && (
          <span className="ml-auto rounded-full border border-success/40 px-2 py-0.5 text-[10px] text-success">Recommended</span>
        )}
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
    </button>
  );
}
