import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { renderPageToCanvas, getFirstPageDimensions, clearPageDimensionsCache } from '../lib/pdfRenderer';
import type { PDFDocument } from '../lib/pdfRenderer';

type LayoutMode = 'single' | 'double' | 'triple' | 'grid';

interface UnifiedViewerProps {
  pdf: PDFDocument;
  numPages: number;
  scrollToPage?: number | null;
  onCurrentPageChange?: (page: number) => void;
  // Selection — controlled by parent
  selectMode: boolean;
  onSelectModeChange: (active: boolean) => void;
  selectedPages: Set<number>;
  selectedCount: number;
  onTogglePage: (pageNum: number) => void;
  onRangeSelect: (start: number, end: number) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onViewPage?: (pageNum: number) => void;
  initialPage?: number;
  // Reorder mode
  isReorderMode: boolean;
  pageOrder: number[];
  onReorderSwap?: (pageA: number, pageB: number) => void;
}

const PAGE_GAP = 12;
const COL_GAP = 10;
const POOL_SIZE = 12;
const GRID_PAGE_GAP = 4;

const LAYOUT_MODES: { id: LayoutMode; label: string; icon: string }[] = [
  { id: 'single', label: 'Single', icon: 'M4 4h16v16H4z' },
  { id: 'double', label: 'Double', icon: 'M4 4h7v16H4z M13 4h7v16h-7z' },
  { id: 'triple', label: '3-Col', icon: 'M4 4h4v16H4z M10 4h4v16h-4z M16 4h4v16h-4z' },
  { id: 'grid', label: 'Grid', icon: 'M4 4h4v7H4z M10 4h4v7h-4z M16 4h4v7h-4z M4 13h4v7H4z M10 13h4v7h-4z M16 13h4v7h-4z' },
];

// ── UnifiedViewer ───────────────────────────────────────────

