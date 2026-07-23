// ─── Types ──────────────────────────────────────────────────

export interface InsertDest {
  location: 'before' | 'after';
  page: number;
}

/** Minimal TOC item interface — compatible with both pdfRenderer and pdfOperations TOCItem. */
export interface MinimalTOCItem {
  title: string;
  pageNumber: number | null;
  children: MinimalTOCItem[];
}

// ─── Generic outline update ─────────────────────────────────

/**
 * Update TOC items using a generic page mapping.
 *
 * @param items - Hierarchical outline items.
 * @param mapping - Map of oldPage → newPage (null = page deleted).
 *   Pages not in the map are treated as unchanged.
 *
 * Rules:
 * - Bookmarks pointing to deleted pages (null) with no children are removed.
 * - Bookmarks pointing to deleted pages with children have pageNumber set to null.
 * - Bookmarks pointing to surviving pages are renumbered.
 */
export function updateOutlineAfterMapping<T extends MinimalTOCItem>(
  items: T[],
  mapping: Map<number, number | null>,
): T[] {
  function walk(itemList: T[]): T[] {
    const result: T[] = [];
    for (const item of itemList) {
      const children = walk(item.children as T[]);
      const newPage = item.pageNumber !== null
        ? (mapping.get(item.pageNumber) ?? item.pageNumber)
        : null;

      // Remove orphaned bookmarks (deleted page + no children)
      if (newPage === null && children.length === 0) continue;

      result.push({
        ...item,
        pageNumber: newPage,
        children,
      } as unknown as T);
    }
    return result;
  }
  return walk(items);
}

/** @deprecated Use updateOutlineAfterMapping instead. */
export const updateTOCAfterDelete = updateOutlineAfterMapping;

// ─── Mapping function: Delete ───────────────────────────────

/**
 * Compute the new page mapping after deleting pages.
 * Returns a Map of oldPage → newPage (null if deleted).
 */
export function computeDeletePageMapping(
  totalPages: number,
  deletedPages: number[],
): Map<number, number | null> {
  const deletedSet = new Set(deletedPages);
  const mapping = new Map<number, number | null>();
  let newPage = 1;
  for (let oldPage = 1; oldPage <= totalPages; oldPage++) {
    if (deletedSet.has(oldPage)) {
      mapping.set(oldPage, null);
    } else {
      mapping.set(oldPage, newPage++);
    }
  }
  return mapping;
}

// ─── Mapping function: Identity (Rotate, no page change) ───

/** Identity mapping: every page keeps its position. */
export function identityMapping(totalPages: number): Map<number, number | null> {
  const mapping = new Map<number, number | null>();
  for (let i = 1; i <= totalPages; i++) mapping.set(i, i);
  return mapping;
}

// ─── Mapping function: Reorder / Reverse / Swap ─────────────

/**
 * Compute mapping from a reorder operation.
 * `newOrder` is an array of 1-based page numbers in the desired new order.
 */
export function computeReorderMapping(
  newOrder: number[],
): Map<number, number | null> {
  const mapping = new Map<number, number | null>();
  for (let i = 0; i < newOrder.length; i++) {
    mapping.set(newOrder[i], i + 1);
  }
  return mapping;
}

/**
 * Compute the page order after reversing a subset of pages.
 * Returns the complete 1-based new order array.
 */
export function computeReverseOrder(
  totalPages: number,
  pageNumbers?: number[],
): number[] {
  if (!pageNumbers || pageNumbers.length === 0 || pageNumbers.length === totalPages) {
    // Full reverse
    const order: number[] = [];
    for (let i = totalPages; i >= 1; i--) order.push(i);
    return order;
  }

  // Subset reverse: only reverse the specified pages in-place
  const targetSet = new Set(pageNumbers);
  const sortedTargets = [...pageNumbers].sort((a, b) => a - b);
  const reversed = [...sortedTargets].reverse();

  const order: number[] = [];
  let revIdx = 0;
  for (let i = 1; i <= totalPages; i++) {
    if (targetSet.has(i)) {
      order.push(reversed[revIdx++]);
    } else {
      order.push(i);
    }
  }
  return order;
}

