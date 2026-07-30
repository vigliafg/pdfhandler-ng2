/**
 * TOC Reconstruction Tests
 * Covers all 22 test scenarios from TOC_RECONSTRUCTION_GUIDE.md (tests #121-#142)
 *
 * Tests the core mapping functions in pdfMapping.ts:
 * - computeDeletePageMapping
 * - computeReorderMapping
 * - computeReverseOrder
 * - computeInsertMapping
 * - computeMoveMapping
 * - computeReplaceMapping
 * - computeDuplicateInlineMapping
 * - updateOutlineAfterMapping
 */

import { describe, it, expect } from 'vitest';
import {
  computeDeletePageMapping,
  computeReorderMapping,
  computeReverseOrder,
  computeInsertMapping,
  computeMoveMapping,
  computeReplaceMapping,
  computeDuplicateInlineMapping,
  identityMapping,
  updateOutlineAfterMapping,
  type MinimalTOCItem,
} from '../pdfMapping';

// ─── Helper: build a mock TOC tree ──────────────────────────

interface TocBuilder {
  title: string;
  pageNumber: number | null;
  children?: TocBuilder[];
}

function buildTOC(items: TocBuilder[]): MinimalTOCItem[] {
  return items.map((i) => ({
    title: i.title,
    pageNumber: i.pageNumber,
    children: i.children ? buildTOC(i.children) : [],
  }));
}

// Simulates modern.pdf's TOC (simplified):
// Cover:1, Copyright:3, Contributors:4, TOC:8, Preface:16,
// Chapter 1:24 (with children), Chapter 2:50 (with children)
function modernTOC(): MinimalTOCItem[] {
  return buildTOC([
    { title: 'Cover', pageNumber: 1 },
    { title: 'Copyright', pageNumber: 3 },
    { title: 'Contributors', pageNumber: 4 },
    { title: 'Table of Contents', pageNumber: 8 },
    { title: 'Preface', pageNumber: 16 },
    {
      title: 'Chapter 1', pageNumber: 24,
      children: [
        { title: '1.1 Section', pageNumber: 25 },
        {
          title: '1.2 Deep Section', pageNumber: 28,
          children: [
            { title: '1.2.1 Sub', pageNumber: 29 },
            { title: '1.2.2 Sub', pageNumber: 32 },
          ],
        },
        { title: '1.3 Section', pageNumber: 35 },
      ],
    },
    {
      title: 'Chapter 2', pageNumber: 50,
      children: [
        { title: '2.1 Section', pageNumber: 51 },
        { title: '2.2 Section', pageNumber: 55 },
      ],
    },
    { title: 'Appendix', pageNumber: 200 },
  ]);
}

// ─── Helper: get page numbers for TOC items ─────────────────

function tocPageNumbers(items: MinimalTOCItem[]): (number | null)[] {
  const result: (number | null)[] = [];
  function walk(list: MinimalTOCItem[]) {
    for (const item of list) {
      result.push(item.pageNumber);
      if (item.children.length > 0) walk(item.children);
    }
  }
  walk(items);
  return result;
}

function tocTitles(items: MinimalTOCItem[]): string[] {
  const result: string[] = [];
  function walk(list: MinimalTOCItem[]) {
    for (const item of list) {
      result.push(item.title);
      if (item.children.length > 0) walk(item.children);
    }
  }
  walk(items);
  return result;
}

// =====================================================================
// 🗑️ DELETE TESTS (#121-#126)
// =====================================================================

