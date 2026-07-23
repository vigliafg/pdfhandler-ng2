import * as pdfjsLib from 'pdfjs-dist';
// Import worker locally for offline/desktop support (Tauri)
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export type PDFDocument = pdfjsLib.PDFDocumentProxy;

/**
 * Load a PDF document from an ArrayBuffer.
 */
export async function loadPDFDocument(data: ArrayBuffer): Promise<PDFDocument> {
  const loadingTask = pdfjsLib.getDocument({ data });
  return loadingTask.promise;
}

// ─── TOC / Outline ──────────────────────────────────────────

export interface TOCItem {
  title: string;
  pageNumber: number | null;
  children: TOCItem[];
}

/**
 * Extract the document outline (table of contents) from a PDF.
 * Returns a hierarchical list of bookmarks with resolved page numbers.
 */
export async function getOutline(pdf: PDFDocument): Promise<TOCItem[]> {
  try {
    const outline = await pdf.getOutline();
    if (!outline || outline.length === 0) return [];

    const pageMap = new Map<string, number>();
    // Build a map of named destinations -> page index
    try {
      const dests = await pdf.getDestinations();
      if (dests) {
        for (const [name, dest] of Object.entries(dests)) {
          if (Array.isArray(dest) && dest.length > 0) {
            const ref = dest[0];
            if (typeof ref === 'object' && 'num' in ref) {
              const pageIdx = await pdf.getPageIndex(ref as any);
              pageMap.set(name, pageIdx + 1);
            }
          }
        }
      }
    } catch { /* named destinations not always present */ }

    const pageIndexCache = new Map<number, number>();

    async function resolveItems(items: any[]): Promise<TOCItem[]> {
      const result: TOCItem[] = [];
      for (const item of items) {
        let pageNumber: number | null = null;
        if (item.dest) {
          pageNumber = await resolveDestination(item.dest, pdf, pageMap, pageIndexCache);
        }
        result.push({
          title: item.title || '',
          pageNumber,
          children: item.items ? await resolveItems(item.items) : [],
        });
      }
      return result;
    }

    return resolveItems(outline);
  } catch {
    return [];
  }
}

async function resolveDestination(
  dest: any,
  pdf: PDFDocument,
  namedMap: Map<string, number>,
  indexCache: Map<number, number>,
): Promise<number | null> {
  // String destination = named destination
  if (typeof dest === 'string') {
    return namedMap.get(dest) ?? null;
  }

  // Explicit destination array [ref, ...]
  if (Array.isArray(dest) && dest.length > 0) {
    const ref = dest[0];
    if (typeof ref === 'object' && 'num' in ref && 'gen' in ref) {
      const key = ref.num;
      if (!indexCache.has(key)) {
        try {
          const idx = await pdf.getPageIndex(ref as any);
          indexCache.set(key, idx + 1);
        } catch {
          return null;
        }
      }
      return indexCache.get(key) ?? null;
    }
  }

  return null;
}

// ─── Page viewport ──────────────────────────────────────────

export interface PageDimensions {
  width: number;
  height: number;
}

/** Cached page dimensions (in points at scale 1). */
const pageDimsCache = new Map<string, PageDimensions>();

function getCacheKey(pdf: PDFDocument, pageNumber: number): string {
  const fp = (pdf as any)._pdfInfo?.fingerprint ?? '0';
  return `${fp}:${pageNumber}`;
}

/**
 * Get the original dimensions of a PDF page (in points at scale 1).
 * Results are cached per document.
 */
export async function getPageDimensions(
  pdf: PDFDocument,
  pageNumber: number,
): Promise<PageDimensions> {
  const key = getCacheKey(pdf, pageNumber);
  const cached = pageDimsCache.get(key);
  if (cached) return cached;

  const page = await pdf.getPage(pageNumber);
  const vp = page.getViewport({ scale: 1 });
  const dims: PageDimensions = { width: vp.width, height: vp.height };
  pageDimsCache.set(key, dims);
  return dims;
}

/**
 * Get the first page dimensions (or A4 default).
 * Used as a fallback for estimating page sizes.
 */
export async function getFirstPageDimensions(pdf: PDFDocument): Promise<PageDimensions> {
  return getPageDimensions(pdf, 1);
}

/** Clear cached page dimensions (e.g. when loading a new PDF). */
export function clearPageDimensionsCache(): void {
  pageDimsCache.clear();
}

// ─── Page rendering ─────────────────────────────────────────

/**
 * Render a single PDF page to a canvas element.
 * Returns the canvas dimensions for layout purposes.
 */
export async function renderPageToCanvas(
  pdf: PDFDocument,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale: number = 0.3,
  signal?: AbortSignal,
): Promise<{ width: number; height: number }> {
  if (signal?.aborted) {
    return { width: 0, height: 0 };
  }

  const page = await pdf.getPage(pageNumber);

  if (signal?.aborted) {
    return { width: 0, height: 0 };
  }

  const viewport = page.getViewport({ scale });

  // Set canvas size to match viewport at device pixel ratio for crisp rendering
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(viewport.width * dpr);
  canvas.height = Math.floor(viewport.height * dpr);
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas 2D context');
  }

  ctx.scale(dpr, dpr);

  // Render with cancellation support
  const renderTask = page.render({
    canvasContext: ctx,
    viewport,
    canvas,
  });

  if (signal) {
    const onAbort = () => {
      renderTask.cancel();
    };
    signal.addEventListener('abort', onAbort, { once: true });
    await renderTask.promise;
    signal.removeEventListener('abort', onAbort);
  } else {
    await renderTask.promise;
  }

  return { width: viewport.width, height: viewport.height };
}


