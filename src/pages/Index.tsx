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
import { PackageCards } from '@/components/agentready/PackageCards';
import { FULL_PACKAGE_ID, type ShipSealPackageId } from '@/lib/packages';
import { getGitHubAppClientConfig } from '@/lib/githubApp/config';
import type { GitHubAppConnectionMessage, GitHubAppInstallation, GitHubAppRepository, GitHubAppRepositoryListStatus } from '@/lib/githubApp/types';
import { createConnectedGitHubConnection, type GitHubConnectionState } from '@/lib/githubConnection/types';
import { ChevronDown, FileText, FolderArchive, Sparkles } from 'lucide-react';
import { resolveDeliveryPackFocus } from '@/lib/deliveryPack';

type PendingSource =
  | { type: 'zip'; file: File; projectName: string }
  | { type: 'github'; url: string; branch?: string; projectName: string }
  | { type: 'github-app'; url: string; branch?: string; projectName: string; connection: GitHubConnectionState; isPrivate?: boolean };

const ResultDashboard = lazy(() => import('@/components/agentready/ResultDashboard').then(module => ({ default: module.ResultDashboard })));
const GITHUB_INSTALLATION_STORAGE_KEY = 'shipseal.githubInstallationId';

function repositoryListFriendlyMessage(code?: string, fallback?: string) {
  switch (code) {
    case 'missing_app_id':
      return 'GitHub App ID is missing in Vercel.';
    case 'missing_private_key':
    case 'invalid_private_key_format':
    case 'jwt_signing_failed':
      return 'GitHub App private key is missing or invalid in Vercel.';
    case 'missing_client_id':
    case 'missing_client_secret':
      return 'GitHub OAuth client credentials are missing in Vercel.';
    case 'installation_not_found':
      return 'GitHub App installation was not found. Reconnect GitHub.';
    case 'user_authorization_failed':
      return 'GitHub authorization was not completed. Reconnect GitHub.';
    case 'no_installations':
      return 'No ShipSeal GitHub App installation was found for this account. Use Install or configure ShipSeal GitHub App.';
    case 'network_error':
      return 'ShipSeal could not reach GitHub. Retry repository listing.';
    case 'github_api_error':
      return 'GitHub connection is configured, but ShipSeal could not create an installation token.';
    default:
      return fallback || 'GitHub repository listing failed. Retry or reconnect GitHub.';
  }
}

const EMPTY_GITHUB_APP_REPOSITORIES_MESSAGE = 'No repositories are available for this GitHub App installation. Configure the ShipSeal GitHub App and choose All repositories or add the missing repository.';

