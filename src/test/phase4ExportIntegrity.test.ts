import { describe, expect, it } from 'vitest';
import { futuresQaProductIntelligence } from '@/dev/RepositoryFuturesLayoutQa';
import {
  classifyRepositoryProductContentIntegrity,
  REPOSITORY_PRODUCT_CONTENT_INTEGRITY_VERSION,
} from '@/lib/repositoryIntelligence/productIntelligenceSchema';
import { buildExportCoverageFacts, buildSharedExportFacts } from '@/lib/report/exportFacts';
import { presentEvidenceReferences } from '@/lib/workspace/evidencePresentation';

describe('Phase 4 export truth and Future content integrity', () => {
  it.each([
    [{ scanMode: 'full', limited: false, totalFilesFound: 46, filesAnalyzed: 41, filesIgnored: 5 }, 'Full scan'],
    [{ scanMode: 'bounded', limited: false, totalFilesFound: 357, filesAnalyzed: 160, filesIgnored: 197, boundedReasons: ['selected-file-budget'] }, 'Bounded analysis'],
    [{ scanMode: 'limited-fallback', limited: true, totalFilesFound: 4, filesAnalyzed: 4, filesIgnored: 0 }, 'Limited fallback'],
  ] as const)('formats $scanMode coverage without binary limited/full inference', (summary, expected) => {
    const facts = buildExportCoverageFacts(summary);
    expect(facts.label).toBe(expected);
    expect(facts.discovered).toBe(summary.totalFilesFound);
    expect(facts.analyzed).toBe(summary.filesAnalyzed);
    expect(facts.excluded).toBe(summary.filesIgnored);
  });

  it('derives repository and delivery scores without collapsing their semantics', () => {
    const facts = buildSharedExportFacts({
      fallbackRepositoryName: 'Csisz/cantu',
      scoreJson: {
        repositoryName: 'Csisz/cantu', score: 100, status: 'ready', outputCount: 42,
        scanSummary: { scanMode: 'bounded', limited: false, totalFilesFound: 357, filesAnalyzed: 160, filesIgnored: 197 },
        repositoryHealth: {
          overall: { score: 84, status: 'AI-ready with targeted improvements', confidence: 'High' },
          topActions: [{ title: 'Document the integration boundary', whyItMatters: 'Agents need a stable change surface.' }],
        },
      },
    });
    expect(facts.repositoryHealth).toMatchObject({ score: 84, status: 'AI-ready with targeted improvements' });
    expect(facts.deliveryReadiness).toEqual({ score: 100, status: 'ready' });
    expect(facts.repositoryHealth.topActions[0]).toContain('Document the integration boundary');
  });

  it('classifies known legacy boundary clipping without fabricating missing text', () => {
    const legacy = structuredClone(futuresQaProductIntelligence);
    delete legacy.contentIntegrity;
    legacy.opportunities[0].title = 'x'.repeat(40);
    legacy.opportunities[0].opportunityStatement = 'y'.repeat(80);
    expect(classifyRepositoryProductContentIntegrity(legacy)).toBe('legacy-truncated');

    const compatible = structuredClone(futuresQaProductIntelligence);
    delete compatible.contentIntegrity;
    rewriteLegacyBoundaries(compatible);
    expect(classifyRepositoryProductContentIntegrity(compatible)).toBe('legacy-compatible');

    const current = {
      ...legacy,
      contentIntegrity: { version: REPOSITORY_PRODUCT_CONTENT_INTEGRITY_VERSION, state: 'complete' as const },
    };
    expect(classifyRepositoryProductContentIntegrity(current)).toBe('current-complete');

    const priorExplicitContract = {
      ...legacy,
      contentIntegrity: { version: 'shipseal.repository-product-content-integrity.v3' as const, state: 'complete' as const },
    };
    expect(classifyRepositoryProductContentIntegrity(priorExplicitContract)).toBe('legacy-compatible');
  });

  it('preserves provenance internally while presenting paths and neutral labels', () => {
    const evidence = [
      { id: 'evidence:readme:123', path: 'README.md' },
      { id: 'evidence:opaque:456' },
    ];
    expect(presentEvidenceReferences(evidence.map(item => item.id), evidence)).toEqual([
      { label: 'Repository path: README.md', path: 'README.md' },
      { label: 'Repository evidence 2' },
    ]);
    expect(JSON.stringify(presentEvidenceReferences(evidence.map(item => item.id), evidence))).not.toContain('evidence:');
  });
});

function rewriteLegacyBoundaries(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === 'string' && [32, 40, 48, 56, 64, 72, 80, 88].includes(entry.trim().length)) {
      (value as Record<string, unknown>)[key] = `${entry}.`;
    } else if (entry && typeof entry === 'object') {
      rewriteLegacyBoundaries(entry);
    }
  }
}
