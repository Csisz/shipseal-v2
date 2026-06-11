import { describe, expect, it } from 'vitest';
import { buildClientReportPdfFilename } from '@/lib/report';

describe('client report PDF export', () => {
  it('builds a stable ShipSeal PDF filename', () => {
    expect(buildClientReportPdfFilename('Customer Support RAG Assistant')).toBe('shipseal-client-report-customer-support-rag-assistant.pdf');
    expect(buildClientReportPdfFilename('')).toBe('shipseal-client-report-project.pdf');
  });
});
