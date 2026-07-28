import { useState, useEffect, useCallback } from 'react';
import { getOutline } from '../../src/lib/pdfRenderer';
import type { PDFDocument, TOCItem } from '../../src/lib/pdfRenderer';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';

interface TOCPanelProps {
  pdf: PDFDocument;
  open: boolean;
  onClose: () => void;
  onNavigate: (pageNumber: number) => void;
}

export function TOCPanel({ pdf, open, onClose, onNavigate }: TOCPanelProps) {
  const { isMobile } = useResponsiveLayout();
  const [items, setItems] = useState<TOCItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['root']));
  const [showToast, setShowToast] = useState(false);

  // Auto-dismiss toast after 5 seconds
  useEffect(() => {
    if (!showToast) return;
    const timer = setTimeout(() => setShowToast(false), 5000);
    return () => clearTimeout(timer);
  }, [showToast]);

  // Suppress unused var warning
  void (expanded as unknown);

  useEffect(() => {
    if (!open) {
      setShowToast(false);
      return;
    }
    setLoading(true);
    setError(null);
    getOutline(pdf)
      .then((loadedItems) => {
        setItems(loadedItems);
        if (loadedItems.length > 0) setShowToast(true);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load outline'))
      .finally(() => setLoading(false));
  }, [pdf, open]);

  if (!open) return null;

  const handleNavigate = useCallback((page: number) => {
    onNavigate(page);
    if (isMobile) onClose();
  }, [onNavigate, isMobile, onClose]);

  const toggleExpand = (path: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path); else next.add(path);
      return next;
    });
  };

  const content = (
    <>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
          <span className="text-sm font-bold text-zinc-200">Contents</span>
        </div>
        <button onClick={onClose} className="p-1.5 text-zinc-500 hover:text-zinc-300 rounded-lg hover:bg-zinc-800 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
          </div>
        ) : error ? (
          <p className="text-sm text-red-400 p-4">{error}</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-zinc-500 p-4 text-center">No table of contents found.</p>
        ) : (
          <TOCTree items={items} path="root" expanded={expanded} onToggle={toggleExpand} onNavigate={handleNavigate} />
        )}
      </div>

      {/* Layout warning toast */}
      {showToast && (
        <div className="shrink-0 mx-2 mb-2 px-3 py-2.5 bg-amber-900/50 border border-amber-700/40 rounded-lg text-[11px] text-amber-200 leading-relaxed animate-slide-up">
          <div className="flex items-start gap-2">
            <svg className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div className="flex-1">
              <p className="font-semibold mb-0.5">Seleziona prima il layout</p>
              <p>Scegli il layout (Single, Double, Triple, Grid) prima di cliccare una voce del TOC. Se cambi layout dopo, dovrai riselezionare la voce per ritrovare la pagina.</p>
            </div>
          </div>
        </div>
      )}
    </>
  );

  // Mobile: bottom sheet
  if (isMobile) {
    return (
      <div className="bottom-sheet animate-fade-in">
        <div className="bottom-sheet-backdrop" onClick={onClose} />
        <div className="bottom-sheet-panel" style={{ maxHeight: '70vh' }}>
          <div className="bottom-sheet-handle" />
          <div className="flex flex-col flex-1 overflow-hidden">
            {content}
          </div>
        </div>
      </div>
    );
  }

  // Desktop: side panel
  return (
    <div className="w-72 shrink-0 border-r border-zinc-700 bg-zinc-900 flex flex-col shadow-xl overflow-hidden">
      {content}
    </div>
  );
}

// ─── TOC Tree ──────────────────────────────────────────────

function TOCTree({ items, path, expanded, onToggle, onNavigate, depth = 0 }: {
  items: TOCItem[]; path: string; expanded: Set<string>; onToggle: (path: string) => void;
  onNavigate: (page: number) => void; depth?: number;
}) {
  return (
    <div className={depth > 0 ? 'ml-3' : ''}>
      {items.map((item, i) => {
        const childPath = `${path}-${i}`;
        const hasChildren = item.children.length > 0;
        const isOpen = expanded.has(childPath) !== false;

        return (
          <div key={childPath}>
            <div
              className={`flex items-center gap-1 min-h-[44px] py-1.5 px-1.5 rounded cursor-pointer transition-colors text-sm ${
                item.pageNumber !== null
                  ? 'hover:bg-zinc-800 active:bg-zinc-700 text-zinc-300'
                  : 'text-zinc-500 italic'
              }`}
              style={{ paddingLeft: `${depth * 12 + 4}px` }}
            >
              {/* Expand toggle */}
              {hasChildren ? (
                <button onClick={(e) => { e.stopPropagation(); onToggle(childPath); }}
                  className="p-0.5 hover:bg-zinc-700 rounded shrink-0">
                  <svg className={`w-3 h-3 text-zinc-500 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ) : (
                <span className="w-4 shrink-0" />
              )}

              {/* Title + page */}
              <span
                className="flex-1 truncate"
                onClick={() => { if (item.pageNumber !== null) onNavigate(item.pageNumber); }}
              >
                {item.title || '(untitled)'}
              </span>

              {item.pageNumber !== null && (
                <span className="text-[10px] text-zinc-600 tabular-nums shrink-0 ml-1">{item.pageNumber}</span>
              )}
            </div>

            {/* Children */}
            {hasChildren && isOpen && (
              <TOCTree items={item.children} path={childPath} expanded={expanded} onToggle={onToggle} onNavigate={onNavigate} depth={depth + 1} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// Re-export for convenience
export type { TOCItem };
