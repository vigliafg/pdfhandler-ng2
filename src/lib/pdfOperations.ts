import { PDFDocument, degrees, toDegrees } from 'pdf-lib';
import JSZip from 'jszip';
import type { InsertDest } from './pdfMapping';

type InsertDestination = InsertDest;

// ─── Helpers ────────────────────────────────────────────────

/** Load a PDF from ArrayBuffer, with encryption tolerance. */
async function loadPDF(data: ArrayBuffer): Promise<PDFDocument> {
  return PDFDocument.load(data, { ignoreEncryption: true });
}

/** Convert 1-based page numbers to sorted 0-based indices. */
function toIndices(pageNumbers: number[]): number[] {
  return [...pageNumbers].sort((a, b) => a - b).map((p) => p - 1);
}

/** Build a new PDF from the source, keeping only the pages at given 0-based indices. */
async function rebuildPDF(
  sourceDoc: PDFDocument,
  indices: number[],
): Promise<Uint8Array> {
  const newDoc = await PDFDocument.create();
  const pages = await newDoc.copyPages(sourceDoc, indices);
  for (const page of pages) newDoc.addPage(page);
  return newDoc.save();
}

// ─── Delete ─────────────────────────────────────────────────

/**
 * Remove selected pages from the PDF. Returns the new PDF bytes.
 * Page numbers are 1-based.
 *
 * When `tocItems` is provided, bookmarks are preserved:
 * - Bookmarks pointing to deleted pages are removed
 * - Bookmarks pointing to surviving pages are renumbered
 */
export async function deletePages(
  sourcePdfBytes: ArrayBuffer,
  pageNumbers: number[],
  tocItems?: TOCItem[],
): Promise<{ bytes: Uint8Array; tocItems?: TOCItem[] }> {
  const sourceDoc = await loadPDF(sourcePdfBytes);
  const total = sourceDoc.getPageCount();
  const toDelete = new Set(toIndices(pageNumbers));

  const keepIndices: number[] = [];
  for (let i = 0; i < total; i++) {
    if (!toDelete.has(i)) keepIndices.push(i);
  }

  if (keepIndices.length === 0) {
    throw new Error('Cannot delete all pages — at least one page must remain.');
  }

  const bytes = await rebuildPDF(sourceDoc, keepIndices);

  // Update outline if provided
  let updatedTOC: TOCItem[] | undefined;
  if (tocItems && tocItems.length > 0) {
    const { computeDeletePageMapping, updateOutlineAfterMapping } =
      await import('./pdfMapping');
    const { writeUpdatedOutline } =
      await import('./pdfOutline');
    const mapping = computeDeletePageMapping(total, pageNumbers);
    updatedTOC = updateOutlineAfterMapping(tocItems, mapping);

    // Write the updated outline into the new PDF
    if (updatedTOC.length > 0) {
      const newBytes = await writeUpdatedOutline(bytes, updatedTOC);
      return { bytes: newBytes, tocItems: updatedTOC };
    }
  }

  return { bytes, tocItems: updatedTOC };
}

// ─── Rotate ─────────────────────────────────────────────────

export type RotationAngle = 90 | 180 | 270;

/**
 * Rotate selected pages by the given angle (multiples of 90).
 * Modifies in-place and returns new PDF bytes.
 * When `tocItems` is provided, the outline is preserved (no page numbers change).
 */
export async function rotatePages(
  sourcePdfBytes: ArrayBuffer,
  pageNumbers: number[],
  angle: RotationAngle,
  tocItems?: TOCItem[],
): Promise<{ bytes: Uint8Array; tocItems?: TOCItem[] }> {
  const sourceDoc = await loadPDF(sourcePdfBytes);
  const total = sourceDoc.getPageCount();
  const targetSet = new Set(toIndices(pageNumbers));

  // Build new doc preserving all pages, rotating only the selected ones
  const newDoc = await PDFDocument.create();
  const allIndices: number[] = [];
  for (let i = 0; i < total; i++) allIndices.push(i);

  const pages = await newDoc.copyPages(sourceDoc, allIndices);
  for (let i = 0; i < pages.length; i++) {
    if (targetSet.has(i)) {
      const currentDeg = toDegrees(pages[i].getRotation());
      pages[i].setRotation(degrees((currentDeg + angle) % 360));
    }
    newDoc.addPage(pages[i]);
  }

  let bytes = await newDoc.save();

  // Preserve outline (identity mapping — no page numbers change)
  if (tocItems && tocItems.length > 0) {
    const { identityMapping, updateOutlineAfterMapping } =
      await import('./pdfMapping');
    const { writeUpdatedOutline } =
      await import('./pdfOutline');
    const mapping = identityMapping(total);
    const updatedTOC = updateOutlineAfterMapping(tocItems, mapping);
    bytes = await writeUpdatedOutline(bytes, updatedTOC);
    return { bytes, tocItems: updatedTOC };
  }

  return { bytes };
}

