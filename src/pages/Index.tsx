import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { Nav } from '@/components/agentready/Nav';
import { Landing } from '@/components/agentready/Landing';
import { UploadDropzone } from '@/components/agentready/UploadDropzone';
import { RepositoryFormation } from '@/components/agentready/RepositoryFormation';
import { SurfaceState } from '@/components/agentready/SurfaceState';
import { buildSampleReport } from '@/lib/readiness';
import { SAMPLE_PROJECT_REPO_INPUT } from '@/lib/demo/sampleReadiness';
import { clearScanHistory, getScanHistory, saveScanHistory } from '@/lib/scanHistory';
import type { AgentOperatingModeId, ReadinessReport, ScanHistoryItem } from '@/lib/types';
import { toast } from '@/hooks/use-toast';
import { useRepoScan } from '@/hooks/useRepoScan';
import type { ProjectIntake } from '@/lib/intake';
import { createDefaultProjectIntake } from '@/lib/intake';
import { parseGitHubUrl } from '@/lib/github/parseGitHubUrl';
import { Button } from '@/components/ui/button';
import { DEFAULT_AGENT_OPERATING_MODE } from '@/lib/agentOperatingMode';
import { getGitHubAppClientConfig } from '@/lib/githubApp/config';
import type { GitHubAppConnectionMessage, GitHubAppInstallation, GitHubAppRepository, GitHubAppRepositoryListStatus } from '@/lib/githubApp/types';
import { createConnectedGitHubConnection, type GitHubConnectionState } from '@/lib/githubConnection/types';
import type { RepositoryVerificationBaseline, WorkspaceStoryChapterId } from '@/lib/workspace';
import { validateRepositoryIntelligenceVerificationBaseline, type RepositoryIntelligenceVerificationBaseline } from '@/lib/repositoryIntelligence';
import { getScan } from '@/lib/persistence';
import { useOptionalAccount } from '@/components/account/accountContext';
import {
  resolveRepositoryFormationPhase,
  type RepositoryFuturePreparationState,
} from '@/lib/workspace/repositoryFormationPipeline';

type PendingSource =
  | { type: 'zip'; file: File; projectName: string }
  | { type: 'github'; url: string; branch?: string; projectName: string }
  | { type: 'github-app'; url: string; branch?: string; projectName: string; connection: GitHubConnectionState; isPrivate?: boolean };

const ResultDashboard = lazy(() => import('@/components/agentready/ResultDashboard').then(module => ({ default: module.ResultDashboard })));
const SaveProjectControl = lazy(() => import('@/components/account/SaveProjectControl').then(module => ({ default: module.SaveProjectControl })));
const RepositoryIntelligenceVerificationQa = import.meta.env.DEV
  ? lazy(() => import('@/dev/RepositoryIntelligenceVerificationQa'))
  : null;
const PostScanOverviewQa = import.meta.env.DEV
  ? lazy(() => import('@/dev/PostScanOverviewQa'))
  : null;
const PostScanChaptersQa = import.meta.env.DEV
  ? lazy(() => import('@/dev/PostScanChaptersQa'))
  : null;
const GITHUB_INSTALLATION_STORAGE_KEY = 'shipseal.githubInstallationId';