describe('DELETE operations', () => {
  // #121 — Delete pages BEFORE TOC targets (offset −)
  it('#121: Delete pages before TOC targets → correct negative offset', () => {
    const toc = modernTOC();
    const totalPages = 300;
    const deletedPages = [1, 2];
    const mapping = computeDeletePageMapping(totalPages, deletedPages);
    const updated = updateOutlineAfterMapping(toc, mapping);

    // Pages 1-2 deleted, everything shifts down by 2
    // Cover (page 1) → deleted (removed, leaf)
    // Copyright (page 3) → page 1
    // Contributors (page 4) → page 2
    // TOC (page 8) → page 6
    // Preface (page 16) → page 14
    // Chapter 1 (page 24) → page 22
    // Chapter 2 (page 50) → page 48
    // Appendix (page 200) → page 198

    const expectedPages = [
      // Cover removed (leaf, page 1 deleted)
      1,    // Copyright → 1
      2,    // Contributors → 2
      6,    // TOC → 6
      14,   // Preface → 14
      22,   // Chapter 1 → 22
      23,   // 1.1 Section → 23
      26,   // 1.2 Deep Section → 26
      27,   // 1.2.1 Sub → 27
      30,   // 1.2.2 Sub → 30
      33,   // 1.3 Section → 33
      48,   // Chapter 2 → 48
      49,   // 2.1 Section → 49
      53,   // 2.2 Section → 53
      198,  // Appendix → 198
    ];
    expect(tocPageNumbers(updated)).toEqual(expectedPages);
    // Cover should be gone
    expect(tocTitles(updated)).not.toContain('Cover');
  });

  // #122 — Delete pages AFTER TOC targets (no offset for early bookmarks)
  it('#122: Delete pages after TOC targets → early bookmarks unchanged', () => {
    const toc = modernTOC();
    const totalPages = 300;
    const deletedPages = [10, 11, 12];
    const mapping = computeDeletePageMapping(totalPages, deletedPages);
    const updated = updateOutlineAfterMapping(toc, mapping);

    const pages = tocPageNumbers(updated);
    // Cover=1, Copyright=3, Contributors=4, TOC=8 → unchanged
    expect(pages[0]).toBe(1);   // Cover
    expect(pages[1]).toBe(3);   // Copyright
    expect(pages[2]).toBe(4);   // Contributors
    expect(pages[3]).toBe(8);   // TOC

    // Chapter 1 was 24 → after deleting 3 pages before it → 21
    expect(pages[5]).toBe(21);  // Chapter 1 → 21
  });

  // #123 — Delete bookmark LEAF page (bookmark removed)
  it('#123: Delete leaf bookmark page → bookmark removed', () => {
    const toc = modernTOC();
    const totalPages = 300;
    const deletedPages = [1]; // Delete Cover (leaf)
    const mapping = computeDeletePageMapping(totalPages, deletedPages);
    const updated = updateOutlineAfterMapping(toc, mapping);

    // Cover should be removed
    expect(tocTitles(updated)).not.toContain('Cover');
    // Other bookmarks renumbered
    expect(tocPageNumbers(updated)[0]).toBe(2); // Copyright was 3 → 2
  });

  // #124 — Delete bookmark WITH CHILDREN (pageNumber → null)
  it('#124: Delete parent bookmark page → pageNumber=null, children survive', () => {
    const toc = modernTOC();
    const totalPages = 300;
    const deletedPages = [24]; // Chapter 1 page
    const mapping = computeDeletePageMapping(totalPages, deletedPages);
    const updated = updateOutlineAfterMapping(toc, mapping);

    // Find Chapter 1
    const ch1 = updated.find(item => item.title === 'Chapter 1');
    expect(ch1).toBeDefined();
    expect(ch1!.pageNumber).toBeNull(); // pageNumber → null
    expect(ch1!.children.length).toBeGreaterThan(0); // children survive

    // Children should be renumbered
    expect(ch1!.children[0].pageNumber).toBe(24); // 1.1 was 25 → 24
  });

  // #125 — Delete ALL pages referenced by TOC
  it('#125: Delete all TOC pages → empty or only pageNumber=null items', () => {
    const toc = modernTOC();
    const totalPages = 300;
    // Delete pages 1-200 (covers all bookmarks)
    const deletedPages = Array.from({ length: 200 }, (_, i) => i + 1);
    const mapping = computeDeletePageMapping(totalPages, deletedPages);
    const updated = updateOutlineAfterMapping(toc, mapping);

    // All leaf bookmarks should be removed
    // Only items with children survive (with pageNumber=null)
    // After cascade, Chapter 1 and 2 lose all children and get removed too
    
    // Actually, since ALL their children point to deleted pages and are leaves,
    // after children are removed, Chapter 1 and 2 become leaves with null → removed
    // So the result might be completely empty
    expect(updated.length).toBeLessThanOrEqual(2);
    // Any remaining items should have null pageNumber
    for (const item of updated) {
      expect(item.pageNumber).toBeNull();
    }
  });

  // #126 — Delete partial with 3+ level nested TOC
  it('#126: Partial delete preserves hierarchy, only affected bookmarks updated', () => {
    const toc = modernTOC();
    const totalPages = 300;
    const deletedPages = [25, 26, 27]; // Delete 1.1 Section page and some others
    const mapping = computeDeletePageMapping(totalPages, deletedPages);
    const updated = updateOutlineAfterMapping(toc, mapping);

    // Chapter 1 should still exist
    const ch1 = updated.find(item => item.title === 'Chapter 1');
    expect(ch1).toBeDefined();
    expect(ch1!.pageNumber).toBe(24); // unchanged (before deleted range)

    // 1.1 Section was at page 25 (deleted) → removed (leaf)
    const section1_1 = ch1!.children.find(c => c.title === '1.1 Section');
    expect(section1_1).toBeUndefined(); // Removed

    // 1.2 Deep Section was at 28 → now 25 (shifted by 3)
    const deep = ch1!.children.find(c => c.title === '1.2 Deep Section');
    expect(deep).toBeDefined();
    expect(deep!.pageNumber).toBe(25); // 28 - 3 = 25

    // Deep children also shifted
    expect(deep!.children[0].pageNumber).toBe(26); // 29 - 3 = 26
    expect(deep!.children[1].pageNumber).toBe(29); // 32 - 3 = 29

    // Chapter 2 still intact, shifted
    const ch2 = updated.find(item => item.title === 'Chapter 2');
    expect(ch2).toBeDefined();
    expect(ch2!.pageNumber).toBe(47); // 50 - 3 = 47
  });
});

