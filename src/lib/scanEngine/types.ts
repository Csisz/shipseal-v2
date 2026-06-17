import type { ReadinessReport } from '../types';
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
  onWarning?: (warning: string) => void;
  onError?: (error: Error) => void;
}

export interface ScanEngine {
  scan(input: ScanInput, callbacks?: ScanProgressCallbacks): Promise<ReadinessReport>;
}

export const SCAN_ENGINE_STEPS = [
  'Reading repository structure',
  'Detecting stack and package files',
  'Checking build/test/lint signals',
  'Checking agent instruction files',
  'Checking security and secret risks',
  'Building Repo Context Pack',
  'Generating Agent Pack',
] as const;

export const GITHUB_PUBLIC_SCAN_STEPS = [
  'Connecting to GitHub',
  'Downloading repository archive',
  'Reading repository structure',
  'Detecting stack and project signals',
  'Checking tests, docs, CI and security signals',
  'Preparing Delivery Pack',
] as const;

export const GITHUB_APP_SCAN_STEPS = GITHUB_PUBLIC_SCAN_STEPS;
