import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { GITHUB_APP_SCAN_STEPS, GITHUB_PUBLIC_SCAN_STEPS, localScanEngine, ScanCancelledError, SCAN_ENGINE_STEPS } from '@/lib/scanEngine';
import { GitHubImportError, importGitHubAppRepoArchive, importPublicGitHubRepo } from '@/lib/github/githubImport';
import type { GitHubImportErrorCategory } from '@/lib/github/types';
import type { ReadinessReport, RepoScanInput, ScanSourceMetadata, ScanSummary } from '@/lib/types';
import type {
  BuildRepositoryIntelligenceArtifactReviewResult,
  RepositoryIntelligenceProviderStatus,
  RepositoryIntelligenceVerificationBaseline,
  RepositoryIntelligenceVerificationResult,
} from '@/lib/repositoryIntelligence';

export type RepoScanStatus = 'idle' | 'scanning' | 'completed' | 'failed' | 'cancelled';

export interface RepoScanState {
  selectedFile: File | null;
  status: RepoScanStatus;
  currentStep: string | null;
  currentStepIndex: number;
  progress: number;
  warnings: string[];
  error: string | null;
  errorCategory: GitHubImportErrorCategory | null;
  report: ReadinessReport | null;
  /** Safe UI boundary: validated drafts and review metadata, without selected source context. */
  repositoryIntelligenceReview: Pick<BuildRepositoryIntelligenceArtifactReviewResult, 'artifactSet' | 'review'> | null;
  repositoryIntelligenceReviewPreparing: boolean;
  repositoryIntelligenceReviewError: string | null;
  repositoryIntelligenceProviderStatus: RepositoryIntelligenceProviderStatus;
  /** Safe internal UI boundary: fingerprints, finite states and repository-relative paths only. */
  repositoryIntelligenceVerification: RepositoryIntelligenceVerificationResult | null;
  repositoryIntelligenceVerificationStatus: 'idle' | 'scanning' | 'completed' | 'failed';
  repositoryIntelligenceVerificationError: string | null;
  steps: readonly string[];
  activeRepositoryLabel: string | null;
  activeScanSourceLabel: string | null;
  discoveredFileCount: number | null;
  analyzedFileCount: number | null;
}

interface PreparedRepositoryIntelligenceVerification {
  result: RepositoryIntelligenceVerificationResult | null;
  error: string | null;
}

const initialState: RepoScanState = {
  selectedFile: null,
  status: 'idle',
  currentStep: null,
  currentStepIndex: 0,
  progress: 0,
  warnings: [],
  error: null,
  errorCategory: null,
  report: null,
  repositoryIntelligenceReview: null,
  repositoryIntelligenceReviewPreparing: false,
  repositoryIntelligenceReviewError: null,
  repositoryIntelligenceProviderStatus: { state: 'deterministic', message: 'Deterministic repository intelligence is ready for review.', retryable: false },
  repositoryIntelligenceVerification: null,
  repositoryIntelligenceVerificationStatus: 'idle',
  repositoryIntelligenceVerificationError: null,
  steps: SCAN_ENGINE_STEPS,
  activeRepositoryLabel: null,
  activeScanSourceLabel: null,
  discoveredFileCount: null,
  analyzedFileCount: null,
};

function applyScanSummary(summary: ScanSummary) {
  return {
    discoveredFileCount: summary.totalFilesFound,
    analyzedFileCount: summary.filesAnalyzed,
  };
}

