/**
 * Integration tests for pdfOperations.ts
 * Verifies that insertPages, movePages, and replacePages correctly:
 * 1. Pass tocItems to mapping functions
 * 2. Remap bookmarks correctly
 * 3. Write the updated outline into the output PDF
 * 4. Handle missing/empty tocItems gracefully
 */

import { describe, it, expect } from 'vitest';
import { PDFDocument, PDFName } from 'pdf-lib';
import { insertPages, movePages, replacePages, type TOCItem } from '../pdfOperations';

// ─── Helpers ────────────────────────────────────────────────

/** Create a simple N-page PDF with no outline. */
async function createSimplePDF(pageCount: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    const page = doc.addPage([595, 842]); // A4
    page.drawText(`Page ${i + 1}`, { x: 50, y: 800, size: 12 });
  }
  return doc.save();
}

/** Create a PDF with page numbers written as text for identification. */
async function createLabeledPDF(pageCount: number, prefix: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    const page = doc.addPage([595, 842]);
    page.drawText(`${prefix} Page ${i + 1}`, { x: 50, y: 800, size: 14 });
  }
  return doc.save();
}

/**
 * Verify that the PDF has an outline written into it.
 * We do this by checking that the byte length is larger when tocItems are provided
 * (the outline adds object entries to the PDF).
 */
async function hasOutline(pdfBytes: Uint8Array): Promise<boolean> {
  const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const catalog = (doc as any).catalog;
  if (!catalog) return false;
  // Check if /Outlines entry exists in the catalog
  const outlinesRef = catalog.get(PDFName.of('Outlines'));
  return outlinesRef != null;
}

/** Build minimal TOC items for testing. */
function buildTOC(pageNumbers: (number | null)[]): TOCItem[] {
  const items: TOCItem[] = [];
  for (let i = 0; i < pageNumbers.length; i++) {
    items.push({
      title: `Bookmark ${i + 1}`,
      pageNumber: pageNumbers[i],
      children: [],
    });
  }
  return items;
}

/** Build nested TOC for deep-hierarchy testing. */
function buildNestedTOC(): TOCItem[] {
  return [
    { title: 'Cover', pageNumber: 1, children: [] },
    { title: 'Chapter 1', pageNumber: 3, children: [
      { title: 'Section 1.1', pageNumber: 4, children: [
        { title: 'Sub 1.1.1', pageNumber: 5, children: [] },
      ]},
      { title: 'Section 1.2', pageNumber: 7, children: [] },
    ]},
    { title: 'Chapter 2', pageNumber: 10, children: [
      { title: 'Section 2.1', pageNumber: 11, children: [] },
    ]},
  ];
}

// =====================================================================
// insertPages tests
// =====================================================================

