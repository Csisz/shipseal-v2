import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '..', '..');

function read(path: string) {
  return readFileSync(resolve(root, path), 'utf8');
}

describe('ShipSeal dogfooding governance files', () => {
  it('includes agent, contribution, ownership, security, and CI files', () => {
    for (const path of [
      'AGENTS.md',
      'CLAUDE.md',
      'CONTRIBUTING.md',
      'SECURITY.md',
      'CODEOWNERS',
      'docs/OWNERSHIP.md',
      'docs/CRITICAL_FILES_POLICY.md',
      'docs/RELEASE_CHECKLIST.md',
      '.github/workflows/ci.yml',
    ]) {
      expect(existsSync(resolve(root, path)), path).toBe(true);
    }
  });

  it('documents required validation commands and key ShipSeal safety boundaries', () => {
    const agents = read('AGENTS.md');
    const contributing = read('CONTRIBUTING.md');
    const criticalPolicy = read('docs/CRITICAL_FILES_POLICY.md');
    const ci = read('.github/workflows/ci.yml');

    expect(agents).toContain('npm run test');
    expect(agents).toContain('npm run build');
    expect(agents).toContain('Delivery Pack export');
    expect(agents).toContain('/api/github-archive');
    expect(agents).toContain('This is not legal advice');
    expect(contributing).toContain('Download the PDF client report');
    expect(criticalPolicy).toContain('PDF report download');
    expect(ci).toContain('npm run test');
    expect(ci).toContain('npm run build');
  });
});