// =====================================================================
// 🔄 REORDER / SWAP TESTS (#127-#130)
// =====================================================================

describe('REORDER / SWAP operations', () => {
  // #127 — Swap two pages that are BOTH TOC targets
  it('#127: Swap two pages both in TOC → both bookmarks updated', () => {
    const toc = modernTOC();
    const totalPages = 300;

    // Swap pages 24 ↔ 50 (Chapter 1 ↔ Chapter 2)
    const newOrder: number[] = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 24) newOrder.push(50);
      else if (i === 50) newOrder.push(24);
      else newOrder.push(i);
    }

    const mapping = computeReorderMapping(newOrder);
    const updated = updateOutlineAfterMapping(toc, mapping);

    const ch1 = updated.find(item => item.title === 'Chapter 1');
    const ch2 = updated.find(item => item.title === 'Chapter 2');
    expect(ch1).toBeDefined();
    expect(ch2).toBeDefined();
    expect(ch1!.pageNumber).toBe(50); // Chapter 1 now at position 50
    expect(ch2!.pageNumber).toBe(24); // Chapter 2 now at position 24
  });

  // #128 — Swap TOC target with non-target page
  it('#128: Swap TOC target with non-target → bookmark follows swap', () => {
    const toc = modernTOC();
    const totalPages = 300;

    // Preface is at page 16 (TOC target), page 100 has no bookmark
    // Swap 16 ↔ 100
    const newOrder: number[] = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 16) newOrder.push(100);
      else if (i === 100) newOrder.push(16);
      else newOrder.push(i);
    }

    const mapping = computeReorderMapping(newOrder);
    const updated = updateOutlineAfterMapping(toc, mapping);

    const preface = updated.find(item => item.title === 'Preface');
    expect(preface).toBeDefined();
    expect(preface!.pageNumber).toBe(100); // Followed the swap
  });

  // #129 — Move first page to end (global offset −1)
  it('#129: Move first page to end → all TOC entries offset −1', () => {
    const toc = modernTOC();
    const total = 300;

    const newOrder: number[] = [];
    for (let i = 2; i <= total; i++) newOrder.push(i);
    newOrder.push(1); // page 1 goes to the end

    const mapping = computeReorderMapping(newOrder);
    const updated = updateOutlineAfterMapping(toc, mapping);

    const pages = tocPageNumbers(updated);
    // Cover was 1 → now at position 300. But wait, Cover is at page 1 which moves to the end.
    // Cover page 1 → new position N (300), but that's where page N used to be.
    // Actually, mapping maps old page → new position.
    // Old page 1 → new position 300
    // Old page 2 → new position 1
    // So Cover bookmark (old page 1) → new page 300
    // Copyright (old page 3) → new page 2
    // Every bookmark shifts by -1
    
    // Cover should now be at 300
    expect(pages[0]).toBe(300); // Cover: old 1 → new 300
    // Copyright: old 3 → new 2
    expect(pages[1]).toBe(2);
    // Contributors: old 4 → new 3
    expect(pages[2]).toBe(3);
  });

  // #130 — Move last page to beginning (global offset +1)
  it('#130: Move last page to beginning → all TOC entries offset +1', () => {
    const toc = modernTOC();
    const totalPages = 300;

    const newOrder: number[] = [300]; // last page first
    for (let i = 1; i <= 299; i++) newOrder.push(i);

    const mapping = computeReorderMapping(newOrder);
    const updated = updateOutlineAfterMapping(toc, mapping);

    const pages = tocPageNumbers(updated);
    // Old page 1 → new position 2
    // Old page 3 → new position 4
    expect(pages[0]).toBe(2);   // Cover: old 1 → new 2
    expect(pages[1]).toBe(4);   // Copyright: old 3 → new 4
    expect(pages[2]).toBe(5);   // Contributors: old 4 → new 5
  });
});

