import { buildReport } from '../readiness';
import { ArchiveParseError, LIMITED_SCAN_WARNING, fallbackScan, scanZipFile } from '../scanner';
import { ScannerValidationError } from '../scannerLimits';
import { validateZipUpload } from '../uploadValidation';
import type { ReadinessReport, RepoScanInput } from '../types';
import type { ScanEngine, ScanInput, ScanProgressCallbacks } from './types';
import { SCAN_ENGINE_STEPS } from './types';

export class ScanCancelledError extends Error {
  constructor() {
    super('Scan cancelled');
    this.name = 'ScanCancelledError';
  }
}

function throwIfCancelled(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new ScanCancelledError();
  }
}

async function yieldToUi() {
  await new Promise(resolve => window.setTimeout(resolve, 80));
}

export class LocalScanEngine implements ScanEngine {
  async scan(input: ScanInput, callbacks: ScanProgressCallbacks = {}): Promise<ReadinessReport> {
    if (input.mode !== 'local' && input.mode !== 'github-public') {
      throw new Error('Only local and public GitHub scan modes are available in this prototype.');
    }

    const validation = validateZipUpload(input.file);
    if (!validation.valid) {
      throw new ScannerValidationError(validation.error || 'This file cannot be scanned.');
    }

    let scanInput: RepoScanInput | null = null;
    let report: ReadinessReport | null = null;

    const runStep = async (index: number, work?: () => Promise<void> | void) => {
      throwIfCancelled(input.signal);
      const step = SCAN_ENGINE_STEPS[index];
      callbacks.onStepStart?.(step, index);
      callbacks.onProgress?.(Math.round((index / SCAN_ENGINE_STEPS.length) * 100));
      await yieldToUi();
      await work?.();
      throwIfCancelled(input.signal);
      callbacks.onStepComplete?.(step, index);
      callbacks.onProgress?.(Math.round(((index + 1) / SCAN_ENGINE_STEPS.length) * 100));
    };

    try {
      await runStep(0, async () => {
        try {
          scanInput = await scanZipFile(input.file, input.source);
          scanInput.source = input.source || {
            sourceType: input.mode === 'github-public' ? 'github-url' : 'zip-upload',
          };
          if (input.source?.githubOwner && input.source.githubRepo) {
            scanInput.repoName = `${input.source.githubOwner}/${input.source.githubRepo}`;
          }
        } catch (error) {
          if (error instanceof ScannerValidationError) {
            throw error;
          }
          callbacks.onWarning?.(error instanceof ArchiveParseError
            ? `${LIMITED_SCAN_WARNING} Archive classification: ${error.diagnostics.inputKind}.`
            : LIMITED_SCAN_WARNING);
          scanInput = fallbackScan(input.file, error instanceof ArchiveParseError ? error.diagnostics : undefined);
          scanInput.source = input.source || {
            sourceType: input.mode === 'github-public' ? 'github-url' : 'zip-upload',
          };
          if (input.source?.githubOwner && input.source.githubRepo) {
            scanInput.repoName = `${input.source.githubOwner}/${input.source.githubRepo}`;
          }
        }
      });

      await runStep(1);
      await runStep(2);
      await runStep(3);
      await runStep(4);
      await runStep(5);
      await runStep(6, () => {
        if (!scanInput) throw new Error('Scan input was not prepared.');
        report = buildReport(scanInput);
      });

      if (!report) throw new Error('Scan did not produce a report.');
      return report;
    } catch (error) {
      callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }
}

export const localScanEngine = new LocalScanEngine();