// ─── Duplicate ──────────────────────────────────────────────

/**
 * Duplicate selected pages, inserting copies at a specific destination.
 * @param pageNumbers - 1-based page numbers to duplicate.
 * @param copies - Number of copies of each selected page.
 * @param dest - Where to insert the copies (before/after × target page).
 * @param tocItems - Optional TOC to preserve.
 */
export async function duplicatePages(
  sourcePdfBytes: ArrayBuffer,
  pageNumbers: number[],
  copies: number = 1,
  dest?: { location: 'before' | 'after'; page: number },
  tocItems?: TOCItem[],
): Promise<{ bytes: Uint8Array; tocItems?: TOCItem[] }> {
  const sourceDoc = await loadPDF(sourcePdfBytes);
  const total = sourceDoc.getPageCount();
  const sorted = [...pageNumbers].sort((a, b) => a - b);
  const duplicateSet = new Set(sorted);

  if (copies < 1 || copies > 99) {
    throw new Error('Copies must be between 1 and 99');
  }

  const newDoc = await PDFDocument.create();

  if (!dest) {
    // Original behavior: insert each copy right after its original
    for (let i = 1; i <= total; i++) {
      const [page] = await newDoc.copyPages(sourceDoc, [i - 1]);
      newDoc.addPage(page);

      if (duplicateSet.has(i)) {
        for (let c = 0; c < copies; c++) {
          const [dupe] = await newDoc.copyPages(sourceDoc, [i - 1]);
          newDoc.addPage(dupe);
        }
      }
    }
  } else {
    // New behavior: copy all pages, then insert duplicates at destination
    // First, copy all original pages
    const allIndices: number[] = [];
    for (let i = 0; i < total; i++) allIndices.push(i);
    const origPages = await newDoc.copyPages(sourceDoc, allIndices);
    for (const page of origPages) newDoc.addPage(page);

    // Copy the selected pages for duplication
    const dupeIndices = toIndices(pageNumbers);
    const dupePages = await newDoc.copyPages(sourceDoc, dupeIndices);

    // Calculate insertion index (0-based) in the new document
    // dest.page is 1-based in the ORIGINAL document
    const insertIdx = dest.location === 'before' ? dest.page - 1 : dest.page;

    // Insert all copies at the destination (reverse order to maintain position)
    for (let c = 0; c < copies; c++) {
      for (let i = dupePages.length - 1; i >= 0; i--) {
        newDoc.insertPage(insertIdx + c * dupePages.length, dupePages[i]);
      }
    }
  }

  let bytes = await newDoc.save();

  // Preserve outline
  if (tocItems && tocItems.length > 0) {
    const { updateOutlineAfterMapping, computeInsertMapping, computeDuplicateInlineMapping } =
      await import('./pdfMapping');
    const { writeUpdatedOutline } =
      await import('./pdfOutline');
    const mapping = dest
      ? computeInsertMapping(total, pageNumbers.length * copies, dest)
      : computeDuplicateInlineMapping(total, pageNumbers, copies);
    const updatedTOC = updateOutlineAfterMapping(tocItems, mapping);
    bytes = await writeUpdatedOutline(bytes, updatedTOC);
    return { bytes, tocItems: updatedTOC };
  }

  return { bytes };
}

// ─── Replace ────────────────────────────────────────────────

/**
 * Replace pages in the target PDF with pages from a replacement PDF.
 *
 * @param targetPdfBytes - The PDF whose pages will be replaced.
 * @param replacementPdfBytes - The PDF providing replacement pages.
 * @param targetPageNumbers - 1-based pages in the target to replace.
 * @param replacementPageNumbers - 1-based pages from the replacement PDF to use.
 *   If fewer replacement pages than target pages, extra target pages are removed.
 *   If more, extra replacement pages are inserted after the last replaced position.
 *   When target pages are non-contiguous, all replacement pages
 *   are consolidated at the position of the first replaced page.
 * @param tocItems - Optional TOC to preserve.
 * @returns New PDF bytes with replaced pages.
 */
