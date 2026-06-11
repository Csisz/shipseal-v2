import { useMemo, useState } from 'react';
import { AlertTriangle, ExternalLink, GitPullRequestDraft, Github, KeyRound, Plug, ShieldCheck } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { getGitHubAppClientConfig, type GitHubAppClientConfig } from '@/lib/githubApp/config';
import { buildGitHubConnectionFromReport, type GitHubConnectionState } from '@/lib/githubConnection/types';
import type { ReadinessReport } from '@/lib/types';
import type { ReadinessFixPackFile } from '@/lib/readinessFixPack';
import { buildReadinessPrPlan } from '@/lib/readinessPr';
import {
  CreateReadinessPrClientError,
  buildCreateGitHubAppReadinessPrPayload,
  buildCreateReadinessPrPayload,
  createGitHubAppReadinessPr,
  createReadinessPr,
  inferGitHubRepo,
} from '@/lib/github/write';

interface Props {
  report: ReadinessReport;
  files: ReadinessFixPackFile[];
  githubAppConfig?: GitHubAppClientConfig;
  githubConnection?: GitHubConnectionState;
}

export function CreateReadinessPrDialog({ report, files, githubAppConfig, githubConnection }: Props) {
  const [open, setOpen] = useState(false);
  const plan = useMemo(() => buildReadinessPrPlan(), []);
  const inferred = useMemo(() => inferGitHubRepo(report), [report]);
  const prFiles = useMemo(() => files.filter(file => plan.files.some(planned => planned.path === file.path)), [files, plan.files]);
  const appConfig = useMemo(() => githubAppConfig || getGitHubAppClientConfig(), [githubAppConfig]);
  const connection = useMemo(() => githubConnection || buildGitHubConnectionFromReport(report), [githubConnection, report]);
  const [owner, setOwner] = useState(inferred.owner);
  const [repo, setRepo] = useState(inferred.repo);
  const [baseBranch, setBaseBranch] = useState(report.source.githubDefaultBranch || report.source.githubBranch || '');
  const [githubToken, setGithubToken] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ pullRequestUrl: string; branchName: string } | null>(null);
  const [advancedSection, setAdvancedSection] = useState<string>('');

  const hasWorkflowFile = prFiles.some(file => file.path === '.github/workflows/ci.yml');
  const currentRepository = inferred.owner && inferred.repo ? `${inferred.owner}/${inferred.repo}` : '';
  const connectedRepository = connection.owner && connection.repo ? `${connection.owner}/${connection.repo}` : '';

  const resetTransientState = () => {
    setGithubToken('');
    setError('');
    setIsSubmitting(false);
    setAdvancedSection('');
  };

  const connectGitHub = () => {
    if (!appConfig.isConfigured) return;
    window.open(appConfig.installUrl, '_blank', 'noopener,noreferrer');
  };

  const submit = async () => {
    setError('');
    setSuccess(null);
    if (connection.canCreatePullRequest && connection.installationId && connection.owner && connection.repo) {
      if (!confirmed) {
        setError('Confirm that ShipSeal will create a branch and open a Pull Request.');
        return;
      }

      setIsSubmitting(true);
      try {
        const response = await createGitHubAppReadinessPr(buildCreateGitHubAppReadinessPrPayload({
          report,
          installationId: connection.installationId,
          owner: connection.owner,
          repo: connection.repo,
          baseBranch: baseBranch || connection.defaultBranch || undefined,
        }));
        setSuccess({ pullRequestUrl: response.prUrl, branchName: response.branchName });
      } catch (requestError) {
        setError(requestError instanceof CreateReadinessPrClientError
          ? requestError.message
          : 'Create Readiness PR failed. Check repository access and try again.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (!owner.trim() || !repo.trim()) {
      setError('GitHub owner and repository are required.');
      return;
    }
    if (!githubToken.trim()) {
      setError('GitHub token is required.');
      return;
    }
    if (!confirmed) {
      setError('Confirm that ShipSeal will create a branch and open a Pull Request.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await createReadinessPr(buildCreateReadinessPrPayload({
        report,
        owner,
        repo,
        baseBranch: baseBranch || undefined,
        githubToken,
      }));
      setSuccess({ pullRequestUrl: response.pullRequestUrl, branchName: response.branchName });
      setGithubToken('');
    } catch (requestError) {
      setGithubToken('');
      setError(requestError instanceof CreateReadinessPrClientError
        ? requestError.message
        : 'Create Readiness PR failed. Check repository access and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)} className="bg-gradient-primary border-0 shadow-glow hover:opacity-90">
        <GitPullRequestDraft className="h-3.5 w-3.5 mr-1.5" /> Create Readiness PR
      </Button>
      <Dialog
        open={open}
        onOpenChange={nextOpen => {
          setOpen(nextOpen);
          if (!nextOpen) resetTransientState();
        }}
      >
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Create Readiness PR</DialogTitle>
            <DialogDescription>
              Create a branch with ShipSeal Readiness Fix Pack files and open a pull request for human review.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <section className="rounded-xl border border-border/60 bg-secondary/25 p-4">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <div className="text-xs font-mono uppercase tracking-wider text-primary-glow">Step 1: Review changes</div>
                <Badge variant="outline" className="border-warning/50 text-warning">Human review required</Badge>
              </div>
              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <Info label="Branch" value={plan.branchName} />
                <Info label="PR title" value={plan.title} />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">{plan.summary}</p>
              <div className="mt-4 grid sm:grid-cols-2 gap-2">
                {prFiles.map(file => (
                  <div key={file.path} className="rounded-md border border-border/60 bg-background/30 px-3 py-2">
                    <div className="font-mono text-[11px] text-foreground/90 break-all">{file.path}</div>
                    <div className="text-[10px] text-muted-foreground mt-1">{file.readinessCategory}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
                ShipSeal will create a new branch and open a pull request. It will not push to main.
              </div>
              {hasWorkflowFile && (
                <div className="mt-3 flex gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>This PR includes a GitHub Actions workflow file. Review workflow changes carefully before merging.</span>
                </div>
              )}
            </section>

            <section className="rounded-xl border border-border/60 bg-secondary/25 p-4">
              <div className="text-xs font-mono uppercase tracking-wider text-primary-glow mb-3">Step 2: GitHub access</div>
              <div className="rounded-xl border border-primary/30 bg-primary/10 p-4">
                {connection.canCreatePullRequest && connectedRepository ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <Github className="h-4 w-4 text-primary-glow" />
                    <div className="min-w-0 flex-1">
                      <div className="font-display font-semibold">Connected repository: {connectedRepository}</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        ShipSeal will create the Readiness PR through the GitHub App. No token paste is required.
                      </p>
                    </div>
                    <Badge variant="outline" className="border-success/50 text-success">Connected</Badge>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-start gap-3">
                    <Github className="h-4 w-4 text-primary-glow mt-1" />
                    <div className="min-w-0 flex-1">
                      <div className="font-display font-semibold">Connect GitHub before creating a Pull Request.</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Public URL and ZIP scans can still export reports and fix packs. PR creation requires a connected GitHub repository.
                      </p>
                      {currentRepository && (
                        <p className="mt-2 text-xs text-foreground/85">Current repository: {currentRepository}</p>
                      )}
                      {!appConfig.isConfigured && (
                        <p className="text-xs text-warning mt-2">GitHub App install is not configured in this demo.</p>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!appConfig.isConfigured}
                      onClick={connectGitHub}
                      className="border-border/60"
                    >
                      <Plug className="h-3.5 w-3.5 mr-1.5" /> Connect GitHub
                    </Button>
                  </div>
                )}
              </div>

              <Accordion
                type="single"
                collapsible
                value={advancedSection}
                onValueChange={setAdvancedSection}
                className="mt-4"
              >
                <AccordionItem value="temporary-token" className="rounded-xl border border-border/60 bg-background/30 px-4">
                  <AccordionTrigger className="py-3 text-left hover:no-underline">
                    <span className="flex items-center gap-2 text-sm">
                      <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                      Advanced: use a temporary token
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    {advancedSection === 'temporary-token' && (
                      <div className="space-y-4">
                        <div className="rounded-lg border border-border/60 bg-secondary/25 p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="font-medium text-sm">Use temporary GitHub token</div>
                            <Badge variant="outline" className="border-border/70 text-[10px]">Developer/test mode</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Developer/test mode. For production use, connect GitHub.
                          </p>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-3">
                          <label className="block">
                            <span className="block text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1.5">Repository owner</span>
                            <Input aria-label="Repository owner" value={owner} onChange={event => setOwner(event.target.value)} />
                          </label>
                          <label className="block">
                            <span className="block text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1.5">Repository name</span>
                            <Input aria-label="Repository name" value={repo} onChange={event => setRepo(event.target.value)} />
                          </label>
                          <p className="sm:col-span-2 text-xs text-muted-foreground">
                            Repository owner and name are required only if you want ShipSeal to create a GitHub Pull Request.
                          </p>
                          <label className="block">
                            <span className="block text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1.5">Base branch</span>
                            <Input aria-label="Base branch" value={baseBranch} onChange={event => setBaseBranch(event.target.value)} placeholder="Leave empty for default branch" />
                            <span className="block mt-1.5 text-xs text-muted-foreground">Leave empty to use the repository default branch.</span>
                          </label>
                          <label className="block">
                            <span className="block text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1.5">GitHub token</span>
                            <Input
                              aria-label="GitHub token"
                              type="password"
                              value={githubToken}
                              onChange={event => setGithubToken(event.target.value)}
                              autoComplete="off"
                            />
                            <span className="block mt-1.5 text-xs text-muted-foreground">
                              Temporary MVP access: paste a GitHub fine-grained token for this request only. ShipSeal keeps it in memory and does not store it.
                            </span>
                          </label>
                        </div>
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-background/30 px-3 py-2 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-primary-glow" />
                <span>For production use, connect GitHub at repository source selection. Temporary tokens are for developer testing only.</span>
              </div>
              <label className="mt-4 flex items-start gap-3 text-sm text-foreground/90">
                <Checkbox
                  checked={confirmed}
                  onCheckedChange={checked => setConfirmed(checked === true)}
                  aria-label="I understand ShipSeal will create a branch and open a Pull Request."
                />
                <span>I understand ShipSeal will create a branch and open a Pull Request.</span>
              </label>
            </section>

            <section className="rounded-xl border border-border/60 bg-secondary/25 p-4">
              <div className="text-xs font-mono uppercase tracking-wider text-primary-glow mb-3">Step 3: Submit</div>
              {error && (
                <div role="alert" className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}
              {success && (
                <div role="status" className="mb-3 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
                  <div className="font-medium">Readiness PR created</div>
                  <div className="mt-1 text-xs break-all">{success.pullRequestUrl}</div>
                  <div className="mt-1 text-xs">Branch: {success.branchName}</div>
                </div>
              )}
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                <div className="inline-flex items-start gap-2 text-xs text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5 mt-0.5" />
                  <span>Token is held in memory only for this request and cleared after submit.</span>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  {success && (
                    <Button type="button" variant="outline" asChild>
                      <a href={success.pullRequestUrl} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Open Pull Request on GitHub
                      </a>
                    </Button>
                  )}
                  <Button type="button" onClick={submit} disabled={isSubmitting} className="bg-gradient-primary border-0 shadow-glow hover:opacity-90">
                    {isSubmitting ? 'Creating...' : 'Create Pull Request'}
                  </Button>
                </div>
              </div>
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/30 p-3">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-xs font-mono text-foreground/90 break-all">{value}</div>
    </div>
  );
}
