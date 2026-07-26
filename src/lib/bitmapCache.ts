import { renderPageToCanvas } from './pdfRenderer';
import type { PDFDocument } from './pdfRenderer';

interface CachedPage {
  bitmap: ImageBitmap;
  cssWidth: number;
  cssHeight: number;
}

interface PDFDocumentWithInfo {
  _pdfInfo?: { fingerprint?: string };
}

function getFingerprint(pdf: PDFDocument): string {
  return (pdf as PDFDocumentWithInfo)._pdfInfo?.fingerprint ?? '0';
}

function getCacheKey(pdf: PDFDocument, pageNumber: number, scale: number): string {
  const fp = getFingerprint(pdf);
  const scalePct = Math.round(scale * 100);
  const dpr = Math.round(window.devicePixelRatio * 10);
  return `${fp}:${pageNumber}:${scalePct}:dpr${dpr}`;
}

class BitmapCache {
  private cache = new Map<string, CachedPage>();
  private order: string[] = [];
  private maxSize = 50;

  get(key: string): CachedPage | undefined {
    const entry = this.cache.get(key);
    if (entry) {
      const idx = this.order.indexOf(key);
      if (idx > -1) {
        this.order.splice(idx, 1);
        this.order.push(key);
      }
    }
    return entry;
  }

  set(key: string, entry: CachedPage): void {
    if (this.cache.has(key)) {
      this.cache.get(key)!.bitmap.close();
    }
    this.cache.set(key, entry);
    const idx = this.order.indexOf(key);
    if (idx > -1) this.order.splice(idx, 1);
    this.order.push(key);

    while (this.order.length > this.maxSize) {
      const oldKey = this.order.shift()!;
      const old = this.cache.get(oldKey);
      if (old) {
        old.bitmap.close();
        this.cache.delete(oldKey);
      }
    }
  }

  clear(): void {
    for (const entry of this.cache.values()) {
      entry.bitmap.close();
    }
    this.cache.clear();
    this.order = [];
  }
}

export const bitmapCache = new BitmapCache();

export function clearBitmapCache(): void {
  bitmapCache.clear();
}

export async function renderPageWithCache(
  pdf: PDFDocument,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale: number,
  signal?: AbortSignal,
): Promise<{ width: number; height: number }> {
  const key = getCacheKey(pdf, pageNumber, scale);
  const cached = bitmapCache.get(key);

  if (cached) {
    canvas.width = cached.bitmap.width;
    canvas.height = cached.bitmap.height;
    canvas.style.width = `${cached.cssWidth}px`;
    canvas.style.height = `${cached.cssHeight}px`;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(cached.bitmap, 0, 0);
    return { width: cached.cssWidth, height: cached.cssHeight };
  }

  const result = await renderPageToCanvas(pdf, pageNumber, canvas, scale, signal);

  try {
    const cssWidth = parseFloat(canvas.style.width) || result.width;
    const cssHeight = parseFloat(canvas.style.height) || result.height;
    const bitmap = await createImageBitmap(canvas);
    bitmapCache.set(key, { bitmap, cssWidth, cssHeight });
  } catch {
    // ImageBitmap creation may fail (e.g., canvas too large or tainted)
  }

  return result;
}
