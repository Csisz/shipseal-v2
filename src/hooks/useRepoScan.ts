import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { GITHUB_APP_SCAN_STEPS, GITHUB_PUBLIC_SCAN_STEPS, localScanEngine, ScanCancelledError, SCAN_ENGINE_STEPS } from '@/lib/scanEngine';
import { GitHubImportError, importGitHubAppRepoArchive, importPublicGitHubRepo } from '@/lib/github/githubImport';
import type { GitHubImportErrorCategory } from '@/lib/github/types';
import type { ReadinessReport, RepoScanInput, ScanSourceMetadata, ScanSummary } from '@/lib/types';
import type {
  BuildRepositoryIntelligenceArtifactReviewResult,
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

const MIN_SCAN_VISIBLE_MS = 900;

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

async function waitForMinimumVisibleDuration(startedAt: number) {
  const remaining = MIN_SCAN_VISIBLE_MS - (Date.now() - startedAt);
  if (remaining > 0) {
    await new Promise(resolve => window.setTimeout(resolve, remaining));
  }
}

export function useRepoScan(repositoryIntelligenceVerificationBaseline?: RepositoryIntelligenceVerificationBaseline | null) {
  const [state, setState] = useState<RepoScanState>(initialState);
  const abortRef = useRef<AbortController | null>(null);
  const scanTokenRef = useRef(0);

  const resetScan = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    scanTokenRef.current += 1;
    setState(initialState);
  }, []);

  const cancelScan = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
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

  const startScan = useCallback(async (file: File) => {
    const startedAt = Date.now();
    const token = scanTokenRef.current + 1;
    scanTokenRef.current = token;
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
            void setRepositoryIntelligenceReview(setState, scanInput, () => scanTokenRef.current === token);
            verificationPromise = prepareRepositoryIntelligenceVerification(scanInput, repositoryIntelligenceVerificationBaseline);
          },
        }
      );

      if (scanTokenRef.current !== token || controller.signal.aborted) return null;
      await waitForMinimumVisibleDuration(startedAt);
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
    const startedAt = Date.now();
    const token = scanTokenRef.current + 1;
    scanTokenRef.current = token;
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

      const localToGitHubStepIndex = [2, 3, 4, 4, 4, 5, 5];
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
            void setRepositoryIntelligenceReview(setState, scanInput, () => scanTokenRef.current === token);
            verificationPromise = prepareRepositoryIntelligenceVerification(scanInput, repositoryIntelligenceVerificationBaseline);
          },
        }
      );

      if (scanTokenRef.current !== token || controller.signal.aborted) return null;
      await waitForMinimumVisibleDuration(startedAt);
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
    const startedAt = Date.now();
    const token = scanTokenRef.current + 1;
    scanTokenRef.current = token;
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
            const adjustedIndex = [2, 3, 4, 4, 4, 5, 5][index] ?? GITHUB_APP_SCAN_STEPS.length - 1;
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
            void setRepositoryIntelligenceReview(setState, scanInput, () => scanTokenRef.current === token);
            verificationPromise = prepareRepositoryIntelligenceVerification(scanInput, repositoryIntelligenceVerificationBaseline);
          },
        }
      );

      if (scanTokenRef.current !== token || controller.signal.aborted) return null;
      await waitForMinimumVisibleDuration(startedAt);
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

  return {
    ...state,
    startScan,
    startGitHubScan,
    startGitHubAppScan,
    cancelScan,
    resetScan,
  };
}

async function prepareRepositoryIntelligenceVerification(
  scanInput: RepoScanInput,
  baseline?: RepositoryIntelligenceVerificationBaseline | null,
): Promise<PreparedRepositoryIntelligenceVerification> {
  if (!baseline) return { result: null, error: null };
  try {
    const { verifyRepositoryIntelligenceArtifacts } = await import('@/lib/repositoryIntelligence');
    return { result: verifyRepositoryIntelligenceArtifacts({ baseline, currentScan: scanInput }), error: null };
  } catch {
    return { result: null, error: 'Repository Intelligence verification could not be completed safely. The previous valid result was preserved.' };
  }
}

async function setRepositoryIntelligenceReview(
  setState: Dispatch<SetStateAction<RepoScanState>>,
  scanInput: RepoScanInput,
  isCurrent: () => boolean,
) {
  setState(current => ({ ...current, repositoryIntelligenceReviewPreparing: true, repositoryIntelligenceReviewError: null }));
  try {
    const { buildRepositoryIntelligenceArtifactReview } = await import('@/lib/repositoryIntelligence');
    if (!isCurrent()) return;
    const result = buildRepositoryIntelligenceArtifactReview({ scanInput });
    if (!isCurrent()) return;
    setState(current => ({
      ...current,
      repositoryIntelligenceReview: { artifactSet: result.artifactSet, review: result.review },
      repositoryIntelligenceReviewPreparing: false,
      repositoryIntelligenceReviewError: null,
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
