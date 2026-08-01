import { useState, useCallback, useRef, useEffect, useMemo, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { getModalPageDimensions, clearPageDimensionsCache } from '../lib/pdfRenderer';
import { renderPageWithCache, clearBitmapCache } from '../lib/bitmapCache';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { PDFDocument } from '../lib/pdfRenderer';

type PagesPerRow = 1 | 2 | 3 | 4 | 5 | 6;

interface UnifiedViewerProps {
  pdf: PDFDocument;
  numPages: number;
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
  rotation: number;
  onRotateCW: () => void;
  onRotateCCW: () => void;
  // Imperative navigate — populated with goToPage, same function the "go to page" box uses
  goToPageRef?: React.MutableRefObject<((page: number) => void) | null>;
}

const PAGE_GAP = 12;
const COL_GAP = 10;
const POOL_SIZE = 12;
const GRID_PAGE_GAP = 4;

const PAGE_ICONS: Record<number, string> = {
  1: 'M4 4h16v16H4z',
  2: 'M4 4h7v16H4z M13 4h7v16h-7z',
  3: 'M4 4h4v16H4z M10 4h4v16h-4z M16 4h4v16h-4z',
};

// ── UnifiedViewer ───────────────────────────────────────────

export function UnifiedViewer({
  pdf, numPages, onCurrentPageChange,
  selectMode, onSelectModeChange,
  selectedPages, selectedCount, onTogglePage, onRangeSelect,
  onSelectAll, onDeselectAll, onViewPage, initialPage,
  isReorderMode, pageOrder,
  rotation, onRotateCW, onRotateCCW,
  goToPageRef,
}: UnifiedViewerProps) {
  const { isCompact } = useResponsiveLayout();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pageWidth, setPageWidth] = useState(595);
  const [pageHeight, setPageHeight] = useState(842);
  const [containerWidth, setContainerWidth] = useState(400);
  const [loaded, setLoaded] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagesPerRow, setPagesPerRow] = useState<PagesPerRow>(1);
  const [zoom, setZoom] = useState(100);
  const [fitMode, setFitMode] = useState<'width' | 'auto'>('width');
  const lastReportedPageRef = useRef(1);

  const isGrid = pagesPerRow >= 4;
  const cols = pagesPerRow;

  // ── Init ──────────────────────────────────────────────────
  useEffect(() => {
    clearPageDimensionsCache();
    clearBitmapCache();
    getModalPageDimensions(pdf).then((dims) => {
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
    let timer: ReturnType<typeof setTimeout> | null = null;
    const ro = new ResizeObserver((entries) => {
      if (!scrollRef.current) return;
      // Debounce to batch rapid resize events (e.g. smooth window drag)
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        setContainerWidth(isGridRef.current
          ? scrollRef.current!.getBoundingClientRect().width
          : entries[0]?.contentRect.width ?? scrollRef.current!.clientWidth);
      }, 50);
    });
    ro.observe(el);
    // Initial measure (no debounce)
    if (scrollRef.current) {
      setContainerWidth(isGridRef.current
        ? scrollRef.current.getBoundingClientRect().width
        : scrollRef.current.clientWidth);
    }
    return () => { ro.disconnect(); if (timer) clearTimeout(timer); };
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

  // ── Page navigation ──────────────────────────────────────
  const goToPage = useCallback((page: number) => {
    const p = Math.max(1, Math.min(page, numPages));
    const row = Math.floor((p - 1) / cols);
    if (scrollRef.current) scrollRef.current.scrollTop = row * rowH;
    setCurrentPage(p);
    lastReportedPageRef.current = p;
  }, [numPages, cols, rowH]);

  // Expose goToPage so TOC navigation works exactly like the "go to page" box
  useEffect(() => {
    if (goToPageRef) goToPageRef.current = goToPage;
    return () => { if (goToPageRef) goToPageRef.current = null; };
  }, [goToPage, goToPageRef]);

  // ── Re-anchor on layout change ───────────────────────────
  // When rowH or cols change (layout switch, resize), recalculate
  // scrollTop so the current page stays visible in the viewport.
  // Uses lastReportedPageRef (always the page the user sees) not a
  // nav-only ref, so it won't snap back after manual scroll.
  // useEffect + rAF ensures GridView's useVirtualizer has mounted
  // and sized itself before we touch scroll position.
  useEffect(() => {
    if (!loaded || !scrollRef.current || rowH <= 0) return;
    if (!scrolledToInitialRef.current) return; // let initial scroll happen first
    const p = lastReportedPageRef.current;
    const row = Math.floor((p - 1) / cols);
    const target = row * rowH;
    const id = requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = target;
    });
    return () => cancelAnimationFrame(id);
  }, [rowH, cols, loaded]);

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
    const p = Math.max(1, Math.min(initialPage, numPages));
    lastReportedPageRef.current = p;
    const row = Math.floor((p - 1) / cols);
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
      <div className="flex items-center gap-0.5 sm:gap-1 md:gap-1.5 px-1.5 sm:px-2 py-1 sm:py-1.5 bg-zinc-900 border-b border-zinc-800 shrink-0 overflow-x-auto scrollbar-thin">

        {/* Pages per row — single unified segmented control */}
        <PagesPerRowControl pagesPerRow={pagesPerRow} isCompact={isCompact} onChange={(n) => { setPagesPerRow(n); if (n < 4) setFitMode('width'); }} />

        {/* Zoom (hidden in grid mode) */}
        {!isGrid && <>
          <button onClick={zoomOut} className="min-w-[36px] sm:min-w-[44px] min-h-[36px] sm:min-h-[44px] flex items-center justify-center text-zinc-400 hover:text-zinc-200 rounded-lg transition-colors active:bg-zinc-700 shrink-0" title="Zoom out" aria-label="Zoom out">
            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" d="M5 12h14"/></svg>
          </button>
          <button onClick={() => setFitMode(f => f === 'width' ? 'auto' : 'width')}
            className="min-h-[36px] sm:min-h-[44px] px-1 sm:px-1.5 text-[10px] sm:text-xs tabular-nums text-zinc-300 text-center select-none font-mono rounded-lg hover:bg-zinc-800 active:bg-zinc-700 shrink-0">
            {zoomLabel}
          </button>
          <button onClick={zoomIn} className="min-w-[36px] sm:min-w-[44px] min-h-[36px] sm:min-h-[44px] flex items-center justify-center text-zinc-400 hover:text-zinc-200 rounded-lg transition-colors active:bg-zinc-700 shrink-0" title="Zoom in" aria-label="Zoom in">
            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" d="M12 5v14M5 12h14"/></svg>
          </button>
          <div className="w-px h-4 sm:h-5 bg-zinc-700 shrink-0" />
          <button onClick={handleFitWidth}
            className={`min-w-[36px] sm:min-w-[44px] min-h-[36px] sm:min-h-[44px] flex items-center justify-center rounded-lg transition-colors active:bg-zinc-700 shrink-0 ${
              fitMode === 'width' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
            }`} title="Fit width" aria-label="Fit to width">
            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/>
            </svg>
          </button>
        </>}

        {/* Rotation (desktop only, hidden in grid) */}
        {!isCompact && !isGrid && <>
          <div className="w-px h-4 sm:h-5 bg-zinc-700 shrink-0" />
          <button onClick={onRotateCCW} className="min-w-[36px] sm:min-w-[44px] min-h-[36px] sm:min-h-[44px] flex items-center justify-center text-zinc-400 hover:text-zinc-200 rounded-lg transition-colors active:bg-zinc-700 shrink-0" title="Rotate left" aria-label="Rotate left">
            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a5 5 0 015 5v2M3 10l4-4M3 10l4 4"/></svg>
          </button>
          <button onClick={onRotateCW} className="min-w-[36px] sm:min-w-[44px] min-h-[36px] sm:min-h-[44px] flex items-center justify-center text-zinc-400 hover:text-zinc-200 rounded-lg transition-colors active:bg-zinc-700 shrink-0" title="Rotate right" aria-label="Rotate right">
            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 10H11a5 5 0 00-5 5v2m15-7l-4-4m4 4l-4 4"/></svg>
          </button>
        </>}

        {/* ── SELECT toggle (desktop only) ─────────────────── */}
        {!isCompact && (
          <>
            <div className={isGrid ? 'flex-1 hidden sm:block' : 'w-px h-5 bg-zinc-700 shrink-0'} />

            <button onClick={toggleSelectMode} title="Select"
              className={`min-h-[32px] sm:min-h-[44px] px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs font-semibold rounded-lg transition-all shrink-0 border ${
                selectMode
                  ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/20'
                  : 'text-zinc-400 border-zinc-700 hover:text-zinc-200 hover:border-zinc-600 active:bg-zinc-700'
              }`}>
              ✂️ <span className="hidden sm:inline">Select</span>
            </button>

            {/* Selection actions (visible when selectMode is active) */}
            {selectMode && (
              <>
                {selectedCount > 0 && (
                  <span className="text-[10px] sm:text-xs text-blue-400 font-semibold tabular-nums shrink-0">{selectedCount}</span>
                )}
                <button onClick={onSelectAll} className="min-w-[32px] sm:min-w-[44px] min-h-[28px] sm:min-h-[36px] px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-semibold text-zinc-300 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 rounded-lg transition-colors shrink-0">All</button>
                <button onClick={onDeselectAll} disabled={selectedCount === 0}
                  className="min-w-[32px] sm:min-w-[44px] min-h-[28px] sm:min-h-[36px] px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-semibold text-zinc-300 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 rounded-lg transition-colors disabled:opacity-30 shrink-0">None</button>
              </>
            )}
          </>
        )}
        {isCompact && isGrid && <div className="flex-1" />}

        {/* Reorder swap controls — moved to floating swap bar in App */}

        <div className="flex-1 hidden sm:block" />

        {/* Page navigation */}
        <button onClick={prevPage} disabled={currentPage <= 1}
          className="min-w-[32px] sm:min-w-[44px] min-h-[32px] sm:min-h-[44px] flex items-center justify-center text-zinc-400 hover:text-zinc-200 rounded-lg transition-colors disabled:opacity-30 active:bg-zinc-700 shrink-0" title="Previous" aria-label="Previous page">
          <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
        </button>
        <span className="text-[10px] sm:text-xs tabular-nums text-zinc-400 whitespace-nowrap select-none shrink-0">{currentPage}/{numPages}</span>
        <button onClick={nextPage} disabled={currentPage >= numPages}
          className="min-w-[32px] sm:min-w-[44px] min-h-[32px] sm:min-h-[44px] flex items-center justify-center text-zinc-400 hover:text-zinc-200 rounded-lg transition-colors disabled:opacity-30 active:bg-zinc-700 shrink-0" title="Next" aria-label="Next page">
          <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
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
              cols={cols}
              pageWidth={pageWidth}
              pageHeight={pageHeight}
              scale={effectiveScale}
              rowH={rowH}
              pdf={pdf}
              scrollRef={scrollRef}
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

