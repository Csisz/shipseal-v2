import type React from 'react';
import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { GitBranch, Github, Search, Upload, FileArchive, X, Plug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
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
      setSelected(null);
      return;
    }
    setError(null);
    setSelected(f);
  }, []);

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

  const selectedRepository = useMemo(
    () => repositories.find(repository => repository.fullName === selectedRepositoryFullName),
    [repositories, selectedRepositoryFullName]
  );

  const confirmGitHubRepository = useCallback(() => {
    if (selectedRepository) onGitHubAppRepositorySelect?.(selectedRepository);
  }, [onGitHubAppRepositorySelect, selectedRepository]);

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
                <div className="mt-2 text-xs text-warning">
                  {repositoryListMessage || 'No repositories are available for this GitHub App installation. Configure the ShipSeal GitHub App and choose All repositories or add the missing repository.'}
                </div>
              )}
            </div>
            <Button type="button" variant="outline" disabled={disabled} onClick={onGitHubConnect}>
              <Plug className="h-4 w-4 mr-2" /> Connect GitHub
            </Button>
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
                  onValueChange={value => setSelectedRepositoryFullName(value)}
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
                {selectedRepository && (
                  <div className="rounded-xl border border-primary/30 bg-primary/10 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-foreground">{selectedRepository.fullName}</div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline" className="border-border/70 bg-background/25 text-[10px]">
                            {selectedRepository.private ? 'Private' : 'Public'}
                          </Badge>
                          <span className="inline-flex items-center gap-1">
                            <GitBranch className="h-3 w-3" /> {selectedRepository.defaultBranch || 'default branch'}
                          </span>
                        </div>
                      </div>
                      <Button
                        type="button"
                        onClick={confirmGitHubRepository}
                        disabled={disabled}
                        className="bg-gradient-primary border-0 shadow-glow hover:opacity-90 sm:shrink-0"
                      >
                        Scan selected repository
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Input aria-label="Select repository" disabled placeholder="Connect GitHub to list repositories" />
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" disabled={disabled || !githubInstallationId} onClick={onGitHubRepositoryRetry}>
              Retry repository listing
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={onGitHubConnect}>
              Reconnect GitHub
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={disabled || !githubInstallationId} onClick={onGitHubDisconnect}>
              Disconnect GitHub
            </Button>
            {repositoryListStatus === 'error' && (
              <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => setMode('github')}>
                Use public URL instead
              </Button>
            )}
            {appConfig.installUrl && (
              <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={onGitHubInstall}>
                Install or configure ShipSeal GitHub App
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
