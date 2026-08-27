export interface UploadValidationFile {
  name: string;
  size: number;
}

export interface UploadValidationResult {
  valid: boolean;
  error?: string;
}

export function validateZipUpload(file: UploadValidationFile): UploadValidationResult {
  if (!file.name.toLowerCase().endsWith('.zip')) {
    return { valid: false, error: 'Only .zip files are accepted.' };
  }

  if (file.size > SCANNER_LIMITS.maxZipSizeBytes) {
    return { valid: false, error: 'ZIP file is too large. It exceeds ShipSeal’s 2 GB local archive safety ceiling.' };
  }

  return { valid: true };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
import { SCANNER_LIMITS } from './scannerLimits';
