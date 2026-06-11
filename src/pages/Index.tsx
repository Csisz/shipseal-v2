import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { Nav } from '@/components/agentready/Nav';
import { Landing } from '@/components/agentready/Landing';
import { UploadDropzone } from '@/components/agentready/UploadDropzone';
import { ScanProgress } from '@/components/agentready/ScanProgress';
import { ProjectIntakeForm } from '@/components/agentready/ProjectIntakeForm';
import { buildSampleReport } from '@/lib/readiness';
import { clearScanHistory, getScanHistory, saveScanHistory } from '@/lib/scanHistory';
import type { ReadinessReport, ScanHistoryItem } from '@/lib/types';
import { toast } from '@/hooks/use-toast';
import { useRepoScan } from '@/hooks/useRepoScan';
import type { ProjectIntake } from '@/lib/intake';
import { createDefaultProjectIntake, hasMeaningfulProjectContext } from '@/lib/intake';
import { parseGitHubUrl } from '@/lib/github/parseGitHubUrl';
import { Button } from '@/components/ui/button';
import type { GitHubAppRepository, GitHubAppRepositoryListStatus } from '@/lib/githubApp/types';
import { createConnectedGitHubConnection, type GitHubConnectionState } from '@/lib/githubConnection/types';

type PendingSource =
  | { type: 'zip'; file: File; projectName: string }
  | { type: 'github'; url: string; branch?: string; projectName: string }
  | { type: 'github-app'; url: string; branch?: string; projectName: string; connection: GitHubConnectionState; isPrivate?: boolean };

const ResultDashboard = lazy(() => import('@/components/agentready/ResultDashboard').then(module => ({ default: module.ResultDashboard })));

function importErrorTitle(category?: string | null) {
  switch (category) {
    case 'invalid-url':
      return 'Invalid GitHub URL';
    case 'unsupported-host':
      return 'Unsupported repository host';
    case 'network-cors-blocked':
      return 'GitHub ZIP download blocked';
    case 'repo-not-found':
      return 'Repository not found';
    case 'branch-ref-not-found':
      return 'Branch or ref not found';
    case 'zip-too-large':
      return 'Repository ZIP too large';
    default:
      return 'Import blocked';
  }
}

