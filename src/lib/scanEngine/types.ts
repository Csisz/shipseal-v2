import type { ReadinessReport, RepoScanInput } from '../types';
import type { SCANNER_LIMITS } from '../scannerLimits';
import type { ScanSourceMetadata, ScanSummary } from '../types';

export type ScannerLimits = typeof SCANNER_LIMITS;
export type ScanMode = 'local' | 'github-public';

export interface ScanInput {
  file: File;
  mode: ScanMode;
  source?: ScanSourceMetadata;
  limits?: Partial<ScannerLimits>;
  signal?: AbortSignal;
}

export interface ScanProgressCallbacks {
  onStepStart?: (step: string, index: number) => void;
  onStepComplete?: (step: string, index: number) => void;
  onProgress?: (progress: number) => void;
  onScanSummary?: (summary: ScanSummary) => void;
  /** Internal session boundary for consumers that need scanner-loaded, bounded text without rereading the repository. */
  onScanInput?: (input: RepoScanInput) => void;
  onWarning?: (warning: string) => void;
  onError?: (error: Error) => void;
}

export interface ScanEngine {
  scan(input: ScanInput, callbacks?: ScanProgressCallbacks): Promise<ReadinessReport>;
}

export const SCAN_ENGINE_STEPS = [
  'Reading repository',
  'Building repository intelligence',
  'Preparing workspace',
] as const;

export const GITHUB_PUBLIC_SCAN_STEPS = [
  'Connecting to GitHub',
  'Downloading repository archive',
  ...SCAN_ENGINE_STEPS,
] as const;

export const GITHUB_APP_SCAN_STEPS = GITHUB_PUBLIC_SCAN_STEPS;
