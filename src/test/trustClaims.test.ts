import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  SHIPSEAL_DEEP_ANALYSIS_DISCLOSURE,
  SHIPSEAL_LEGAL_DISCLAIMER,
  SHIPSEAL_STATIC_ANALYSIS_CLAIM,
  SHIPSEAL_UNSUPPORTED_PUBLIC_CLAIMS,
} from '@/lib/trust/publicTrust';
import { generateAiActReadinessFiles } from '@/lib/deliveryPack';
import { generateClientHandoffFiles } from '@/lib/deliveryPack/clientHandoff';
import { normalizeProjectIntake } from '@/lib/intake';

const publicSources = [
  'src/pages/Privacy.tsx',
  'src/pages/Security.tsx',
  'src/pages/Terms.tsx',
  'src/pages/Trust.tsx',
  'src/pages/GithubPermissions.tsx',
  'src/components/agentready/Landing.tsx',
  'src/components/agentready/UploadDropzone.tsx',
  'src/components/agentready/result-dashboard/PostScanViewSelector.tsx',
].map(path => readFileSync(path, 'utf8')).join('\n').toLowerCase();

describe('ShipSeal factual trust claim contract', () => {
  it('keeps the supported static-analysis and AI-processing claims centralized', () => {
    expect(SHIPSEAL_STATIC_ANALYSIS_CLAIM).toMatch(/statically.*not executed/i);
    expect(SHIPSEAL_DEEP_ANALYSIS_DISCLOSURE).toMatch(/selected, bounded repository evidence/i);
    expect(SHIPSEAL_LEGAL_DISCLAIMER).toMatch(/not legal advice/i);
    expect(readFileSync('TRUST_CLAIMS.md', 'utf8')).toContain(SHIPSEAL_STATIC_ANALYSIS_CLAIM);
  });

  it('does not publish unsupported absolute privacy or certification claims', () => {
    expect(publicSources).not.toContain('we never send repository data to ai');
    expect(publicSources).not.toContain('shipseal stores no repository data');
    expect(publicSources).not.toContain('end-to-end encrypted');
    expect(publicSources).not.toContain('zero knowledge system');
    expect(publicSources).not.toContain('soc 2 compliant');
    expect(publicSources).not.toContain('iso certified');
    expect(SHIPSEAL_UNSUPPORTED_PUBLIC_CLAIMS).toContain('encrypted end-to-end');
  });

  it('keeps report and AI Act exports explicit about legal and security limits', () => {
    const intake = normalizeProjectIntake({ projectName: 'Trust fixture' });
    const handoff = generateClientHandoffFiles(intake).clientHandoffReport;
    expect(handoff).toContain('This is not legal advice');
    expect(handoff).toContain('not a production security audit');
    for (const output of Object.values(generateAiActReadinessFiles(intake))) {
      expect(output).toContain('This is not legal advice');
    }
  });

  it('records implementation evidence and human-review ownership for every major claim', () => {
    const registry = readFileSync('TRUST_CLAIMS.md', 'utf8');
    expect(registry).toContain('Implementation evidence');
    expect(registry).toContain('Human/legal review?');
    expect(registry).toContain('Owner / follow-up');
    expect(registry).toContain('Stripe processes card details');
    expect(registry).toContain('Deep Analysis sends selected bounded evidence');
  });
});
