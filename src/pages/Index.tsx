import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { Nav } from '@/components/agentready/Nav';
import { Landing } from '@/components/agentready/Landing';
import { UploadDropzone } from '@/components/agentready/UploadDropzone';
import { RepositoryFormation } from '@/components/agentready/RepositoryFormation';
import { operationSupportReference } from '@/lib/supportReference';
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
import { addGitHubFlowQuery, launchGitHubBrowserFlow, restoreGitHubFlowDraft, saveGitHubFlowDraft } from '@/lib/githubApp/browserFlow';
import { createConnectedGitHubConnection, type GitHubConnectionState } from '@/lib/githubConnection/types';
import type { RepositoryVerificationBaseline, WorkspaceStoryChapterId } from '@/lib/workspace';
import { validateRepositoryIntelligenceVerificationBaseline, type RepositoryIntelligenceProviderStatus, type RepositoryIntelligenceVerificationBaseline } from '@/lib/repositoryIntelligence';
import { getScan } from '@/lib/persistence';
import { useOptionalAccount } from '@/components/account/accountContext';
import type { PersistedProjectContext } from '@/components/account/SaveProjectControl';
import {
  resolveRepositoryFormationPhase,
  type RepositoryFuturePreparationState,
} from '@/lib/workspace/repositoryFormationPipeline';
import { useFeedback } from '@/components/feedback/feedbackContext';

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
const RepositoryFuturesLayoutQa = import.meta.env.DEV
  ? lazy(() => import('@/dev/RepositoryFuturesLayoutQa'))
  : null;
const RepositoryFutureRecoveryQa = import.meta.env.DEV
  ? lazy(() => import('@/dev/RepositoryFutureRecoveryQa'))
  : null;
const RepositoryRootContractQa = import.meta.env.DEV
  ? lazy(() => import('@/dev/RepositoryRootContractQa'))
  : null;
function scrollWindowToTop(behavior: ScrollBehavior) {
  if (window.navigator.userAgent.toLowerCase().includes('jsdom')) return;
  window.scrollTo({ top: 0, behavior });
}

function repositoryListFriendlyMessage(code?: string, _fallback?: string) {
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
      return 'No ShipSeal GitHub App installation was found for this account. Select repositories to continue.';
    case 'invalid_oauth_state':
    case 'github_session_expired':
    case 'installation_not_authorized':
      return 'Your GitHub connection is no longer valid. Reconnect GitHub and select the repository again.';
    case 'app_identity_mismatch':
    case 'app_slug_mismatch':
      return 'ShipSeal GitHub configuration does not use one consistent GitHub App. An operator must correct the production settings.';
    case 'network_error':
      return 'ShipSeal could not reach GitHub. Retry repository listing.';
    case 'github_api_error':
      return 'GitHub connection is configured, but ShipSeal could not create an installation token.';
    default:
      return 'GitHub repository listing failed. Retry or reconnect GitHub.';
  }
}

const EMPTY_GITHUB_APP_REPOSITORIES_MESSAGE = 'No repositories are available for this GitHub App installation. Manage repository access and choose Only select repositories to add the repository you need.';
const GITHUB_FLOW_POLL_MS = 1_000;
const GITHUB_FLOW_MAX_MS = 2 * 60 * 1_000;

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
    case 'repository-evidence-permission-denied':
      return 'Repository access denied';
    case 'repository-evidence-rate-limited':
      return 'GitHub indexing temporarily busy';
    case 'repository-evidence-service-unavailable':
      return 'Repository indexing unavailable';
    case 'repository-evidence-contract-error':
      return 'Unexpected repository-index response';
    case 'repository-evidence-budget-reached':
      return 'Repository indexing budget reached';
    default:
      return 'Import blocked';
  }
}