// =====================================================================
// ↩️ REVERSE TESTS (#131-#133)
// =====================================================================

describe('REVERSE operations', () => {
  // #131 — Reverse ALL pages → every bookmark mapped N−P+1
  it('#131: Full reverse → every bookmark at N−P+1', () => {
    const toc = modernTOC();
    const totalPages = 300;

    const newOrder = computeReverseOrder(totalPages);
    const mapping = computeReorderMapping(newOrder);
    const updated = updateOutlineAfterMapping(toc, mapping);

    const pages = tocPageNumbers(updated);
    // Cover was 1 → new = 300 − 1 + 1 = 300
    expect(pages[0]).toBe(300);
    // Copyright was 3 → new = 300 − 3 + 1 = 298
    expect(pages[1]).toBe(298);
    // Contributors was 4 → 300 − 4 + 1 = 297
    expect(pages[2]).toBe(297);
    // Chapter 1 was 24 → 300 − 24 + 1 = 277
    const ch1 = updated.find(item => item.title === 'Chapter 1');
    expect(ch1!.pageNumber).toBe(277);
  });

  // #132 — Reverse a SUBSET containing TOC targets
  it('#132: Reverse subset with TOC targets → only in-range bookmarks remapped', () => {
    const toc = modernTOC();
    const totalPages = 300;

    // Reverse pages 2-5. In this range: Copyright (p.3), Contributors (p.4)
    const pageNumbers = [2, 3, 4, 5];
    const newOrder = computeReverseOrder(totalPages, pageNumbers);
    // 2,3,4,5 reversed → 5,4,3,2
    
    const mapping = computeReorderMapping(newOrder);
    const updated = updateOutlineAfterMapping(toc, mapping);

    const pages = tocPageNumbers(updated);
    // Cover (p.1) → unchanged (outside range)
    expect(pages[0]).toBe(1);
    // Copyright (p.3) → now at position of page 4 in the range = swapped with p.4
    expect(pages[1]).toBe(4); // Copyright old 3 → in reversed subset, p.3 is now where p.4 was
    // Contributors (p.4) → now where p.3 was
    expect(pages[2]).toBe(3);
    // TOC (p.8) → unchanged (outside range)
    expect(pages[3]).toBe(8);
  });

  // #133 — Reverse subset WITHOUT TOC targets
  it('#133: Reverse subset without TOC targets → all bookmarks unchanged', () => {
    const toc = modernTOC();
    const totalPages = 300;

    // Reverse pages 100-110 (no bookmarks in this range)
    const pageNumbers = Array.from({ length: 11 }, (_, i) => i + 100);
    const newOrder = computeReverseOrder(totalPages, pageNumbers);
    const mapping = computeReorderMapping(newOrder);
    const updated = updateOutlineAfterMapping(toc, mapping);

    const pages = tocPageNumbers(updated);
    // All bookmarks should be unchanged
    expect(pages[0]).toBe(1);   // Cover
    expect(pages[1]).toBe(3);   // Copyright
    expect(pages[2]).toBe(4);   // Contributors
    expect(pages[3]).toBe(8);   // TOC
  });
});

