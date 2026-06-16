import type React from 'react';
import { useCallback, useMemo, useState, useRef } from 'react';
import { Github, Upload, FileArchive, X, Plug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatFileSize, validateZipUpload } from '@/lib/uploadValidation';
import { parseGitHubUrl } from '@/lib/github/parseGitHubUrl';
import { getGitHubAppClientConfig, type GitHubAppClientConfig } from '@/lib/githubApp/config';
import type { GitHubAppInstallation, GitHubAppRepository, GitHubAppRepositoryListStatus } from '@/lib/githubApp/types';

interface Props {
  onFile: (file: File) => void;
  onGitHubImport?: (url: string, branch?: string) => void;
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
  const [selected, setSelected] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [githubUrl, setGithubUrl] = useState('');
  const [githubBranch, setGithubBranch] = useState('');
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
      setSelected(null);
      return;
    }
    setError(null);
    setSelected(f);
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handle(f);
  };

  return (
    <div className="w-full">
      <div className="mb-4 grid md:grid-cols-3 gap-3">
        <SourceOption
          active={mode === 'github-app'}
          icon={<Plug className="h-4 w-4" />}
          title="Connect GitHub"
          description="Best for selecting repositories and creating Pull Requests."
          recommended
          disabled={disabled}
          onClick={() => { setMode('github-app'); setError(null); }}
        />
        <SourceOption
          active={mode === 'github'}
          icon={<Github className="h-4 w-4" />}
          title="Import public GitHub URL"
          description="Good for public repo scans. PR creation requires connection later."
          disabled={disabled}
          onClick={() => { setMode('github'); setError(null); }}
        />
        <SourceOption
          active={mode === 'zip'}
          icon={<FileArchive className="h-4 w-4" />}
          title="Upload ZIP"
          description="Best for local/private review without GitHub access."
          disabled={disabled}
          onClick={() => { setMode('zip'); setError(null); }}
        />
      </div>

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
              {!appConfig.isConfigured && (
                <div className="mt-2 text-xs text-warning">
                  GitHub App connection is not configured in this demo. Use public URL or ZIP upload.
                </div>
              )}
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
              {githubInstallationId && repositoryListStatus === 'not_configured' && (
                <div className="mt-2 text-xs text-warning">
                  {repositoryListMessage || 'GitHub connection is configured, but ShipSeal could not create an installation token.'}
                </div>
              )}
              {repositoryListStatus === 'error' && repositoryListMessage && (
                <div className="mt-2 text-xs text-destructive">{repositoryListMessage}</div>
              )}
              {repositoryListStatus === 'loaded' && repositories.length === 0 && (
                <div className="mt-2 text-xs text-warning">No repositories are available for this GitHub App installation.</div>
              )}
            </div>
            <Button type="button" variant="outline" disabled={disabled || !appConfig.isConfigured} onClick={onGitHubConnect}>
              <Plug className="h-4 w-4 mr-2" /> Connect GitHub
            </Button>
          </div>
          {githubInstallations.length > 1 && (
            <label className="mb-4 block">
              <span className="block text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1.5">GitHub account</span>
              <select
                aria-label="Select GitHub installation"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                value={githubInstallationId || ''}
                onChange={event => onGitHubInstallationSelect?.(event.target.value)}
              >
                <option value="" disabled>Select GitHub account</option>
                {githubInstallations.map(installation => (
                  <option key={installation.id} value={installation.id}>
                    {installation.accountLogin}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="block">
            <span className="block text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1.5">Select repository</span>
            {repositoryListStatus === 'loaded' && repositories.length > 0 ? (
              <select
                aria-label="Select repository"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                defaultValue=""
                onChange={event => {
                  const repository = repositories.find(repo => repo.fullName === event.target.value);
                  if (repository) onGitHubAppRepositorySelect?.(repository);
                }}
              >
                <option value="" disabled>Select repository</option>
                {repositories.map(repository => (
                  <option key={repository.fullName} value={repository.fullName}>
                    {repository.fullName}
                  </option>
                ))}
              </select>
            ) : (
              <Input aria-label="Select repository" disabled placeholder="Connect GitHub to list repositories" />
            )}
          </label>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" disabled={disabled || !githubInstallationId} onClick={onGitHubRepositoryRetry}>
              Retry repository listing
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={disabled || !appConfig.isConfigured} onClick={onGitHubConnect}>
              Reconnect GitHub
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={disabled || !githubInstallationId} onClick={onGitHubDisconnect}>
              Disconnect GitHub
            </Button>
            {appConfig.installUrl && (
              <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={onGitHubInstall}>
                Install ShipSeal GitHub App
              </Button>
            )}
          </div>
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
          <div className="text-sm text-muted-foreground mt-1.5">or click to browse - max 25 MB, .zip only</div>
          <div className="text-xs text-muted-foreground/70 mt-4 max-w-md">
            ShipSeal does not execute uploaded code. Scanning runs in your browser on structure and metadata only.
          </div>
          {!selected && (
            <div className="mt-4 rounded-lg border border-border/60 bg-secondary/25 px-3 py-2 text-xs text-muted-foreground">
              No file selected yet. Choose a repository ZIP when you are ready.
            </div>
          )}
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
              value={githubUrl}
              onChange={event => setGithubUrl(event.target.value)}
              placeholder="https://github.com/Csisz/shipseal"
              disabled={disabled}
            />
            <Input
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
          <div className="mt-4 text-xs text-muted-foreground/80 space-y-1">
            <div>Examples: <span className="font-mono text-foreground/80">https://github.com/Csisz/shipseal</span>, <span className="font-mono text-foreground/80">github.com/Csisz/shipseal</span>, or a <span className="font-mono text-foreground/80">.git</span> URL.</div>
            <div>Only public GitHub repositories are supported in the local MVP. Private repositories are not supported.</div>
            <div>Public GitHub import may be blocked by browser CORS restrictions in local mode. ZIP upload is the most reliable local MVP path.</div>
            <div>Hosted demos can use the ShipSeal GitHub archive proxy. In local browser mode, ZIP upload remains the most reliable option.</div>
            <div>Local MVP note: if GitHub import is blocked, use Download ZIP on GitHub and upload it here.</div>
            {!githubUrl.trim() && <div className="text-accent">Enter a GitHub URL to enable import.</div>}
          </div>
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
        <div className="mt-3 text-sm text-destructive">{error}</div>
      )}

      {selected && (
        <div className="mt-4 glass rounded-xl p-4 flex items-center gap-3 animate-fade-in">
          <div className="h-10 w-10 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
            <FileArchive className="h-5 w-5 text-primary-glow" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{selected.name}</div>
            <div className="text-xs text-muted-foreground">{formatFileSize(selected.size)} - validated ZIP</div>
          </div>
          <Button
            variant="ghost" size="icon" type="button"
            onClick={() => { setSelected(null); if (inputRef.current) inputRef.current.value = ''; }}
          >
            <X className="h-4 w-4" />
          </Button>
          <Button variant="default" onClick={() => selected && onFile(selected)} disabled={disabled}>
            Analyze repository
          </Button>
        </div>
      )}
    </div>
  );
}

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
        'min-h-32 text-left rounded-xl border p-4 transition-colors bg-secondary/25 hover:border-primary/40',
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
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{description}</p>
    </button>
  );
}