describe('insertPages — TOC preservation', () => {
  it('inserts pages at beginning → remaps all bookmarks with positive offset', async () => {
    const targetPDF = await createSimplePDF(10);
    const sourcePDF = await createLabeledPDF(3, 'Inserted');

    const tocItems = buildTOC([1, 3, 5, 8]); // bookmarks at pages 1,3,5,8

    const result = await insertPages(targetPDF, sourcePDF, [1, 2, 3], { location: 'before', page: 1 }, tocItems);

    expect(result.tocItems).toBeDefined();
    expect(result.tocItems!.length).toBe(4);
    // All bookmarks shift by +3
    expect(result.tocItems![0].pageNumber).toBe(4);  // was 1 → 4
    expect(result.tocItems![1].pageNumber).toBe(6);  // was 3 → 6
    expect(result.tocItems![2].pageNumber).toBe(8);  // was 5 → 8
    expect(result.tocItems![3].pageNumber).toBe(11); // was 8 → 11

    // Verify outline was written into PDF
    expect(await hasOutline(result.bytes)).toBe(true);
  });

  it('inserts pages after last page → bookmarks unchanged', async () => {
    const targetPDF = await createSimplePDF(10);
    const sourcePDF = await createLabeledPDF(2, 'Extra');

    const tocItems = buildTOC([1, 5, 10]);

    const result = await insertPages(targetPDF, sourcePDF, [1, 2], { location: 'after', page: 10 }, tocItems);

    expect(result.tocItems).toBeDefined();
    // No bookmark should change
    expect(result.tocItems![0].pageNumber).toBe(1);
    expect(result.tocItems![1].pageNumber).toBe(5);
    expect(result.tocItems![2].pageNumber).toBe(10);

    expect(await hasOutline(result.bytes)).toBe(true);
  });

  it('inserts pages in middle → only bookmarks after insertion point shift', async () => {
    const targetPDF = await createSimplePDF(10);
    const sourcePDF = await createLabeledPDF(2, 'Mid');

    const tocItems = buildTOC([2, 4, 6, 8]); // p.2,4,6,8

    const result = await insertPages(targetPDF, sourcePDF, [1, 2], { location: 'after', page: 4 }, tocItems);

    expect(result.tocItems).toBeDefined();
    expect(result.tocItems![0].pageNumber).toBe(2); // 2 ≤ 4 → unchanged
    expect(result.tocItems![1].pageNumber).toBe(4); // 4 ≤ 4 → unchanged
    expect(result.tocItems![2].pageNumber).toBe(8); // 6 > 4 → 6 + 2 = 8
    expect(result.tocItems![3].pageNumber).toBe(10); // 8 > 4 → 8 + 2 = 10
  });

  it('without tocItems → still works, returns no tocItems', async () => {
    const targetPDF = await createSimplePDF(5);
    const sourcePDF = await createSimplePDF(2);

    const result = await insertPages(targetPDF, sourcePDF, [1, 2], { location: 'after', page: 3 });

    expect(result.tocItems).toBeUndefined();
    expect(result.bytes).toBeDefined();
    expect(await hasOutline(result.bytes)).toBe(false);
  });

  it('with empty tocItems → returns undefined tocItems', async () => {
    const targetPDF = await createSimplePDF(5);
    const sourcePDF = await createSimplePDF(2);

    const result = await insertPages(targetPDF, sourcePDF, [1], { location: 'before', page: 1 }, []);

    expect(result.tocItems).toBeUndefined();
  });
});

// =====================================================================
// movePages tests
// =====================================================================

describe('movePages — TOC preservation', () => {
  it('moves pages → moved bookmarks follow, intermediate bookmarks shift', async () => {
    const pdf = await createSimplePDF(12);

    const tocItems = buildTOC([2, 4, 6, 8, 10]);

    // Move pages 3-4 after page 8
    const result = await movePages(pdf, [3, 4], { location: 'after', page: 8 }, tocItems);

    expect(result.tocItems).toBeDefined();
    
    const pages = result.tocItems!.map(t => t.pageNumber);
    expect(pages[0]).toBe(2);   // p.2 unchanged
    expect(pages[1]).toBe(8);   // p.4 moved to 8
    expect(pages[2]).toBe(4);   // p.6 → 4
    expect(pages[3]).toBe(6);   // p.8 → 6
    expect(pages[4]).toBe(10);  // p.10 unchanged

    expect(await hasOutline(result.bytes)).toBe(true);
  });

  it('moves pages to before → correct mapping', async () => {
    const pdf = await createSimplePDF(10);

    const tocItems = buildTOC([1, 5, 10]);

    // Move pages 8-9 before page 3
    const result = await movePages(pdf, [8, 9], { location: 'before', page: 3 }, tocItems);

    expect(result.tocItems).toBeDefined();
    const pages = result.tocItems!.map(t => t.pageNumber);
    
    expect(pages[0]).toBe(1);   // p.1 unchanged
    expect(pages[1]).toBe(7);   // p.5 → 7
    expect(pages[2]).toBe(10);  // p.10 unchanged
  });

  it('without tocItems → works, no TOC returned', async () => {
    const pdf = await createSimplePDF(10);
    const result = await movePages(pdf, [2, 3], { location: 'after', page: 7 });

    expect(result.tocItems).toBeUndefined();
    expect(result.bytes).toBeDefined();
    expect(await hasOutline(result.bytes)).toBe(false);
  });

  it('moves single page → bookmark follows correctly', async () => {
    const pdf = await createSimplePDF(8);
    const tocItems = buildTOC([3]); // bookmark only at page 3

    const result = await movePages(pdf, [3], { location: 'after', page: 6 }, tocItems);

    expect(result.tocItems![0].pageNumber).toBe(6);
    expect(await hasOutline(result.bytes)).toBe(true);
  });
});