export async function replacePages(
  targetPdfBytes: ArrayBuffer,
  replacementPdfBytes: ArrayBuffer,
  targetPageNumbers: number[],
  replacementPageNumbers: number[],
  tocItems?: TOCItem[],
): Promise<{ bytes: Uint8Array; tocItems?: TOCItem[] }> {
  if (targetPageNumbers.length === 0) {
    throw new Error('No target pages selected for replacement');
  }
  if (replacementPageNumbers.length === 0) {
    throw new Error('No replacement pages selected from source PDF');
  }

  const targetDoc = await loadPDF(targetPdfBytes);
  const replDoc = await loadPDF(replacementPdfBytes);

  const targetTotal = targetDoc.getPageCount();
  const replTotal = replDoc.getPageCount();

  // Sort target page numbers and get 0-based indices
  const targetIndices = toIndices(targetPageNumbers);
  const targetSet = new Set(targetIndices);

  // Validate
  for (const idx of targetIndices) {
    if (idx < 0 || idx >= targetTotal) {
      throw new Error(`Target page ${idx + 1} is out of range (1-${targetTotal})`);
    }
  }

  const replIndices = toIndices(replacementPageNumbers);
  for (const idx of replIndices) {
    if (idx < 0 || idx >= replTotal) {
      throw new Error(`Replacement page ${idx + 1} is out of range (1-${replTotal})`);
    }
  }

  const newDoc = await PDFDocument.create();

  // Copy replacement pages
  const replPages = await newDoc.copyPages(replDoc, replIndices);

  // Build the new document: walk through target pages,
  // replacing the first encountered target page range with all replacement pages
  let replaced = false;

  for (let i = 0; i < targetTotal; i++) {
    if (targetSet.has(i)) {
      if (!replaced) {
        // Insert all replacement pages at the position of the first replaced page
        for (const rp of replPages) {
          newDoc.addPage(rp);
        }
        replaced = true;
      }
      // Skip the original page (it's being replaced)
    } else {
      // Keep non-replaced pages
      const [page] = await newDoc.copyPages(targetDoc, [i]);
      newDoc.addPage(page);
    }
  }

  let bytes = await newDoc.save();

  // Preserve outline
  if (tocItems && tocItems.length > 0) {
    const { computeReplaceMapping, updateOutlineAfterMapping } =
      await import('./pdfMapping');
    const { writeUpdatedOutline } =
      await import('./pdfOutline');
    const mapping = computeReplaceMapping(targetTotal, targetPageNumbers, replacementPageNumbers.length);
    const updatedTOC = updateOutlineAfterMapping(tocItems, mapping);
    bytes = await writeUpdatedOutline(bytes, updatedTOC);
    return { bytes, tocItems: updatedTOC };
  }

  return { bytes };
}

// ─── Reverse ────────────────────────────────────────────────

/**
 * Reverse the order of pages in the PDF.
 * If `pageNumbers` is provided, only those pages are reversed while others stay in place.
 * If `pageNumbers` is undefined/empty, all pages are reversed.
 * @param tocItems - Optional TOC to preserve.
 */
export async function reversePages(
  sourcePdfBytes: ArrayBuffer,
  pageNumbers?: number[],
  tocItems?: TOCItem[],
): Promise<{ bytes: Uint8Array; tocItems?: TOCItem[] }> {
  const sourceDoc = await loadPDF(sourcePdfBytes);
  const total = sourceDoc.getPageCount();

  let newOrder: number[];

  if (!pageNumbers || pageNumbers.length === 0 || pageNumbers.length === total) {
    // Reverse all pages
    const reversed: number[] = [];
    for (let i = total - 1; i >= 0; i--) reversed.push(i);
    newOrder = reversed.map((i) => i + 1);
  } else {
    // Reverse a subset of pages while keeping others in place
    const targetSet = new Set(toIndices(pageNumbers));
    const targetIndices = toIndices(pageNumbers);
    const reversedTargets = [...targetIndices].reverse();

    // Build a new index order: walk through all pages,
    // replacing target pages with reversed ones
    const newIndices: number[] = [];
    let revIdx = 0;
    for (let i = 0; i < total; i++) {
      if (targetSet.has(i)) {
        newIndices.push(reversedTargets[revIdx++]);
      } else {
        newIndices.push(i);
      }
    }
    newOrder = newIndices.map((i) => i + 1);
  }

  const bytes = await rebuildPDF(sourceDoc, newOrder.map((p) => p - 1));

  // Preserve outline
  if (tocItems && tocItems.length > 0) {
    const { computeReorderMapping, updateOutlineAfterMapping } =
      await import('./pdfMapping');
    const { writeUpdatedOutline } =
      await import('./pdfOutline');
    const mapping = computeReorderMapping(newOrder);
    const updatedTOC = updateOutlineAfterMapping(tocItems, mapping);
    const newBytes = await writeUpdatedOutline(bytes, updatedTOC);
    return { bytes: newBytes, tocItems: updatedTOC };
  }

  return { bytes };
}