// ─── Mapping function: Insert / Copy ────────────────────────

/**
 * Compute mapping after inserting `insertedCount` pages at `dest`.
 * Original pages after the insertion point shift right by `insertedCount`.
 */
export function computeInsertMapping(
  totalPages: number,
  insertedCount: number,
  dest: InsertDest,
): Map<number, number | null> {
  const mapping = new Map<number, number | null>();
  for (let i = 1; i <= totalPages; i++) {
    const isAfter = dest.location === 'before' ? i >= dest.page : i > dest.page;
    mapping.set(i, isAfter ? i + insertedCount : i);
  }
  return mapping;
}

// ─── Mapping function: Move ─────────────────────────────────

/**
 * Compute mapping after moving pages to a new destination.
 * Moved pages take new positions at the destination; pages between
 * the old and new positions shift accordingly.
 */
export function computeMoveMapping(
  totalPages: number,
  movedPages: number[],
  dest: InsertDest,
): Map<number, number | null> {
  const sortedMoved = [...movedPages].sort((a, b) => a - b);
  const movedSet = new Set(movedPages);

  // Build the list of non-moved pages in their original order
  const remaining: number[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (!movedSet.has(i)) remaining.push(i);
  }

  // Compute the adjusted destination page (its 1-based position after removal)
  const movedBeforeDest = sortedMoved.filter((p) => {
    if (dest.location === 'before') return p < dest.page;
    return p <= dest.page;
  }).length;
  const adjustedDestPage = dest.page - movedBeforeDest;

  // Insert position in the remaining array (0-based index)
  const insertPos = dest.location === 'before'
    ? Math.max(0, adjustedDestPage - 1)
    : Math.min(adjustedDestPage, remaining.length);

  // Build final order
  const newOrder = [
    ...remaining.slice(0, insertPos),
    ...sortedMoved,
    ...remaining.slice(insertPos),
  ];

  return computeReorderMapping(newOrder);
}

// ─── Mapping function: Replace ──────────────────────────────

/**
 * Compute mapping after replacing pages with a different number of pages.
 *
 * Replaced pages are consolidated at the position of the first replaced page.
 * Non-replaced pages after the first replaced page shift by:
 *   (replacementCount - numberOfReplacedPagesBeforeThem)
 */
export function computeReplaceMapping(
  totalPages: number,
  replacedPages: number[],
  replacementCount: number,
): Map<number, number | null> {
  const replacedSet = new Set(replacedPages);
  const sortedReplaced = [...replacedPages].sort((a, b) => a - b);
  const firstReplaced = sortedReplaced[0];
  const mapping = new Map<number, number | null>();

  for (let oldPage = 1; oldPage <= totalPages; oldPage++) {
    if (replacedSet.has(oldPage)) {
      mapping.set(oldPage, null);
    } else if (oldPage < firstReplaced) {
      // Pages before the first replaced page stay unchanged
      mapping.set(oldPage, oldPage);
    } else {
      // Pages after the first replacement block shift by:
      // (replacement pages inserted) - (replaced pages removed before this page)
      const replacedBefore = sortedReplaced.filter((p) => p < oldPage).length;
      const newPage = oldPage - replacedBefore + replacementCount;
      mapping.set(oldPage, newPage);
    }
  }

  return mapping;
}

// ─── Mapping function: Duplicate (inline, no dest) ──────────

/**
 * Compute mapping after duplicating pages inline (each duplicate inserted
 * right after its original, no explicit destination).
 */
export function computeDuplicateInlineMapping(
  totalPages: number,
  duplicatedPages: number[],
  copies: number,
): Map<number, number | null> {
  const dupSet = new Set(duplicatedPages);
  const mapping = new Map<number, number | null>();
  let newPage = 1;
  for (let oldPage = 1; oldPage <= totalPages; oldPage++) {
    mapping.set(oldPage, newPage);
    newPage++; // the original page
    if (dupSet.has(oldPage)) {
      newPage += copies; // skip past the N copies
    }
  }
  return mapping;
}