// ── Pages Per Row control ────────────────────────────────
// Desktop: segmented control 1-6. Compact: icon + dropdown.

function PagesPerRowControl({ pagesPerRow, isCompact, onChange }: {
  pagesPerRow: PagesPerRow;
  isCompact: boolean;
  onChange: (n: PagesPerRow) => void;
}) {
  // Desktop: full segmented control
  if (!isCompact) {
    const options = [1, 2, 3, 4, 5, 6];
    return (
      <div className="flex items-center bg-zinc-800 rounded-lg p-0.5 border border-zinc-700 shrink-0">
        {options.map((n) => (
          <span key={n} className="flex items-center">
            {n === 4 && <div className="w-px h-4 sm:h-5 bg-zinc-700 mx-0.5" />}
            <button
              onClick={() => onChange(n as PagesPerRow)}
              className={`min-w-[28px] sm:min-w-[36px] min-h-[28px] sm:min-h-[36px] px-1 sm:px-1.5 py-0.5 rounded-md flex items-center justify-center transition-all ${
                pagesPerRow === n
                  ? 'bg-zinc-100 text-zinc-900 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 active:bg-zinc-700'
              }`}
              title={`${n} page${n > 1 ? 's' : ''} per row`}
              aria-label={`${n} page${n > 1 ? 's' : ''} per row`}
            >
              {n <= 3 ? (
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={PAGE_ICONS[n]} />
                </svg>
              ) : (
                <span className="text-[10px] sm:text-xs font-semibold">{n}</span>
              )}
            </button>
          </span>
        ))}
      </div>
    );
  }

  // Compact: dropdown
  return <PagesPerRowDropdown pagesPerRow={pagesPerRow} onChange={onChange} />;
}