const Index = () => {
  const scan = useRepoScan();
  const [sampleReport, setSampleReport] = useState<ReadinessReport | null>(null);
  const [history, setHistory] = useState<ScanHistoryItem[]>([]);
  const [pendingSource, setPendingSource] = useState<PendingSource | null>(null);
  const [pendingIntake, setPendingIntake] = useState<ProjectIntake>(() => createDefaultProjectIntake());
  const [submittedIntake, setSubmittedIntake] = useState<ProjectIntake | undefined>();
  const [submittedIntakeSkipped, setSubmittedIntakeSkipped] = useState(false);
  const [githubInstallationId, setGithubInstallationId] = useState('');
  const [githubSetupAction, setGithubSetupAction] = useState('');
  const [repositoryListStatus, setRepositoryListStatus] = useState<GitHubAppRepositoryListStatus>('idle');
  const [githubRepositories, setGithubRepositories] = useState<GitHubAppRepository[]>([]);
  const [repositoryListMessage, setRepositoryListMessage] = useState('');
  const savedReportKey = useRef<string | null>(null);
  const lastError = useRef<string | null>(null);
  const scanSectionRef = useRef<HTMLDivElement>(null);

  const activeReport = sampleReport || scan.report;
  const isScanning = scan.status === 'scanning';

  useEffect(() => {
    setHistory(getScanHistory());
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const installationId = params.get('githubInstallationId') || '';
    const setupAction = params.get('githubSetupAction') || '';
    if (!installationId) return;

    setGithubInstallationId(installationId);
    setGithubSetupAction(setupAction);
    setRepositoryListStatus('loading');
    setRepositoryListMessage('');

    fetch(`/api/github-app/repositories?installationId=${encodeURIComponent(installationId)}`)
      .then(async response => {
        const payload = await response.json().catch(() => null);
        if (response.ok && payload?.status === 'ok' && Array.isArray(payload.repositories)) {
          setGithubRepositories(payload.repositories);
          setRepositoryListStatus('loaded');
          return;
        }
        if (payload?.status === 'not_configured') {
          setGithubRepositories([]);
          setRepositoryListStatus('not_configured');
          setRepositoryListMessage(payload.message || 'GitHub App server credentials are not configured yet.');
          return;
        }
        setGithubRepositories([]);
        setRepositoryListStatus('error');
        setRepositoryListMessage(payload?.message || 'Repository listing is not available yet.');
      })
      .catch(() => {
        setGithubRepositories([]);
        setRepositoryListStatus('error');
        setRepositoryListMessage('Repository listing is not available yet.');
      });
  }, []);

  useEffect(() => {
    if (!scan.report) return;
    const key = `${scan.report.repoName}-${scan.report.scannedAt}`;
    if (savedReportKey.current === key) return;
    savedReportKey.current = key;
    setHistory(saveScanHistory(scan.report));
    queueMicrotask(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }, [scan.report]);

  useEffect(() => {
    if (!scan.error || lastError.current === scan.error) return;
    lastError.current = scan.error;
    toast({
      title: scan.status === 'cancelled' ? 'Scan cancelled' : importErrorTitle(scan.errorCategory),
      description: scan.error,
      variant: scan.status === 'cancelled' ? 'default' : 'destructive',
    });
  }, [scan.error, scan.errorCategory, scan.status]);

  const scrollScan = useCallback(() => {
    scanSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const handleNavAnchor = useCallback((href: string) => {
    scan.resetScan();
    setSampleReport(null);
    setPendingSource(null);
    setSubmittedIntake(undefined);
    setSubmittedIntakeSkipped(false);
    savedReportKey.current = null;
    lastError.current = null;
    window.setTimeout(() => {
      const target = document.querySelector(href);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 0);
  }, [scan]);

  const handleHome = useCallback(() => {
    scan.resetScan();
    setSampleReport(null);
    setPendingSource(null);
    setSubmittedIntake(undefined);
    setSubmittedIntakeSkipped(false);
    savedReportKey.current = null;
    lastError.current = null;
    window.setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0);
  }, [scan]);

  const handleFile = useCallback((file: File) => {
    setSampleReport(null);
    savedReportKey.current = null;
    lastError.current = null;
    const projectName = file.name.replace(/\.zip$/i, '') || 'repository';
    setPendingSource({ type: 'zip', file, projectName });
    setPendingIntake(createDefaultProjectIntake(projectName));
    setSubmittedIntake(undefined);
    setSubmittedIntakeSkipped(false);
  }, []);

  const handleGitHubImport = useCallback((url: string, branch?: string) => {
    setSampleReport(null);
    savedReportKey.current = null;
    lastError.current = null;
    const projectName = githubProjectName(url);
    setPendingSource({ type: 'github', url, branch, projectName });
    setPendingIntake(createDefaultProjectIntake(projectName));
    setSubmittedIntake(undefined);
    setSubmittedIntakeSkipped(false);
  }, []);

  const handleGitHubAppRepository = useCallback((repository: GitHubAppRepository) => {
    setSampleReport(null);
    savedReportKey.current = null;
    lastError.current = null;
    const connection = createConnectedGitHubConnection({
      owner: repository.owner,
      repo: repository.name,
      defaultBranch: repository.defaultBranch,
      installationId: githubInstallationId,
    });
    setPendingSource({
      type: 'github-app',
      url: `https://github.com/${repository.fullName}`,
      branch: repository.defaultBranch,
      projectName: repository.name,
      connection,
      isPrivate: repository.private,
    });
    setPendingIntake(createDefaultProjectIntake(repository.name));
    setSubmittedIntake(undefined);
    setSubmittedIntakeSkipped(false);
  }, [githubInstallationId]);

  const startPendingScan = useCallback(() => {
    if (!pendingSource) return;
    const hasProjectContext = hasMeaningfulProjectContext(pendingIntake, pendingSource.projectName);
    const intake = hasProjectContext ? pendingIntake : createDefaultProjectIntake(pendingSource.projectName);

    setSubmittedIntake(intake);
    setSubmittedIntakeSkipped(!hasProjectContext);
    setSampleReport(null);
    savedReportKey.current = null;
    lastError.current = null;

    if (pendingSource.type === 'zip') {
      void scan.startScan(pendingSource.file);
    } else if (pendingSource.type === 'github-app') {
      void scan.startGitHubAppScan({
        installationId: pendingSource.connection.installationId || '',
        owner: pendingSource.connection.owner || '',
        repo: pendingSource.connection.repo || '',
        ref: pendingSource.connection.defaultBranch,
      });
    } else {
      void scan.startGitHubScan(pendingSource.url, pendingSource.branch);
    }
  }, [pendingIntake, pendingSource, scan]);

  const handleSample = useCallback(() => {
    scan.resetScan();
    setPendingSource(null);
    setSubmittedIntake(undefined);
    setSubmittedIntakeSkipped(false);
    const report = buildSampleReport();
    setSampleReport(report);
    setHistory(saveScanHistory(report));
    queueMicrotask(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }, [scan]);

  const reset = useCallback(() => {
    scan.resetScan();
    setSampleReport(null);
    setPendingSource(null);
    setSubmittedIntake(undefined);
    setSubmittedIntakeSkipped(false);
    savedReportKey.current = null;
    lastError.current = null;
    queueMicrotask(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }, [scan]);

  const handleClearHistory = useCallback(() => {
    clearScanHistory();
    setHistory([]);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav onNavigateAnchor={handleNavAnchor} onHome={handleHome} />

      {activeReport ? (
        <main className="pt-20">
          <Suspense fallback={<div className="container py-24 text-sm text-muted-foreground">Loading report...</div>}>
            <ResultDashboard
              report={activeReport}
              history={history}
              onReset={reset}
              onClearHistory={handleClearHistory}
              initialIntake={submittedIntake}
              intakeSkipped={submittedIntakeSkipped}
            />
          </Suspense>
        </main>
      ) : (
        <main>
          <Landing onSampleReport={handleSample} onScrollScan={scrollScan} />

          <section id="scan" ref={scanSectionRef} className="container py-20 scroll-mt-20">
            <div className="max-w-3xl mx-auto text-center mb-10">
              <div className="text-xs font-mono uppercase tracking-wider text-primary-glow mb-3">Scan</div>
              <h2 className="font-display text-3xl md:text-4xl font-bold">Scan a repository</h2>
              <p className="text-muted-foreground mt-3">
                Connect GitHub, import a public repository URL, or upload a ZIP. Strip <span className="font-mono text-foreground/80">node_modules</span>, <span className="font-mono text-foreground/80">dist</span>, and <span className="font-mono text-foreground/80">build</span> folders for the smallest, cleanest scan.
              </p>
            </div>

            <div className="max-w-2xl mx-auto">
              {isScanning ? (
                <ScanProgress
                  steps={scan.steps}
                  currentStepIndex={scan.currentStepIndex}
                  progress={scan.progress}
                  warnings={scan.warnings}
                  onCancel={scan.cancelScan}
                />
              ) : pendingSource ? (
                <ProjectContextStep
                  sourceLabel={pendingSource.type === 'zip' ? pendingSource.file.name : pendingSource.url}
                  intake={pendingIntake}
                  onChange={setPendingIntake}
                  onBack={() => setPendingSource(null)}
                  onContinue={startPendingScan}
                />
              ) : (
                <>
                  <div className="mb-5">
                    <FlowSteps activeStep={1} />
                  </div>
                  <UploadDropzone
                    onFile={handleFile}
                    onGitHubImport={handleGitHubImport}
                    githubInstallationId={githubInstallationId}
                    repositoryListStatus={repositoryListStatus}
                    repositories={githubRepositories}
                    repositoryListMessage={repositoryListMessage || (githubSetupAction ? `GitHub setup action: ${githubSetupAction}` : '')}
                    onGitHubAppRepositorySelect={handleGitHubAppRepository}
                  />
                  {scan.status === 'cancelled' && (
                    <div className="mt-4 text-center text-sm text-muted-foreground">Scan cancelled.</div>
                  )}
                </>
              )}
            </div>
          </section>
        </main>
      )}
    </div>
  );
};

function githubProjectName(url: string) {
  try {
    const parsed = parseGitHubUrl(url);
    return parsed.repo;
  } catch {
    return 'repository';
  }
}

function ProjectContextStep({
  sourceLabel,
  intake,
  onChange,
  onBack,
  onContinue,
}: {
  sourceLabel: string;
  intake: ProjectIntake;
  onChange: (value: ProjectIntake) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="space-y-5">
      <FlowSteps activeStep={2} />
      <div className="rounded-2xl border border-border/60 bg-secondary/25 px-4 py-3 text-sm text-muted-foreground">
        Repository selected: <span className="text-foreground/90 font-medium break-all">{sourceLabel}</span>
      </div>
      <ProjectIntakeForm value={intake} onChange={onChange} />
      <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-muted-foreground">
        You can continue without project context, but the client report will be more generic.
      </div>
      <div className="flex flex-col sm:flex-row gap-3 justify-end">
        <Button type="button" variant="ghost" onClick={onBack}>Back</Button>
        <Button type="button" className="bg-gradient-primary border-0 shadow-glow hover:opacity-90" onClick={onContinue}>
          Continue
        </Button>
      </div>
    </div>
  );
}

function FlowSteps({ activeStep }: { activeStep: number }) {
  const steps = [
    'Step 1: Add repository',
    'Step 2: Add project context',
    'Step 3: Generate Delivery Pack',
    'Step 4: Review and export',
  ];

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
      {steps.map((step, index) => (
        <div
          key={step}
          className={`rounded-lg border px-3 py-2 text-xs ${index + 1 === activeStep ? 'border-primary/50 bg-primary/10 text-foreground' : 'border-border/60 bg-secondary/20 text-muted-foreground'}`}
        >
          {step}
        </div>
      ))}
    </div>
  );
}

export default Index;
