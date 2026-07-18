import { readdir, readFile, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const assetsDirectory = fileURLToPath(new URL('../dist/assets/', import.meta.url));
const entries = await readdir(assetsDirectory);
const javascriptAssets = [];
const forbiddenProviderMarkers = [
  'SHIPSEAL_DEEP_INTELLIGENCE_API_KEY',
  'test-provider-key-do-not-log',
  'OpenAiCompatibleRepositoryDeepIntelligenceProvider',
];
const forbiddenPersistenceMarkers = [
  'SHIPSEAL_ACCOUNT_GITHUB_CLIENT_SECRET',
  'DATABASE_URL is not configured.',
  'PostgresAccountPersistenceStore',
  'shipseal_sessions',
];

for (const name of entries.filter(entry => entry.endsWith('.js')).sort()) {
  const path = join(assetsDirectory, name);
  const [details, content] = await Promise.all([stat(path), readFile(path)]);
  const text = content.toString('utf8');
  const leakedMarker = forbiddenProviderMarkers.find(marker => text.includes(marker));
  if (leakedMarker) throw new Error(`Server-only provider marker entered browser asset ${name}.`);
  const leakedPersistenceMarker = forbiddenPersistenceMarkers.find(marker => text.includes(marker));
  if (leakedPersistenceMarker) throw new Error(`Server-only account or persistence marker entered browser asset ${name}.`);
  javascriptAssets.push({ name, bytes: details.size, gzipBytes: gzipSync(content).byteLength });
}

javascriptAssets.sort((left, right) => right.bytes - left.bytes || left.name.localeCompare(right.name));
const totalBytes = javascriptAssets.reduce((total, asset) => total + asset.bytes, 0);
const totalGzipBytes = javascriptAssets.reduce((total, asset) => total + asset.gzipBytes, 0);

console.log(`JavaScript assets: ${javascriptAssets.length}`);
console.log(`Total JavaScript: ${format(totalBytes)} raw / ${format(totalGzipBytes)} gzip`);
console.log(`Assets over 500 KiB: ${javascriptAssets.filter(asset => asset.bytes > 500 * 1024).length}`);
console.log('Server-only provider markers in browser assets: 0');
console.log('Server-only account/persistence markers in browser assets: 0');
console.table(javascriptAssets.map(asset => ({
  asset: asset.name,
  raw: format(asset.bytes),
  gzip: format(asset.gzipBytes),
})));

function format(bytes) {
  return `${(bytes / 1024).toFixed(2)} KiB`;
}