// =====================================================================
// replacePages tests
// =====================================================================

describe('replacePages — TOC preservation', () => {
  it('replace 2 pages with 5 → bookmarks in range removed, after range shift +3', async () => {
    const targetPDF = await createSimplePDF(15);
    const replacementPDF = await createLabeledPDF(5, 'Replacement');

    const tocItems = buildTOC([1, 4, 5, 10, 15]);

    const result = await replacePages(targetPDF, replacementPDF, [4, 5], [1, 2, 3, 4, 5], tocItems);

    expect(result.tocItems).toBeDefined();
    const pages = result.tocItems!.map(t => t.pageNumber);
    
    expect(pages[0]).toBe(1);
    expect(pages[1]).toBe(13);
    expect(pages[2]).toBe(18);
    expect(result.tocItems!.length).toBe(3); // 2 removed

    expect(await hasOutline(result.bytes)).toBe(true);
  });

  it('replace 5 pages with 2 → after range shift -3', async () => {
    const targetPDF = await createSimplePDF(15);
    const replacementPDF = await createLabeledPDF(2, 'Short');

    const tocItems = buildTOC([1, 8, 15]);

    const result = await replacePages(targetPDF, replacementPDF, [3, 4, 5, 6, 7], [1, 2], tocItems);

    expect(result.tocItems).toBeDefined();
    const pages = result.tocItems!.map(t => t.pageNumber);
    
    expect(pages[0]).toBe(1);
    expect(pages[1]).toBe(5);
    expect(pages[2]).toBe(12);
    expect(result.tocItems!.length).toBe(3);

    expect(await hasOutline(result.bytes)).toBe(true);
  });

  it('replace with non-contiguous target pages → consolidated at first replaced position', async () => {
    const targetPDF = await createSimplePDF(15);
    const replacementPDF = await createLabeledPDF(3, 'Consolidated');

    const tocItems = buildTOC([1, 4, 8, 12]);

    const result = await replacePages(targetPDF, replacementPDF, [4, 8], [1, 2, 3], tocItems);

    expect(result.tocItems).toBeDefined();
    const pages = result.tocItems!.map(t => t.pageNumber);
    
    expect(pages[0]).toBe(1);
    expect(pages[1]).toBe(13);
    expect(result.tocItems!.length).toBe(2);

    expect(await hasOutline(result.bytes)).toBe(true);
  });

  it('without tocItems → works, no TOC returned', async () => {
    const targetPDF = await createSimplePDF(10);
    const replacementPDF = await createLabeledPDF(2, 'NoTOC');

    const result = await replacePages(targetPDF, replacementPDF, [3, 4], [1, 2]);

    expect(result.tocItems).toBeUndefined();
    expect(result.bytes).toBeDefined();
    expect(await hasOutline(result.bytes)).toBe(false);
  });

  it('replace pages including bookmark with children → hierarchy preserved', async () => {
    const targetPDF = await createSimplePDF(15);
    const replacementPDF = await createLabeledPDF(2, 'Repl');

    const tocItems = buildNestedTOC();
    // Chapter 1 at p.3 (with children), Section 1.1 at p.4 (with Sub 1.1.1 at p.5)
    // Replace pages 3-4 (Chapter 1 parent and Section 1.1) with 2 pages

    const result = await replacePages(targetPDF, replacementPDF, [3, 4], [1, 2], tocItems);

    expect(result.tocItems).toBeDefined();
    
    // Cover (p.1) → unchanged (before replaced range)
    expect(result.tocItems![0].pageNumber).toBe(1);
    
    // Chapter 1 (p.3) → page deleted → pageNumber=null, children survive
    const ch1 = result.tocItems![1];
    expect(ch1.title).toBe('Chapter 1');
    expect(ch1.pageNumber).toBeNull();
    
    // Section 1.1 (p.4) → page deleted, but has children (Sub 1.1.1) → pageNumber=null
    const sec1_1 = ch1.children.find(c => c.title === 'Section 1.1');
    expect(sec1_1).toBeDefined();
    expect(sec1_1!.pageNumber).toBeNull();
    
    // Sub 1.1.1 (p.5) → NOT replaced, survives. replacedBefore=2, new=5-2+2=5
    expect(sec1_1!.children.length).toBe(1);
    expect(sec1_1!.children[0].title).toBe('Sub 1.1.1');
    expect(sec1_1!.children[0].pageNumber).toBe(5);

    // Section 1.2 (p.7) → NOT replaced. replacedBefore=2, new=7-2+2=7
    const sec1_2 = ch1.children.find(c => c.title === 'Section 1.2');
    expect(sec1_2).toBeDefined();
    expect(sec1_2!.pageNumber).toBe(7);
    
    // Chapter 2 (p.10) → replacedBefore=2, new=10-2+2=10
    const ch2 = result.tocItems![2];
    expect(ch2.title).toBe('Chapter 2');
    expect(ch2.pageNumber).toBe(10);

    expect(await hasOutline(result.bytes)).toBe(true);
  });

  it('replacing pages that are not bookmark targets → bookmarks unaffected', async () => {
    const targetPDF = await createSimplePDF(15);
    const replacementPDF = await createLabeledPDF(3, 'NoTarget');

    const tocItems = buildTOC([1, 2, 12]);

    const result = await replacePages(targetPDF, replacementPDF, [5, 6, 7], [1, 2, 3], tocItems);

    expect(result.tocItems).toBeDefined();
    const pages = result.tocItems!.map(t => t.pageNumber);
    
    expect(pages[0]).toBe(1);
    expect(pages[1]).toBe(2);
    expect(pages[2]).toBe(12);

    expect(await hasOutline(result.bytes)).toBe(true);
  });
});

