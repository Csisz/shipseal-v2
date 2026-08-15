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
  RepositoryProductIntelligenceResult,
} from '@/lib/repositoryIntelligence';
import { repositoryFutureFailureMessage } from '@/lib/repositoryIntelligence';

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
  repositoryProductIntelligenceStatus: RepositoryIntelligenceProviderStatus;
  /** Validated, bounded Product Understanding and proposed opportunities; never raw provider output. */
  repositoryProductIntelligence: RepositoryProductIntelligenceResult | null;
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
  repositoryIntelligenceProviderStatus: { state: 'deterministic', deepState: 'disabled', message: 'Deterministic repository intelligence is ready for review.', retryable: false },
  repositoryProductIntelligenceStatus: { state: 'deterministic', deepState: 'disabled', message: 'Product opportunity analysis is ready to start.', retryable: false },
  repositoryProductIntelligence: null,
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
  const productAbortRef = useRef<AbortController | null>(null);
  const providerSingleFlightRef = useRef<import('@/lib/repositoryIntelligence/deepIntelligenceClient').RepositoryIntelligenceEnhancementSingleFlight | null>(null);
  const productSingleFlightRef = useRef<import('@/lib/repositoryIntelligence/deepIntelligenceClient').RepositoryIntelligenceEnhancementSingleFlight | null>(null);
  const repositoryIntelligencePreparationRef = useRef<BuildRepositoryIntelligenceArtifactReviewResult | null>(null);
  const repositoryIntelligenceScanInputRef = useRef<RepoScanInput | null>(null);
  const productReportIdentityRef = useRef('');
  const productRequestIdentityRef = useRef('');
  const productRequestPromiseRef = useRef<Promise<void> | null>(null);
  const productRequestAttemptRef = useRef(0);
  const scanTokenRef = useRef(0);

  const resetScan = useCallback(() => {
    abortRef.current?.abort();
    providerAbortRef.current?.abort();
    productAbortRef.current?.abort();
    abortRef.current = null;
    repositoryIntelligencePreparationRef.current = null;
    repositoryIntelligenceScanInputRef.current = null;
    productReportIdentityRef.current = '';
    productRequestIdentityRef.current = '';
    productRequestPromiseRef.current = null;
    productRequestAttemptRef.current = 0;
    scanTokenRef.current += 1;
    setState(initialState);
  }, []);

  const cancelScan = useCallback(() => {
    abortRef.current?.abort();
    providerAbortRef.current?.abort();
    productAbortRef.current?.abort();
    abortRef.current = null;
    repositoryIntelligencePreparationRef.current = null;
    repositoryIntelligenceScanInputRef.current = null;
    productReportIdentityRef.current = '';
    productRequestIdentityRef.current = '';
    productRequestPromiseRef.current = null;
    productRequestAttemptRef.current = 0;
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

  useEffect(() => () => {
    providerAbortRef.current?.abort();
    productAbortRef.current?.abort();
  }, []);

  const startScan = useCallback(async (file: File) => {
    const token = scanTokenRef.current + 1;
    scanTokenRef.current = token;
    providerAbortRef.current?.abort();
    productAbortRef.current?.abort();
    repositoryIntelligencePreparationRef.current = null;
    repositoryIntelligenceScanInputRef.current = null;
    productReportIdentityRef.current = '';
    productRequestIdentityRef.current = '';
    productRequestPromiseRef.current = null;
    productRequestAttemptRef.current = 0;
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
      productReportIdentityRef.current = repositoryReportIdentity(report);
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
    productAbortRef.current?.abort();
    repositoryIntelligencePreparationRef.current = null;
    repositoryIntelligenceScanInputRef.current = null;
    productReportIdentityRef.current = '';
    productRequestIdentityRef.current = '';
    productRequestPromiseRef.current = null;
    productRequestAttemptRef.current = 0;
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
      productReportIdentityRef.current = repositoryReportIdentity(report);
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
    productAbortRef.current?.abort();
    repositoryIntelligencePreparationRef.current = null;
    repositoryIntelligenceScanInputRef.current = null;
    productReportIdentityRef.current = '';
    productRequestIdentityRef.current = '';
    productRequestPromiseRef.current = null;
    productRequestAttemptRef.current = 0;
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
      productReportIdentityRef.current = repositoryReportIdentity(report);
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
        repositoryIntelligenceProviderStatus: { state: 'preparing', deepState: 'pending', message: 'Preparing optional deep analysis from bounded, redacted repository context.', retryable: false },
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
              state: 'enhanced', deepState: response.deepState, message: 'Validated deep analysis is available alongside deterministic findings.', retryable: false,
              providerId: response.providerId, modelId: response.modelId, diagnostics: response.diagnostics,
              insights: response.result.findings.map(finding => ({
                id: finding.id,
                title: finding.title,
                confidence: finding.acceptedConfidence,
                validationState: finding.validationState,
                evidencePaths: finding.acceptedPaths,
                evidenceCount: finding.supportingEvidenceIds.length,
                heuristic: finding.inferenceType !== 'verified',
                futureDirection: finding.futureDirectionCandidate ? {
                  goal: finding.futureDirectionCandidate.goal,
                  verificationMethod: finding.futureDirectionCandidate.verificationMethod,
                } : undefined,
              })),
            },
          }));
          return;
        }
        if (response.state === 'stage-enhanced') throw new Error('Unexpected Product expansion response in general Deep Intelligence.');
        const fallbackStatus: RepositoryIntelligenceProviderStatus = response.category === 'request_cancelled'
          ? { state: 'cancelled', deepState: response.deepState, message: response.message, retryable: true, category: 'request_cancelled', diagnostics: response.diagnostics }
          : { state: 'fallback', deepState: response.deepState, message: response.message, retryable: response.retryable, category: response.category, diagnostics: response.diagnostics };
        setState(current => ({ ...current, repositoryIntelligenceProviderStatus: fallbackStatus }));
      } catch (error) {
        if (scanTokenRef.current !== token) return;
        setState(current => ({
          ...current,
          repositoryIntelligenceProviderStatus: controller.signal.aborted
            ? { state: 'cancelled', deepState: 'failed', category: 'request_cancelled', retryable: true, message: 'Deep analysis was cancelled. Deterministic repository intelligence remains ready.' }
            : { state: 'fallback', deepState: 'failed', category: 'provider_unavailable', retryable: true, message: 'Deep analysis is unavailable. Deterministic repository intelligence remains ready for review.' },
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

  const prepareRepositoryProductIntelligence = useCallback((options: { retry?: boolean } = {}) => {
    const preparation = repositoryIntelligencePreparationRef.current;
    const scanInput = repositoryIntelligenceScanInputRef.current;
    const reportIdentity = productReportIdentityRef.current;
    if (!preparation || !scanInput || !reportIdentity) return Promise.resolve();
    if (!options.retry && productRequestIdentityRef.current.startsWith(`${reportIdentity}:attempt-`)) {
      return productRequestPromiseRef.current || Promise.resolve();
    }

    if (options.retry) {
      productAbortRef.current?.abort();
      productRequestAttemptRef.current += 1;
    }
    const requestIdentity = `${reportIdentity}:attempt-${productRequestAttemptRef.current}`;
    productRequestIdentityRef.current = requestIdentity;
    const run = async () => {
      const token = scanTokenRef.current;
      const controller = new AbortController();
      productAbortRef.current?.abort();
      productAbortRef.current = controller;
      setState(current => ({
        ...current,
        repositoryProductIntelligence: null,
        repositoryProductIntelligenceStatus: {
          state: 'preparing', deepState: 'pending',
          productStage: 'roots', completedBatches: 0, totalBatches: 0,
          message: 'ShipSeal is understanding the product and finding grounded directions.', retryable: false,
        },
      }));
      try {
        const [productModule, clientModule] = await Promise.all([
          import('@/lib/repositoryIntelligence/productStrategistContext'),
          import('@/lib/repositoryIntelligence/deepIntelligenceClient'),
        ]);
        const contextBundle = productModule.prepareRepositoryProductStrategistContext({
          scanInput,
          evidenceResult: preparation.evidenceResult,
        });
        const request = productModule.buildRepositoryProductStrategistRequest({
          contextBundle,
          evidenceResult: preparation.evidenceResult,
        });
        const response = await clientModule.requestRepositoryProductIntelligenceStaged(request, {
          signal: controller.signal,
          onProgress: progress => {
            if (scanTokenRef.current !== token || productRequestIdentityRef.current !== requestIdentity || controller.signal.aborted) return;
            setState(current => ({
              ...current,
              repositoryProductIntelligenceStatus: {
                state: 'preparing', deepState: 'pending', retryable: false,
                productStage: progress.stage,
                completedBatches: progress.completedBatches,
                totalBatches: progress.totalBatches,
                activeBatchIndexes: progress.activeBatchIndexes,
                message: progress.stage === 'roots'
                  ? progress.stageAttempt && progress.stageAttempt > 1
                    ? 'Retrying product directions with the completed repository understanding.'
                    : 'Understanding the product and finding grounded directions.'
                  : progress.stage === 'expansion'
                    ? `${progress.stageAttempt && progress.stageAttempt > 1 ? 'Retrying one pathway group' : 'Building future pathways'} · ${progress.completedBatches} of ${progress.totalBatches} pathway groups complete.`
                    : 'Validating and preparing your Future graph.',
              },
            }));
          },
        });
        if (scanTokenRef.current !== token || productRequestIdentityRef.current !== requestIdentity) return;
        if (controller.signal.aborted || response.state === 'fallback' && response.category === 'request_cancelled') {
          setState(current => ({
            ...current,
            repositoryProductIntelligenceStatus: {
              state: 'cancelled', deepState: 'failed', category: 'request_cancelled', retryable: true,
              message: 'Future analysis was cancelled. You can retry when you are ready.',
              diagnostics: response.state === 'fallback' ? response.diagnostics : undefined,
            },
          }));
          return;
        }
        if (response.state === 'enhanced') {
          if (response.result.productIntelligence?.opportunities.length) {
            setState(current => ({
              ...current,
              repositoryProductIntelligence: response.result.productIntelligence || null,
              repositoryProductIntelligenceStatus: {
                state: 'enhanced', deepState: response.deepState,
                message: 'Validated Product Understanding and Product Opportunities are available.', retryable: false,
                providerId: response.providerId, modelId: response.modelId, diagnostics: response.diagnostics,
              },
            }));
          } else {
            setState(current => ({
              ...current,
              repositoryProductIntelligenceStatus: {
                state: 'fallback', deepState: 'rejected', category: 'evidence_validation_failed', retryable: false,
                message: 'Product opportunity analysis did not return an accepted strategic result. Repository evidence fallback remains available.',
                diagnostics: response.diagnostics,
              },
            }));
          }
          return;
        }
        if (response.state === 'stage-enhanced') throw new Error('Incomplete staged response reached the Product Intelligence owner.');
        const incompleteExpansion = response.diagnostics?.productStage === 'expansion';
        const fallbackStatus: RepositoryIntelligenceProviderStatus = {
          state: 'fallback',
          deepState: response.deepState,
          message: incompleteExpansion && response.category === 'request_timeout'
            ? 'Some future pathways took longer than expected.'
            : repositoryFutureFailureMessage(response.category, response.diagnostics),
          retryable: response.retryable,
          category: response.category,
          diagnostics: response.diagnostics,
        };
        setState(current => ({ ...current, repositoryProductIntelligenceStatus: fallbackStatus }));
      } catch {
        if (scanTokenRef.current !== token || productRequestIdentityRef.current !== requestIdentity) return;
        setState(current => ({
          ...current,
          repositoryProductIntelligenceStatus: controller.signal.aborted
            ? { state: 'cancelled', deepState: 'failed', category: 'request_cancelled', retryable: true, message: 'Future analysis was cancelled.', diagnostics: { costEstimate: 'unavailable', operationalFailureCategory: 'cancelled', failureBoundary: 'browser-network' } }
            : { state: 'fallback', deepState: 'failed', category: 'provider_unavailable', retryable: true, message: 'Future analysis is temporarily unavailable.', diagnostics: { costEstimate: 'unavailable', operationalFailureCategory: 'provider_unavailable', failureBoundary: 'browser-network' } },
        }));
      } finally {
        if (productAbortRef.current === controller) productAbortRef.current = null;
      }
    };
    const launch = () => import('@/lib/repositoryIntelligence/deepIntelligenceClient')
      .then(({ RepositoryIntelligenceEnhancementSingleFlight }) => {
        productSingleFlightRef.current ||= new RepositoryIntelligenceEnhancementSingleFlight();
        return productSingleFlightRef.current.run(run);
      })
      .catch(() => {
        if (productRequestIdentityRef.current !== requestIdentity) return;
        setState(current => ({
          ...current,
          repositoryProductIntelligenceStatus: {
            state: 'fallback', deepState: 'failed', category: 'provider_unavailable', retryable: true,
            message: 'Future analysis is temporarily unavailable.',
            diagnostics: { costEstimate: 'unavailable', operationalFailureCategory: 'provider_unavailable', failureBoundary: 'browser-network' },
          },
        }));
      });
    const previous = options.retry ? productRequestPromiseRef.current : null;
    const requestPromise = (previous ? previous.catch(() => undefined).then(launch) : launch()).finally(() => {
      if (productRequestPromiseRef.current === requestPromise) productRequestPromiseRef.current = null;
    });
    productRequestPromiseRef.current = requestPromise;
    return requestPromise;
  }, []);

  useEffect(() => {
    if (state.status !== 'completed' || !state.report || !state.repositoryIntelligenceReview) return;
    if (state.repositoryProductIntelligenceStatus.state !== 'deterministic') return;
    void prepareRepositoryProductIntelligence().catch(() => undefined);
  }, [prepareRepositoryProductIntelligence, state.report, state.repositoryIntelligenceReview, state.repositoryProductIntelligenceStatus.state, state.status]);

  const retryRepositoryProductIntelligence = useCallback(
    () => prepareRepositoryProductIntelligence({ retry: true }),
    [prepareRepositoryProductIntelligence],
  );

  const cancelRepositoryProductIntelligence = useCallback(() => {
    productAbortRef.current?.abort();
    setState(current => current.repositoryProductIntelligenceStatus.state === 'preparing'
      ? {
          ...current,
          repositoryProductIntelligenceStatus: {
            state: 'cancelled', deepState: 'failed', category: 'request_cancelled', retryable: true,
            message: 'Future analysis was cancelled. You can retry when you are ready.',
          },
        }
      : current);
  }, []);

  return {
    ...state,
    startScan,
    startGitHubScan,
    startGitHubAppScan,
    cancelScan,
    resetScan,
    prepareRepositoryIntelligenceEnhancement,
    prepareRepositoryProductIntelligence,
    retryRepositoryProductIntelligence,
    cancelRepositoryProductIntelligence,
  };
}

function repositoryReportIdentity(report: ReadinessReport) {
  return `${report.repoName}:${report.scannedAt}`;
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
      repositoryIntelligenceProviderStatus: { state: 'deterministic', deepState: 'disabled', message: 'Deterministic repository intelligence is ready for review.', retryable: false },
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