// =====================================================================
// 📥 INSERT / COPY / MOVE TESTS (#134-#137)
// =====================================================================

describe('INSERT / COPY / MOVE operations', () => {
  // #134 — Insert pages BEFORE TOC targets (positive offset)
  it('#134: Insert before TOC targets → offset +insertedCount', () => {
    const toc = modernTOC();
    const totalPages = 300;

    // Insert 3 pages before page 1 (at position 0/first)
    const mapping = computeInsertMapping(totalPages, 3, { location: 'before', page: 1 });
    const updated = updateOutlineAfterMapping(toc, mapping);

    const pages = tocPageNumbers(updated);
    // All pages shift by +3
    expect(pages[0]).toBe(4);   // Cover: 1 + 3 = 4
    expect(pages[1]).toBe(6);   // Copyright: 3 + 3 = 6
    expect(pages[2]).toBe(7);   // Contributors: 4 + 3 = 7
    expect(pages[3]).toBe(11);  // TOC: 8 + 3 = 11
  });

  // #135 — Insert pages AFTER all TOC targets (no offset)
  it('#135: Insert after all TOC targets → all bookmarks unchanged', () => {
    const toc = modernTOC();
    const totalPages = 300;

    // Insert 5 pages after the last page (after page 300)
    const mapping = computeInsertMapping(totalPages, 5, { location: 'after', page: 300 });
    const updated = updateOutlineAfterMapping(toc, mapping);

    const pages = tocPageNumbers(updated);
    // No bookmarks should change
    expect(pages[0]).toBe(1);   // Cover
    expect(pages[1]).toBe(3);   // Copyright
    expect(pages[2]).toBe(4);   // Contributors
    expect(pages[3]).toBe(8);   // TOC
  });

  // #136 — Move: pages containing TOC targets to new position
  it('#136: Move TOC target pages → bookmarks follow, others shift', () => {
    const toc = modernTOC();
    const totalPages = 300;

    // Move pages 24-25 (Chapter 1 + 1.1) after page 50
    const mapping = computeMoveMapping(totalPages, [24, 25], { location: 'after', page: 50 });
    const updated = updateOutlineAfterMapping(toc, mapping);

    // Chapter 1 (p.24) moved to after page 50
    // The adjusted destination: page 50 minus 2 moved pages before it = 48
    // Insert after position 48 → position 50 (1-based)
    // But wait, pages 24 and 25 are removed, so after removal, page 50 becomes page 48.
    // Insert after 48 → new position 49 and 50
    
    // Actually, let me verify: movedBeforeDest = pages < 50 in [24,25] → both → 2
    // adjustedDestPage = 50 - 2 = 48
    // after → insertPos = 48
    // New order: remaining[0..47] + [24,25] + remaining[48..]
    // Chapter 1 gets position 49, 1.1 gets 50
    
    const ch1 = updated.find(item => item.title === 'Chapter 1');
    expect(ch1).toBeDefined();
    expect(ch1!.pageNumber).toBe(49);

    // Chapter 2 (p.50) shifts down by 2 (moved pages removed before it)
    const ch2 = updated.find(item => item.title === 'Chapter 2');
    expect(ch2!.pageNumber).toBe(48); // 50 - 2 = 48
  });

  // #137 — Copy: duplicate TOC target page → original unchanged, others shift
  it('#137: Copy/duplicate → original bookmark unchanged, later bookmarks shift', () => {
    const toc = modernTOC();
    const totalPages = 300;

    // Copy page 3 after page 7 (1 copy)
    const mapping = computeInsertMapping(totalPages, 1, { location: 'after', page: 7 });
    const updated = updateOutlineAfterMapping(toc, mapping);

    const pages = tocPageNumbers(updated);
    // Pages before/at position 7 unchanged
    expect(pages[0]).toBe(1);   // Cover
    expect(pages[1]).toBe(3);   // Copyright (unchanged, it IS the copied page but original stays)
    expect(pages[2]).toBe(4);   // Contributors (page 4 > 7? No, 4 ≤ 7, unchanged)
    expect(pages[3]).toBe(9);   // TOC: 8 > 7 → 8+1 = 9
    expect(pages[4]).toBe(17);  // Preface: 16 > 7 → 16+1 = 17
  });
});