// =====================================================================
// Edge cases
// =====================================================================

describe('Edge cases', () => {
  it('insertPages: nested TOC preserved after insert', async () => {
    const targetPDF = await createSimplePDF(15);
    const sourcePDF = await createLabeledPDF(2, 'Extra');

    const tocItems = buildNestedTOC();

    const result = await insertPages(targetPDF, sourcePDF, [1, 2], { location: 'before', page: 1 }, tocItems);

    expect(result.tocItems).toBeDefined();
    // All bookmarks shift by +2
    expect(result.tocItems![0].pageNumber).toBe(3);  // Cover: 1+2=3
    expect(result.tocItems![1].pageNumber).toBe(5);  // Ch1: 3+2=5
    expect(result.tocItems![1].children[0].pageNumber).toBe(6); // 1.1: 4+2=6
    expect(result.tocItems![1].children[0].children[0].pageNumber).toBe(7); // Sub: 5+2=7
    expect(result.tocItems![2].pageNumber).toBe(12); // Ch2: 10+2=12

    expect(await hasOutline(result.bytes)).toBe(true);
  });

  it('movePages: throws on invalid page numbers', async () => {
    const pdf = await createSimplePDF(10);
    await expect(movePages(pdf, [11], { location: 'after', page: 5 }))
      .rejects.toThrow('out of range');
  });

  it('insertPages: throws on invalid destination', async () => {
    const targetPDF = await createSimplePDF(5);
    const sourcePDF = await createSimplePDF(2);
    await expect(insertPages(targetPDF, sourcePDF, [1], { location: 'after', page: 10 }))
      .rejects.toThrow('out of range');
  });

  it('replacePages: throws on empty target pages', async () => {
    const targetPDF = await createSimplePDF(5);
    const replacementPDF = await createSimplePDF(2);
    await expect(replacePages(targetPDF, replacementPDF, [], [1]))
      .rejects.toThrow('No target pages');
  });

  it('insertPages: outline NOT written when tocItems not provided', async () => {
    const targetPDF = await createSimplePDF(5);
    const sourcePDF = await createSimplePDF(2);

    // With tocItems
    const withTOC = await insertPages(targetPDF, sourcePDF, [1], { location: 'after', page: 2 }, buildTOC([1]));
    expect(await hasOutline(withTOC.bytes)).toBe(true);

    // Without tocItems
    const withoutTOC = await insertPages(targetPDF, sourcePDF, [1], { location: 'after', page: 2 });
    expect(await hasOutline(withoutTOC.bytes)).toBe(false);

    // The two PDFs should have different byte lengths (outline adds data)
    expect(withTOC.bytes.length).toBeGreaterThan(withoutTOC.bytes.length);
  });
});