function openCenteredPopup(url: string, name: string) {
  const width = 620;
  const height = 720;
  const left = Math.max(0, window.screenX + (window.outerWidth - width) / 2);
  const top = Math.max(0, window.screenY + (window.outerHeight - height) / 2);
  return window.open(
    url,
    name,
    `popup=yes,width=${width},height=${height},left=${Math.round(left)},top=${Math.round(top)},resizable=yes,scrollbars=yes`
  );
}

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
  const [selectedPackages, setSelectedPackages] = useState<string[]>([]);
  const [submittedIntake, setSubmittedIntake] = useState<ProjectIntake | undefined>();
  const [submittedIntakeSkipped, setSubmittedIntakeSkipped] = useState(false);
  const [githubInstallationId, setGithubInstallationId] = useState('');
  const [githubSetupAction, setGithubSetupAction] = useState('');
  const [repositoryListStatus, setRepositoryListStatus] = useState<GitHubAppRepositoryListStatus>('idle');
  const [githubRepositories, setGithubRepositories] = useState<GitHubAppRepository[]>([]);
  const [githubInstallations, setGithubInstallations] = useState<GitHubAppInstallation[]>([]);
  const [repositoryListMessage, setRepositoryListMessage] = useState('');
  const savedReportKey = useRef<string | null>(null);
  const lastError = useRef<string | null>(null);
  const scanSectionRef = useRef<HTMLDivElement>(null);

  const activeReport = sampleReport || scan.report;
  const activeGithubConnection = pendingSource?.type === 'github-app' ? pendingSource.connection : undefined;
  const isScanning = scan.status === 'scanning';

  useEffect(() => {
    setHistory(getScanHistory());
  }, []);

  const loadRepositories = useCallback((installationId: string) => {
    if (!installationId) return;
    setGithubInstallationId(installationId);
    window.localStorage.setItem(GITHUB_INSTALLATION_STORAGE_KEY, installationId);
    setRepositoryListStatus('loading');
    setRepositoryListMessage('');

    fetch(`/api/github-app/repositories?installationId=${encodeURIComponent(installationId)}`)
      .then(async response => {
        const payload = await response.json().catch(() => null);
        if (response.ok && payload?.status === 'ok' && Array.isArray(payload.repositories)) {
          setGithubRepositories(payload.repositories);
          setRepositoryListStatus('loaded');
          setRepositoryListMessage(payload.repositories.length ? '' : EMPTY_GITHUB_APP_REPOSITORIES_MESSAGE);
          return;
        }
        if (payload?.status === 'not_configured') {
          setGithubRepositories([]);
          setRepositoryListStatus('not_configured');
          setRepositoryListMessage(repositoryListFriendlyMessage(payload?.code, payload?.message));
          return;
        }
        setGithubRepositories([]);
        setRepositoryListStatus('error');
        setRepositoryListMessage(repositoryListFriendlyMessage(payload?.code, payload?.message));
      })
      .catch(() => {
        setGithubRepositories([]);
        setRepositoryListStatus('error');
        setRepositoryListMessage(repositoryListFriendlyMessage('network_error'));
      });
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const installationId = params.get('githubInstallationId') || window.localStorage.getItem(GITHUB_INSTALLATION_STORAGE_KEY) || '';
    const setupAction = params.get('githubSetupAction') || '';
    if (!installationId) return;

    setGithubSetupAction(setupAction);
    loadRepositories(installationId);
  }, [loadRepositories]);

  useEffect(() => {
    const onMessage = (event: MessageEvent<GitHubAppConnectionMessage>) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || data.source !== 'shipseal-github-connect') return;
      if (data.status === 'error') {
        setGithubRepositories([]);
        setRepositoryListStatus('error');
        setRepositoryListMessage(repositoryListFriendlyMessage(data.code, data.message));
        return;
      }

      const installations = data.installations || [];
      setGithubInstallations(installations);
      const installationId = data.installationId || (installations.length === 1 ? installations[0].id : '');
      if (installationId) {
        loadRepositories(installationId);
      } else if (installations.length > 1) {
        setRepositoryListStatus('idle');
        setRepositoryListMessage('Choose a GitHub account to list repositories.');
      } else {
        setRepositoryListStatus('error');
        setRepositoryListMessage('No ShipSeal GitHub App installation was found for this account. Use Install or configure ShipSeal GitHub App.');
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [loadRepositories]);

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

  const handlePickPackage = useCallback((id: string) => {
    setSelectedPackages([id]);
    scanSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const togglePackage = useCallback((id: string) => {
    setSelectedPackages(current => {
      if (current.includes(id)) return current.filter(item => item !== id);
      // Choosing the full package clears individual picks; picking an individual pack clears "full".
      if (id === FULL_PACKAGE_ID) return [FULL_PACKAGE_ID];
      return [...current.filter(item => item !== FULL_PACKAGE_ID), id];
    });
  }, []);

  const handleNavAnchor = useCallback((href: string) => {
    scan.resetScan();
    setSampleReport(null);
    setPendingSource(null);
    setSelectedPackages([]);
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
    setSelectedPackages([]);
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

  const handleGitHubConnect = useCallback(() => {
    const config = getGitHubAppClientConfig();
    openCenteredPopup(config.loginUrl, 'shipseal-github-connect');
  }, []);

  const handleGitHubInstall = useCallback(() => {
    const config = getGitHubAppClientConfig();
    if (!config.installUrl) return;
    openCenteredPopup(config.installUrl, 'shipseal-github-install');
  }, []);

  const handleGitHubDisconnect = useCallback(() => {
    window.localStorage.removeItem(GITHUB_INSTALLATION_STORAGE_KEY);
    setGithubInstallationId('');
    setGithubSetupAction('');
    setGithubInstallations([]);
    setGithubRepositories([]);
    setRepositoryListStatus('idle');
    setRepositoryListMessage('');
    setPendingSource(null);
  }, []);

  const handleGitHubRepositoryRetry = useCallback(() => {
    if (githubInstallationId) loadRepositories(githubInstallationId);
  }, [githubInstallationId, loadRepositories]);

  const handleGitHubInstallationSelect = useCallback((installationId: string) => {
    loadRepositories(installationId);
  }, [loadRepositories]);

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
    setSelectedPackages([]);
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
              selectedPackages={selectedPackages}
              githubConnection={activeGithubConnection}
            />
          </Suspense>
        </main>
      ) : isScanning ? (
        <main className="min-h-screen pt-28 pb-16">
          <div className="container">
            <ScanProgress
              steps={scan.steps}
              currentStepIndex={scan.currentStepIndex}
              progress={scan.progress}
              warnings={scan.warnings}
              repositoryLabel={scan.activeRepositoryLabel}
              sourceLabel={scan.activeScanSourceLabel}
              discoveredFileCount={scan.discoveredFileCount}
              analyzedFileCount={scan.analyzedFileCount}
              onCancel={scan.cancelScan}
            />
          </div>
        </main>
      ) : (
        <main>
          <Landing
            onSampleReport={handleSample}
            onScrollScan={scrollScan}
            onPickPackage={handlePickPackage}
            scanSlot={
              <div id="scan" ref={scanSectionRef} className="scroll-mt-28">
                {pendingSource ? (
                  <ProjectContextStep
                    sourceType={pendingSource.type === 'zip' ? 'ZIP upload' : pendingSource.type === 'github-app' ? 'Connected GitHub repository' : 'Public GitHub repository'}
                    sourceLabel={pendingSource.type === 'zip' ? pendingSource.file.name : pendingSource.url}
                    intake={pendingIntake}
                    onChange={setPendingIntake}
                    selectedPackages={selectedPackages}
                    onTogglePackage={togglePackage}
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
                      githubInstallations={githubInstallations}
                      repositoryListMessage={repositoryListMessage || (githubSetupAction ? `GitHub setup action: ${githubSetupAction}` : '')}
                      onGitHubAppRepositorySelect={handleGitHubAppRepository}
                      onGitHubConnect={handleGitHubConnect}
                      onGitHubInstall={handleGitHubInstall}
                      onGitHubDisconnect={handleGitHubDisconnect}
                      onGitHubRepositoryRetry={handleGitHubRepositoryRetry}
                      onGitHubInstallationSelect={handleGitHubInstallationSelect}
                    />
                    <p className="mt-3 text-center text-xs text-muted-foreground">
                      Tip: leave out <span className="font-mono text-foreground/80">node_modules</span>, <span className="font-mono text-foreground/80">dist</span> and <span className="font-mono text-foreground/80">build</span> folders for the fastest scan.
                    </p>
                    {scan.status === 'cancelled' && (
                      <div className="mt-2 text-center text-sm text-muted-foreground">Scan cancelled.</div>
                    )}
                  </>
                )}
              </div>
            }
          />
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
  sourceType,
  sourceLabel,
  intake,
  onChange,
  selectedPackages,
  onTogglePackage,
  onBack,
  onContinue,
}: {
  sourceType: string;
  sourceLabel: string;
  intake: ProjectIntake;
  onChange: (value: ProjectIntake) => void;
  selectedPackages: string[];
  onTogglePackage: (id: string) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const hasGoalSelection = selectedPackages.length > 0;

  return (
    <div className="space-y-6">
      <FlowSteps activeStep={2} />

      <div className="glass rounded-2xl p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Project Source</div>
            <div className="mt-2 text-sm text-muted-foreground">{sourceType}</div>
            <div className="mt-1 break-all font-medium text-foreground/90">{sourceLabel}</div>
          </div>
          <Button type="button" variant="outline" onClick={onBack} className="border-border/60 sm:shrink-0">
            Change project
          </Button>
        </div>
      </div>

      <div className="glass rounded-2xl p-6">
        <div className="max-w-2xl">
          <h2 className="font-display text-2xl font-semibold">What do you want ShipSeal to help with?</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Choose the outcome you need. ShipSeal will scan your project and prepare review notes, improvement suggestions and delivery-ready files.
          </p>
        </div>
        <div className="mt-6">
        <PackageCards variant="select" selected={selectedPackages} onToggle={onTogglePackage} />
        </div>
      </div>

      {hasGoalSelection && (
        <>
          <ProjectIntakeForm value={intake} onChange={onChange} />
          <OutputPreview selectedPackages={selectedPackages} />
          <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-muted-foreground">
            You can continue without project context, but the client report will be more generic.
          </div>
        </>
      )}

      <div className="flex flex-col sm:flex-row gap-3 justify-end">
        <Button type="button" variant="ghost" onClick={onBack}>Back</Button>
        <Button type="button" className="bg-gradient-primary border-0 shadow-glow hover:opacity-90" onClick={onContinue} disabled={!hasGoalSelection}>
          Scan project
        </Button>
      </div>
    </div>
  );
}

function FlowSteps({ activeStep }: { activeStep: number }) {
  const steps = [
    'Step 1: Upload your project',
    'Step 2: Choose your goal',
    'Step 3: Download your ShipSeal pack',
  ];

  return (
    <div className="grid sm:grid-cols-3 gap-2">
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

const OUTPUT_CATEGORIES = [
  {
    id: 'client-handoff',
    title: 'Client handoff',
    description: 'Report, executive summary and next steps.',
    goalIds: ['client-handoff', 'launch-readiness', 'sales-present', 'full-package'],
  },
  {
    id: 'agent-pack',
    title: 'AI agent development pack',
    description: 'Agent rules, repo context and safe edit prompts.',
    goalIds: ['agent-readiness', 'rescue-refactor', 'full-package'],
  },
  {
    id: 'safety',
    title: 'Safety and data risk notes',
    description: 'Secrets, data handling, auth and tool-boundary notes.',
    goalIds: ['safety-risk', 'launch-readiness', 'mcp-readiness', 'full-package'],
  },
  {
    id: 'testing',
    title: 'Test and red-team pack',
    description: 'Eval tests, prompt-injection checks and QA prompts.',
    goalIds: ['testing-red-team', 'launch-readiness', 'safety-risk', 'full-package'],
  },
  {
    id: 'mcp',
    title: 'MCP readiness',
    description: 'Server recommendations, allowlist and governance notes.',
    goalIds: ['mcp-readiness', 'safety-risk', 'full-package'],
  },
  {
    id: 'ai-act',
    title: 'AI Act / transparency readiness',
    description: 'Transparency notice draft and legal review questions.',
    goalIds: ['ai-act-transparency', 'full-package'],
  },
  {
    id: 'roadmap',
    title: 'Improvement roadmap',
    description: 'Prioritized fixes and cleanup suggestions.',
    goalIds: ['rescue-refactor', 'client-handoff', 'launch-readiness', 'sales-present', 'full-package'],
  },
] satisfies Array<{
  id: string;
  title: string;
  description: string;
  goalIds: ShipSealPackageId[];
}>;

function OutputPreview({ selectedPackages }: { selectedPackages: string[] }) {
  const effectiveSelection = selectedPackages.includes(FULL_PACKAGE_ID) ? [FULL_PACKAGE_ID] : selectedPackages;
  const activeIds = new Set(effectiveSelection);
  const focus = resolveDeliveryPackFocus(effectiveSelection);
  const filePaths = focus.generatedPaths;

  return (
    <div className="glass rounded-2xl p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-secondary/45">
          <FolderArchive className="h-4 w-4 text-primary-glow" />
        </span>
        <div>
          <h3 className="font-display text-xl font-semibold">What ShipSeal will prepare</h3>
          <p className="mt-1 text-sm text-muted-foreground">Grouped preview first. Exact files stay tucked away until you want them.</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {OUTPUT_CATEGORIES.map(category => {
          const active = category.goalIds.some(id => activeIds.has(id));
          return (
            <div
              key={category.id}
              className={`rounded-xl border px-4 py-3 ${active ? 'border-primary/45 bg-primary/10' : 'border-border/60 bg-secondary/20'}`}
            >
              <div className="flex items-center gap-2">
                {active ? <Sparkles className="h-3.5 w-3.5 text-primary-glow" /> : <FileText className="h-3.5 w-3.5 text-muted-foreground" />}
                <div className="text-sm font-medium">{category.title}</div>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{category.description}</p>
            </div>
          );
        })}
      </div>

      <details className="group mt-5 rounded-xl border border-border/60 bg-secondary/15">
        <summary className="flex cursor-pointer select-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors [&::-webkit-details-marker]:hidden">
          <span>View generated file list ({filePaths.length})</span>
          <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
        </summary>
        <div className="grid gap-2 border-t border-border/50 px-4 py-4 sm:grid-cols-2">
          {filePaths.map(path => (
            <div key={path} className="rounded-lg border border-border/50 bg-background/30 px-3 py-2 font-mono text-[11px] text-foreground/80">
              {path}
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

export default Index;
