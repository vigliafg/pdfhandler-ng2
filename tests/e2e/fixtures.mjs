// Deterministic test fixtures generated with pdf-lib (offline, no downloads).
// Every page carries unique, searchable text so PDFs can be validated by content.
import { PDFDocument, StandardFonts, rgb, PDFName, PDFNumber, PDFRef, PDFString, PDFArray } from 'pdf-lib';
import { mkdir, writeFile } from 'node:fs/promises';

export const FIX_DIR = '/tmp/e2e-fix';

/** Build a PDF with `pages` pages, each with text `label page N of total`. */
export async function makeLabeledPdf(label, pages) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  for (let p = 1; p <= pages; p++) {
    const page = doc.addPage([400, 300]);
    page.drawText(`${label} page ${p} of ${pages}`, { x: 30, y: 240, size: 20, font: bold, color: rgb(0.1, 0.1, 0.1) });
    page.drawText(`${label}-unique-token-p${p}`, { x: 30, y: 120, size: 14, font, color: rgb(0.2, 0.2, 0.2) });
  }
  doc.setTitle(`${label} fixture`);
  return doc;
}

/**
 * Attach a flat outline (bookmarks) to a pdf-lib document.
 * entries: [{ title, page }] (1-based page numbers).
 * Built with low-level dicts: Catalog/Outlines → items chained via Next/Prev.
 */
export function attachOutline(doc, entries) {
  const context = doc.context;
  const outlinesRef = context.nextRef();
  const itemRefs = entries.map(() => context.nextRef());

  entries.forEach((e, i) => {
    // Dest must carry the page REFERENCE (PDFRef), not the looked-up page dict,
    // otherwise pdfjs cannot resolve the destination and reports dest: null.
    const dict = context.obj({
      Title: PDFString.of(e.title),
      Parent: outlinesRef,
      Dest: [doc.getPage(e.page - 1).ref, PDFName.of('Fit')],
    });
    const keys = ['Title', 'Parent', 'Dest'];
    if (i > 0) { dict.set(PDFName.of('Prev'), itemRefs[i - 1]); keys.push('Prev'); }
    if (i < entries.length - 1) { dict.set(PDFName.of('Next'), itemRefs[i + 1]); keys.push('Next'); }
    context.assign(itemRefs[i], dict);
  });

  context.assign(outlinesRef, context.obj({
    Type: 'Outlines',
    First: itemRefs[0],
    Last: itemRefs[itemRefs.length - 1],
    Count: entries.length,
  }));
  doc.catalog.set(PDFName.of('Outlines'), outlinesRef);
}

/** Generate all fixtures into FIX_DIR; returns map of paths. */
export async function generateFixtures() {
  await mkdir(FIX_DIR, { recursive: true });

  const paths = {};

  // fixA: 3 pages with a 2-entry outline (Chapter One → p1, Chapter Two → p3)
  const fixA = await makeLabeledPdf('FIXA', 3);
  attachOutline(fixA, [
    { title: 'Chapter One', page: 1 },
    { title: 'Chapter Two', page: 3 },
  ]);
  paths.fixA = `${FIX_DIR}/fixa.pdf`;
  await writeFile(paths.fixA, await fixA.save());

  // fixB: 2 pages
  const fixB = await makeLabeledPdf('FIXB', 2);
  paths.fixB = `${FIX_DIR}/fixb.pdf`;
  await writeFile(paths.fixB, await fixB.save());

  // fixC: 4 pages
  const fixC = await makeLabeledPdf('FIXC', 4);
  paths.fixC = `${FIX_DIR}/fixc.pdf`;
  await writeFile(paths.fixC, await fixC.save());

  // fixM: 3 marker pages (for split-by-markers)
  const fixM = await makeLabeledPdf('FIXM', 3);
  paths.fixM = `${FIX_DIR}/fixm.pdf`;
  await writeFile(paths.fixM, await fixM.save());

  // corrupted file (for Merge rejection test)
  paths.corrupt = `${FIX_DIR}/corrupt.pdf`;
  await writeFile(paths.corrupt, Buffer.from('this is not a pdf at all'));

  return paths;
}