// =====================================================================
// 🔁 REPLACE TESTS (#138-#139)
// =====================================================================

describe('REPLACE operations', () => {
  // #138 — Replace 2 pages with 5 → offset +3 for pages after
  it('#138: Replace 2→5 pages → before block unchanged, inside removed, after +3', () => {
    const toc = modernTOC();
    const totalPages = 300;

    // Replace pages 3-4 with 5 pages
    const mapping = computeReplaceMapping(totalPages, [3, 4], 5);
    const updated = updateOutlineAfterMapping(toc, mapping);

    // Cover (p.1) → unchanged (before first replaced)
    expect(updated.find(i => i.title === 'Cover')!.pageNumber).toBe(1);

    // Copyright (p.3) → deleted (inside replaced range, leaf)
    expect(updated.find(i => i.title === 'Copyright')).toBeUndefined();

    // Contributors (p.4) → deleted (inside replaced range, leaf)
    expect(updated.find(i => i.title === 'Contributors')).toBeUndefined();

    // TOC (p.8) → after replacement block
    // replacedBefore for page 8 = 2 (pages 3,4)
    // new = 8 - 2 + 5 = 11
    expect(updated.find(i => i.title === 'Table of Contents')!.pageNumber).toBe(11);

    // Chapter 1 (p.24) → 24 - 2 + 5 = 27
    expect(updated.find(i => i.title === 'Chapter 1')!.pageNumber).toBe(27);
  });

  // #139 — Replace 5 pages with 2 → offset −3 for pages after
  it('#139: Replace 5→2 pages → after block −3', () => {
    const toc = modernTOC();
    const totalPages = 300;

    // Replace pages 3-7 (5 pages) with 2 pages
    const mapping = computeReplaceMapping(totalPages, [3, 4, 5, 6, 7], 2);
    const updated = updateOutlineAfterMapping(toc, mapping);

    // Cover (p.1) → unchanged
    expect(updated.find(i => i.title === 'Cover')!.pageNumber).toBe(1);

    // TOC (p.8) → after block
    // replacedBefore for page 8 = 5 (3,4,5,6,7)
    // new = 8 - 5 + 2 = 5
    expect(updated.find(i => i.title === 'Table of Contents')!.pageNumber).toBe(5);

    // Chapter 1 (p.24) → 24 - 5 + 2 = 21
    expect(updated.find(i => i.title === 'Chapter 1')!.pageNumber).toBe(21);
  });
});

// =====================================================================
// 🔗 CUMULATIVE & ROBUSTNESS TESTS (#140-#142)
// =====================================================================

