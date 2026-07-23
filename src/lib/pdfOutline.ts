import { PDFDocument, PDFName, PDFNumber, PDFString, PDFArray, PDFNull } from 'pdf-lib';
import type { TOCItem } from './pdfOperations';

// ─── Re-export all mapping functions from the shared module ─

export {
  type InsertDest,
  updateOutlineAfterMapping,
  updateTOCAfterDelete,
  computeDeletePageMapping,
  identityMapping,
  computeReorderMapping,
  computeReverseOrder,
  computeInsertMapping,
  computeMoveMapping,
  computeReplaceMapping,
  computeDuplicateInlineMapping,
} from './pdfMapping';

// ─── pdf-lib low-level outline writer ───────────────────────

/**
 * Write a hierarchical outline (bookmark tree) into an existing PDFDocument.
 * Uses pdf-lib's low-level API (PDFDict, PDFName, etc.) via doc.context.
 *
 * @param doc - The PDFDocument to write the outline into (must have pages).
 * @param items - Hierarchical outline items from pdfjs-dist getOutline().
 */
export function writeOutline(doc: PDFDocument, items: TOCItem[]): void {
  if (items.length === 0) return;

  const context = (doc as any).context;
  if (!context) return;

  // Root Outlines dictionary
  const outlinesDict = context.obj({ Type: PDFName.of('Outlines') });
  const outlinesRef = context.register(outlinesDict);

  // Write root-level items as children of the Outlines dict
  const { first, last, count } = writeSiblings(doc, items, outlinesRef);

  if (first) {
    outlinesDict.set(PDFName.of('First'), first);
    outlinesDict.set(PDFName.of('Last'), last!);
    outlinesDict.set(PDFName.of('Count'), PDFNumber.of(count));
  }

  // Hook into document catalog
  const catalog = (doc as any).catalog;
  if (catalog) {
    catalog.set(PDFName.of('Outlines'), outlinesRef);
  }
}

/**
 * Write a list of sibling outline items, each as a child of `parentRef`.
 * Returns the first ref, last ref, and total descendant count.
 */
function writeSiblings(
  doc: PDFDocument,
  items: TOCItem[],
  parentRef: ReturnType<typeof doc.context.register>,
): {
  first: ReturnType<typeof doc.context.register> | null;
  last: ReturnType<typeof doc.context.register> | null;
  count: number;
} {
  const context = (doc as any).context;
  let firstRef: ReturnType<typeof doc.context.register> | null = null;
  let lastRef: ReturnType<typeof doc.context.register> | null = null;
  let totalDescendants = 0;

  let prevRef: ReturnType<typeof doc.context.register> | null = null;
  // Store previous dict to set its Next after current item is registered
  let prevDict: any = null;

  for (const item of items) {
    // Get page reference for destination
    const pageRef = item.pageNumber !== null
      ? getPageRef(doc, item.pageNumber - 1)
      : null;

    // Build the outline item dict
    const dict = context.obj({
      Title: PDFString.of(item.title),
      Parent: parentRef,
    });

    // Set destination as inline array (not indirect object) so pdfjs-dist can resolve it
    if (pageRef) {
      const destArray = PDFArray.withContext(context);
      destArray.push(pageRef);
      destArray.push(PDFName.of('XYZ'));
      destArray.push(PDFNull);
      destArray.push(PDFNull);
      destArray.push(PDFNull);
      dict.set(PDFName.of('Dest'), destArray);
    }

    // Set Prev pointer
    if (prevRef) {
      dict.set(PDFName.of('Prev'), prevRef);
    }

    const ref = context.register(dict);

    // Set Next on the previous sibling (safe: pdf-lib dicts are mutable after register)
    if (prevDict) {
      prevDict.set(PDFName.of('Next'), ref);
    }

    if (!firstRef) firstRef = ref;
    lastRef = ref;
    totalDescendants++;

    // Recursively write children
    if (item.children.length > 0) {
      const childResult = writeSiblings(doc, item.children, ref);
      if (childResult.first) {
        dict.set(PDFName.of('First'), childResult.first);
        dict.set(PDFName.of('Last'), childResult.last!);
        dict.set(PDFName.of('Count'), PDFNumber.of(childResult.count));
      }
      totalDescendants += childResult.count;
    }

    prevRef = ref;
    prevDict = dict;
  }

  return { first: firstRef, last: lastRef, count: totalDescendants };
}

/** Get a page's PDFRef from the document. */
function getPageRef(
  doc: PDFDocument,
  pageIndex: number,
): ReturnType<typeof doc.context.register> | null {
  try {
    const page = doc.getPage(pageIndex);
    return (page as any).ref as ReturnType<typeof doc.context.register>;
  } catch {
    return null;
  }
}

// ─── Convenience: apply mapping + write outline ─────────────

/**
 * Re-open the just-saved PDF, write the updated outline, and return new bytes.
 * Used as the final step in every operation that preserves the TOC.
 */
export async function writeUpdatedOutline(
  pdfBytes: Uint8Array,
  updatedTOC: TOCItem[],
): Promise<Uint8Array> {
  if (updatedTOC.length === 0) return pdfBytes;
  const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  writeOutline(doc, updatedTOC);
  return doc.save();
}
