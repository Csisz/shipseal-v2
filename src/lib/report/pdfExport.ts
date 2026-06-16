import { generateClientReportHtml } from './clientReportHtml';
import type { ClientReportHtmlInput } from './types';

function fileSafe(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'project';
}

export function buildClientReportPdfFilename(projectName: string) {
  return `shipseal-client-report-${fileSafe(projectName)}.pdf`;
}

export function shouldAddPdfContinuationPage(remainingHeightMm: number) {
  return remainingHeightMm > 24;
}

export async function downloadClientReportPdf(input: ClientReportHtmlInput, projectName: string) {
  const [{ jsPDF }, html2canvasModule] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ]);
  const html2canvas = html2canvasModule.default;
  const html = generateClientReportHtml(input);
  const container = document.createElement('div');

  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.width = '794px';
  container.style.background = '#ffffff';
  container.innerHTML = html;

  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      backgroundColor: '#ffffff',
      scale: 1.5,
      useCORS: true,
    });
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const imageData = canvas.toDataURL('image/png');

    let remainingHeight = imgHeight;
    let position = 0;

    pdf.addImage(imageData, 'PNG', 0, position, imgWidth, imgHeight);
    remainingHeight -= pageHeight;

    while (shouldAddPdfContinuationPage(remainingHeight)) {
      position -= pageHeight;
      pdf.addPage();
      pdf.addImage(imageData, 'PNG', 0, position, imgWidth, imgHeight);
      remainingHeight -= pageHeight;
    }

    pdf.save(buildClientReportPdfFilename(projectName));
  } finally {
    container.remove();
  }
}
