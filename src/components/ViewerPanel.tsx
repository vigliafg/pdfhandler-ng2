import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { renderPageToCanvas, getFirstPageDimensions, clearPageDimensionsCache } from '../../src/lib/pdfRenderer';
import type { PDFDocument } from '../../src/lib/pdfRenderer';

type ViewMode = 'single' | 'double' | 'triple';

interface ViewerPanelProps {
  pdf: PDFDocument;
  numPages: number;
  scrollToPage?: number | null;
  onCurrentPageChange?: (page: number) => void;
}

const PAGE_GAP = 12;
const COL_GAP = 10;
const POOL_SIZE = 12;

const LAYOUT_MODES: { id: ViewMode; label: string; icon: string }[] = [
  { id: 'single', label: 'Single', icon: 'M4 4h16v16H4z' },
  { id: 'double', label: 'Double', icon: 'M4 4h7v16H4z M13 4h7v16h-7z' },
  { id: 'triple', label: '3-Col', icon: 'M4 4h4v16H4z M10 4h4v16h-4z M16 4h4v16h-4z' },
];

// ── ViewerPanel ────────────────────────────────────────────

export function ViewerPanel({ pdf, numPages, scrollToPage, onCurrentPageChange }: ViewerPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pageWidth, setPageWidth] = useState(595);
  const [pageHeight, setPageHeight] = useState(842);
  const [containerWidth, setContainerWidth] = useState(400);
  const [loaded, setLoaded] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>('single');
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [fitMode, setFitMode] = useState<'width' | 'auto'>('width');
  const lastReportedPageRef = useRef(1);
  const lastHandledScrollToRef = useRef<number | null>(null);

  const cols = viewMode === 'single' ? 1 : viewMode === 'double' ? 2 : 3;

  // ── Init: get dimensions ─────────────────────────────────
  useEffect(() => {
    clearPageDimensionsCache();
    getFirstPageDimensions(pdf).then((dims) => {
      setPageWidth(dims.width);
      setPageHeight(dims.height);
      setLoaded(true);
    });
    return () => { clearPageDimensionsCache(); };
  }, [pdf]);

  // ── Container width ──────────────────────────────────────
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setContainerWidth(entry.contentRect.width);
    });
    ro.observe(el);
    setContainerWidth(el.clientWidth);
    return () => ro.disconnect();
  }, [loaded]);

  // ── Fit-to-width scale helper ────────────────────────────
  const fitScale = useCallback((cw: number, c: number, pw: number): number => {
    const pad = c === 1 ? 32 : 8;
    return (cw - pad - (c - 1) * COL_GAP) / (c * pw);
  }, []);

  // ── Compute scale ────────────────────────────────────────
  const effectiveScale = useMemo(() => {
    if (fitMode === 'width') return fitScale(containerWidth, cols, pageWidth);
    return Math.min(zoom / 100, fitScale(containerWidth, cols, pageWidth) * 4);
  }, [containerWidth, pageWidth, zoom, fitMode, cols, fitScale]);

  const rowH = pageHeight * effectiveScale + PAGE_GAP;
  const totalRows = Math.ceil(numPages / cols);
  const totalHeight = loaded ? totalRows * rowH : 0;
  const containerW = cols * pageWidth * effectiveScale + (cols - 1) * COL_GAP + 32;

  // ── Scroll-to-page ───────────────────────────────────────
  useEffect(() => {
    if (scrollToPage == null || !loaded || !scrollRef.current) return;
    if (scrollToPage === lastHandledScrollToRef.current) return;
    const p = Math.max(1, Math.min(scrollToPage, numPages));
    const row = Math.floor((p - 1) / cols);
    const target = row * rowH;
    if (Math.abs(scrollRef.current.scrollTop - target) < 2) return;
    lastHandledScrollToRef.current = scrollToPage;
    scrollRef.current.scrollTop = target;
    setCurrentPage(p);
    lastReportedPageRef.current = p;
  }, [scrollToPage, loaded, numPages, cols, rowH]);

  // ── Scroll handler: track current page ───────────────────
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const mid = scrollRef.current.scrollTop + scrollRef.current.clientHeight / 2;
    const midRow = Math.floor(mid / rowH);
    const p = Math.max(1, Math.min(midRow * cols + 1, numPages));
    if (p !== lastReportedPageRef.current) {
      lastReportedPageRef.current = p;
      setCurrentPage(p);
      onCurrentPageChange?.(p);
    }
  }, [rowH, cols, numPages, onCurrentPageChange]);

  // ── Zoom controls ────────────────────────────────────────
  const zoomIn  = () => { setFitMode('auto'); setZoom(z => Math.min(400, z + 25)); };
  const zoomOut = () => { setFitMode('auto'); setZoom(z => Math.max(25, z - 25)); };
  const handleFitWidth = () => setFitMode('width');

  // ── Rotation ─────────────────────────────────────────────
  const rotateCW  = () => setRotation(r => (r + 90) % 360);
  const rotateCCW = () => setRotation(r => (r + 270) % 360);

  // ── Page navigation ──────────────────────────────────────
  const goToPage = useCallback((page: number) => {
    const p = Math.max(1, Math.min(page, numPages));
    const row = Math.floor((p - 1) / cols);
    if (scrollRef.current) scrollRef.current.scrollTop = row * rowH;
    setCurrentPage(p);
    lastReportedPageRef.current = p;
  }, [numPages, cols, rowH]);
  const prevPage = () => goToPage(currentPage - cols);
  const nextPage = () => goToPage(currentPage + cols);

  if (!loaded) {
    return (
      <div className="flex-1 flex items-center justify-center" ref={containerRef}>
        <div className="w-8 h-8 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 flex flex-col overflow-hidden bg-zinc-950">
      {/* ── Toolbar — responsive touch targets (min 44px) ── */}
      <div className="flex items-center gap-1 md:gap-1.5 px-2 py-1.5 bg-zinc-900 border-b border-zinc-800 shrink-0 overflow-x-auto scrollbar-thin">

        {/* Layout mode: Single / Double / Triple */}
        <div className="flex items-center bg-zinc-800 rounded-lg p-0.5 border border-zinc-700 shrink-0">
          {LAYOUT_MODES.map(lm => (
            <button key={lm.id} onClick={() => { setViewMode(lm.id); setFitMode('width'); }}
              className={`min-w-[44px] min-h-[44px] px-1.5 py-0.5 rounded-md transition-all ${
                viewMode === lm.id ? 'bg-zinc-100 text-zinc-900 shadow-sm' : 'text-zinc-400 hover:text-zinc-200 active:bg-zinc-700'
              }`}
              title={lm.label} aria-label={lm.label}>
              <svg className="w-4 h-4 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d={lm.icon} />
              </svg>
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-zinc-700 shrink-0" />

        {/* Zoom out */}
        <button onClick={zoomOut} className="min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-400 hover:text-zinc-200 rounded-lg transition-colors active:bg-zinc-700 shrink-0" title="Zoom out" aria-label="Zoom out">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" d="M5 12h14"/></svg>
        </button>

        {/* Zoom percentage / Fit toggle */}
        <button onClick={() => setFitMode(f => f === 'width' ? 'auto' : 'width')}
          className="min-h-[44px] px-1.5 text-xs tabular-nums text-zinc-300 text-center select-none font-mono rounded-lg hover:bg-zinc-800 active:bg-zinc-700 shrink-0"
          title={fitMode === 'width' ? 'Fit width (click for manual)' : 'Click to fit width'}>
          {fitMode === 'width' ? 'Fit' : `${Math.round(effectiveScale * 100)}%`}
        </button>

        {/* Zoom in */}
        <button onClick={zoomIn} className="min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-400 hover:text-zinc-200 rounded-lg transition-colors active:bg-zinc-700 shrink-0" title="Zoom in" aria-label="Zoom in">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" d="M12 5v14M5 12h14"/></svg>
        </button>

        <div className="w-px h-5 bg-zinc-700 shrink-0" />

        {/* Fit width */}
        <button onClick={handleFitWidth}
          className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg transition-colors active:bg-zinc-700 shrink-0 ${
            fitMode === 'width' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
          }`} title="Fit width" aria-label="Fit to width">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/>
          </svg>
        </button>

        <div className="w-px h-5 bg-zinc-700 shrink-0" />

        {/* Rotate CCW */}
        <button onClick={rotateCCW} className="min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-400 hover:text-zinc-200 rounded-lg transition-colors active:bg-zinc-700 shrink-0" title="Rotate left" aria-label="Rotate left">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a5 5 0 015 5v2M3 10l4-4M3 10l4 4"/></svg>
        </button>

        {/* Rotate CW */}
        <button onClick={rotateCW} className="min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-400 hover:text-zinc-200 rounded-lg transition-colors active:bg-zinc-700 shrink-0" title="Rotate right" aria-label="Rotate right">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 10H11a5 5 0 00-5 5v2m15-7l-4-4m4 4l-4 4"/></svg>
        </button>

        <div className="flex-1" />

        {/* Page navigation */}
        <button onClick={prevPage} disabled={currentPage <= 1}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-400 hover:text-zinc-200 rounded-lg transition-colors disabled:opacity-30 active:bg-zinc-700 shrink-0" title="Previous" aria-label="Previous page">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
        </button>

        <span className="text-xs tabular-nums text-zinc-400 whitespace-nowrap select-none shrink-0">{currentPage} / {numPages}</span>

        <button onClick={nextPage} disabled={currentPage >= numPages}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-400 hover:text-zinc-200 rounded-lg transition-colors disabled:opacity-30 active:bg-zinc-700 shrink-0" title="Next" aria-label="Next page">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
        </button>

        {/* Page jump input */}
        <PageJumpInput onGo={goToPage} numPages={numPages} />
      </div>

      {/* ── Scrollable pages ──────────────────────────────── */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-auto scrollbar-thin bg-zinc-900">
        <div
          className="relative mx-auto"
          style={{
            width: containerW,
            height: totalHeight,
            transform: rotation ? `rotate(${rotation}deg)` : undefined,
            transformOrigin: 'center top',
          }}
        >
          <PageRenderer
            pdf={pdf}
            numPages={numPages}
            rowH={rowH}
            pageWidth={pageWidth}
            scale={effectiveScale}
            cols={cols}
            scrollRef={scrollRef}
          />
        </div>
      </div>
    </div>
  );
}

// ── Page jump input ────────────────────────────────────────

function PageJumpInput({ onGo, numPages }: { onGo: (p: number) => void; numPages: number }) {
  const [val, setVal] = useState('');
  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const n = parseInt(val, 10);
      if (n >= 1 && n <= numPages) { onGo(n); setVal(''); }
    }
  };
  return (
    <input type="number" min={1} max={numPages} value={val}
      onChange={e => setVal(e.target.value)} onKeyDown={handleKey}
      placeholder={`1-${numPages}`}
      className="w-10 h-8 px-1 text-[11px] font-mono bg-zinc-800 border border-zinc-700 rounded-md text-zinc-200 text-center focus:outline-none focus:border-blue-500 placeholder:text-zinc-600" />
  );
}

// ── Page renderer (canvas pool, multi-column) ──────────────

function PageRenderer({ pdf, numPages, rowH, pageWidth, scale, cols, scrollRef }: {
  pdf: PDFDocument; numPages: number; rowH: number; pageWidth: number; scale: number; cols: number; scrollRef: React.RefObject<HTMLDivElement | null>;
}) {
  const poolRef = useRef<HTMLCanvasElement[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!containerRef.current) return;
    // Clean old canvases
    poolRef.current.forEach(c => c.remove());
    poolRef.current = [];
    renderedRef.current.clear();

    for (let i = 0; i < POOL_SIZE; i++) {
      const canvas = document.createElement('canvas');
      canvas.style.position = 'absolute';
      canvas.style.display = 'none';
      canvas.style.boxShadow = '0 1px 3px rgba(0,0,0,0.4)';
      canvas.style.background = '#fff';
      containerRef.current.appendChild(canvas);
      poolRef.current.push(canvas);
    }

    renderVisible();
  }, [scale, numPages, rowH, cols]);

  // ── Stable refs to avoid re-attaching scroll listener ───
  const renderVisibleRef = useRef<() => void>(() => {});

  const renderVisible = useCallback(() => {
    // Compute derived values inside to avoid unstable deps
    const cW = pageWidth * scale;
    const cH = rowH - PAGE_GAP;
    const cStep = cW + COL_GAP;

    if (!scrollRef.current || !containerRef.current) return;
    const scrollTop = scrollRef.current.scrollTop;
    const viewH = scrollRef.current.clientHeight;
    const buffer = 1;

    const visibleRowStart = Math.max(0, Math.floor(scrollTop / rowH) - buffer);
    const visibleRowEnd = Math.min(Math.ceil(numPages / cols) - 1, Math.ceil((scrollTop + viewH) / rowH) + buffer);
    const visibleStartPage = visibleRowStart * cols;
    const visibleEndPage = Math.min(numPages - 1, (visibleRowEnd + 1) * cols - 1);

    const pool = poolRef.current;
    if (pool.length === 0) return;

    // Build visible set
    const visibleSet = new Set<number>();
    for (let i = visibleStartPage; i <= visibleEndPage; i++) visibleSet.add(i);

    // Find free slots
    const freeSlots = pool.filter(s => !visibleSet.has((s as any).__page));

    // Hide canvases not needed
    pool.forEach(c => {
      const page = (c as any).__page;
      if (page !== undefined && !visibleSet.has(page)) {
        c.style.display = 'none';
        (c as any).__page = undefined;
      }
    });

    // Assign free slots to new pages
    let fi = 0;
    for (let p = visibleStartPage; p <= visibleEndPage && fi < freeSlots.length; p++) {
      if (pool.some(c => (c as any).__page === p)) continue;
      const canvas = freeSlots[fi++];
      (canvas as any).__page = p;
      renderedRef.current.add(p);

      const row = Math.floor(p / cols);
      const col = p % cols;
      canvas.style.left = `${16 + col * cStep}px`;
      canvas.style.top = `${row * rowH}px`;
      canvas.style.width = `${cW}px`;
      canvas.style.height = `${cH}px`;
      canvas.style.display = 'block';

      renderPageToCanvas(pdf, p + 1, canvas, scale).catch(() => {});
    }
  }, [pdf, scale, rowH, numPages, cols, scrollRef, pageWidth]);

  // ── Keep renderVisibleRef in sync ──
  renderVisibleRef.current = renderVisible;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = () => renderVisibleRef.current();
    el.addEventListener('scroll', handler, { passive: true });
    return () => el.removeEventListener('scroll', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} className="relative w-full" style={{ height: '100%' }} />;
}
