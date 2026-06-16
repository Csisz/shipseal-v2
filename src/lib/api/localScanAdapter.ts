import { buildScoreJson } from '../exports';
import { getDeliveryPackRequiredPaths } from '../deliveryPack/manifest';
import { localScanEngine, ScanCancelledError } from '../scanEngine';
import type { ReadinessReport } from '../types';
import type { CreateScanResponse, ScanErrorResponse, ScanJobProgress, ScanJobResult, ScanJobStatus } from './contracts';

interface LocalJob {
  id: string;
  status: ScanJobStatus;
  progress: number;
  currentStep?: string;
  warnings: string[];
  report?: ReadinessReport;
  error?: ScanErrorResponse;
}

const jobs = new Map<string, LocalJob>();

function scanId() {
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createLocalScanJob(file: File): CreateScanResponse {
  const id = scanId();
  const job: LocalJob = {
    id,
    status: 'running',
    progress: 0,
    warnings: [],
  };
  jobs.set(id, job);

  void localScanEngine.scan(
    { file, mode: 'local' },
    {
      onStepStart: step => {
        job.currentStep = step;
      },
      onProgress: progress => {
        job.progress = progress;
      },
      onWarning: warning => {
        job.warnings.push(warning);
      },
    }
  ).then(report => {
    job.status = 'completed';
    job.progress = 100;
    job.report = report;
  }).catch(error => {
    job.status = error instanceof ScanCancelledError ? 'cancelled' : 'failed';
    job.error = {
      scanId: id,
      status: 'failed',
      code: error instanceof ScanCancelledError ? 'CANCELLED' : 'SCAN_FAILED',
      message: error instanceof Error ? error.message : String(error),
    };
  });

  return { scanId: id, status: job.status };
}

export function getLocalScanJobStatus(id: string): ScanJobProgress | ScanErrorResponse {
  const job = jobs.get(id);
  if (!job) {
    return { scanId: id, status: 'failed', code: 'NOT_FOUND', message: 'Scan job was not found.' };
  }
  if (job.error) return job.error;
  return {
    scanId: id,
    status: job.status,
    currentStep: job.currentStep,
    progress: job.progress,
    warnings: [...job.warnings],
  };
}

export function getLocalScanJobResult(id: string): ScanJobResult | ScanErrorResponse {
  const job = jobs.get(id);
  if (!job) {
    return { scanId: id, status: 'failed', code: 'NOT_FOUND', message: 'Scan job was not found.' };
  }
  if (job.error) return job.error;
  if (!job.report || job.status !== 'completed') {
    return { scanId: id, status: 'failed', code: 'SCAN_FAILED', message: 'Scan job has not completed yet.' };
  }
  return {
    scanId: id,
    status: 'completed',
    report: job.report,
    scoreJson: buildScoreJson(job.report),
    generatedFiles: {
      deliveryPack: getDeliveryPackRequiredPaths(),
      coreAgentPack: job.report.agentPack.map(file => file.name),
      mcpGovernancePack: job.report.mcpReadiness.generatedFiles.map(file => file.filename),
      repoContextPack: ['REPO_CONTEXT_PACK.md', 'repo-context-pack.json'],
    },
  };
}

export function clearLocalScanJobs() {
  jobs.clear();
}