export function UnifiedViewer({
  pdf, numPages, scrollToPage, onCurrentPageChange,
  selectMode, onSelectModeChange,
  selectedPages, selectedCount, onTogglePage, onRangeSelect,
  onSelectAll, onDeselectAll, onViewPage, initialPage,
  isReorderMode, pageOrder, onReorderSwap,
}: UnifiedViewerProps) {
  const { isMobile } = useResponsiveLayout();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pageWidth, setPageWidth] = useState(595);
  const [pageHeight, setPageHeight] = useState(842);
  const [containerWidth, setContainerWidth] = useState(400);
  const [loaded, setLoaded] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [layout, setLayout] = useState<LayoutMode>(isMobile ? 'single' : 'single');
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [fitMode, setFitMode] = useState<'width' | 'auto'>('width');
  const [gridCols, setGridCols] = useState(isMobile ? 3 : 5);
  const [swapPageA, setSwapPageA] = useState('');
  const [swapPageB, setSwapPageB] = useState('');
  const lastReportedPageRef = useRef(1);
  const lastHandledScrollToRef = useRef<number | null>(null);

  const isGrid = layout === 'grid';
  const cols = isGrid ? gridCols : layout === 'single' ? 1 : layout === 'double' ? 2 : 3;

  const swapANum = parseInt(swapPageA, 10);
  const swapBNum = parseInt(swapPageB, 10);
  const canSwap = !isNaN(swapANum) && swapANum >= 1 && swapANum <= numPages &&
    !isNaN(swapBNum) && swapBNum >= 1 && swapBNum <= numPages && swapANum !== swapBNum;

  // ── Init ──────────────────────────────────────────────────
  useEffect(() => {
    clearPageDimensionsCache();
    getFirstPageDimensions(pdf).then((dims) => {
      setPageWidth(dims.width);
      setPageHeight(dims.height);
      setLoaded(true);
    });
    return () => { clearPageDimensionsCache(); };
  }, [pdf]);

  // ── Container width (float-precision, stable observer) ────
  const isGridRef = useRef(isGrid);
  isGridRef.current = isGrid;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      if (!scrollRef.current) return;
      // Grid: getBoundingClientRect includes scrollbar area (edge-to-edge fill)
      // Non-grid: contentRect.width gives float precision for fit-to-width
      setContainerWidth(isGridRef.current
        ? scrollRef.current.getBoundingClientRect().width
        : entries[0]?.contentRect.width ?? scrollRef.current.clientWidth);
    });
    ro.observe(el);
    // Initial measure
    if (scrollRef.current) {
      setContainerWidth(isGridRef.current
        ? scrollRef.current.getBoundingClientRect().width
        : scrollRef.current.clientWidth);
    }
    return () => ro.disconnect();
  }, [loaded]);

  // ── Scale ────────────────────────────────────────────────
  const fitScale = useCallback((cw: number, c: number, pw: number): number => {
    if (isGrid) return cw / (c * pw);
    const pad = c === 1 ? 32 : 8;
    return (cw - pad - (c - 1) * COL_GAP) / (c * pw);
  }, [isGrid]);

  const effectiveScale = useMemo(() => {
    if (isGrid) return fitScale(containerWidth, cols, pageWidth);
    if (fitMode === 'width') return fitScale(containerWidth, cols, pageWidth);
    return Math.min(zoom / 100, fitScale(containerWidth, cols, pageWidth) * 4);
  }, [containerWidth, pageWidth, zoom, fitMode, cols, fitScale, isGrid]);

  const rowH = isGrid
    ? pageHeight * effectiveScale + GRID_PAGE_GAP
    : pageHeight * effectiveScale + PAGE_GAP;
  const totalRows = Math.ceil(numPages / cols);
  const totalHeight = loaded ? totalRows * rowH : 0;
  const containerW = isGrid
    ? cols * pageWidth * effectiveScale
    : cols * pageWidth * effectiveScale + (cols - 1) * COL_GAP + 32;

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

  // ── Scroll handler ───────────────────────────────────────
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

  // ── Selection handling ───────────────────────────────────
  const lastClickedRef = useRef<number | null>(null);

  const toggleSelectMode = () => {
    if (selectMode) {
      onSelectModeChange(false);
      onDeselectAll();
    } else {
      onSelectModeChange(true);
    }
  };

  // ── Reorder: scroll to initial page once ─────────────────
  const scrolledToInitialRef = useRef(false);
  useEffect(() => {
    if (!loaded || !scrollRef.current || initialPage == null || scrolledToInitialRef.current) return;
    if (containerWidth <= 0) return;
    scrolledToInitialRef.current = true;
    const row = Math.floor((initialPage - 1) / cols);
    scrollRef.current.scrollTop = row * rowH;
  }, [loaded, initialPage, cols, rowH, containerWidth]);

  if (!loaded) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
      </div>
    );
  }

  const displayOrder = isReorderMode ? pageOrder : Array.from({ length: numPages }, (_, i) => i + 1);

  const zoomLabel = isGrid ? `${Math.round(effectiveScale * 100)}%` : fitMode === 'width' ? 'Fit' : `${Math.round(effectiveScale * 100)}%`;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-zinc-950">
      {/* ── Unified Toolbar ────────────────────────────────── */}
      <div className="flex items-center gap-1 md:gap-1.5 px-2 py-1.5 bg-zinc-900 border-b border-zinc-800 shrink-0 overflow-x-auto scrollbar-thin">

        {/* Layout mode */}
        <div className="flex items-center bg-zinc-800 rounded-lg p-0.5 border border-zinc-700 shrink-0">
          {LAYOUT_MODES.map(lm => (
            <button key={lm.id} onClick={() => { setLayout(lm.id); setFitMode('width'); }}
              className={`min-w-[44px] min-h-[44px] px-1.5 py-0.5 rounded-md transition-all ${
                layout === lm.id ? 'bg-zinc-100 text-zinc-900 shadow-sm' : 'text-zinc-400 hover:text-zinc-200 active:bg-zinc-700'
              }`}
              title={lm.label} aria-label={lm.label}>
              <svg className="w-4 h-4 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d={lm.icon} />
              </svg>
            </button>
          ))}
        </div>

        {/* Grid columns (only in grid mode) */}
        {isGrid && (
          <div className="flex items-center bg-zinc-800 rounded-lg p-0.5 border border-zinc-700 shrink-0">
            {(isMobile ? [2, 3, 4] : [3, 4, 5, 6]).map(n => (
              <button key={n} onClick={() => setGridCols(n)}
                className={`min-w-[36px] min-h-[36px] px-2 py-1 text-xs font-semibold rounded-md transition-all ${
                  gridCols === n ? 'bg-zinc-100 text-zinc-900 shadow-sm' : 'text-zinc-400 hover:text-zinc-200 active:bg-zinc-700'
                }`}>{n}</button>
            ))}
          </div>
        )}
        {isGrid && <div className="w-px h-5 bg-zinc-700 shrink-0" />}

        {/* Zoom (hidden in grid mode) */}
        {!isGrid && <>
          <button onClick={zoomOut} className="min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-400 hover:text-zinc-200 rounded-lg transition-colors active:bg-zinc-700 shrink-0" title="Zoom out" aria-label="Zoom out">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" d="M5 12h14"/></svg>
          </button>
          <button onClick={() => setFitMode(f => f === 'width' ? 'auto' : 'width')}
            className="min-h-[44px] px-1.5 text-xs tabular-nums text-zinc-300 text-center select-none font-mono rounded-lg hover:bg-zinc-800 active:bg-zinc-700 shrink-0">
            {zoomLabel}
          </button>
          <button onClick={zoomIn} className="min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-400 hover:text-zinc-200 rounded-lg transition-colors active:bg-zinc-700 shrink-0" title="Zoom in" aria-label="Zoom in">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" d="M12 5v14M5 12h14"/></svg>
          </button>
          <div className="w-px h-5 bg-zinc-700 shrink-0" />
          <button onClick={handleFitWidth}
            className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg transition-colors active:bg-zinc-700 shrink-0 ${
              fitMode === 'width' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
            }`} title="Fit width" aria-label="Fit to width">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/>
            </svg>
          </button>
        </>}

        {/* Rotation */}
        {!isGrid && <>
          <div className="w-px h-5 bg-zinc-700 shrink-0" />
          <button onClick={rotateCCW} className="min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-400 hover:text-zinc-200 rounded-lg transition-colors active:bg-zinc-700 shrink-0" title="Rotate left" aria-label="Rotate left">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a5 5 0 015 5v2M3 10l4-4M3 10l4 4"/></svg>
          </button>
          <button onClick={rotateCW} className="min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-400 hover:text-zinc-200 rounded-lg transition-colors active:bg-zinc-700 shrink-0" title="Rotate right" aria-label="Rotate right">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 10H11a5 5 0 00-5 5v2m15-7l-4-4m4 4l-4 4"/></svg>
          </button>
        </>}

        <div className={isGrid ? 'flex-1' : 'w-px h-5 bg-zinc-700 shrink-0'} />

        {/* ── SELECT toggle ─────────────────────────────────── */}
        <button onClick={toggleSelectMode}
          className={`min-h-[44px] px-3 py-1 text-xs font-semibold rounded-lg transition-all shrink-0 border ${
            selectMode
              ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/20'
              : 'text-zinc-400 border-zinc-700 hover:text-zinc-200 hover:border-zinc-600 active:bg-zinc-700'
          }`}>
          ✂️ Select
        </button>

        {/* Selection actions (visible when selectMode is active) */}
        {selectMode && (
          <>
            {selectedCount > 0 && (
              <span className="text-xs text-blue-400 font-semibold tabular-nums shrink-0">{selectedCount} sel.</span>
            )}
            <button onClick={onSelectAll} className="min-w-[44px] min-h-[36px] px-2 py-1 text-xs font-semibold text-zinc-300 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 rounded-lg transition-colors shrink-0">All</button>
            <button onClick={onDeselectAll} disabled={selectedCount === 0}
              className="min-w-[44px] min-h-[36px] px-2 py-1 text-xs font-semibold text-zinc-300 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 rounded-lg transition-colors disabled:opacity-30 shrink-0">None</button>
          </>
        )}

        {/* Reorder swap controls */}
        {isReorderMode && (
          <>
            <div className="w-px h-5 bg-zinc-700 shrink-0" />
            <input type="number" min={1} max={numPages} value={swapPageA} onChange={e => setSwapPageA(e.target.value)}
              placeholder="A" className="w-14 h-9 px-2 text-sm font-mono bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 text-center shrink-0 focus:outline-none focus:border-amber-500" />
            <svg className="w-4 h-4 text-zinc-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            <input type="number" min={1} max={numPages} value={swapPageB} onChange={e => setSwapPageB(e.target.value)}
              placeholder="B" className="w-14 h-9 px-2 text-sm font-mono bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 text-center shrink-0 focus:outline-none focus:border-amber-500" />
            <button onClick={() => { if (canSwap && onReorderSwap) { onReorderSwap(swapANum, swapBNum); setSwapPageA(''); setSwapPageB(''); } }}
              disabled={!canSwap}
              className="h-9 px-3 text-xs font-semibold text-amber-300 bg-amber-600/20 hover:bg-amber-600/30 active:bg-amber-600/40 border border-amber-600/30 rounded-lg disabled:opacity-30 shrink-0 transition-colors">
              Swap
            </button>
          </>
        )}

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
        <PageJumpInput onGo={goToPage} numPages={numPages} />
      </div>

      {/* ── Pages area ──────────────────────────────────────── */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-auto scrollbar-thin bg-zinc-900">
        <div
          className="relative mx-auto"
          style={{
            width: isGrid ? containerWidth : containerW,
            height: totalHeight,
            transform: rotation && !isGrid ? `rotate(${rotation}deg)` : undefined,
            transformOrigin: 'center top',
          }}
        >
          {isGrid ? (
            <GridView
              displayOrder={displayOrder}
              cols={gridCols}
              pageWidth={pageWidth}
              pageHeight={pageHeight}
              scale={effectiveScale}
              pdf={pdf}
              selectedPages={selectedPages}
              selectMode={selectMode}
              isReorderMode={isReorderMode}
              onTogglePage={onTogglePage}
              onRangeSelect={onRangeSelect}
              onViewPage={onViewPage}
              lastClickedRef={lastClickedRef}
            />
          ) : (
            <PageView
              pdf={pdf}
              numPages={numPages}
              cols={cols}
              rowH={rowH}
              pageWidth={pageWidth}
              scale={effectiveScale}
              scrollRef={scrollRef}
              selectedPages={selectedPages}
              selectMode={selectMode}
              isReorderMode={isReorderMode}
              displayOrder={displayOrder}
              onTogglePage={onTogglePage}
              onRangeSelect={onRangeSelect}
              onViewPage={onViewPage}
              lastClickedRef={lastClickedRef}
            />
          )}
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

// ── Page View (full-page rendering, single/double/triple) ──

function PageView({
  pdf, numPages, cols, rowH, pageWidth, scale, scrollRef,
  selectedPages, selectMode, isReorderMode, displayOrder,
  onTogglePage, onRangeSelect, onViewPage, lastClickedRef,
}: {
  pdf: PDFDocument; numPages: number; cols: number; rowH: number;
  pageWidth: number; scale: number; scrollRef: React.RefObject<HTMLDivElement | null>;
  selectedPages: Set<number>; selectMode: boolean; isReorderMode: boolean;
  displayOrder: number[];
  onTogglePage: (p: number) => void; onRangeSelect: (s: number, e: number) => void;
  onViewPage?: (p: number) => void; lastClickedRef: React.MutableRefObject<number | null>;
}) {
  const poolRef = useRef<HTMLCanvasElement[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderedRef = useRef<Set<number>>(new Set());

  const canvasW = pageWidth * scale;
  const canvasH = rowH - PAGE_GAP;
  const colStep = canvasW + COL_GAP;

  useEffect(() => {
    if (!containerRef.current) return;
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
    doRender();
  }, [scale, numPages, rowH, cols]);

  const doRender = useCallback(() => {
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
    const visibleSet = new Set<number>();
    for (let i = visibleStartPage; i <= visibleEndPage; i++) visibleSet.add(i);

    const freeSlots = pool.filter(s => !visibleSet.has((s as any).__page));
    pool.forEach(c => {
      const page = (c as any).__page;
      if (page !== undefined && !visibleSet.has(page)) {
        c.style.display = 'none';
        (c as any).__page = undefined;
      }
    });

    let fi = 0;
    for (let p = visibleStartPage; p <= visibleEndPage && fi < freeSlots.length; p++) {
      if (pool.some(c => (c as any).__page === p)) continue;
      const canvas = freeSlots[fi++];
      (canvas as any).__page = p;
      renderedRef.current.add(p);
      const row = Math.floor(p / cols);
      const col = p % cols;
      canvas.style.left = `${16 + col * colStep}px`;
      canvas.style.top = `${row * rowH}px`;
      canvas.style.width = `${canvasW}px`;
      canvas.style.height = `${canvasH}px`;
      canvas.style.display = 'block';
      renderPageToCanvas(pdf, p + 1, canvas, scale).catch(() => {});
    }
  }, [pdf, scale, rowH, numPages, cols, scrollRef, canvasW, canvasH, colStep]);

  const doRenderRef = useRef(doRender);
  doRenderRef.current = doRender;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = () => doRenderRef.current();
    el.addEventListener('scroll', handler, { passive: true });
    return () => el.removeEventListener('scroll', handler);
  }, []);

  const handleClick = (pageNum: number, e: React.MouseEvent) => {
    if (isReorderMode) return;
    if (!selectMode) { onViewPage?.(pageNum); return; }
    if (e.shiftKey && lastClickedRef.current !== null) {
      onRangeSelect(lastClickedRef.current, pageNum);
    } else {
      onTogglePage(pageNum);
      lastClickedRef.current = pageNum;
    }
  };

  return (
    <div ref={containerRef} className="relative w-full" style={{ height: '100%' }}>
      {/* Selection overlays */}
      {selectMode && Array.from({ length: numPages }, (_, i) => {
        const pageNum = displayOrder[i];
        const row = Math.floor(i / cols);
        const col = i % cols;
        const selected = selectedPages.has(pageNum);
        if (!selected) return null;
        return (
          <div key={`sel-${pageNum}`}
            className="absolute pointer-events-none z-10"
            style={{
              left: `${16 + col * colStep}px`,
              top: `${row * rowH}px`,
              width: `${canvasW}px`,
              height: `${canvasH}px`,
            }}>
            <div className="absolute inset-0 bg-blue-500/15 border-2 border-blue-500 rounded-sm" />
            <div className="absolute top-2 left-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center shadow">
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
        );
      })}
      {/* Clickable overlay for selection */}
      {selectMode && Array.from({ length: numPages }, (_, i) => {
        const pageNum = displayOrder[i];
        const row = Math.floor(i / cols);
        const col = i % cols;
        return (
          <div key={`click-${pageNum}`}
            onClick={(e) => handleClick(pageNum, e)}
            className="absolute cursor-pointer z-20"
            style={{
              left: `${16 + col * colStep}px`,
              top: `${row * rowH}px`,
              width: `${canvasW}px`,
              height: `${canvasH}px`,
            }}
          />
        );
      })}
    </div>
  );
}

// ── Grid View (thumbnail grid, replaces EditorPanel) ────────

function GridView({
  displayOrder, cols, pageWidth, pageHeight, scale, pdf,
  selectedPages, selectMode, isReorderMode, onTogglePage, onRangeSelect,
  onViewPage, lastClickedRef,
}: {
  displayOrder: number[]; cols: number;
  pageWidth: number; pageHeight: number; scale: number;
  pdf: PDFDocument; selectedPages: Set<number>; selectMode: boolean;
  isReorderMode: boolean;
  onTogglePage: (p: number) => void; onRangeSelect: (s: number, e: number) => void;
  onViewPage?: (p: number) => void; lastClickedRef: React.MutableRefObject<number | null>;
}) {
  const handleClick = (pageNum: number, e: React.MouseEvent) => {
    if (isReorderMode) return;
    if (!selectMode) { onViewPage?.(pageNum); return; }
    if (e.shiftKey && lastClickedRef.current !== null) {
      onRangeSelect(lastClickedRef.current, pageNum);
    } else {
      onTogglePage(pageNum);
      lastClickedRef.current = pageNum;
    }
  };

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
      columnGap: 0,
      rowGap: `${GRID_PAGE_GAP}px`,
      width: '100%',
    }}>
      {displayOrder.map((pageNum, idx) => (
        <div key={`${pageNum}-${idx}`}
          onClick={(e) => handleClick(pageNum, e)}
          className={`relative cursor-pointer overflow-hidden transition-all duration-150 border-2 ${
            isReorderMode
              ? 'border-zinc-700 hover:border-amber-500/50'
              : selectMode && selectedPages.has(pageNum)
                ? 'border-blue-500 shadow-md shadow-blue-500/20 scale-[0.97] z-10'
                : 'border-transparent hover:border-zinc-600'
          }`}
          style={{ width: '100%', aspectRatio: `${pageWidth}/${pageHeight}` }}
        >
          <GridCanvas pdf={pdf} pageNumber={pageNum} scale={scale} />
          <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-zinc-800/90 rounded-full">
            <span className="text-[9px] font-medium tabular-nums text-zinc-400">{pageNum}</span>
          </div>
          {selectMode && selectedPages.has(pageNum) && (
            <div className="absolute top-1 left-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center shadow">
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function GridCanvas({ pdf, pageNumber, scale }: { pdf: PDFDocument; pageNumber: number; scale: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderedRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || renderedRef.current) return;
    renderedRef.current = true;
    renderPageToCanvas(pdf, pageNumber, canvas, scale).catch(() => {});
  }, [pdf, pageNumber, scale]);

  return <canvas ref={canvasRef} className="block bg-white w-full h-full" />;
}