function scrollWindowToTop(behavior: ScrollBehavior) {
  if (window.navigator.userAgent.toLowerCase().includes('jsdom')) return;
  window.scrollTo({ top: 0, behavior });
}

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
    case 'invalid_client_id_format':
      return 'GitHub OAuth client credentials are missing in Vercel.';
    case 'invalid_callback_url':
      return 'GitHub OAuth callback URL is invalid in Vercel.';
    case 'invalid_api_base_url':
      return 'GitHub API base URL is invalid in Vercel.';
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
  const account = useOptionalAccount();
  const [repositoryIntelligenceVerificationBaseline, setRepositoryIntelligenceVerificationBaseline] = useState<RepositoryIntelligenceVerificationBaseline | null>(null);
  const [verificationProjectContext, setVerificationProjectContext] = useState<{ projectId: string; baselineScanId: string } | null>(null);
  const [verificationContextMessage, setVerificationContextMessage] = useState('');
  const scan = useRepoScan(repositoryIntelligenceVerificationBaseline);
  const [sampleReport, setSampleReport] = useState<ReadinessReport | null>(null);
  const [history, setHistory] = useState<ScanHistoryItem[]>([]);
  const [pendingSource, setPendingSource] = useState<PendingSource | null>(null);
  const [selectedPackages, setSelectedPackages] = useState<string[]>([]);
  const [agentOperatingMode, setAgentOperatingMode] = useState<AgentOperatingModeId>(DEFAULT_AGENT_OPERATING_MODE);
  const [submittedIntake, setSubmittedIntake] = useState<ProjectIntake | undefined>();
  const [submittedIntakeSkipped, setSubmittedIntakeSkipped] = useState(false);
  const [githubInstallationId, setGithubInstallationId] = useState('');
  const [githubSetupAction, setGithubSetupAction] = useState('');
  const [repositoryListStatus, setRepositoryListStatus] = useState<GitHubAppRepositoryListStatus>('idle');
  const [githubRepositories, setGithubRepositories] = useState<GitHubAppRepository[]>([]);
  const [githubInstallations, setGithubInstallations] = useState<GitHubAppInstallation[]>([]);
  const [repositoryListMessage, setRepositoryListMessage] = useState('');
  const [intelligenceReveal, setIntelligenceReveal] = useState<{ key: string; visible: boolean } | null>(null);
  const [activeStoryChapterId, setActiveStoryChapterId] = useState<WorkspaceStoryChapterId | null>(null);
  const [verificationBaseline, setVerificationBaseline] = useState<RepositoryVerificationBaseline | null>(null);
  const [futurePreparation, setFuturePreparation] = useState<{
    reportIdentity: string;
    state: RepositoryFuturePreparationState;
    error: string | null;
  }>({ reportIdentity: '', state: 'idle', error: null });
  const savedReportKey = useRef<string | null>(null);
  const lastError = useRef<string | null>(null);
  const scanStartInFlight = useRef(false);
  const scanSectionRef = useRef<HTMLDivElement>(null);
  const futurePreparationIdentityRef = useRef('');

  const activeReport = sampleReport || scan.report;
  const activeGithubConnection = pendingSource?.type === 'github-app' ? pendingSource.connection : undefined;
  const isScanning = scan.status === 'scanning';
  const activeReportKey = activeReport ? `${activeReport.repoName}-${activeReport.scannedAt}` : null;
  const showIntelligenceReveal = Boolean(
    activeReport &&
    activeReportKey &&
    intelligenceReveal?.key === activeReportKey &&
    intelligenceReveal.visible
  );
  const productIntelligencePreparationState = scan.repositoryProductIntelligenceStatus?.state;
  const productIntelligenceReady = Boolean(scan.repositoryProductIntelligence?.opportunities.length)
    && productIntelligencePreparationState === 'enhanced';

  useEffect(() => {
    if (!activeReport || !activeReportKey) return;
    if (sampleReport) {
      futurePreparationIdentityRef.current = `sample:${activeReportKey}`;
      setFuturePreparation({ reportIdentity: activeReportKey, state: 'ready', error: null });
      return;
    }
    const productIntelligence = scan.repositoryProductIntelligence;
    if (!productIntelligence?.opportunities.length || productIntelligencePreparationState !== 'enhanced') return;
    const preparationIdentity = `${activeReportKey}:${productIntelligence.fingerprint}`;
    if (futurePreparationIdentityRef.current === preparationIdentity) return;
    futurePreparationIdentityRef.current = preparationIdentity;
    let active = true;
    setFuturePreparation({ reportIdentity: activeReportKey, state: 'building', error: null });
    void (async () => {
      try {
        const [{ buildRepositoryUniverseModel }, { buildRepositoryFuturePathwaysGraph }] = await Promise.all([
          import('@/lib/workspace'),
          import('@/components/agentready/result-workspace/futures/repositoryFuturePathwaysGraph'),
        ]);
        if (!active) return;
        const universe = buildRepositoryUniverseModel(activeReport);
        const graph = buildRepositoryFuturePathwaysGraph(activeReport, universe, productIntelligence);
        const usableProductDirections = graph.candidates.filter(candidate => candidate.alignment === 'product-opportunity' && candidate.eligibility !== 'unsupported');
        if (!usableProductDirections.length || !graph.nodes.some(node => node.kind === 'future-goal' && node.candidateId)) {
          throw new Error('Validated Product Intelligence did not produce usable Future pathways.');
        }
        setFuturePreparation({ reportIdentity: activeReportKey, state: 'preparing-workspace', error: null });
        await Promise.all([
          import('@/components/agentready/ResultDashboard'),
          import('@/components/agentready/result-workspace/futures/RepositoryFuturesWorkspace'),
        ]);
        if (!active) return;
        setFuturePreparation({ reportIdentity: activeReportKey, state: 'ready', error: null });
      } catch (error) {
        if (!active) return;
        setFuturePreparation({
          reportIdentity: activeReportKey,
          state: 'failed',
          error: error instanceof Error ? error.message : 'Future pathways could not be prepared.',
        });
      }
    })();
    return () => { active = false; };
  }, [activeReport, activeReportKey, productIntelligencePreparationState, sampleReport, scan.repositoryProductIntelligence]);

  const activeFuturePreparationState = futurePreparation.reportIdentity === activeReportKey
    ? futurePreparation.state
    : 'idle';
  const formationPhase = resolveRepositoryFormationPhase({
    scanStatus: scan.status,
    currentScanStep: scan.currentStep,
    repositoryIntelligenceReady: Boolean(sampleReport || scan.repositoryIntelligenceReview),
    productStatus: scan.repositoryProductIntelligenceStatus,
    productIntelligenceReady: Boolean(sampleReport || productIntelligenceReady),
    futurePreparationState: activeFuturePreparationState,
  });
  const futuresReady = formationPhase === 'ready';

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const projectId = params.get('projectId');
    const baselineScanId = params.get('baselineScanId');
    if (!projectId || !baselineScanId) return;
    if (account.status === 'loading') return;
    if (!account.user) {
      setVerificationContextMessage('Sign in to load this private verification baseline. You can still run an anonymous scan without attaching it.');
      return;
    }
    let active = true;
    setVerificationContextMessage('Loading the immutable verification baseline…');
    getScan(baselineScanId).then(saved => {
      if (!active) return;
      if (saved.scan.projectId !== projectId) throw new Error('Baseline does not belong to the selected project.');
      const validated = validateRepositoryIntelligenceVerificationBaseline(saved.snapshot.verificationBaseline);
      if (!validated.valid || !validated.baseline) throw new Error('This scan does not contain a compatible applied-plan baseline.');
      setRepositoryIntelligenceVerificationBaseline(validated.baseline);
      setVerificationProjectContext({ projectId, baselineScanId });
      setVerificationContextMessage(`Verification baseline loaded for ${validated.baseline.repository.owner}/${validated.baseline.repository.repo}. Run a later scan, then save it to attach the evidence.`);
    }).catch(error => {
      if (!active) return;
      setVerificationProjectContext(null);
      setVerificationContextMessage(error instanceof Error ? error.message : 'The verification baseline could not be loaded.');
    });
    return () => { active = false; };
  }, [account.status, account.user]);

  useEffect(() => {
    if (!isScanning) return;
    scrollWindowToTop('auto');
  }, [isScanning]);

  useEffect(() => {
    if (scan.status === 'failed' || scan.status === 'cancelled' || scan.status === 'idle') {
      scanStartInFlight.current = false;
    }
  }, [scan.status]);

  const prepareSampleRepositoryIntelligenceReview = useCallback(async () => {
    const { buildRepositoryIntelligenceArtifactReview } = await import('@/lib/repositoryIntelligence/repositoryIntelligenceReview');
    const result = buildRepositoryIntelligenceArtifactReview({ scanInput: SAMPLE_PROJECT_REPO_INPUT });
    return { artifactSet: result.artifactSet, review: result.review };
  }, []);

  const rescanRepositoryIntelligence = useCallback(() => {
    if (!pendingSource) return;
    if (pendingSource.type === 'github-app') {
      const connection = pendingSource.connection;
      if (!connection.installationId || !connection.owner || !connection.repo) return;
      void scan.startGitHubAppScan({
        installationId: connection.installationId,
        owner: connection.owner,
        repo: connection.repo,
        ref: pendingSource.branch || connection.defaultBranch,
      });
      return;
    }
    if (pendingSource.type === 'github') void scan.startGitHubScan(pendingSource.url, pendingSource.branch);
  }, [pendingSource, scan]);

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
        setRepositoryListStatus(['missing_client_id', 'missing_client_secret', 'invalid_client_id_format', 'invalid_callback_url', 'invalid_api_base_url'].includes(data.code || '') ? 'not_configured' : 'error');
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
    setIntelligenceReveal({ key, visible: true });
    setHistory(saveScanHistory(scan.report));
    queueMicrotask(() => scrollWindowToTop('smooth'));
  }, [scan.report]);

  useEffect(() => {
    if (!activeReportKey) return;
    setActiveStoryChapterId(null);
  }, [activeReportKey]);

  const completeIntelligenceReveal = useCallback(() => {
    setIntelligenceReveal(current => current ? { ...current, visible: false } : current);
    scrollWindowToTop('auto');
  }, []);

  useEffect(() => {
    if (!showIntelligenceReveal || formationPhase !== 'ready') return undefined;
    const reducedMotion = Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    const timer = window.setTimeout(completeIntelligenceReveal, reducedMotion ? 0 : 720);
    return () => window.clearTimeout(timer);
  }, [completeIntelligenceReveal, formationPhase, showIntelligenceReveal]);

  const replayIntelligenceReveal = useCallback(() => {
    if (!activeReportKey) return;
    setIntelligenceReveal({ key: activeReportKey, visible: true });
    scrollWindowToTop('auto');
  }, [activeReportKey]);

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

  const handleNavAnchor = useCallback((href: string) => {
    scanStartInFlight.current = false;
    scan.resetScan();
    setSampleReport(null);
    setPendingSource(null);
    setSelectedPackages([]);
    setAgentOperatingMode(DEFAULT_AGENT_OPERATING_MODE);
    setSubmittedIntake(undefined);
    setSubmittedIntakeSkipped(false);
    setIntelligenceReveal(null);
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
    scanStartInFlight.current = false;
    scan.resetScan();
    setSampleReport(null);
    setPendingSource(null);
    setSelectedPackages([]);
    setAgentOperatingMode(DEFAULT_AGENT_OPERATING_MODE);
    setSubmittedIntake(undefined);
    setSubmittedIntakeSkipped(false);
    setIntelligenceReveal(null);
    savedReportKey.current = null;
    lastError.current = null;
    window.setTimeout(() => scrollWindowToTop('smooth'), 0);
  }, [scan]);

  const beginScanForSource = useCallback((source: PendingSource) => {
    if (scanStartInFlight.current) return;
    scanStartInFlight.current = true;

    setSampleReport(null);
    setIntelligenceReveal(null);
    savedReportKey.current = null;
    lastError.current = null;
    setPendingSource(source);
    setSubmittedIntake(createDefaultProjectIntake(source.projectName));
    setSubmittedIntakeSkipped(true);

    if (source.type === 'zip') {
      void scan.startScan(source.file);
    } else if (source.type === 'github-app') {
      void scan.startGitHubAppScan({
        installationId: source.connection.installationId || '',
        owner: source.connection.owner || '',
        repo: source.connection.repo || '',
        ref: source.branch || source.connection.defaultBranch,
      });
    } else {
      void scan.startGitHubScan(source.url, source.branch);
    }
  }, [scan]);

  const handleFile = useCallback((file: File) => {
    const projectName = file.name.replace(/\.zip$/i, '') || 'repository';
    beginScanForSource({ type: 'zip', file, projectName });
  }, [beginScanForSource]);

  const handleGitHubImport = useCallback((url: string, branch?: string) => {
    const projectName = githubProjectName(url);
    beginScanForSource({ type: 'github', url, branch, projectName });
  }, [beginScanForSource]);

  const handleGitHubAppRepository = useCallback((repository: GitHubAppRepository) => {
    const connection = createConnectedGitHubConnection({
      owner: repository.owner,
      repo: repository.name,
      defaultBranch: repository.defaultBranch,
      installationId: githubInstallationId,
    });
    beginScanForSource({
      type: 'github-app',
      url: `https://github.com/${repository.fullName}`,
      branch: repository.defaultBranch,
      projectName: repository.name,
      connection,
      isPrivate: repository.private,
    });
  }, [beginScanForSource, githubInstallationId]);

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

  const retryPendingScan = useCallback(() => {
    if (pendingSource) beginScanForSource(pendingSource);
  }, [beginScanForSource, pendingSource]);

  const handleSample = useCallback(() => {
    scanStartInFlight.current = false;
    scan.resetScan();
    setPendingSource(null);
    setSelectedPackages([]);
    setAgentOperatingMode(DEFAULT_AGENT_OPERATING_MODE);
    setSubmittedIntake(undefined);
    setSubmittedIntakeSkipped(false);
    setIntelligenceReveal(null);
    const report = buildSampleReport();
    const key = `${report.repoName}-${report.scannedAt}`;
    setSampleReport(report);
    setIntelligenceReveal({ key, visible: true });
    setHistory(saveScanHistory(report));
    queueMicrotask(() => scrollWindowToTop('smooth'));
  }, [scan]);

  const reset = useCallback(() => {
    scanStartInFlight.current = false;
    scan.resetScan();
    setSampleReport(null);
    setPendingSource(null);
    setAgentOperatingMode(DEFAULT_AGENT_OPERATING_MODE);
    setSubmittedIntake(undefined);
    setSubmittedIntakeSkipped(false);
    setIntelligenceReveal(null);
    savedReportKey.current = null;
    lastError.current = null;
    queueMicrotask(() => scrollWindowToTop('smooth'));
  }, [scan]);

  const retryFutureAnalysis = useCallback(() => {
    futurePreparationIdentityRef.current = '';
    setFuturePreparation(current => ({ ...current, state: 'idle', error: null }));
    void scan.retryRepositoryProductIntelligence();
  }, [scan]);

  const productFailure = !sampleReport && productIntelligencePreparationState && ['fallback', 'cancelled'].includes(productIntelligencePreparationState)
    ? scan.repositoryProductIntelligenceStatus
    : null;
  const formationFailure = productFailure || scan.repositoryIntelligenceReviewError || activeFuturePreparationState === 'failed'
    ? {
        message: productFailure?.message || scan.repositoryIntelligenceReviewError || futurePreparation.error || 'Future pathways could not be prepared.',
        onRetry: productFailure || activeFuturePreparationState === 'failed' ? retryFutureAnalysis : undefined,
        onReturn: reset,
      }
    : undefined;
  const scanCountLine = scan.discoveredFileCount == null
    ? scan.currentStep || 'Reading repository'
    : `${scan.analyzedFileCount == null ? 'Reading' : scan.analyzedFileCount.toLocaleString()} of ${scan.discoveredFileCount.toLocaleString()} files understood`;
  const formationAction = formationPhase === 'reading'
    ? scanCountLine
    : formationPhase === 'understanding'
      ? scan.status === 'scanning' ? scan.currentStep || 'Building repository intelligence' : 'Turning scan evidence into repository intelligence.'
      : formationPhase === 'directions'
        ? scan.repositoryProductIntelligenceStatus.message
        : formationPhase === 'pathways'
          ? 'Normalising validated product opportunities into usable pathways.'
          : formationPhase === 'workspace'
            ? 'Loading the prepared perspectives and workspace controls.'
            : 'Project Universe and Repository Futures are ready to explore.';
  const formationSourceLabel = sampleReport
    ? 'Sample repository'
    : activeReport?.source.sourceType === 'github-app'
      ? 'Connected GitHub'
      : activeReport?.source.sourceType.startsWith('github')
        ? 'GitHub repository'
        : scan.activeScanSourceLabel || 'Repository scan';

  const handleClearHistory = useCallback(() => {
    clearScanHistory();
    setHistory([]);
  }, []);

  if (RepositoryIntelligenceVerificationQa && new URLSearchParams(window.location.search).get('omega16Qa') === 'verification') {
    return <Suspense fallback={<div className="min-h-screen bg-background p-8 text-muted-foreground">Loading verification fixture...</div>}><RepositoryIntelligenceVerificationQa /></Suspense>;
  }

  if (PostScanOverviewQa && new URLSearchParams(window.location.search).get('omega17Qa') === 'overview') {
    return <Suspense fallback={<div className="min-h-screen bg-background p-8 text-muted-foreground">Loading overview fixture...</div>}><PostScanOverviewQa /></Suspense>;
  }

  if (PostScanChaptersQa && new URLSearchParams(window.location.search).get('omega17Qa') === 'chapters') {
    return <Suspense fallback={<div className="min-h-screen bg-background p-8 text-muted-foreground">Loading chapter fixture...</div>}><PostScanChaptersQa /></Suspense>;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {!showIntelligenceReveal && <Nav onNavigateAnchor={handleNavAnchor} onHome={handleHome} />}
      {!showIntelligenceReveal && verificationContextMessage && <div role="status" className="container relative z-10 pt-20 md:pt-24"><div className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">{verificationContextMessage}</div></div>}

      {isScanning || showIntelligenceReveal ? (
        <main className="min-h-screen pt-16 md:pt-20">
          <RepositoryFormation
            repositoryName={activeReport?.repoName || scan.activeRepositoryLabel || 'Repository'}
            sourceLabel={formationSourceLabel}
            stage={formationPhase}
            title={futuresReady ? 'Your workspace is ready' : 'Forming repository intelligence'}
            action={formationAction}
            progress={isScanning ? scan.progress : undefined}
            onCancel={isScanning ? scan.cancelScan : undefined}
            failure={formationFailure}
            fullScreen
          />
        </main>
      ) : activeReport ? (
        <main className="pt-16 md:pt-20">
          <Suspense fallback={<div className="container py-24 text-sm text-muted-foreground">Loading report...</div>}>
            <ResultDashboard
              report={activeReport}
              repositoryIntelligenceReviewSession={sampleReport ? null : scan.repositoryIntelligenceReview}
              repositoryIntelligenceReviewPreparing={sampleReport ? false : scan.repositoryIntelligenceReviewPreparing}
              repositoryIntelligenceReviewError={sampleReport ? null : scan.repositoryIntelligenceReviewError}
              prepareRepositoryIntelligenceReview={sampleReport ? prepareSampleRepositoryIntelligenceReview : undefined}
              repositoryIntelligenceProviderStatus={sampleReport ? undefined : scan.repositoryIntelligenceProviderStatus}
              repositoryProductIntelligence={sampleReport ? null : scan.repositoryProductIntelligence}
              prepareRepositoryIntelligenceEnhancement={sampleReport ? undefined : scan.prepareRepositoryIntelligenceEnhancement}
              repositoryProductIntelligenceStatus={scan.repositoryProductIntelligenceStatus}
              history={history}
              onReset={reset}
              onClearHistory={handleClearHistory}
              onReplayReveal={replayIntelligenceReveal}
              activeStoryChapterId={activeStoryChapterId}
              onActiveStoryChapterChange={setActiveStoryChapterId}
              initialIntake={submittedIntake}
              intakeSkipped={submittedIntakeSkipped}
              selectedPackages={selectedPackages}
              agentOperatingMode={agentOperatingMode}
              githubConnection={activeGithubConnection}
              verificationBaseline={verificationBaseline}
              onSaveVerificationBaseline={setVerificationBaseline}
              onDiscardVerificationBaseline={() => setVerificationBaseline(null)}
              repositoryIntelligenceVerificationBaseline={repositoryIntelligenceVerificationBaseline}
              repositoryIntelligenceVerificationResult={sampleReport ? null : scan.repositoryIntelligenceVerification}
              repositoryIntelligenceVerificationStatus={sampleReport ? 'idle' : scan.repositoryIntelligenceVerificationStatus}
              repositoryIntelligenceVerificationError={sampleReport ? null : scan.repositoryIntelligenceVerificationError}
              onSaveRepositoryIntelligenceVerificationBaseline={setRepositoryIntelligenceVerificationBaseline}
              onDiscardRepositoryIntelligenceVerificationBaseline={() => setRepositoryIntelligenceVerificationBaseline(null)}
              onRescanRepositoryIntelligence={pendingSource?.type === 'github' || pendingSource?.type === 'github-app' ? rescanRepositoryIntelligence : undefined}
              persistenceControl={<Suspense fallback={<div className="text-xs text-muted-foreground">Preparing private save…</div>}><SaveProjectControl report={activeReport} providerStatus={sampleReport ? undefined : scan.repositoryIntelligenceProviderStatus} verificationBaseline={sampleReport ? undefined : repositoryIntelligenceVerificationBaseline} verificationResult={sampleReport ? undefined : scan.repositoryIntelligenceVerification} projectId={verificationProjectContext?.projectId} baselineScanId={verificationProjectContext?.baselineScanId} /></Suspense>}
            />
          </Suspense>
        </main>
      ) : (
        <main>
          <Landing
            onSampleReport={handleSample}
            onScrollScan={scrollScan}
            onPickPackage={handlePickPackage}
            scanSlot={
              <div ref={scanSectionRef} className="scroll-mt-28" data-testid="source-selection">
                {(scan.status === 'failed' || scan.status === 'cancelled') && (
                  <SurfaceState
                    tone={scan.status === 'cancelled' ? 'empty' : 'error'}
                    title={scan.status === 'cancelled' ? 'Scan cancelled' : importErrorTitle(scan.errorCategory)}
                    description={scan.status === 'cancelled'
                      ? 'The repository was not changed. You can restart when ready.'
                      : 'ShipSeal could not finish this source. Retry it or choose another source.'}
                    action={pendingSource
                      ? <Button type="button" size="sm" onClick={retryPendingScan}>Retry scan</Button>
                      : undefined}
                    fallback={<Button type="button" size="sm" variant="outline" onClick={() => { scanStartInFlight.current = false; scan.resetScan(); setPendingSource(null); }}>Choose another source</Button>}
                    details={scan.status === 'failed' ? scan.error : undefined}
                    className="mb-4"
                  />
                )}
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
                  onSampleReport={handleSample}
                />
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  Tip: leave out <span className="font-mono text-foreground/80">node_modules</span>, <span className="font-mono text-foreground/80">dist</span> and <span className="font-mono text-foreground/80">build</span> folders for the fastest scan.
                </p>
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

export default Index;