const Index = () => {
  const account = useOptionalAccount();
  const { recordOutcome } = useFeedback();
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
  const [githubLogin, setGithubLogin] = useState('');
  const [repositoryListMessage, setRepositoryListMessage] = useState('');
  const [intelligenceReveal, setIntelligenceReveal] = useState<{ key: string; visible: boolean } | null>(null);
  const [activeStoryChapterId, setActiveStoryChapterId] = useState<WorkspaceStoryChapterId | null>(null);
  const [verificationBaseline, setVerificationBaseline] = useState<RepositoryVerificationBaseline | null>(null);
  const [activeProjectContext, setActiveProjectContext] = useState<(PersistedProjectContext & { reportKey: string }) | null>(null);
  const [futurePreparation, setFuturePreparation] = useState<{
    reportIdentity: string;
    state: RepositoryFuturePreparationState;
    error: string | null;
  }>({ reportIdentity: '', state: 'idle', error: null });
  const savedReportKey = useRef<string | null>(null);
  const lastError = useRef<string | null>(null);
  const scanStartInFlight = useRef(false);
  const signalledScanIdentity = useRef('');
  const scanSectionRef = useRef<HTMLDivElement>(null);
  const futurePreparationIdentityRef = useRef('');
  const repositoryLoadRequestRef = useRef(0);
  const connectionRefreshRequestRef = useRef(0);
  const githubFlowRef = useRef<{ popup: Window | null; startedAt: number; phase: 'oauth' | 'install' | 'switch'; priorSessionId: string } | null>(null);
  const githubFlowTimerRef = useRef<number | null>(null);
  const githubSuccessIdentityRef = useRef('');
  const githubLoginRef = useRef('');
  const githubConnectionSessionIdRef = useRef('');

  const activeReport = sampleReport || scan.report;
  const activeGithubConnection = pendingSource?.type === 'github-app' ? pendingSource.connection : undefined;
  const isScanning = scan.status === 'scanning';
  const activeReportKey = activeReport ? `${activeReport.repoName}-${activeReport.scannedAt}` : null;
  const currentProjectContext = activeProjectContext?.reportKey === activeReportKey ? activeProjectContext : null;
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
    if (!scan.report || scan.status !== 'completed') return;
    const identity = `${scan.report.repoName}:${scan.report.scannedAt}`;
    if (signalledScanIdentity.current === identity) return;
    signalledScanIdentity.current = identity;
    recordOutcome('scan_completed', 'scan_result', { prompt: true });
  }, [recordOutcome, scan.report, scan.status]);

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
  const futureProviderTerminal = !sampleReport && ['fallback', 'cancelled'].includes(productIntelligencePreparationState || '');
  const futureOnlyTerminalFailure = Boolean(
    activeReport
    && (sampleReport || scan.repositoryIntelligenceReview)
    && (futureProviderTerminal || activeFuturePreparationState === 'failed')
  );
  const accountAwareFuturesStatus: RepositoryIntelligenceProviderStatus = account.productMode?.earlyAccessFree
    && scan.repositoryProductIntelligenceStatus.state === 'fallback'
    && scan.repositoryProductIntelligenceStatus.category === 'upgrade_required'
    ? { state: 'deterministic', retryable: false, message: 'Repository evidence is ready for Early Access Deep Analysis.' }
    : scan.repositoryProductIntelligenceStatus.state === 'deterministic'
    && !sampleReport
    && account.status !== 'loading'
    && (!account.user || account.usage && !account.usage.capabilities.repositoryFutures)
    ? {
        state: 'fallback', deepState: 'disabled', retryable: false,
        category: account.user ? 'upgrade_required' : 'authentication_required',
        message: account.user
          ? 'Full Repository Futures is a paid AI feature. Project Universe and deterministic intelligence remain available.'
          : 'Sign in to start full Repository Futures. Project Universe remains available.',
      }
    : scan.repositoryProductIntelligenceStatus;
  const workspaceFuturesStatus: RepositoryIntelligenceProviderStatus = activeFuturePreparationState === 'failed'
    ? {
        state: 'fallback',
        deepState: 'rejected',
        category: 'schema_validation_failed',
        retryable: true,
        message: 'Some future pathways could not be completed.',
        diagnostics: { costEstimate: 'unavailable', operationalFailureCategory: 'merge_incomplete', failureBoundary: 'staged-merge' },
      }
    : accountAwareFuturesStatus;
  const accountUserForUsage = account.user;
  const refreshAccountUsage = account.refreshUsage;

  useEffect(() => {
    if (!accountUserForUsage) return;
    const active = scan.repositoryProductIntelligenceStatus.state === 'preparing';
    void refreshAccountUsage();
    if (!active) return;
    const timer = window.setInterval(() => { void refreshAccountUsage(); }, 4_000);
    return () => window.clearInterval(timer);
  }, [accountUserForUsage, refreshAccountUsage, scan.repositoryProductIntelligenceStatus.state]);

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
    const requestId = ++repositoryLoadRequestRef.current;
    setGithubInstallationId(installationId);
    setRepositoryListStatus('loading');
    setRepositoryListMessage('');

    fetch(`/api/github-app/repositories?installationId=${encodeURIComponent(installationId)}`)
      .then(async response => {
        const payload = await response.json().catch(() => null);
        if (requestId !== repositoryLoadRequestRef.current) return;
        if (response.ok && payload?.status === 'ok' && Array.isArray(payload.repositories)) {
          setGithubRepositories(payload.repositories);
          setRepositoryListStatus('loaded');
          setRepositoryListMessage(payload.repositories.length
            ? 'GitHub connected. Authorized repositories are ready.'
            : EMPTY_GITHUB_APP_REPOSITORIES_MESSAGE);
          return;
        }
        if (response.status === 401 || response.status === 403 || payload?.status === 'reconnect_required'
          || ['installation_not_found', 'user_authorization_failed'].includes(payload?.code || '')) {
          setGithubInstallationId('');
          setGithubRepositories([]);
          setGithubInstallations([]);
          setRepositoryListStatus('reconnect_required');
          setRepositoryListMessage(repositoryListFriendlyMessage(payload?.code, payload?.message));
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
        if (requestId !== repositoryLoadRequestRef.current) return;
        setGithubRepositories([]);
        setRepositoryListStatus('error');
        setRepositoryListMessage(repositoryListFriendlyMessage('network_error'));
      });
  }, []);

  const stopGitHubFlowSync = useCallback(() => {
    if (githubFlowTimerRef.current !== null) {
      window.clearInterval(githubFlowTimerRef.current);
      githubFlowTimerRef.current = null;
    }
    githubFlowRef.current = null;
  }, []);

  const refreshGitHubConnection = useCallback(async (options: { announce?: boolean; activeFlow?: boolean } = {}) => {
    const requestId = ++connectionRefreshRequestRef.current;
    try {
      const response = await fetch('/api/github-app/connection', {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => null);
      if (requestId !== connectionRefreshRequestRef.current) return false;
      if (!response.ok || payload?.status !== 'connected') {
        if (!options.activeFlow && (response.status === 401 || payload?.status === 'reconnect_required') && githubLoginRef.current) {
          setRepositoryListStatus('reconnect_required');
          setRepositoryListMessage(repositoryListFriendlyMessage(payload?.code, payload?.message));
        }
        return false;
      }

      const connection = payload.connection;
      const sessionId = typeof connection?.sessionId === 'string' ? connection.sessionId : '';
      const activeFlow = githubFlowRef.current;
      if (options.activeFlow && activeFlow?.priorSessionId && sessionId === activeFlow.priorSessionId) return false;
      const login = typeof connection?.githubLogin === 'string' ? connection.githubLogin : '';
      const installations = Array.isArray(connection?.installations) ? connection.installations : [];
      setGithubLogin(login);
      githubLoginRef.current = login;
      githubConnectionSessionIdRef.current = sessionId;
      setGithubInstallations(installations);
      const installationId = typeof connection?.selectedInstallationId === 'string'
        ? connection.selectedInstallationId
        : installations.length === 1 ? installations[0].id : '';

      if (installationId) {
        loadRepositories(installationId);
      } else if (installations.length === 0) {
        setGithubInstallationId('');
        setGithubRepositories([]);
        setRepositoryListStatus(options.activeFlow ? 'authorizing' : 'idle');
        setRepositoryListMessage(options.activeFlow
          ? 'GitHub is connected. Opening repository selection…'
          : 'Select repositories to finish connecting GitHub.');
      } else {
        setGithubInstallationId('');
        setGithubRepositories([]);
        setRepositoryListStatus('idle');
        setRepositoryListMessage('Choose a GitHub installation to list repositories.');
      }

      if (options.announce && installations.length > 0) {
        const identity = `${login}:${installations.map((installation: GitHubAppInstallation) => installation.id).join(',')}`;
        if (githubSuccessIdentityRef.current !== identity) {
          githubSuccessIdentityRef.current = identity;
          toast({ title: `GitHub connected as @${login}`, description: 'Authorized repositories are ready.' });
        }
      }
      return installations.length > 0;
    } catch {
      if (!options.activeFlow) {
        setRepositoryListStatus('error');
        setRepositoryListMessage(repositoryListFriendlyMessage('network_error'));
      }
      return false;
    }
  }, [loadRepositories]);

  const synchronizeActiveGitHubFlow = useCallback(async (announce = false) => {
    const activeFlow = githubFlowRef.current;
    if (!activeFlow) return;
    const connected = await refreshGitHubConnection({ announce, activeFlow: true });
    if (connected) {
      try { activeFlow.popup?.close(); } catch { /* Browser controls popup closure. */ }
      stopGitHubFlowSync();
      try { window.focus(); } catch { /* Some embedded browsers do not expose focus control. */ }
      return;
    }
    const elapsed = Date.now() - activeFlow.startedAt;
    if (elapsed >= GITHUB_FLOW_MAX_MS) {
      stopGitHubFlowSync();
      setRepositoryListStatus('error');
      setRepositoryListMessage('GitHub is taking longer than expected. Retry connection or continue with a public URL.');
      return;
    }
    if (activeFlow.popup?.closed && elapsed > GITHUB_FLOW_POLL_MS * 4) {
      stopGitHubFlowSync();
      setRepositoryListStatus('error');
      setRepositoryListMessage('The GitHub window closed before connection completed. Retry when you are ready.');
    }
  }, [refreshGitHubConnection, stopGitHubFlowSync]);

  const beginGitHubFlowSync = useCallback((popup: Window, phase: 'oauth' | 'install' | 'switch') => {
    stopGitHubFlowSync();
    githubFlowRef.current = { popup, phase, startedAt: Date.now(), priorSessionId: githubConnectionSessionIdRef.current };
    githubFlowTimerRef.current = window.setInterval(() => {
      void synchronizeActiveGitHubFlow(false);
    }, GITHUB_FLOW_POLL_MS);
  }, [stopGitHubFlowSync, synchronizeActiveGitHubFlow]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connectionResult = params.get('githubConnection');
    const setupAction = params.get('githubSetupAction') || '';
    setGithubSetupAction(setupAction);

    if (connectionResult) {
      const draft = restoreGitHubFlowDraft();
      if (draft) {
        setSelectedPackages(draft.selectedPackages);
        if (draft.agentOperatingMode) setAgentOperatingMode(draft.agentOperatingMode as AgentOperatingModeId);
      }
      params.delete('githubConnection');
      params.delete('githubSetupAction');
      params.delete('githubError');
      const query = params.toString();
      window.history.replaceState(window.history.state, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
    }

    if (connectionResult === 'reconnect-required') {
      setRepositoryListStatus('reconnect_required');
      setRepositoryListMessage('GitHub setup did not complete. Reconnect GitHub when you are ready.');
      return;
    }
    void refreshGitHubConnection({ announce: connectionResult === 'connected' });
  }, [refreshGitHubConnection]);

  useEffect(() => {
    const synchronizeOnReturn = () => {
      if (githubFlowRef.current) void synchronizeActiveGitHubFlow(true);
    };
    const synchronizeOnVisibility = () => {
      if (document.visibilityState === 'visible') synchronizeOnReturn();
    };
    window.addEventListener('focus', synchronizeOnReturn);
    document.addEventListener('visibilitychange', synchronizeOnVisibility);
    return () => {
      window.removeEventListener('focus', synchronizeOnReturn);
      document.removeEventListener('visibilitychange', synchronizeOnVisibility);
    };
  }, [synchronizeActiveGitHubFlow]);

  useEffect(() => {
    const onMessage = (event: MessageEvent<GitHubAppConnectionMessage>) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || data.source !== 'shipseal-github-connect') return;
      const activePopup = githubFlowRef.current?.popup;
      if (activePopup && event.source && event.source !== activePopup) return;
      if (data.status === 'error') {
        setGithubLogin(data.githubLogin || '');
        githubLoginRef.current = data.githubLogin || '';
        if (data.code === 'no_installations') {
          setGithubInstallationId('');
          setGithubRepositories([]);
          setRepositoryListStatus('authorizing');
          setRepositoryListMessage('GitHub is connected. Opening repository selection…');
          return;
        }
        stopGitHubFlowSync();
        setGithubRepositories([]);
        setRepositoryListStatus(['missing_client_id', 'missing_client_secret', 'invalid_client_id_format', 'invalid_callback_url', 'invalid_api_base_url', 'app_identity_mismatch', 'app_slug_mismatch'].includes(data.code || '')
          ? 'not_configured'
          : ['invalid_oauth_state', 'github_session_expired', 'installation_not_authorized', 'user_authorization_failed'].includes(data.code || '') ? 'reconnect_required' : 'error');
        setRepositoryListMessage(repositoryListFriendlyMessage(data.code, data.message));
        return;
      }

      void synchronizeActiveGitHubFlow(true);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [stopGitHubFlowSync, synchronizeActiveGitHubFlow]);

  useEffect(() => () => stopGitHubFlowSync(), [stopGitHubFlowSync]);

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
    if (!showIntelligenceReveal || formationPhase !== 'ready' && !futureOnlyTerminalFailure) return undefined;
    const reducedMotion = Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    const timer = window.setTimeout(completeIntelligenceReveal, reducedMotion || futureOnlyTerminalFailure ? 0 : 720);
    return () => window.clearTimeout(timer);
  }, [completeIntelligenceReveal, formationPhase, futureOnlyTerminalFailure, showIntelligenceReveal]);

  const replayIntelligenceReveal = useCallback(() => {
    if (!activeReportKey) return;
    setIntelligenceReveal({ key: activeReportKey, visible: true });
    scrollWindowToTop('auto');
  }, [activeReportKey]);

  useEffect(() => {
    if (!scan.error || lastError.current === scan.error) return;
    lastError.current = scan.error;
    toast({
      title: scan.status === 'cancelled'
        ? 'Scan cancelled'
        : scan.error === "We couldn't read this ZIP archive."
          ? "We couldn't read this ZIP archive."
          : importErrorTitle(scan.errorCategory),
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
    recordOutcome('demo_started', 'global');

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
  }, [recordOutcome, scan]);

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

  const startGitHubConnectionFlow = useCallback((phase: 'oauth' | 'switch') => {
    repositoryLoadRequestRef.current += 1;
    connectionRefreshRequestRef.current += 1;
    setGithubInstallationId('');
    setGithubInstallations([]);
    setGithubRepositories([]);
    setGithubLogin('');
    githubLoginRef.current = '';
    setRepositoryListStatus('authorizing');
    setRepositoryListMessage(phase === 'switch'
      ? 'Choose the GitHub account you want to connect.'
      : 'Complete GitHub authorization in the secure window.');
    const config = getGitHubAppClientConfig();
    const url = phase === 'switch'
      ? addGitHubFlowQuery(config.loginUrl, 'prompt', 'select_account')
      : config.loginUrl;
    const launch = launchGitHubBrowserFlow({
      url,
      name: 'shipseal-github-connect',
      beforeSameTab: () => saveGitHubFlowDraft({ selectedPackages, agentOperatingMode }),
    });
    if (launch.mode === 'popup' && launch.popup) {
      beginGitHubFlowSync(launch.popup, phase);
    }
  }, [agentOperatingMode, beginGitHubFlowSync, selectedPackages]);

  const handleGitHubConnect = useCallback(() => {
    startGitHubConnectionFlow('oauth');
  }, [startGitHubConnectionFlow]);

  const handleGitHubSwitch = useCallback(() => {
    startGitHubConnectionFlow('switch');
  }, [startGitHubConnectionFlow]);

  const handleGitHubInstall = useCallback(() => {
    const config = getGitHubAppClientConfig();
    if (!config.installUrl) return;
    setRepositoryListStatus('authorizing');
    setRepositoryListMessage('Opening GitHub repository access…');
    const launch = launchGitHubBrowserFlow({
      url: config.installUrl,
      name: 'shipseal-github-install',
      beforeSameTab: () => saveGitHubFlowDraft({ selectedPackages, agentOperatingMode }),
    });
    if (launch.mode === 'popup' && launch.popup) beginGitHubFlowSync(launch.popup, 'install');
  }, [agentOperatingMode, beginGitHubFlowSync, selectedPackages]);

  const handleGitHubDisconnect = useCallback(() => {
    stopGitHubFlowSync();
    repositoryLoadRequestRef.current += 1;
    void fetch('/api/github-app/connection', { method: 'DELETE', headers: { Accept: 'application/json' } });
    setGithubInstallationId('');
    setGithubSetupAction('');
    setGithubInstallations([]);
    setGithubLogin('');
    githubLoginRef.current = '';
    githubConnectionSessionIdRef.current = '';
    setGithubRepositories([]);
    setRepositoryListStatus('idle');
    setRepositoryListMessage('');
    setPendingSource(null);
  }, [stopGitHubFlowSync]);

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
    recordOutcome('demo_started', 'global');
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
  }, [recordOutcome, scan]);

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
        reference: productFailure && 'diagnostics' in productFailure
          ? operationSupportReference(productFailure.diagnostics?.publicOperationId)
          : null,
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
      : formationPhase === 'directions' || formationPhase === 'pathways' && scan.repositoryProductIntelligenceStatus.state === 'preparing'
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
  const corruptZipFailure = scan.status === 'failed' && scan.error === "We couldn't read this ZIP archive.";

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

  if (RepositoryFuturesLayoutQa && new URLSearchParams(window.location.search).get('omega18Qa') === 'futures-layout') {
    return <Suspense fallback={<div className="min-h-screen bg-background p-8 text-muted-foreground">Loading Futures layout fixture...</div>}><RepositoryFuturesLayoutQa /></Suspense>;
  }
  if (RepositoryFutureRecoveryQa && new URLSearchParams(window.location.search).get('omega18Qa') === 'futures-recovery') {
    return <Suspense fallback={<div className="min-h-screen bg-background p-8 text-muted-foreground">Loading Future recovery fixture...</div>}><RepositoryFutureRecoveryQa /></Suspense>;
  }
  if (RepositoryRootContractQa && new URLSearchParams(window.location.search).get('omega18Qa') === 'roots-contract') {
    return <Suspense fallback={<div className="min-h-screen bg-background p-8 text-muted-foreground">Loading roots contract fixture...</div>}><RepositoryRootContractQa /></Suspense>;
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
              repositoryProductIntelligenceStatus={sampleReport ? undefined : workspaceFuturesStatus}
              retryRepositoryProductIntelligence={sampleReport || accountAwareFuturesStatus.state === 'fallback' && ['upgrade_required', 'authentication_required'].includes(accountAwareFuturesStatus.category) ? undefined : scan.retryRepositoryProductIntelligence}
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
              persistenceControl={sampleReport ? undefined : <Suspense fallback={<div className="text-xs text-muted-foreground">Preparing private save…</div>}><SaveProjectControl key={activeReportKey || undefined} report={activeReport} providerStatus={scan.repositoryIntelligenceProviderStatus} verificationBaseline={repositoryIntelligenceVerificationBaseline} verificationResult={scan.repositoryIntelligenceVerification} projectId={verificationProjectContext?.projectId || currentProjectContext?.projectId} baselineScanId={verificationProjectContext?.baselineScanId} existingContext={currentProjectContext} onPersisted={context => activeReportKey && setActiveProjectContext({ ...context, reportKey: activeReportKey })} /></Suspense>}
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
                    title={scan.status === 'cancelled' ? 'Scan cancelled' : corruptZipFailure ? "We couldn't read this ZIP archive." : importErrorTitle(scan.errorCategory)}
                    description={scan.status === 'cancelled'
                      ? 'The repository was not changed. You can restart when ready.'
                      : corruptZipFailure
                        ? 'This file is not a readable supported ZIP. Try another ZIP or choose another source.'
                      : 'ShipSeal could not finish this source. Retry it or choose another source.'}
                    action={corruptZipFailure
                      ? <Button type="button" size="sm" onClick={() => { scanStartInFlight.current = false; scan.resetScan(); setPendingSource(null); }}>Try another ZIP</Button>
                      : pendingSource
                      ? <Button type="button" size="sm" onClick={retryPendingScan}>Retry scan</Button>
                      : undefined}
                    fallback={<Button type="button" size="sm" variant="outline" onClick={() => { scanStartInFlight.current = false; scan.resetScan(); setPendingSource(null); }}>Choose another source</Button>}
                    details={scan.status === 'failed' && !corruptZipFailure ? scan.error : undefined}
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
                  githubLogin={githubLogin}
                  repositoryListMessage={repositoryListMessage || (githubSetupAction ? `GitHub setup action: ${githubSetupAction}` : '')}
                  onGitHubAppRepositorySelect={handleGitHubAppRepository}
                  onGitHubConnect={handleGitHubConnect}
                  onGitHubSwitch={handleGitHubSwitch}
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
