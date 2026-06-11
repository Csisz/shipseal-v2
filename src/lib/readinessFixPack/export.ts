import JSZip from 'jszip';
import type { ReadinessReport } from '../types';
import { buildSuggestedReadinessFixPack } from './generators';
import type { ReadinessFixPackFile } from './types';

export function buildReadinessFixPackZipFilename(repoName: string) {
  return `shipseal-readiness-fix-pack-${slug(repoName || 'repository')}.zip`;
}

export async function buildReadinessFixPackZipBlob(report: ReadinessReport) {
  return buildReadinessFixPackZipBlobFromFiles(buildSuggestedReadinessFixPack(report));
}

export async function buildReadinessFixPackZipBlobFromFiles(files: ReadinessFixPackFile[]) {
  const zip = new JSZip();
  for (const file of files) {
    zip.file(file.path, file.content);
  }
  const bytes = await zip.generateAsync({ type: 'uint8array' });
  return new Blob([bytes], { type: 'application/zip' });
}

function slug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'repository';
}
