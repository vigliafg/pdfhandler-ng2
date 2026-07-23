import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';

/**
 * Extract all text from a PDF document.
 * Returns the complete text as a string.
 */
export async function extractText(sourcePdfBytes: ArrayBuffer): Promise<string> {
  const loadingTask = pdfjsLib.getDocument({ data: sourcePdfBytes });
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;

  const texts: string[] = [];
  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => item.str ?? '')
      .join(' ');
    texts.push(`--- Page ${i} ---\n${pageText}`);
  }

  // pdfjs-dist v6: no explicit destroy needed
  return texts.join('\n\n');
}

/**
 * Download a text string as a .txt file.
 */
export function downloadText(text: string, filename: string): void {
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Export all PDF pages as PNG images, bundled in a ZIP.
 */
export async function exportImagesAsZip(
  sourcePdfBytes: ArrayBuffer,
  baseFilename: string,
  scale: number = 1.5,
  format: 'png' | 'jpeg' = 'png',
): Promise<Uint8Array> {
  const loadingTask = pdfjsLib.getDocument({ data: sourcePdfBytes.slice(0) });
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;
  const zip = new JSZip();

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });

    // Create offscreen canvas
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No canvas context');

    await page.render({ canvasContext: ctx, viewport, canvas }).promise;

    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b!), `image/${format}`, 0.9),
    );

    const pad = String(i).padStart(4, '0');
    zip.file(`${baseFilename}-page-${pad}.${format}`, new Uint8Array(await blob.arrayBuffer()));
  }

  // pdfjs-dist v6: no explicit destroy needed
  return zip.generateAsync({ type: 'uint8array' });
}