describe('CUMULATIVE & ROBUSTNESS', () => {
  // #140 — Delete then Reorder in sequence
  it('#140: Delete → Reorder cumulative: both mappings applied', () => {
    const toc = modernTOC();
    const totalPages = 300;

    // Step 1: Delete pages 1-2
    const deleteMapping = computeDeletePageMapping(totalPages, [1, 2]);
    const afterDelete = updateOutlineAfterMapping(toc, deleteMapping);

    // Step 2: Swap pages 3↔6 (in the NEW document after deletion)
    // After deletion, old page 3 is now page 1, old page 6 is now page 4
    // But wait, the reorder happens on the actual document pages, which uses ORIGINAL numbering.
    // Actually, after the PDF is rebuilt, we need to renumber.
    // The API flow: delete → rebuild PDF → reorder on new PDF → rebuild again
    // For the mapping test, we simulate: swap old page 5 ↔ old page 8 in the new doc
    // In the new doc (after delete), old page 5 = new page 3, old page 8 = new page 6
    const totalAfterDelete = 298;
    const newOrder: number[] = [];
    for (let i = 1; i <= totalAfterDelete; i++) {
      if (i === 3) newOrder.push(6);
      else if (i === 6) newOrder.push(3);
      else newOrder.push(i);
    }
    const reorderMapping = computeReorderMapping(newOrder);
    const final = updateOutlineAfterMapping(afterDelete, reorderMapping);

    // Verify: Cover (p.1) was deleted
    expect(final.find(i => i.title === 'Cover')).toBeUndefined();

    // Copyright was old 3 → after delete new 1 → swap: new 1 was at position 1 (not swapped), stays 1
    // Wait, swap is new page 3 ↔ 6, not 1
    // Copyright should be at new page 1 still
    
    // Let me trace more carefully:
    // After delete mapping: old→new
    // old 1 → null, old 2 → null, old 3 → 1, old 4 → 2, old 5 → 3, old 6 → 4, old 7 → 5, old 8 → 6, old 9 → 7, ...
    // Copyright (old 3) → new page 1 (not swapped, 1≠3 and 1≠6) → stays at 1
    // Contributors (old 4) → new page 2 → stays at 2
    // old 5 (some page) → new 3 → swapped to 6
    // old 8 → TOC → new 6 → swapped to 3
    
    expect(final.find(i => i.title === 'Copyright')!.pageNumber).toBe(1);
    expect(final.find(i => i.title === 'Table of Contents')!.pageNumber).toBe(3);
    expect(final.find(i => i.title === 'Preface')!.pageNumber).toBe(14); // old 16 → after delete 14, not swapped
  });

  // #141 — Deep nested TOC after massive delete
  it('#141: Deep nested TOC preserves hierarchy after massive delete', () => {
    const toc = modernTOC();
    const totalPages = 300;

    // Delete ~30% of pages, including some with deep bookmarks
    const deletedPages = Array.from({ length: 90 }, (_, i) => i + 1); // delete 1-90
    const mapping = computeDeletePageMapping(totalPages, deletedPages);
    const updated = updateOutlineAfterMapping(toc, mapping);

    // Cover, Copyright, Contributors, TOC, Preface all in deleted range → removed
    // Chapter 1 (p.24) → removed (leaf, in range)
    // Chapter 2 (p.50) → removed (leaf, in range)
    // Appendix (p.200) → after delete: 200 - 90 = 110
    
    // Actually many are leaves that got deleted. Let me check what survives.
    // Cover (1): leaf, deleted → removed
    // Copyright (3): leaf, deleted → removed
    // Contributors (4): leaf, deleted → removed
    // TOC (8): leaf, deleted → removed
    // Preface (16): leaf, deleted → removed
    // Chapter 1 (24): has children, page deleted → pageNumber=null
    //   1.1 (25): leaf, deleted → removed
    //   1.2 (28): has children, deleted → pageNumber=null
    //     1.2.1 (29): leaf, deleted → removed
    //     1.2.2 (32): leaf, deleted → removed
    //   1.3 (35): leaf, deleted → removed
    // After 1.2's children are all removed, 1.2 becomes leaf with null → removed
    // After 1.2 is removed, Chapter 1's children are all gone → Chapter 1 becomes leaf with null → removed
    // Chapter 2 (50): has children, page deleted → pageNumber=null
    //   2.1 (51): leaf, deleted → removed
    //   2.2 (55): leaf, deleted → removed
    // After children removed, Chapter 2 is leaf with null → removed
    // Appendix (200): leaf, outside deleted range → survives at 110

    const appendix = updated.find(i => i.title === 'Appendix');
    expect(appendix).toBeDefined();
    expect(appendix!.pageNumber).toBe(110); // 200 - 90 = 110
    
    // Most items should be removed
    expect(updated.length).toBe(1); // Only Appendix survives
  });

  // #142 — PDF WITHOUT TOC: empty array handling
  it('#142: Empty TOC → all operations return empty array without crash', () => {
    const emptyToc: MinimalTOCItem[] = [];
    const totalPages = 10;

    // Delete
    let result = updateOutlineAfterMapping(emptyToc, computeDeletePageMapping(totalPages, [1]));
    expect(result).toEqual([]);

    // Reorder
    result = updateOutlineAfterMapping(emptyToc, computeReorderMapping([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));
    expect(result).toEqual([]);

    // Reverse
    result = updateOutlineAfterMapping(emptyToc, computeReorderMapping(computeReverseOrder(totalPages)));
    expect(result).toEqual([]);

    // Insert
    result = updateOutlineAfterMapping(emptyToc, computeInsertMapping(totalPages, 3, { location: 'before', page: 1 }));
    expect(result).toEqual([]);

    // Move
    result = updateOutlineAfterMapping(emptyToc, computeMoveMapping(totalPages, [2, 3], { location: 'after', page: 8 }));
    expect(result).toEqual([]);

    // Replace
    result = updateOutlineAfterMapping(emptyToc, computeReplaceMapping(totalPages, [4, 5], 3));
    expect(result).toEqual([]);

    // Duplicate
    result = updateOutlineAfterMapping(emptyToc, computeDuplicateInlineMapping(totalPages, [3], 2));
    expect(result).toEqual([]);

    // All operations handled empty TOC gracefully
  });
});

// =====================================================================
// EDGE CASE TESTS (additional)
// =====================================================================

describe('Edge cases', () => {
  it('Identity mapping preserves all bookmarks', () => {
    const toc = modernTOC();
    const mapping = identityMapping(300);
    const updated = updateOutlineAfterMapping(toc, mapping);
    expect(tocPageNumbers(updated)).toEqual(tocPageNumbers(toc));
  });

  it('Bookmark pointing to page not in mapping is preserved', () => {
    const toc = modernTOC();
    // Map that only covers pages 1-5, but bookmark at page 8
    const mapping = new Map<number, number | null>();
    for (let i = 1; i <= 5; i++) mapping.set(i, i + 10);
    const updated = updateOutlineAfterMapping(toc, mapping);
    // TOC at page 8 → not in mapping → unchanged
    expect(updated.find(i => i.title === 'Table of Contents')!.pageNumber).toBe(8);
  });

  it('Non-contiguous delete handles properly', () => {
    const toc = modernTOC();
    const mapping = computeDeletePageMapping(300, [3, 8, 16]); // Non-contiguous
    const updated = updateOutlineAfterMapping(toc, mapping);
    // After deleting 3, 8, 16:
    // Cover (1) → 1
    // Copyright (3) → deleted
    // Contributors (4) → 4 - 1 = 3
    // TOC (8) → deleted
    // Preface (16) → deleted
    // Chapter 1 (24) → 24 - 3 = 21
    expect(updated.find(i => i.title === 'Cover')!.pageNumber).toBe(1);
    expect(updated.find(i => i.title === 'Copyright')).toBeUndefined();
    expect(updated.find(i => i.title === 'Contributors')!.pageNumber).toBe(3);
    expect(updated.find(i => i.title === 'Table of Contents')).toBeUndefined();
    expect(updated.find(i => i.title === 'Preface')).toBeUndefined();
    expect(updated.find(i => i.title === 'Chapter 1')!.pageNumber).toBe(21);
  });

  it('Reorder where newOrder includes all pages exactly once', () => {
    const toc = modernTOC();
    // Complete shuffle
    const newOrder = Array.from({ length: 300 }, (_, i) => ((i * 7 + 3) % 300) + 1);
    const mapping = computeReorderMapping(newOrder);
    const updated = updateOutlineAfterMapping(toc, mapping);
    
    // All items should survive (no deletions)
    expect(updated.length).toBeGreaterThan(0);
    // Verify each original page appears in mapping
    for (const item of toc) {
      if (item.pageNumber !== null) {
        const expectedNewPage = newOrder.indexOf(item.pageNumber) + 1;
        const found = updated.find(i => i.title === item.title);
        if (found) {
          expect(found.pageNumber).toBe(expectedNewPage);
        }
      }
    }
  });
});
