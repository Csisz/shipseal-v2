import { describe, expect, it } from 'vitest';
import { buildClientReportPdfFilename } from '@/lib/report';
import { shouldAddPdfContinuationPage } from '@/lib/report/pdfExport';

describe('client report PDF export', () => {
  it('builds a stable ShipSeal PDF filename', () => {
    expect(buildClientReportPdfFilename('Customer Support RAG Assistant')).toBe('shipseal-client-report-customer-support-rag-assistant.pdf');
    expect(buildClientReportPdfFilename('')).toBe('shipseal-client-report-project.pdf');
  });

  it('does not add a mostly empty continuation page', () => {
    expect(shouldAddPdfContinuationPage(8)).toBe(false);
    expect(shouldAddPdfContinuationPage(24)).toBe(false);
    expect(shouldAddPdfContinuationPage(80)).toBe(true);
  });
});
