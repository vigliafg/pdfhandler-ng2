import { PDFDocument } from 'pdf-lib';

/**
 * Extract selected pages from a source PDF and create a new PDF document.
 * Page numbers are 1-based (as displayed to the user).
 */
export async function extractPages(
  sourcePdfBytes: ArrayBuffer,
  pageNumbers: number[],
): Promise<Uint8Array> {
  if (pageNumbers.length === 0) {
    throw new Error('No pages selected');
  }

  const sourceDoc = await PDFDocument.load(sourcePdfBytes, {
    ignoreEncryption: true,
  });

  const totalPages = sourceDoc.getPageCount();

  // Convert 1-based page numbers to 0-based indices and sort
  const sortedIndices = [...pageNumbers]
    .sort((a, b) => a - b)
    .map((p) => p - 1);

  // Validate indices
  for (const idx of sortedIndices) {
    if (idx < 0 || idx >= totalPages) {
      throw new Error(`Page ${idx + 1} is out of range (1-${totalPages})`);
    }
  }

  const newDoc = await PDFDocument.create();

  const copiedPages = await newDoc.copyPages(sourceDoc, sortedIndices);

  for (const page of copiedPages) {
    newDoc.addPage(page);
  }

  const pdfBytes = await newDoc.save();
  return pdfBytes;
}

/**
 * Trigger a browser download of the given PDF bytes.
 */
export function downloadPDF(pdfBytes: Uint8Array, filename: string = 'extracted-pages.pdf'): void {
  const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up the object URL after a short delay
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
