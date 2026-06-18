import { generateClientReportHtml } from './clientReportHtml';
import type { ClientReportHtmlInput } from './types';

export interface PdfAvoidRange {
  top: number;
  bottom: number;
}

export interface PdfSlice {
  top: number;
  height: number;
}

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
  return remainingHeightMm > 36;
}

export function planPdfSlices(totalHeight: number, pageHeight: number, avoidRanges: PdfAvoidRange[] = []): PdfSlice[] {
  const slices: PdfSlice[] = [];
  let top = 0;

  while (top < totalHeight) {
    const remaining = totalHeight - top;
    if (remaining <= pageHeight) {
      slices.push({ top, height: remaining });
      break;
    }

    const preferredBottom = top + pageHeight;
    const adjustedBottom = findPdfSliceBottom(top, preferredBottom, pageHeight, totalHeight, avoidRanges);
    const height = Math.max(1, adjustedBottom - top);
    slices.push({ top, height });
    top += height;
  }

  return slices;
}

function findPdfSliceBottom(sliceTop: number, preferredBottom: number, pageHeight: number, totalHeight: number, avoidRanges: PdfAvoidRange[]) {
  const minUsefulBottom = sliceTop + pageHeight * 0.68;
  const splitRange = avoidRanges
    .filter(range => range.top < preferredBottom && range.bottom > preferredBottom)
    .sort((a, b) => b.top - a.top)
    .find(range => range.top >= minUsefulBottom);

  if (splitRange && totalHeight - splitRange.top < pageHeight * 0.35) {
    return preferredBottom;
  }

  return splitRange ? Math.floor(splitRange.top) : preferredBottom;
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
    const pageHeightPx = Math.floor(canvas.width * (pageHeight / pageWidth));
    const avoidRanges = collectPdfAvoidRanges(container, canvas);
    const slices = planPdfSlices(canvas.height, pageHeightPx, avoidRanges);

    slices.forEach((slice, index) => {
      if (index > 0) pdf.addPage();

      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = slice.height;
      const context = sliceCanvas.getContext('2d');
      context?.drawImage(
        canvas,
        0,
        slice.top,
        canvas.width,
        slice.height,
        0,
        0,
        canvas.width,
        slice.height
      );

      const imgHeight = (slice.height * pageWidth) / canvas.width;
      pdf.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', 0, 0, pageWidth, imgHeight);
    });

    pdf.save(buildClientReportPdfFilename(projectName));
  } finally {
    container.remove();
  }
}

function collectPdfAvoidRanges(container: HTMLElement, canvas: HTMLCanvasElement): PdfAvoidRange[] {
  const containerRect = container.getBoundingClientRect();
  const scale = canvas.width / containerRect.width;

  return Array.from(container.querySelectorAll<HTMLElement>('section, .card, .avoid-break'))
    .map(element => {
      const rect = element.getBoundingClientRect();
      return {
        top: Math.max(0, (rect.top - containerRect.top) * scale),
        bottom: Math.min(canvas.height, (rect.bottom - containerRect.top) * scale),
      };
    })
    .filter(range => range.bottom - range.top > 24)
    .sort((a, b) => a.top - b.top);
}
