import { useState, useCallback, useRef, useEffect } from 'react';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { renderPageToCanvas, getFirstPageDimensions, clearPageDimensionsCache } from '../../src/lib/pdfRenderer';
import type { PDFDocument } from '../../src/lib/pdfRenderer';

interface EditorPanelProps {
  pdf: PDFDocument;
  numPages: number;
  selectedPages: Set<number>;
  selectedCount: number;
  onTogglePage: (pageNum: number) => void;
  onRangeSelect: (start: number, end: number) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onViewPage?: (pageNum: number) => void;
  initialPage?: number;
  isReorderMode: boolean;
  pageOrder: number[];
  onReorderSwap?: (pageA: number, pageB: number) => void;
  columns: number;
  onColumnsChange: (cols: number) => void;
}

const ROW_GAP = 4;  // vertical gap between rows

export function EditorPanel({
  pdf, numPages, selectedPages, selectedCount,
  onTogglePage, onRangeSelect, onSelectAll, onDeselectAll,
  onViewPage, initialPage, isReorderMode, pageOrder,
  onReorderSwap, columns, onColumnsChange,
}: EditorPanelProps) {
  const { isMobile } = useResponsiveLayout();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pageWidth, setPageWidth] = useState(595);
  const [pageHeight, setPageHeight] = useState(842);
  const [containerWidth, setContainerWidth] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const [swapPageA, setSwapPageA] = useState('');
  const [swapPageB, setSwapPageB] = useState('');

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

  // ── Track container width (guarded against repeated identical values)
  const lastContainerWidthRef = useRef(0);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !loaded) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (Math.abs(lastContainerWidthRef.current - w) < 0.5) return;
        lastContainerWidthRef.current = w;
        setContainerWidth(w);
      }
    });
    ro.observe(el);
    // Set initial width
    const initialW = el.clientWidth;
    lastContainerWidthRef.current = initialW;
    setContainerWidth(initialW);
    return () => ro.disconnect();
  }, [loaded]);

  // ── Derived: dynamic scale fills viewport width ───────────
  const cols = isMobile ? Math.min(columns, 3) : columns;
  // Thumbnail scale computed so that cols * pageWidth * scale = containerWidth
  const thumbScale = containerWidth > 0 && pageWidth > 0
    ? containerWidth / (cols * pageWidth)
    : 0.15;
  const thumbH = pageHeight * thumbScale;

  // ── Scroll to initial page on mount (once only) ──────────
  const scrolledToInitialRef = useRef(false);
  useEffect(() => {
    if (!loaded || !scrollRef.current || initialPage == null || scrolledToInitialRef.current) return;
    if (containerWidth <= 0) return;
    scrolledToInitialRef.current = true;
    const row = Math.floor((initialPage - 1) / cols);
    scrollRef.current.scrollTop = row * (thumbH + ROW_GAP);
  }, [loaded, initialPage, cols, thumbH, containerWidth]);

  // ── Range selection tracking
  const lastClickedRef = useRef<number | null>(null);

  const handlePageClick = useCallback((pageNum: number, e: React.MouseEvent) => {
    if (isReorderMode) return;
    if (e.shiftKey && lastClickedRef.current !== null) {
      onRangeSelect(lastClickedRef.current, pageNum);
    } else {
      onTogglePage(pageNum);
      lastClickedRef.current = pageNum;
    }
  }, [isReorderMode, onTogglePage, onRangeSelect]);

  const handlePageDoubleClick = useCallback((pageNum: number) => {
    if (!isReorderMode && onViewPage) onViewPage(pageNum);
  }, [isReorderMode, onViewPage]);

  if (!loaded) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
      </div>
    );
  }

  const displayOrder = isReorderMode ? pageOrder : Array.from({ length: numPages }, (_, i) => i + 1);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-zinc-950">
      {/* Toolbar — responsive touch targets (min 44px) */}
      <div className="flex items-center gap-1 md:gap-2 px-2 py-1.5 bg-zinc-900 border-b border-zinc-800 shrink-0 overflow-x-auto scrollbar-thin">
        {/* Columns toggle */}
        <div className="flex items-center bg-zinc-800 rounded-lg p-0.5 border border-zinc-700 shrink-0">
          {(isMobile ? [2, 3, 4] : [3, 4, 5, 6]).map(n => (
            <button key={n} onClick={() => onColumnsChange(n)}
              className={`min-w-[36px] min-h-[36px] px-2 py-1 text-xs font-semibold rounded-md transition-all ${
                columns === n ? 'bg-zinc-100 text-zinc-900 shadow-sm' : 'text-zinc-400 hover:text-zinc-200 active:bg-zinc-700'
              }`}>{n}</button>
          ))}
        </div>

        <div className="w-px h-5 bg-zinc-700 shrink-0" />

        {/* Selection controls */}
        {!isReorderMode && (
          <>
            {selectedCount > 0 && (
              <span className="text-xs text-blue-400 font-semibold tabular-nums shrink-0">{selectedCount} sel.</span>
            )}
            <button onClick={onSelectAll} className="min-w-[44px] min-h-[36px] px-3 py-1 text-xs font-semibold text-zinc-300 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 rounded-lg transition-colors shrink-0">All</button>
            <button onClick={onDeselectAll} disabled={selectedCount === 0}
              className="min-w-[44px] min-h-[36px] px-3 py-1 text-xs font-semibold text-zinc-300 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 rounded-lg transition-colors disabled:opacity-30 shrink-0">None</button>
          </>
        )}

        {/* Reorder swap controls */}
        {isReorderMode && (
          <>
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
      </div>

      {/* Thumbnail grid — zero horizontal gap, fills viewport width */}
      <div ref={scrollRef} className="flex-1 overflow-auto scrollbar-thin py-2">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            columnGap: 0,
            rowGap: `${ROW_GAP}px`,
            width: '100%',
            paddingBottom: isReorderMode ? 0 : 80,
          }}
        >
          {displayOrder.map((pageNum, idx) => (
            <div
              key={`${pageNum}-${idx}`}
              onClick={(e) => handlePageClick(pageNum, e)}
              onDoubleClick={() => handlePageDoubleClick(pageNum)}
              className={`relative cursor-pointer overflow-hidden transition-all duration-150 border-2 ${
                isReorderMode
                  ? 'border-zinc-700 hover:border-amber-500/50'
                  : selectedPages.has(pageNum)
                    ? 'border-blue-500 shadow-md shadow-blue-500/20 scale-[0.97] z-10'
                    : 'border-transparent hover:border-zinc-600'
              }`}
              style={{ width: '100%', aspectRatio: `${pageWidth}/${pageHeight}` }}
            >
              <ThumbCanvas pdf={pdf} pageNumber={pageNum} scale={thumbScale} />
              {/* Page number badge */}
              <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-zinc-800/90 rounded-full">
                <span className="text-[9px] font-medium tabular-nums text-zinc-400">{pageNum}</span>
              </div>
              {/* Selection overlay */}
              {!isReorderMode && selectedPages.has(pageNum) && (
                <div className="absolute top-1 left-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center shadow">
                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Thumbnail canvas ──────────────────────────────────────

function ThumbCanvas({ pdf, pageNumber, scale }: { pdf: PDFDocument; pageNumber: number; scale: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderedRef = useRef(false);
  const lastScaleRef = useRef(scale);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Re-render if scale changed
    if (Math.abs(lastScaleRef.current - scale) > 0.001) {
      renderedRef.current = false;
      lastScaleRef.current = scale;
    }
    if (renderedRef.current) return;
    renderedRef.current = true;
    renderPageToCanvas(pdf, pageNumber, canvas, scale).catch(() => {});
  }, [pdf, pageNumber, scale]);

  return (
    <canvas ref={canvasRef} className="block bg-white w-full h-full" />
  );
}