// ─── Split ──────────────────────────────────────────────────

/**
 * Apply a page filter (1-based page numbers) to get effective 0-based indices.
 * When pageFilter is undefined or empty, all pages are included.
 */
function applyPageFilter(totalPages: number, pageFilter?: number[]): number[] {
  if (!pageFilter || pageFilter.length === 0) {
    return Array.from({ length: totalPages }, (_, i) => i);
  }
  return pageFilter
    .filter(p => p >= 1 && p <= totalPages)
    .map(p => p - 1);
}

/**
 * Split the PDF at specific page markers.
 * Each marker is the LAST page of a chunk (e.g. 10 means chunk ends at page 10).
 * The last chunk automatically goes to the end of the document.
 * Returns a ZIP file as Uint8Array.
 */
export async function splitByMarkers(
  sourcePdfBytes: ArrayBuffer,
  markers: number[],
  baseFilename: string,
  pageFilter?: number[],
): Promise<Uint8Array> {
  const sourceDoc = await loadPDF(sourcePdfBytes);
  const effectiveIndices = applyPageFilter(sourceDoc.getPageCount(), pageFilter);
  const effectiveTotal = effectiveIndices.length;
  const zip = new JSZip();

  // Sort markers and ensure they're within bounds of the effective page set
  const sorted = [...markers]
    .filter((m) => m >= 1 && m < effectiveTotal)
    .sort((a, b) => a - b);

  if (sorted.length === 0) {
    throw new Error('No valid markers provided (must be between 1 and ' + (effectiveTotal - 1) + ')');
  }

  let chunkIndex = 1;
  let prevEnd = 0; // 0-based, where previous chunk ended

  for (const marker of sorted) {
    const start = prevEnd;
    const end = marker; // marker is 1-based last page
    if (start >= end) continue;

    const indices: number[] = [];
    for (let i = start; i < end; i++) indices.push(effectiveIndices[i]);

    const chunkDoc = await PDFDocument.create();
    const pages = await chunkDoc.copyPages(sourceDoc, indices);
    for (const page of pages) chunkDoc.addPage(page);
    const chunkBytes = await chunkDoc.save();

    const pad = String(chunkIndex).padStart(3, '0');
    zip.file(
      `${baseFilename}-part${pad}-p${start + 1}-${end}.pdf`,
      chunkBytes,
    );
    chunkIndex++;
    prevEnd = end;
  }

  // Last chunk: from last marker to end
  if (prevEnd < effectiveTotal) {
    const indices: number[] = [];
    for (let i = prevEnd; i < effectiveTotal; i++) indices.push(effectiveIndices[i]);

    const chunkDoc = await PDFDocument.create();
    const pages = await chunkDoc.copyPages(sourceDoc, indices);
    for (const page of pages) chunkDoc.addPage(page);
    const chunkBytes = await chunkDoc.save();

    const pad = String(chunkIndex).padStart(3, '0');
    zip.file(
      `${baseFilename}-part${pad}-p${prevEnd + 1}-${effectiveTotal}.pdf`,
      chunkBytes,
    );
  }

  return zip.generateAsync({ type: 'uint8array' });
}

/**
 * Split the PDF into chunks of `pagesPerChunk` pages.
 * Returns a ZIP file as Uint8Array.
 */
export async function splitPages(
  sourcePdfBytes: ArrayBuffer,
  pagesPerChunk: number,
  baseFilename: string,
  pageFilter?: number[],
): Promise<Uint8Array> {
  const sourceDoc = await loadPDF(sourcePdfBytes);
  const effectiveIndices = applyPageFilter(sourceDoc.getPageCount(), pageFilter);
  const effectiveTotal = effectiveIndices.length;
  const zip = new JSZip();

  let chunkIndex = 1;
  for (let start = 0; start < effectiveTotal; start += pagesPerChunk) {
    const end = Math.min(start + pagesPerChunk, effectiveTotal);
    const indices: number[] = [];
    for (let i = start; i < end; i++) indices.push(effectiveIndices[i]);

    const chunkDoc = await PDFDocument.create();
    const pages = await chunkDoc.copyPages(sourceDoc, indices);
    for (const page of pages) chunkDoc.addPage(page);
    const chunkBytes = await chunkDoc.save();

    const pad = String(chunkIndex).padStart(3, '0');
    zip.file(
      `${baseFilename}-part${pad}-p${start + 1}-${end}.pdf`,
      chunkBytes,
    );
    chunkIndex++;
  }

  return zip.generateAsync({ type: 'uint8array' });
}