export function useRepoScan(repositoryIntelligenceVerificationBaseline?: RepositoryIntelligenceVerificationBaseline | null) {
  const [state, setState] = useState<RepoScanState>(initialState);
  const abortRef = useRef<AbortController | null>(null);
  const providerAbortRef = useRef<AbortController | null>(null);
  const providerSingleFlightRef = useRef<import('@/lib/repositoryIntelligence/deepIntelligenceClient').RepositoryIntelligenceEnhancementSingleFlight | null>(null);
  const repositoryIntelligencePreparationRef = useRef<BuildRepositoryIntelligenceArtifactReviewResult | null>(null);
  const repositoryIntelligenceScanInputRef = useRef<RepoScanInput | null>(null);
  const scanTokenRef = useRef(0);

  const resetScan = useCallback(() => {
    abortRef.current?.abort();
    providerAbortRef.current?.abort();
    abortRef.current = null;
    repositoryIntelligencePreparationRef.current = null;
    repositoryIntelligenceScanInputRef.current = null;
    scanTokenRef.current += 1;
    setState(initialState);
  }, []);

  const cancelScan = useCallback(() => {
    abortRef.current?.abort();
    providerAbortRef.current?.abort();
    abortRef.current = null;
    repositoryIntelligencePreparationRef.current = null;
    repositoryIntelligenceScanInputRef.current = null;
    scanTokenRef.current += 1;
    setState(current => ({
      ...current,
      status: 'cancelled',
        currentStep: null,
        error: 'Scan cancelled',
        errorCategory: null,
        progress: 0,
        report: null,
        repositoryIntelligenceReview: null,
        repositoryIntelligenceReviewPreparing: false,
        repositoryIntelligenceReviewError: null,
        repositoryIntelligenceVerificationStatus: current.repositoryIntelligenceVerification ? 'completed' : 'idle',
        repositoryIntelligenceVerificationError: null,
    }));
  }, []);

  useEffect(() => () => providerAbortRef.current?.abort(), []);

  const startScan = useCallback(async (file: File) => {
    const token = scanTokenRef.current + 1;
    scanTokenRef.current = token;
    providerAbortRef.current?.abort();
    repositoryIntelligencePreparationRef.current = null;
    repositoryIntelligenceScanInputRef.current = null;
    const controller = new AbortController();
    abortRef.current = controller;

    setState(current => ({
      ...initialState,
      repositoryIntelligenceVerification: current.repositoryIntelligenceVerification,
      repositoryIntelligenceVerificationStatus: repositoryIntelligenceVerificationBaseline ? 'scanning' : 'idle',
      selectedFile: file,
      status: 'scanning',
      currentStep: SCAN_ENGINE_STEPS[0],
      steps: SCAN_ENGINE_STEPS,
      activeRepositoryLabel: file.name.replace(/\.zip$/i, '') || file.name,
      activeScanSourceLabel: 'ZIP upload',
    }));

    let verificationPromise: Promise<PreparedRepositoryIntelligenceVerification> | null = null;

    try {
      const report = await localScanEngine.scan(
        { file, mode: 'local', source: { sourceType: 'zip-upload' }, signal: controller.signal },
        {
          onStepStart: (step, index) => {
            if (scanTokenRef.current !== token) return;
            setState(current => ({ ...current, currentStep: step, currentStepIndex: index }));
          },
          onProgress: progress => {
            if (scanTokenRef.current !== token) return;
            setState(current => ({ ...current, progress }));
          },
          onWarning: warning => {
            if (scanTokenRef.current !== token) return;
            setState(current => ({ ...current, warnings: [...current.warnings, warning] }));
          },
          onScanSummary: summary => {
            if (scanTokenRef.current !== token) return;
            setState(current => ({ ...current, ...applyScanSummary(summary) }));
          },
          onScanInput: scanInput => {
            if (scanTokenRef.current !== token) return;
            repositoryIntelligenceScanInputRef.current = scanInput;
            void setRepositoryIntelligenceReview(setState, scanInput, () => scanTokenRef.current === token, result => { repositoryIntelligencePreparationRef.current = result; });
            verificationPromise = prepareRepositoryIntelligenceVerification(scanInput, repositoryIntelligenceVerificationBaseline);
          },
        }
      );

      if (scanTokenRef.current !== token || controller.signal.aborted) return null;
      const verification = verificationPromise ? await verificationPromise : { result: null, error: null };
      if (scanTokenRef.current !== token || controller.signal.aborted) return null;
      setState(current => ({
        ...current,
        status: 'completed',
        currentStep: null,
        currentStepIndex: SCAN_ENGINE_STEPS.length,
        progress: 100,
        report,
        repositoryIntelligenceVerification: verification.result || current.repositoryIntelligenceVerification,
        repositoryIntelligenceVerificationStatus: repositoryIntelligenceVerificationBaseline ? verification.error ? 'failed' : 'completed' : 'idle',
        repositoryIntelligenceVerificationError: verification.error,
      }));
      abortRef.current = null;
      return report;
    } catch (error) {
      if (scanTokenRef.current !== token) return null;
      const cancelled = error instanceof ScanCancelledError || controller.signal.aborted;
      setState(current => ({
        ...current,
        status: cancelled ? 'cancelled' : 'failed',
        currentStep: null,
        error: cancelled ? 'Scan cancelled' : error instanceof Error ? error.message : String(error),
        errorCategory: null,
        report: null,
        repositoryIntelligenceReview: null,
        repositoryIntelligenceReviewPreparing: false,
        repositoryIntelligenceReviewError: null,
        repositoryIntelligenceVerificationStatus: cancelled ? current.repositoryIntelligenceVerification ? 'completed' : 'idle' : repositoryIntelligenceVerificationBaseline ? 'failed' : current.repositoryIntelligenceVerification ? 'completed' : 'idle',
        repositoryIntelligenceVerificationError: repositoryIntelligenceVerificationBaseline && !cancelled ? 'Repository Intelligence verification could not be completed from this scan.' : null,
      }));
      abortRef.current = null;
      return null;
    }
  }, [repositoryIntelligenceVerificationBaseline]);

  const startGitHubScan = useCallback(async (url: string, branch?: string, sourceOverride: Partial<ScanSourceMetadata> = {}) => {
    const token = scanTokenRef.current + 1;
    scanTokenRef.current = token;
    providerAbortRef.current?.abort();
    repositoryIntelligencePreparationRef.current = null;
    repositoryIntelligenceScanInputRef.current = null;
    const controller = new AbortController();
    abortRef.current = controller;

    setState(current => ({
      ...initialState,
      repositoryIntelligenceVerification: current.repositoryIntelligenceVerification,
      repositoryIntelligenceVerificationStatus: repositoryIntelligenceVerificationBaseline ? 'scanning' : 'idle',
      status: 'scanning',
      currentStep: GITHUB_PUBLIC_SCAN_STEPS[0],
      steps: GITHUB_PUBLIC_SCAN_STEPS,
      activeRepositoryLabel: url,
      activeScanSourceLabel: 'Public GitHub',
    }));

    let verificationPromise: Promise<PreparedRepositoryIntelligenceVerification> | null = null;

    try {
      const imported = await importPublicGitHubRepo(
        { url, branch },
        {
          onStepStart: (step, index) => {
            if (scanTokenRef.current !== token) return;
            setState(current => ({ ...current, currentStep: step, currentStepIndex: index }));
          },
          onProgress: progress => {
            if (scanTokenRef.current !== token) return;
            setState(current => ({ ...current, progress }));
          },
        }
      );

      if (scanTokenRef.current !== token || controller.signal.aborted) return null;
      setState(current => ({ ...current, selectedFile: imported.file }));

      const localToGitHubStepIndex = [2, 3, 4];
      const report = await localScanEngine.scan(
        { file: imported.file, mode: 'github-public', source: { ...imported.source, ...sourceOverride }, signal: controller.signal },
        {
          onStepStart: (step, index) => {
            if (scanTokenRef.current !== token) return;
            const adjustedIndex = localToGitHubStepIndex[index] ?? GITHUB_PUBLIC_SCAN_STEPS.length - 1;
            setState(current => ({
              ...current,
              currentStep: GITHUB_PUBLIC_SCAN_STEPS[adjustedIndex] || step,
              currentStepIndex: adjustedIndex,
            }));
          },
          onProgress: progress => {
            if (scanTokenRef.current !== token) return;
            setState(current => ({ ...current, progress: Math.max(30, Math.round(30 + progress * 0.7)) }));
          },
          onWarning: warning => {
            if (scanTokenRef.current !== token) return;
            setState(current => ({ ...current, warnings: [...current.warnings, warning] }));
          },
          onScanSummary: summary => {
            if (scanTokenRef.current !== token) return;
            setState(current => ({ ...current, ...applyScanSummary(summary) }));
          },
          onScanInput: scanInput => {
            if (scanTokenRef.current !== token) return;
            repositoryIntelligenceScanInputRef.current = scanInput;
            void setRepositoryIntelligenceReview(setState, scanInput, () => scanTokenRef.current === token, result => { repositoryIntelligencePreparationRef.current = result; });
            verificationPromise = prepareRepositoryIntelligenceVerification(scanInput, repositoryIntelligenceVerificationBaseline);
          },
        }
      );

      if (scanTokenRef.current !== token || controller.signal.aborted) return null;
      const verification = verificationPromise ? await verificationPromise : { result: null, error: null };
      if (scanTokenRef.current !== token || controller.signal.aborted) return null;
      setState(current => ({
        ...current,
        status: 'completed',
        currentStep: null,
        currentStepIndex: GITHUB_PUBLIC_SCAN_STEPS.length,
        progress: 100,
        report,
        repositoryIntelligenceVerification: verification.result || current.repositoryIntelligenceVerification,
        repositoryIntelligenceVerificationStatus: repositoryIntelligenceVerificationBaseline ? verification.error ? 'failed' : 'completed' : 'idle',
        repositoryIntelligenceVerificationError: verification.error,
      }));
      abortRef.current = null;
      return report;
    } catch (error) {
      if (scanTokenRef.current !== token) return null;
      const cancelled = error instanceof ScanCancelledError || controller.signal.aborted;
      const message = error instanceof GitHubImportError
        ? error.message || error.fallbackMessage
        : cancelled
          ? 'Scan cancelled'
          : error instanceof Error
            ? error.message
            : String(error);
      setState(current => ({
        ...current,
        status: cancelled ? 'cancelled' : 'failed',
        currentStep: null,
        error: message,
        errorCategory: error instanceof GitHubImportError ? error.category : null,
        report: null,
        repositoryIntelligenceReview: null,
        repositoryIntelligenceReviewPreparing: false,
        repositoryIntelligenceReviewError: null,
        repositoryIntelligenceVerificationStatus: cancelled ? current.repositoryIntelligenceVerification ? 'completed' : 'idle' : repositoryIntelligenceVerificationBaseline ? 'failed' : current.repositoryIntelligenceVerification ? 'completed' : 'idle',
        repositoryIntelligenceVerificationError: repositoryIntelligenceVerificationBaseline && !cancelled ? 'Repository Intelligence verification could not be completed from this scan.' : null,
      }));
      abortRef.current = null;
      return null;
    }
  }, [repositoryIntelligenceVerificationBaseline]);

  const startGitHubAppScan = useCallback(async (input: { installationId: string; owner: string; repo: string; ref?: string }) => {
    const token = scanTokenRef.current + 1;
    scanTokenRef.current = token;
    providerAbortRef.current?.abort();
    repositoryIntelligencePreparationRef.current = null;
    repositoryIntelligenceScanInputRef.current = null;
    const controller = new AbortController();
    abortRef.current = controller;

    setState(current => ({
      ...initialState,
      repositoryIntelligenceVerification: current.repositoryIntelligenceVerification,
      repositoryIntelligenceVerificationStatus: repositoryIntelligenceVerificationBaseline ? 'scanning' : 'idle',
      status: 'scanning',
      currentStep: GITHUB_APP_SCAN_STEPS[0],
      steps: GITHUB_APP_SCAN_STEPS,
      activeRepositoryLabel: `${input.owner}/${input.repo}`,
      activeScanSourceLabel: 'GitHub App',
    }));

    let verificationPromise: Promise<PreparedRepositoryIntelligenceVerification> | null = null;

    try {
      setState(current => ({ ...current, currentStep: GITHUB_APP_SCAN_STEPS[1], currentStepIndex: 1, progress: 12 }));
      const imported = await importGitHubAppRepoArchive(input);
      if (scanTokenRef.current !== token || controller.signal.aborted) return null;
      setState(current => ({ ...current, selectedFile: imported.file, progress: 30 }));

      const report = await localScanEngine.scan(
        { file: imported.file, mode: 'github-public', source: imported.source, signal: controller.signal },
        {
          onStepStart: (step, index) => {
            if (scanTokenRef.current !== token) return;
            const adjustedIndex = [2, 3, 4][index] ?? GITHUB_APP_SCAN_STEPS.length - 1;
            setState(current => ({
              ...current,
              currentStep: GITHUB_APP_SCAN_STEPS[adjustedIndex] || step,
              currentStepIndex: adjustedIndex,
            }));
          },
          onProgress: progress => {
            if (scanTokenRef.current !== token) return;
            setState(current => ({ ...current, progress: Math.max(30, Math.round(30 + progress * 0.7)) }));
          },
          onWarning: warning => {
            if (scanTokenRef.current !== token) return;
            setState(current => ({ ...current, warnings: [...current.warnings, warning] }));
          },
          onScanSummary: summary => {
            if (scanTokenRef.current !== token) return;
            setState(current => ({ ...current, ...applyScanSummary(summary) }));
          },
          onScanInput: scanInput => {
            if (scanTokenRef.current !== token) return;
            repositoryIntelligenceScanInputRef.current = scanInput;
            void setRepositoryIntelligenceReview(setState, scanInput, () => scanTokenRef.current === token, result => { repositoryIntelligencePreparationRef.current = result; });
            verificationPromise = prepareRepositoryIntelligenceVerification(scanInput, repositoryIntelligenceVerificationBaseline);
          },
        }
      );

      if (scanTokenRef.current !== token || controller.signal.aborted) return null;
      const verification = verificationPromise ? await verificationPromise : { result: null, error: null };
      if (scanTokenRef.current !== token || controller.signal.aborted) return null;
      setState(current => ({
        ...current,
        status: 'completed',
        currentStep: null,
        currentStepIndex: GITHUB_APP_SCAN_STEPS.length,
        progress: 100,
        report,
        repositoryIntelligenceVerification: verification.result || current.repositoryIntelligenceVerification,
        repositoryIntelligenceVerificationStatus: repositoryIntelligenceVerificationBaseline ? verification.error ? 'failed' : 'completed' : 'idle',
        repositoryIntelligenceVerificationError: verification.error,
      }));
      abortRef.current = null;
      return report;
    } catch (error) {
      if (scanTokenRef.current !== token) return null;
      const cancelled = error instanceof ScanCancelledError || controller.signal.aborted;
      setState(current => ({
        ...current,
        status: cancelled ? 'cancelled' : 'failed',
        currentStep: null,
        error: cancelled ? 'Scan cancelled' : error instanceof Error ? error.message : String(error),
        errorCategory: error instanceof GitHubImportError ? error.category : null,
        report: null,
        repositoryIntelligenceReview: null,
        repositoryIntelligenceReviewPreparing: false,
        repositoryIntelligenceReviewError: null,
        repositoryIntelligenceVerificationStatus: cancelled ? current.repositoryIntelligenceVerification ? 'completed' : 'idle' : repositoryIntelligenceVerificationBaseline ? 'failed' : current.repositoryIntelligenceVerification ? 'completed' : 'idle',
        repositoryIntelligenceVerificationError: repositoryIntelligenceVerificationBaseline && !cancelled ? 'Repository Intelligence verification could not be completed from this scan.' : null,
      }));
      abortRef.current = null;
      return null;
    }
  }, [repositoryIntelligenceVerificationBaseline]);

  const prepareRepositoryIntelligenceEnhancement = useCallback(() => {
    const preparation = repositoryIntelligencePreparationRef.current;
    const scanInput = repositoryIntelligenceScanInputRef.current;
    if (!preparation || !scanInput) return Promise.resolve();
    const run = async () => {
      const token = scanTokenRef.current;
      const controller = new AbortController();
      providerAbortRef.current?.abort();
      providerAbortRef.current = controller;
      setState(current => ({
        ...current,
        repositoryIntelligenceProviderStatus: { state: 'preparing', message: 'Preparing optional enhanced intelligence from bounded repository context.', retryable: false },
      }));
      try {
        const [requestModule, reviewModule, clientModule] = await Promise.all([
          import('@/lib/repositoryIntelligence/deepIntelligenceRequest'),
          import('@/lib/repositoryIntelligence/repositoryIntelligenceReview'),
          import('@/lib/repositoryIntelligence/deepIntelligenceClient'),
        ]);
        const { buildRepositoryDeepIntelligenceRequest } = requestModule;
        const { buildRepositoryIntelligenceArtifactReview } = reviewModule;
        const { requestRepositoryIntelligenceEnhancement } = clientModule;
        const request = buildRepositoryDeepIntelligenceRequest({
          contextBundle: preparation.contextBundle,
          evidenceResult: preparation.evidenceResult,
          requestedCapabilities: [
            'architecture-analysis', 'responsibility-refinement', 'task-routing', 'risk-identification',
            'documentation-conflict-detection', 'agent-instruction-recommendations',
            'artifact-statement-generation', 'structured-output',
          ],
        });
        const response = await requestRepositoryIntelligenceEnhancement(request, { signal: controller.signal });
        if (scanTokenRef.current !== token || controller.signal.aborted) return;
        if (response.state === 'enhanced') {
          const enhanced = buildRepositoryIntelligenceArtifactReview({
            scanInput,
            evidenceResult: preparation.evidenceResult,
            contextBundle: preparation.contextBundle,
            deepIntelligenceResult: response.result,
          });
          repositoryIntelligencePreparationRef.current = enhanced;
          setState(current => ({
            ...current,
            repositoryIntelligenceReview: { artifactSet: enhanced.artifactSet, review: enhanced.review },
            repositoryIntelligenceProviderStatus: {
              state: 'enhanced', message: 'Validated enhanced intelligence contributed to this review.', retryable: false,
              providerId: response.providerId, modelId: response.modelId,
            },
          }));
          return;
        }
        const fallbackStatus: RepositoryIntelligenceProviderStatus = response.category === 'request_cancelled'
          ? { state: 'cancelled', message: response.message, retryable: true, category: 'request_cancelled' }
          : { state: 'fallback', message: response.message, retryable: response.retryable, category: response.category };
        setState(current => ({ ...current, repositoryIntelligenceProviderStatus: fallbackStatus }));
      } catch (error) {
        if (scanTokenRef.current !== token) return;
        setState(current => ({
          ...current,
          repositoryIntelligenceProviderStatus: controller.signal.aborted
            ? { state: 'cancelled', category: 'request_cancelled', retryable: true, message: 'Enhanced intelligence preparation was cancelled. Deterministic repository intelligence remains ready.' }
            : { state: 'fallback', category: 'provider_unavailable', retryable: true, message: 'Enhanced intelligence is unavailable. Deterministic repository intelligence remains ready for review.' },
        }));
      } finally {
        if (providerAbortRef.current === controller) providerAbortRef.current = null;
      }
    };
    return import('@/lib/repositoryIntelligence/deepIntelligenceClient').then(({ RepositoryIntelligenceEnhancementSingleFlight }) => {
      providerSingleFlightRef.current ||= new RepositoryIntelligenceEnhancementSingleFlight();
      return providerSingleFlightRef.current.run(run);
    });
  }, []);

  return {
    ...state,
    startScan,
    startGitHubScan,
    startGitHubAppScan,
    cancelScan,
    resetScan,
    prepareRepositoryIntelligenceEnhancement,
  };
}

