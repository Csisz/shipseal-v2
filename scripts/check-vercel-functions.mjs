import { readdir } from 'node:fs/promises';
import path from 'node:path';

const API_DIRECTORY = path.resolve('api');
const HOBBY_FUNCTION_LIMIT = 12;
const ENTRYPOINT_EXTENSION = /\.(?:[cm]?[jt]s)$/;

async function findEntrypoints(directory, relativeDirectory = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = [];
  for (const entry of entries) {
    if (entry.name.startsWith('_') || entry.name.startsWith('.')) continue;
    const relativePath = path.posix.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) {
      paths.push(...await findEntrypoints(path.join(directory, entry.name), relativePath));
    } else if (entry.isFile() && ENTRYPOINT_EXTENSION.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      paths.push(relativePath);
    }
  }
  return paths;
}

const entrypoints = (await findEntrypoints(API_DIRECTORY)).sort();
console.log(`Vercel Function entrypoints: ${entrypoints.length}/${HOBBY_FUNCTION_LIMIT}`);
for (const entrypoint of entrypoints) console.log(`- api/${entrypoint}`);
if (entrypoints.length > HOBBY_FUNCTION_LIMIT) {
  console.error(`Hobby Function limit exceeded by ${entrypoints.length - HOBBY_FUNCTION_LIMIT}.`);
  process.exitCode = 1;
}