/**
 * Split the PDF using custom page ranges.
 * Each range is a minimal string like "1-10", "11-25", "26-50".
 */
export async function splitByRanges(
  sourcePdfBytes: ArrayBuffer,
  ranges: { start: number; end: number }[],
  baseFilename: string,
  pageFilter?: number[],
): Promise<Uint8Array> {
  const sourceDoc = await loadPDF(sourcePdfBytes);
  const effectiveIndices = applyPageFilter(sourceDoc.getPageCount(), pageFilter);
  const effectiveTotal = effectiveIndices.length;
  const zip = new JSZip();

  for (let ci = 0; ci < ranges.length; ci++) {
    const r = ranges[ci];
    const start = Math.max(1, r.start) - 1;
    const end = Math.min(effectiveTotal, r.end);
    if (start >= end) continue;

    const indices: number[] = [];
    for (let i = start; i < end; i++) indices.push(effectiveIndices[i]);

    const chunkDoc = await PDFDocument.create();
    const pages = await chunkDoc.copyPages(sourceDoc, indices);
    for (const page of pages) chunkDoc.addPage(page);
    const chunkBytes = await chunkDoc.save();

    const pad = String(ci + 1).padStart(3, '0');
    zip.file(
      `${baseFilename}-part${pad}-p${r.start}-${r.end}.pdf`,
      chunkBytes,
    );
  }

  return zip.generateAsync({ type: 'uint8array' });
}

// ─── Split by TOC ──────────────────────────────────────────

/** TOC item from pdfjs-dist outline (minimal interface for splitByTOC). */
export interface TOCItem {
  title: string;
  pageNumber: number | null;
  children: TOCItem[];
}

export type TOCDepth = 0 | 1 | 2 | 3 | 'all';

interface TOCRange {
  title: string;
  start: number;
  end: number;
}

/** Resolve a bookmark's page number, inheriting from first child if null. */
function resolveTOCPage(item: TOCItem): number | null {
  if (item.pageNumber !== null) return item.pageNumber;
  if (item.children.length > 0) return resolveTOCPage(item.children[0]);
  return null;
}

/**
 * Flatten the TOC tree to collect bookmarks at the specified depth.
 * - For numeric depth (1/2/3): collect items at exactly that depth.
 *   Items at shallower depths with no children at the target depth are included too.
 * - For 'all': collect all leaf nodes (items with no children).
 * Returns items sorted by page number, with deduplication for same-page items.
 */
function flattenTOC(
  items: TOCItem[],
  depth: TOCDepth,
  _currentDepth: number = 0,
  totalPages?: number,
): TOCRange[] {
  const collected: { title: string; page: number; depth: number }[] = [];

  function walk(nodes: TOCItem[], d: number): void {
    for (const node of nodes) {
      const hasChildren = node.children.length > 0;
      const isTarget =
        depth === 'all'
          ? !hasChildren
          : d === depth || (!hasChildren && d < depth);

      if (isTarget) {
        const p = resolveTOCPage(node);
        if (p !== null && (totalPages === undefined || p <= totalPages)) {
          collected.push({ title: node.title, page: p, depth: d });
        }
      } else if (hasChildren && (depth === 'all' || d < depth)) {
        walk(node.children, d + 1);
      }
    }
  }

  walk(items, 0);

  // Sort by page number, then by depth (deeper first for same-page dedup)
  collected.sort((a, b) => a.page - b.page || b.depth - a.depth);

  // Deduplicate: keep only first item per page number
  const seen = new Set<number>();
  const unique: typeof collected = [];
  for (const c of collected) {
    if (!seen.has(c.page)) {
      seen.add(c.page);
      unique.push(c);
    }
  }

  // Re-sort by page only (dedup may have changed order slightly)
  unique.sort((a, b) => a.page - b.page);

  return unique.map((c) => ({ title: c.title, start: c.page, end: 0 }));
}