async function prepareRepositoryIntelligenceVerification(
  scanInput: RepoScanInput,
  baseline?: RepositoryIntelligenceVerificationBaseline | null,
): Promise<PreparedRepositoryIntelligenceVerification> {
  if (!baseline) return { result: null, error: null };
  try {
    const { verifyRepositoryIntelligenceArtifacts } = await import('@/lib/repositoryIntelligence/repositoryIntelligenceVerification');
    return { result: verifyRepositoryIntelligenceArtifacts({ baseline, currentScan: scanInput }), error: null };
  } catch {
    return { result: null, error: 'Repository Intelligence verification could not be completed safely. The previous valid result was preserved.' };
  }
}

async function setRepositoryIntelligenceReview(
  setState: Dispatch<SetStateAction<RepoScanState>>,
  scanInput: RepoScanInput,
  isCurrent: () => boolean,
  onPrepared: (result: BuildRepositoryIntelligenceArtifactReviewResult) => void,
) {
  setState(current => ({ ...current, repositoryIntelligenceReviewPreparing: true, repositoryIntelligenceReviewError: null }));
  try {
    const { buildRepositoryIntelligenceArtifactReview } = await import('@/lib/repositoryIntelligence/repositoryIntelligenceReview');
    if (!isCurrent()) return;
    const result = buildRepositoryIntelligenceArtifactReview({ scanInput });
    if (!isCurrent()) return;
    onPrepared(result);
    setState(current => ({
      ...current,
      repositoryIntelligenceReview: { artifactSet: result.artifactSet, review: result.review },
      repositoryIntelligenceReviewPreparing: false,
      repositoryIntelligenceReviewError: null,
      repositoryIntelligenceProviderStatus: { state: 'deterministic', message: 'Deterministic repository intelligence is ready for review.', retryable: false },
    }));
  } catch (error) {
    if (!isCurrent()) return;
    setState(current => ({
      ...current,
      repositoryIntelligenceReview: null,
      repositoryIntelligenceReviewPreparing: false,
      repositoryIntelligenceReviewError: error instanceof Error ? error.message : 'Repository Intelligence review could not be prepared.',
    }));
  }
}