function PagesPerRowDropdown({ pagesPerRow, onChange }: {
  pagesPerRow: PagesPerRow;
  onChange: (n: PagesPerRow) => void;
}) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (open && btnRef.current) setRect(btnRef.current.getBoundingClientRect());
    if (!open) setRect(null);
  }, [open]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || dropdownRef.current?.contains(t)) return;
      setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const ALL_OPTIONS = [
    { n: 1, label: '1 pagina', icon: PAGE_ICONS[1] },
    { n: 2, label: '2 pagine', icon: PAGE_ICONS[2] },
    { n: 3, label: '3 pagine', icon: PAGE_ICONS[3] },
    { n: 4, label: 'Griglia 4', icon: '' },
    { n: 5, label: 'Griglia 5', icon: '' },
    { n: 6, label: 'Griglia 6', icon: '' },
  ];

  // Show the current selection icon or a generic grid icon (4-grid) for 4-6
  const currentIcon = pagesPerRow <= 3 ? PAGE_ICONS[pagesPerRow] : 'M4 4h4v7H4z M10 4h4v7h-4z M16 4h4v7h-4z M4 13h4v7H4z M10 13h4v7h-4z M16 13h4v7h-4z';

  return (
    <div className="relative shrink-0">
      <button ref={btnRef} onClick={() => setOpen(!open)}
        className="flex items-center gap-1 min-w-[36px] min-h-[36px] px-1.5 py-0.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-zinc-200 transition-colors">
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d={currentIcon} />
        </svg>
        <span className="text-[10px] font-semibold ml-0.5">{pagesPerRow}</span>
        <svg className="w-3 h-3 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && rect && createPortal(
        <div ref={dropdownRef} className="fixed z-40 w-40 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 animate-slide-up"
          style={{ top: rect.bottom + 4, left: rect.left }}>
          {ALL_OPTIONS.map(opt => (
            <button key={opt.n} onClick={() => { onChange(opt.n as PagesPerRow); setOpen(false); }}
              className={`flex items-center gap-2 w-full px-3 py-2 text-xs font-medium transition-colors ${
                pagesPerRow === opt.n ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700'
              }`}>
              {opt.icon ? (
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={opt.icon} />
                </svg>
              ) : (
                <span className="w-3.5 h-3.5 shrink-0 flex items-center justify-center text-[11px] font-bold">{opt.n}</span>
              )}
              {opt.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
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
      placeholder={numPages > 99999 ? '…' : String(numPages)}
      className="w-14 sm:w-16 h-7 sm:h-8 px-1 sm:px-1.5 text-[10px] sm:text-[11px] font-mono bg-zinc-800 border border-zinc-700 rounded-md text-zinc-200 text-center focus:outline-none focus:border-blue-500 placeholder:text-zinc-600 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
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
  const poolRef = useRef<HTMLDivElement[]>([]);
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
      const wrapper = document.createElement('div');
      wrapper.style.position = 'absolute';
      wrapper.style.display = 'none';
      wrapper.style.overflow = 'hidden';
      wrapper.style.background = '#fff';
      wrapper.style.boxShadow = '0 1px 3px rgba(0,0,0,0.4)';
      // Center canvas inside wrapper for pages smaller than the slot
      wrapper.style.justifyContent = 'center';
      wrapper.style.alignItems = 'center';
      const canvas = document.createElement('canvas');
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      wrapper.appendChild(canvas);
      containerRef.current.appendChild(wrapper);
      poolRef.current.push(wrapper);
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
      const wrapper = freeSlots[fi++];
      (wrapper as any).__page = p;
      renderedRef.current.add(p);
      const row = Math.floor(p / cols);
      const col = p % cols;
      wrapper.style.left = `${16 + col * colStep}px`;
      wrapper.style.top = `${row * rowH}px`;
      wrapper.style.width = `${canvasW}px`;
      wrapper.style.height = `${canvasH}px`;
      wrapper.style.display = 'flex';
      const canvas = wrapper.firstChild as HTMLCanvasElement;
      renderPageWithCache(pdf, p + 1, canvas, scale).catch(() => {});
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

// ── Grid View (virtual scrolling) ─────────────────────────

function GridView({
  displayOrder, cols, pageWidth, pageHeight, scale, rowH, pdf,
  scrollRef, selectedPages, selectMode, isReorderMode,
  onTogglePage, onRangeSelect, onViewPage, lastClickedRef,
}: {
  displayOrder: number[]; cols: number;
  pageWidth: number; pageHeight: number; scale: number; rowH: number;
  pdf: PDFDocument; scrollRef: React.RefObject<HTMLDivElement | null>;
  selectedPages: Set<number>; selectMode: boolean;
  isReorderMode: boolean;
  onTogglePage: (p: number) => void; onRangeSelect: (s: number, e: number) => void;
  onViewPage?: (p: number) => void; lastClickedRef: React.MutableRefObject<number | null>;
}) {
  const totalRows = Math.ceil(displayOrder.length / cols);

  const rowVirtualizer = useVirtualizer({
    count: totalRows,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowH,
    overscan: 2,
  });

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

  const cellStyle = { width: '100%', aspectRatio: `${pageWidth}/${pageHeight}` } as const;

  return (
    <div style={{ height: rowVirtualizer.getTotalSize(), width: '100%', position: 'relative' }}>
      {rowVirtualizer.getVirtualItems().map(virtualRow => {
        const rowStartIdx = virtualRow.index * cols;
        return (
          <div
            key={virtualRow.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualRow.start}px)`,
              display: 'grid',
              gridTemplateColumns: `repeat(${cols}, 1fr)`,
              rowGap: `${GRID_PAGE_GAP}px`,
            }}
          >
            {Array.from({ length: cols }, (_, colIdx) => {
              const idx = rowStartIdx + colIdx;
              if (idx >= displayOrder.length) return <div key={`e-${virtualRow.index}-${colIdx}`} />;
              const pageNum = displayOrder[idx];
              const key = `${pageNum}-${idx}`;
              const cellClass = `relative cursor-pointer overflow-hidden transition-all duration-150 border-2 ${
                isReorderMode
                  ? 'border-zinc-700 hover:border-amber-500/50'
                  : selectMode && selectedPages.has(pageNum)
                    ? 'border-blue-500 shadow-md shadow-blue-500/20 scale-[0.97] z-10'
                    : 'border-transparent hover:border-zinc-600'
              }`;
              return (
                <div key={key} onClick={(e) => handleClick(pageNum, e)} className={cellClass} style={cellStyle}>
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
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function GridCanvas({ pdf, pageNumber, scale }: { pdf: PDFDocument; pageNumber: number; scale: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastRenderedRef = useRef<{ page?: number; scale?: number }>({});

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const last = lastRenderedRef.current;
    if (last.page === pageNumber && last.scale === scale) return;
    lastRenderedRef.current = { page: pageNumber, scale };
    renderPageWithCache(pdf, pageNumber, canvas, scale).catch(() => {});
  }, [pdf, pageNumber, scale]);

  // !w-full !h-full override inline pixel sizes set by renderPageToCanvas
  return <canvas ref={canvasRef} className="block bg-white !w-full !h-full" />;
}