/** Sanitize a filename: replace illegal chars, trim, max 80 chars. */
function sanitizeTOCFilename(name: string, maxLen: number = 80): string {
  let sanitized = name.replace(/[/\\:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim();
  // Remove leading/trailing dots and spaces
  sanitized = sanitized.replace(/^[.\s]+/, '').replace(/[.\s]+$/, '');
  if (sanitized.length > maxLen) {
    sanitized = sanitized.substring(0, maxLen).replace(/[.\s]+$/, '');
  }
  return sanitized || 'untitled';
}

/**
 * Split the PDF using the table of contents (outline) bookmarks.
 *
 * @param sourcePdfBytes - The PDF bytes to split.
 * @param tocItems - The hierarchical TOC from pdfjs-dist's getOutline().
 * @param depth - Which bookmark depth to split at: 1/2/3 or 'all' for leaf nodes.
 * @param baseFilename - Base name for output files (without extension).
 * @returns ZIP file as Uint8Array containing one PDF per TOC section.
 */
export async function splitByTOC(
  sourcePdfBytes: ArrayBuffer,
  tocItems: TOCItem[],
  depth: TOCDepth,
  _baseFilename: string,
  pageFilter?: number[],
  onProgress?: (current: number, total: number, label: string) => void,
): Promise<Uint8Array> {
  if (tocItems.length === 0) {
    throw new Error('No table of contents found in this PDF.');
  }

  const sourceDoc = await loadPDF(sourcePdfBytes);
  const effectiveIndices = applyPageFilter(sourceDoc.getPageCount(), pageFilter);
  const effectiveTotal = effectiveIndices.length;

  // Flatten TOC to get split points at the requested depth
  const rawRanges = flattenTOC(tocItems, depth, 0, effectiveTotal);

  if (rawRanges.length === 0) {
    throw new Error(
      `No bookmarks found at depth ${depth === 'all' ? 'all (leaves)' : depth}.`,
    );
  }

  // Build final ranges: each ends at next sibling's start - 1, last goes to end
  const ranges: TOCRange[] = [];
  for (let i = 0; i < rawRanges.length; i++) {
    const end = i < rawRanges.length - 1 ? rawRanges[i + 1].start - 1 : effectiveTotal;
    ranges.push({ title: rawRanges[i].title, start: rawRanges[i].start, end });
  }

  // Front matter: if first bookmark starts after page 1
  if (ranges[0].start > 1) {
    ranges.unshift({ title: 'Front Matter', start: 1, end: ranges[0].start - 1 });
  }

  const zip = new JSZip();

  for (let i = 0; i < ranges.length; i++) {
    const r = ranges[i];
    const startIdx = r.start - 1; // 0-based
    const endIdx = r.end; // 1-based end, exclusive as 0-based
    if (startIdx >= endIdx || startIdx >= effectiveTotal) continue;

    const indices: number[] = [];
    for (let j = startIdx; j < endIdx; j++) indices.push(effectiveIndices[j]);

    onProgress?.(i + 1, ranges.length, sanitizeTOCFilename(r.title, 40));

    const chunkDoc = await PDFDocument.create();
    const pages = await chunkDoc.copyPages(sourceDoc, indices);
    for (const page of pages) chunkDoc.addPage(page);
    const chunkBytes = await chunkDoc.save();

    const safeName = sanitizeTOCFilename(r.title);
    const pad = String(i + 1).padStart(3, '0');
    zip.file(`${pad} - ${safeName}.pdf`, chunkBytes);
  }

  return zip.generateAsync({ type: 'uint8array' });
}

/**
 * Download a ZIP file in the browser.
 */
export function downloadZip(zipBytes: Uint8Array, filename: string): void {
  const blob = new Blob([zipBytes as BlobPart], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ─── Merge ──────────────────────────────────────────────────

/**
 * Merge multiple PDFs into a single document.
 * Each entry has the ArrayBuffer and original filename.
 */
export async function mergePDFs(
  pdfs: { data: ArrayBuffer; name: string }[],
): Promise<Uint8Array> {
  const mergedDoc = await PDFDocument.create();

  for (const pdf of pdfs) {
    const sourceDoc = await loadPDF(pdf.data);
    const total = sourceDoc.getPageCount();
    const indices: number[] = [];
    for (let i = 0; i < total; i++) indices.push(i);

    const pages = await mergedDoc.copyPages(sourceDoc, indices);
    for (const page of pages) mergedDoc.addPage(page);
  }

  return mergedDoc.save();
}

// ─── Reorder ────────────────────────────────────────────────

/**
 * Rebuild the PDF with pages in the given order.
 * `newOrder` is an array of 1-based page numbers in the desired order.
 * Must include every page exactly once.
 * @param tocItems - Optional TOC to preserve.
 */
export async function reorderPages(
  sourcePdfBytes: ArrayBuffer,
  newOrder: number[],
  tocItems?: TOCItem[],
): Promise<{ bytes: Uint8Array; tocItems?: TOCItem[] }> {
  const sourceDoc = await loadPDF(sourcePdfBytes);
  const total = sourceDoc.getPageCount();

  if (newOrder.length !== total) {
    throw new Error(
      `New order must contain exactly ${total} pages, got ${newOrder.length}`,
    );
  }

  const seen = new Set<number>();
  for (const p of newOrder) {
    if (p < 1 || p > total) {
      throw new Error(`Page ${p} is out of range (1-${total})`);
    }
    if (seen.has(p)) {
      throw new Error(`Duplicate page ${p} in new order`);
    }
    seen.add(p);
  }

  const indices = newOrder.map((p) => p - 1);
  let bytes = await rebuildPDF(sourceDoc, indices);

  // Preserve outline
  if (tocItems && tocItems.length > 0) {
    const { computeReorderMapping, updateOutlineAfterMapping } =
      await import('./pdfMapping');
    const { writeUpdatedOutline } =
      await import('./pdfOutline');
    const mapping = computeReorderMapping(newOrder);
    const updatedTOC = updateOutlineAfterMapping(tocItems, mapping);
    bytes = await writeUpdatedOutline(bytes, updatedTOC);
    return { bytes, tocItems: updatedTOC };
  }

  return { bytes };
}

// ─── Swap ──────────────────────────────────────────────────

/**
 * Swap the positions of two pages in the PDF.
 * Both page numbers are 1-based.
 * @param tocItems - Optional TOC to preserve.
 */
export async function swapPages(
  sourcePdfBytes: ArrayBuffer,
  pageA: number,
  pageB: number,
  tocItems?: TOCItem[],
): Promise<{ bytes: Uint8Array; tocItems?: TOCItem[] }> {
  const sourceDoc = await loadPDF(sourcePdfBytes);
  const total = sourceDoc.getPageCount();

  if (pageA < 1 || pageA > total) {
    throw new Error(`Page ${pageA} is out of range (1-${total})`);
  }
  if (pageB < 1 || pageB > total) {
    throw new Error(`Page ${pageB} is out of range (1-${total})`);
  }
  if (pageA === pageB) {
    throw new Error('Cannot swap a page with itself');
  }

  // Build the new order by swapping the two pages
  const newOrder: number[] = [];
  for (let i = 1; i <= total; i++) {
    if (i === pageA) newOrder.push(pageB);
    else if (i === pageB) newOrder.push(pageA);
    else newOrder.push(i);
  }

  const indices = newOrder.map((p) => p - 1);
  let bytes = await rebuildPDF(sourceDoc, indices);

  // Preserve outline
  if (tocItems && tocItems.length > 0) {
    const { computeReorderMapping, updateOutlineAfterMapping } =
      await import('./pdfMapping');
    const { writeUpdatedOutline } =
      await import('./pdfOutline');
    const mapping = computeReorderMapping(newOrder);
    const updatedTOC = updateOutlineAfterMapping(tocItems, mapping);
    bytes = await writeUpdatedOutline(bytes, updatedTOC);
    return { bytes, tocItems: updatedTOC };
  }

  return { bytes };
}

// ─── Move ───────────────────────────────────────────────────

/**
 * Move pages from one position to another within the same PDF.
 * Pages are first copied to the destination, then the originals are removed.
 *
 * @param sourcePdfBytes - The PDF to modify.
 * @param pageNumbers - 1-based page numbers to move.
 * @param dest - Where to move the pages (before/after × target page).
 * @param tocItems - Optional TOC to preserve.
 * @returns New PDF bytes with pages moved.
 */
export async function movePages(
  sourcePdfBytes: ArrayBuffer,
  pageNumbers: number[],
  dest: InsertDestination,
  tocItems?: TOCItem[],
): Promise<{ bytes: Uint8Array; tocItems?: TOCItem[] }> {
  if (pageNumbers.length === 0) {
    throw new Error('No pages selected to move');
  }

  const sourceDoc = await loadPDF(sourcePdfBytes);
  const total = sourceDoc.getPageCount();

  // Validate page numbers
  const moveSet = new Set(pageNumbers);
  for (const p of pageNumbers) {
    if (p < 1 || p > total) {
      throw new Error(`Page ${p} is out of range (1-${total})`);
    }
  }

  if (dest.page < 1 || dest.page > total) {
    throw new Error(`Destination page ${dest.page} is out of range (1-${total})`);
  }

  // Collect the pages in order and their 0-based indices
  const sortedPages = [...pageNumbers].sort((a, b) => a - b);
  const moveIndices = sortedPages.map((p) => p - 1);

  // Build new doc: first insert all pages except those being moved
  const newDoc = await PDFDocument.create();

  // Determine the insertion point in the filtered document
  // We need to track where the destination page ends up after removing moved pages
  let adjustedDestPage = dest.page;
  // Count how many moved pages are before the destination
  const movedBeforeDest = sortedPages.filter((p) => {
    if (dest.location === 'before') return p < dest.page;
    return p <= dest.page;
  }).length;
  adjustedDestPage = dest.page - movedBeforeDest;

  // Calculate insertion index (0-based in new doc)
  const insertIdx = dest.location === 'before'
    ? Math.max(0, adjustedDestPage - 1)
    : Math.min(adjustedDestPage, total - moveIndices.length);

  // Batch-copy all non-moved pages into newDoc (much faster than one-at-a-time)
  const keepIndices: number[] = [];
  for (let i = 0; i < total; i++) {
    if (!moveSet.has(i + 1)) keepIndices.push(i);
  }
  const keepPages = await newDoc.copyPages(sourceDoc, keepIndices);
  for (const page of keepPages) newDoc.addPage(page);

  // Copy the moved pages
  const movedPages = await newDoc.copyPages(sourceDoc, moveIndices);

  // Insert moved pages at destination (reverse order to maintain sequence)
  for (let i = movedPages.length - 1; i >= 0; i--) {
    newDoc.insertPage(insertIdx, movedPages[i]);
  }

  let bytes = await newDoc.save();

  // Preserve outline
  if (tocItems && tocItems.length > 0) {
    const { computeMoveMapping, updateOutlineAfterMapping } =
      await import('./pdfMapping');
    const { writeUpdatedOutline } =
      await import('./pdfOutline');
    const mapping = computeMoveMapping(total, pageNumbers, dest);
    const updatedTOC = updateOutlineAfterMapping(tocItems, mapping);
    bytes = await writeUpdatedOutline(bytes, updatedTOC);
    return { bytes, tocItems: updatedTOC };
  }

  return { bytes };
}

// ─── Insert ─────────────────────────────────────────────────

export type { InsertDest as InsertDestination };
export type { InsertDest };

/**
 * Insert pages from a source PDF into the target PDF.
 *
 * @param targetPdfBytes - The PDF to insert pages into.
 * @param sourcePdfBytes - The PDF whose pages will be inserted.
 * @param sourcePageNumbers - 1-based page numbers from the source PDF to insert.
 * @param dest - Where to insert the pages (before/after × target page number).
 * @param tocItems - Optional TOC to preserve. Bookmark numbers are remapped for original pages.
 *   Bookmarks from the source PDF are NOT merged.
 * @returns New PDF bytes with the inserted pages.
 */
export async function insertPages(
  targetPdfBytes: ArrayBuffer,
  sourcePdfBytes: ArrayBuffer,
  sourcePageNumbers: number[],
  dest: InsertDestination,
  tocItems?: TOCItem[],
): Promise<{ bytes: Uint8Array; tocItems?: TOCItem[] }> {
  if (sourcePageNumbers.length === 0) {
    throw new Error('No pages selected from source PDF');
  }

  const targetDoc = await loadPDF(targetPdfBytes);
  const sourceDoc = await loadPDF(sourcePdfBytes);

  const targetTotal = targetDoc.getPageCount();
  const sourceTotal = sourceDoc.getPageCount();

  // Validate source page numbers
  const sourceIndices = toIndices(sourcePageNumbers);
  for (const idx of sourceIndices) {
    if (idx < 0 || idx >= sourceTotal) {
      throw new Error(`Source page ${idx + 1} is out of range (1-${sourceTotal})`);
    }
  }

  // Validate destination page
  if (dest.page < 1 || dest.page > targetTotal) {
    throw new Error(`Destination page ${dest.page} is out of range (1-${targetTotal})`);
  }

  // Copy source pages
  const pagesToInsert = await targetDoc.copyPages(sourceDoc, sourceIndices);

  // Calculate insertion index (0-based)
  // For 'before': insert at dest.page - 1
  // For 'after': insert at dest.page
  const insertIdx = dest.location === 'before' ? dest.page - 1 : dest.page;

  // Insert pages one by one at the correct position (in reverse order to maintain position)
  for (let i = pagesToInsert.length - 1; i >= 0; i--) {
    targetDoc.insertPage(insertIdx, pagesToInsert[i]);
  }

  let bytes = await targetDoc.save();

  // Preserve outline: original page numbers after insertion point shift right
  if (tocItems && tocItems.length > 0) {
    const { computeInsertMapping, updateOutlineAfterMapping } =
      await import('./pdfMapping');
    const { writeUpdatedOutline } =
      await import('./pdfOutline');
    const mapping = computeInsertMapping(targetTotal, sourcePageNumbers.length, dest);
    const updatedTOC = updateOutlineAfterMapping(tocItems, mapping);
    bytes = await writeUpdatedOutline(bytes, updatedTOC);
    return { bytes, tocItems: updatedTOC };
  }

  return { bytes };
}
