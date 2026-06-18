import { describe, expect, it } from 'vitest';
import { buildClientReportPdfFilename } from '@/lib/report';
import { planPdfSlices, shouldAddPdfContinuationPage } from '@/lib/report/pdfExport';

describe('client report PDF export', () => {
  it('builds a stable ShipSeal PDF filename', () => {
    expect(buildClientReportPdfFilename('Customer Support RAG Assistant')).toBe('shipseal-client-report-customer-support-rag-assistant.pdf');
    expect(buildClientReportPdfFilename('')).toBe('shipseal-client-report-project.pdf');
  });

  it('does not add a mostly empty continuation page', () => {
    expect(shouldAddPdfContinuationPage(8)).toBe(false);
    expect(shouldAddPdfContinuationPage(24)).toBe(false);
    expect(shouldAddPdfContinuationPage(36)).toBe(false);
    expect(shouldAddPdfContinuationPage(40)).toBe(true);
    expect(shouldAddPdfContinuationPage(80)).toBe(true);
  });

  it('prefers page cuts before avoid-break report sections', () => {
    const slices = planPdfSlices(2200, 1000, [
      { top: 920, bottom: 1160 },
      { top: 1840, bottom: 2020 },
    ]);

    expect(slices[0]).toEqual({ top: 0, height: 920 });
    expect(slices[1].top).toBe(920);
    expect(slices[1].height).toBe(920);
  });

  it('does not create a sparse final page just to avoid a late split', () => {
    const slices = planPdfSlices(2250, 1000, [
      { top: 1950, bottom: 2140 },
    ]);

    expect(slices[1]).toEqual({ top: 1000, height: 1000 });
    expect(slices[2].height).toBe(250);
  });
});
