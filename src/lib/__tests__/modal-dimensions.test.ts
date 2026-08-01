/**
 * Modal Page Dimensions Tests
 * Tests getModalPageDimensions for mixed-size PDF handling.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock pdfjs-dist to avoid DOMMatrix dependency in Node.js
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
}));

import {
  getModalPageDimensions,
  getFirstPageDimensions,
  clearPageDimensionsCache,
  type PDFDocument,
} from '../pdfRenderer';

// ─── Mock helpers ────────────────────────────────────────────

interface MockPageConfig {
  width: number;
  height: number;
  /** If true, getPage for this page throws */
  fail?: boolean;
}

function mockPDF(numPages: number, pages: MockPageConfig[]): PDFDocument {
  const mock = {
    numPages,
    _pdfInfo: { fingerprint: `test-${Date.now()}-${Math.random()}` },
    getPage: async (pageNumber: number) => {
      const cfg = pages[pageNumber - 1];
      if (!cfg || cfg.fail) throw new Error(`Failed to load page ${pageNumber}`);
      return {
        getViewport: ({ scale }: { scale: number }) => ({
          width: cfg.width * scale,
          height: cfg.height * scale,
          scale,
        }),
      };
    },
    // Stubs required by the PDFDocumentProxy interface
    getOutline: async () => [],
    getDestinations: async () => ({}),
    getPageIndex: async () => 0,
    destroy: () => {},
  };
  return mock as unknown as PDFDocument;
}

// ─── Tests ───────────────────────────────────────────────────

describe('getModalPageDimensions', () => {
  beforeEach(() => {
    clearPageDimensionsCache();
  });

  // ── Scenario 1: PDF with all pages same size ──────────────
  it('returns the uniform dimensions when all pages are identical', async () => {
    const pages: MockPageConfig[] = Array(20).fill({ width: 595, height: 842 });
    const pdf = mockPDF(20, pages);
    const dims = await getModalPageDimensions(pdf);
    expect(dims.width).toBe(595);
    expect(dims.height).toBe(842);
  });

  // ── Scenario 2: mayo.pdf-like — tiny page 1, majority standard ──
  it('picks the modal (majority) dimensions, ignoring the anomalous page 1', async () => {
    const config: MockPageConfig[] = [
      { width: 252, height: 326 },   // page 1: tiny cover
    ];
    // pages 2-20: standard
    for (let i = 2; i <= 20; i++) {
      config.push({ width: 581, height: 798 });
    }
    const pdf = mockPDF(20, config);
    const dims = await getModalPageDimensions(pdf);
    expect(dims.width).toBe(581);
    expect(dims.height).toBe(798);
  });

  // ── Scenario 3: PDF with only 1 page ──────────────────────
  it('returns the single page dimensions when PDF has only 1 page', async () => {
    const pdf = mockPDF(1, [{ width: 600, height: 900 }]);
    const dims = await getModalPageDimensions(pdf);
    expect(dims.width).toBe(600);
    expect(dims.height).toBe(900);
  });

  // ── Scenario 4: Some pages fail to load ───────────────────
  it('skips failing pages and picks the modal from successful ones', async () => {
    const config: MockPageConfig[] = [
      { width: 400, height: 600 },   // page 1: ok
      { width: 0, height: 0, fail: true },  // page 2: fails
      { width: 400, height: 600 },   // page 3: ok
      { width: 400, height: 600 },   // page 4: ok
      { width: 300, height: 500 },   // page 5: ok, different
    ];
    const pdf = mockPDF(5, config);
    const dims = await getModalPageDimensions(pdf);
    // 400×600 has count 3, 300×500 has count 1 → moda = 400×600
    expect(dims.width).toBe(400);
    expect(dims.height).toBe(600);
  });

  // ── Scenario 5: All sampled pages fail — fallback to A4 ───
  it('falls back to A4 default when all sampled pages fail', async () => {
    const config: MockPageConfig[] = [];
    for (let i = 1; i <= 10; i++) {
      config.push({ width: 0, height: 0, fail: true });
    }
    const pdf = mockPDF(11, config);
    const dims = await getModalPageDimensions(pdf);
    // Fallback chain: tally empty → try getPageDimensions(pdf, 1) → fails → A4
    expect(dims.width).toBe(595);
    expect(dims.height).toBe(842);
  });

  // ── Scenario 6: Equal counts (50/50 split) — picks first key ──
  it('picks the first dimension key when there is a tie', async () => {
    const config: MockPageConfig[] = [
      { width: 300, height: 400 },   // page 1
      { width: 300, height: 400 },   // page 2
      { width: 400, height: 300 },   // page 3
      { width: 400, height: 300 },   // page 4
    ];
    const pdf = mockPDF(4, config);
    const dims = await getModalPageDimensions(pdf);
    // Both have count 2. Due to Map iteration order, "300.0x400.0" comes first.
    expect(dims.width).toBe(300);
    expect(dims.height).toBe(400);
  });

  // ── Scenario 7: PDF with multiple mixed sizes, majority in tail ──
  it('handles PDF with multiple mixed sizes correctly', async () => {
    const config: MockPageConfig[] = [
      { width: 100, height: 100 },   // size A: 1
      { width: 200, height: 200 },   // size B: 1
      { width: 300, height: 300 },   // size C: 2
      { width: 300, height: 300 },
      { width: 100, height: 100 },   // size A: 2 (tie)
      { width: 100, height: 100 },   // size A: 3 ← majority
      { width: 200, height: 200 },   // size B: 2
    ];
    const pdf = mockPDF(7, config);
    const dims = await getModalPageDimensions(pdf);
    // 100×100: 3, 200×200: 2, 300×300: 2 → moda = 100×100
    expect(dims.width).toBe(100);
    expect(dims.height).toBe(100);
  });

  // ── Regression: getFirstPageDimensions still works ────────
  it('getFirstPageDimensions returns page 1 dimensions (for backward compat)', async () => {
    const config: MockPageConfig[] = [
      { width: 252, height: 326 },
      { width: 581, height: 798 },
    ];
    const pdf = mockPDF(2, config);
    const dims = await getFirstPageDimensions(pdf);
    expect(dims.width).toBe(252);
    expect(dims.height).toBe(326);
  });
});
