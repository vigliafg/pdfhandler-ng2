import { useState, useCallback, useMemo, type ReactNode } from 'react';
import type { TOCItem, TOCDepth } from '../../lib/pdfOperations';
import {
  DialogShell,
  PreviewBar,
  SectionHeader,
  HelpBox,
  ErrorBanner,
  RangeSelector,
  SubsetSelector,
  parseRangeString,
  type RangeMode,
  type SubsetValue,
} from './shared';

type SplitMode = 'perPages' | 'perFiles' | 'perMarkers' | 'customRanges' | 'perPage' | 'perTOC';

interface SplitModalProps {
  numPages: number;
  fileName: string | null;
  tocItems: TOCItem[] | null;
  onClose: () => void;
  onSplit: (params: SplitParams) => Promise<void>;
  executing?: boolean;
}

export interface SplitParams {
  mode: SplitMode;
  /** For 'perPages': pages per chunk. For 'perFiles': target file count. For 'perMarkers': unused. */
  value: number;
  /** For 'customRanges': array of start-end pairs (1-based). */
  ranges?: { start: number; end: number }[];
  /** For 'perMarkers': array of page numbers where to split (last page of each chunk). */
  markers?: number[];
  /** For 'perTOC': which depth level to split at. */
  tocDepth?: TOCDepth;
  /** Pages to include in the split (1-based). When undefined, all pages are used. */
  filteredPages?: number[];
  /** Callback for split progress (used in TOC mode). */
  onProgress?: (current: number, total: number, label: string) => void;
}

// ─── TOC helpers (mirrored from pdfOperations for preview) ──

function resolveTOCPage(item: TOCItem): number | null {
  if (item.pageNumber !== null) return item.pageNumber;
  if (item.children.length > 0) return resolveTOCPage(item.children[0]);
  return null;
}

function flattenTOCForPreview(
  items: TOCItem[],
  depth: TOCDepth,
  totalPages: number,
  _currentDepth: number = 0,
): { title: string; page: number }[] {
  const collected: { title: string; page: number; depth: number }[] = [];

  function walk(nodes: TOCItem[], d: number): void {
    for (const node of nodes) {
      const hasChildren = node.children.length > 0;
      const isTarget =
        depth === 'all'
          ? !hasChildren
          : d === depth || (!hasChildren && d < depth);

      if (isTarget) {
        const p = resolveTOCPage(node);
        if (p !== null && p <= totalPages) {
          collected.push({ title: node.title, page: p, depth: d });
        }
      } else if (hasChildren && (depth === 'all' || d < depth)) {
        walk(node.children, d + 1);
      }
    }
  }

  walk(items, 0);

  // Sort by page number, then by depth (deeper first for same-page dedup)
  collected.sort((a, b) => a.page - b.page || b.depth - a.depth);

  // Deduplicate: keep only first item per page number
  const seen = new Set<number>();
  const unique: { title: string; page: number }[] = [];
  for (const c of collected) {
    if (!seen.has(c.page)) {
      seen.add(c.page);
      unique.push({ title: c.title, page: c.page });
    }
  }
  unique.sort((a, b) => a.page - b.page);

  return unique;
}

function sanitizeTOCFilename(name: string, maxLen: number = 80): string {
  let sanitized = name.replace(/[/\\:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim();
  sanitized = sanitized.replace(/^[.\s]+/, '').replace(/[.\s]+$/, '');
  if (sanitized.length > maxLen) {
    sanitized = sanitized.substring(0, maxLen).replace(/[.\s]+$/, '');
  }
  return sanitized || 'untitled';
}

// ─── Component ──────────────────────────────────────────────

export function SplitModal({
  numPages,
  fileName,
  tocItems,
  onClose,
  onSplit,
  executing = false,
}: SplitModalProps) {
  const [mode, setMode] = useState<SplitMode>('perPages');
  const [perPages, setPerPages] = useState(10);
  const [perFiles, setPerFiles] = useState(4);
  const [markersStr, setMarkersStr] = useState('');
  const [customRangesStr, setCustomRangesStr] = useState('');
  const [tocDepth, setTocDepth] = useState<TOCDepth>(1);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selectedTOCPath, setSelectedTOCPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Page Filter (FASE 2) ──────────────────────────────────
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterEnabled, setFilterEnabled] = useState(false);
  const [filterRangeMode, setFilterRangeMode] = useState<RangeMode>('all');
  const [filterCustomRange, setFilterCustomRange] = useState('');
  const [filterSubset, setFilterSubset] = useState<SubsetValue>('all');

  // ── Split Progress (FASE 3) ───────────────────────────────
  const [splitProgress, setSplitProgress] = useState<{
    current: number;
    total: number;
    label: string;
  } | null>(null);

  const toggleExpand = (path: string) => {
    setExpanded(prev => ({ ...prev, [path]: !prev[path] }));
  };

  const handleTOCSelect = (path: string) => {
    setSelectedTOCPath(path);
    const d = path.split('-').length - 1;
    setTocDepth(d <= 3 ? d as TOCDepth : 'all');
    // Auto-expand selected node
    setExpanded(prev => ({ ...prev, [path]: true }));
  };

  const base = fileName?.replace(/\.pdf$/i, '') ?? 'document';

  const hasTOC = tocItems !== null && tocItems.length > 0;

  // Parse markers
  const markers = useMemo(() => {
    const parts = markersStr.split(',').map((s) => s.trim()).filter(Boolean);
    const nums: number[] = [];
    for (const part of parts) {
      const n = parseInt(part, 10);
      if (!isNaN(n) && n >= 1 && n < numPages) {
        nums.push(n);
      }
    }
    return [...new Set(nums)].sort((a, b) => a - b);
  }, [markersStr, numPages]);

  // Parse custom ranges
  const customRanges = useMemo(() => {
    const parts = customRangesStr.split(',').map((s) => s.trim()).filter(Boolean);
    const ranges: { start: number; end: number }[] = [];
    for (const part of parts) {
      if (part.includes('-')) {
        const [a, b] = part.split('-').map(Number);
        if (!isNaN(a) && !isNaN(b) && a >= 1 && b <= numPages && a <= b) {
          ranges.push({ start: a, end: b });
        }
      } else {
        const n = parseInt(part, 10);
        if (!isNaN(n) && n >= 1 && n <= numPages) {
          ranges.push({ start: n, end: n });
        }
      }
    }
    return ranges;
  }, [customRangesStr, numPages]);

  // ── Page Filter computation ───────────────────────────────
  const filteredPageNumbers = useMemo(() => {
    if (!filterEnabled) return undefined;

    let pages: number[] = [];
    switch (filterRangeMode) {
      case 'all':
        for (let i = 1; i <= numPages; i++) pages.push(i);
        break;
      case 'custom':
        pages = parseRangeString(filterCustomRange, numPages);
        break;
      default:
        for (let i = 1; i <= numPages; i++) pages.push(i);
    }

    if (filterSubset === 'odd') pages = pages.filter(p => p % 2 === 1);
    else if (filterSubset === 'even') pages = pages.filter(p => p % 2 === 0);

    return pages.length > 0 ? pages : undefined;
  }, [filterEnabled, filterRangeMode, filterCustomRange, filterSubset, numPages]);

  const filteredPageCount = filteredPageNumbers?.length ?? numPages;

  // Preview computation
  const preview = useMemo(() => {
    if (mode === 'perTOC') {
      if (!hasTOC) return { fileCount: 0, lines: [] };
      const flat = flattenTOCForPreview(tocItems!, tocDepth, numPages);

      // Build ranges: each ends at next sibling's start - 1, last goes to end
      const ranges: { title: string; start: number; end: number }[] = [];
      for (let i = 0; i < flat.length; i++) {
        const end = i < flat.length - 1 ? flat[i + 1].page - 1 : numPages;
        ranges.push({ title: flat[i].title, start: flat[i].page, end });
      }

      // Front matter
      if (ranges.length > 0 && ranges[0].start > 1) {
        ranges.unshift({ title: 'Front Matter', start: 1, end: ranges[0].start - 1 });
      }

      const lines = ranges.map((r) => {
        const safe = sanitizeTOCFilename(r.title, 36);
        return `${safe}  →  pp. ${r.start}–${r.end} (${r.end - r.start + 1} pp.)`;
      });
      return { fileCount: ranges.length, lines };
    }

    if (mode === 'perPages') {
      const fileCount = Math.ceil(numPages / Math.max(1, perPages));
      const lines: string[] = [];
      for (let i = 0; i < fileCount; i++) {
        const start = i * perPages + 1;
        const end = Math.min(start + perPages - 1, numPages);
        const pad = String(i + 1).padStart(3, '0');
        lines.push(`${base}-part${pad}-p${start}-${end}.pdf (${end - start + 1} pp.)`);
      }
      return { fileCount, lines };
    }

    if (mode === 'perFiles') {
      const files = Math.max(1, Math.min(perFiles, numPages));
      const basePages = Math.floor(numPages / files);
      const remainder = numPages % files;
      const lines: string[] = [];
      let cursor = 1;
      for (let i = 0; i < files; i++) {
        const chunkSize = basePages + (i < remainder ? 1 : 0);
        const start = cursor;
        const end = cursor + chunkSize - 1;
        const pad = String(i + 1).padStart(3, '0');
        lines.push(`${base}-part${pad}-p${start}-${end}.pdf (${chunkSize} pp.)`);
        cursor = end + 1;
      }
      return { fileCount: files, lines };
    }

    if (mode === 'perMarkers') {
      if (markers.length === 0) return { fileCount: 0, lines: [] };
      const chunks: { start: number; end: number }[] = [];
      let prevEnd = 0;
      for (const m of markers) {
        chunks.push({ start: prevEnd + 1, end: m });
        prevEnd = m;
      }
      chunks.push({ start: prevEnd + 1, end: numPages });
      const lines = chunks
        .filter((c) => c.start <= c.end)
        .map((c, i) => {
          const pad = String(i + 1).padStart(3, '0');
          return `${base}-part${pad}-p${c.start}-${c.end}.pdf (${c.end - c.start + 1} pp.)`;
        });
      return { fileCount: chunks.length, lines };
    }

    if (mode === 'customRanges') {
      return {
        fileCount: customRanges.length,
        lines: customRanges.map((r, i) => {
          const pad = String(i + 1).padStart(3, '0');
          return `${base}-part${pad}-p${r.start}-${r.end}.pdf (${r.end - r.start + 1} pp.)`;
        }),
      };
    }

    // perPage
    const lines: string[] = [];
    for (let i = 1; i <= numPages; i++) {
      const pad = String(i).padStart(3, '0');
      lines.push(`${base}-p${pad}.pdf (1 pp.)`);
    }
    return { fileCount: numPages, lines };
  }, [mode, perPages, perFiles, markers, customRanges, numPages, base, tocItems, tocDepth, hasTOC]);

  const canSplit =
    !executing &&
    numPages > 0 &&
    (mode !== 'perMarkers' || markers.length > 0) &&
    (mode !== 'customRanges' || customRanges.length > 0) &&
    (mode !== 'perTOC' || (hasTOC && preview.fileCount > 0));

  const handleExecute = useCallback(async () => {
    if (!canSplit) return;
    setError(null);
    try {
      if (mode === 'customRanges') {
        await onSplit({ mode, value: 0, ranges: customRanges, filteredPages: filteredPageNumbers });
      } else if (mode === 'perMarkers') {
        await onSplit({ mode, value: 0, markers, filteredPages: filteredPageNumbers });
      } else if (mode === 'perTOC') {
        setSplitProgress({ current: 0, total: preview.fileCount, label: 'Preparing...' });
        await onSplit({
          mode, value: 0, tocDepth,
          filteredPages: filteredPageNumbers,
          onProgress: (c, t, label) => setSplitProgress({ current: c, total: t, label }),
        });
        setSplitProgress(null);
      } else if (mode === 'perPage') {
        await onSplit({ mode, value: 1, filteredPages: filteredPageNumbers });
      } else {
        await onSplit({ mode, value: mode === 'perPages' ? perPages : perFiles, filteredPages: filteredPageNumbers });
      }
    } catch (err: any) {
      setError(err?.message || 'Split failed. Check file permissions or disk space.');
      setSplitProgress(null);
    }
  }, [canSplit, onSplit, mode, perPages, perFiles, markers, customRanges, tocDepth, filteredPageNumbers, preview.fileCount]);

  const executeLabel =
    mode === 'perPage'
      ? `Split into ${numPages} file${numPages !== 1 ? 's' : ''}`
      : `Split into ${preview.fileCount} file${preview.fileCount !== 1 ? 's' : ''}`;

  // Limit preview to first 20 items + count of remaining
  const previewLines = preview.lines;
  const shownLines = previewLines.slice(0, 20);
  const hiddenCount = previewLines.length - shownLines.length;

  // ── TOC Tree renderer ───────────────────────────────────

  function renderTOCTreeNodes(
    items: TOCItem[],
    parentPath: string,
    depth: number,
  ): ReactNode[] {
    return items.map((item, i) => {
      const path = parentPath ? `${parentPath}-${i}` : `${i}`;
      const isSelected = selectedTOCPath === path;
      const isExpanded = expanded[path] !== false; // default: expanded
      const hasChildren = item.children.length > 0;
      const page = resolveTOCPage(item);

      return (
        <div key={path}>
          <div
            onClick={() => handleTOCSelect(path)}
            className={`flex items-center gap-1.5 py-1 px-1.5 rounded cursor-pointer text-xs transition-all border ${
              isSelected
                ? 'bg-green-600/15 border-green-600/40 text-green-300'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 border-transparent'
            }`}
            style={{ paddingLeft: `${depth * 16 + 6}px` }}
          >
            {/* Expand/collapse chevron */}
            {hasChildren ? (
              <button
                onClick={(e) => { e.stopPropagation(); toggleExpand(path); }}
                className="p-0.5 hover:bg-zinc-700/70 rounded shrink-0 transition-colors"
              >
                <svg
                  className={`w-3 h-3 text-zinc-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ) : (
              <span className="w-4 shrink-0" />
            )}
            {/* Title */}
            <span className="truncate flex-1 font-medium">{item.title || '(untitled)'}</span>
            {/* Page number */}
            {page !== null && (
              <span className="text-[10px] text-zinc-600 tabular-nums shrink-0 ml-1">
                p.{page}
              </span>
            )}
          </div>
          {/* Children (if expanded) */}
          {isExpanded && hasChildren &&
            renderTOCTreeNodes(item.children, path, depth + 1)}
        </div>
      );
    });
  }

  // TOC depth labels
  const depthLabels: { value: TOCDepth; label: string; desc: string }[] = [
    { value: 0, label: 'Top Level', desc: 'Top-level bookmarks only (e.g. Parts)' },
    { value: 1, label: 'Level 1', desc: 'First sub-level headings' },
    { value: 2, label: 'Level 2', desc: 'Sections / sub-headings' },
    { value: 3, label: 'Level 3', desc: 'Subsections' },
    { value: 'all', label: 'All', desc: 'Every leaf node (deepest)' },
  ];

  return (
    <DialogShell
      title="Split Document"
      icon="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
      onCancel={onClose}
      onExecute={handleExecute}
      executeLabel={executeLabel}
      executeDisabled={!canSplit}
      disabledReason={
        executing ? undefined
        : mode === 'perMarkers' && markers.length === 0 ? 'Enter at least one page marker (e.g. 10, 25, 40)'
        : mode === 'customRanges' && customRanges.length === 0 ? 'Enter at least one valid range (e.g. 1-10, 15-20)'
        : mode === 'perTOC' && (!hasTOC || preview.fileCount === 0) ? 'This PDF has no table of contents — try another split mode'
        : numPages === 0 ? 'No document loaded'
        : undefined
      }
      executing={executing}
    >
      {/* ── Progress bar (FASE 3) ──────────────────────────── */}
      {executing && splitProgress ? (
        <div className="py-6 space-y-3">
          <p className="text-sm text-zinc-400 text-center">
            Creating {splitProgress.total} files...
          </p>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-zinc-500">
              <span className="truncate max-w-[280px]">{splitProgress.label}</span>
              <span className="tabular-nums">{splitProgress.current}/{splitProgress.total}</span>
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-2.5 overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-200"
                style={{ width: `${(splitProgress.current / splitProgress.total) * 100}%` }}
              />
            </div>
          </div>
        </div>
      ) : (
        <>
      <HelpBox>Split the document into multiple smaller PDFs and download them as a ZIP. The original document <strong className="text-zinc-400">is not modified</strong>.</HelpBox>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {/* ── Page Filter (collapsible, FASE 2) ─────────────── */}
      <div className="space-y-2">
        <button
          onClick={() => setFilterOpen(!filterOpen)}
          className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors w-full"
        >
          <svg className={`w-3 h-3 transition-transform ${filterOpen ? 'rotate-90' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <span className="font-medium">
            Page Filter {filterEnabled ? `(active — ${filteredPageCount} pages)` : '(optional)'}
          </span>
        </button>

        {filterOpen && (
          <div className="bg-zinc-800/30 border border-zinc-800 rounded-lg p-3 space-y-3">
            {/* Toggle enable/disable */}
            <label className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={filterEnabled}
                onChange={(e) => setFilterEnabled(e.target.checked)}
                className="w-3.5 h-3.5 text-blue-500 bg-zinc-800 border-zinc-600 rounded"
              />
              <span className="text-sm text-zinc-300 group-hover:text-zinc-100">
                Enable page filter
              </span>
            </label>

            {filterEnabled && (
              <>
                <RangeSelector
                  numPages={numPages}
                  currentPage={1}
                  selectedCount={0}
                  value={filterRangeMode}
                  onChange={setFilterRangeMode}
                  customRange={filterCustomRange}
                  onCustomRangeChange={setFilterCustomRange}
                  disabledModes={['current', 'selected']}
                />

                <SubsetSelector value={filterSubset} onChange={setFilterSubset} />

                <div className="flex items-start gap-2 text-[10px] text-amber-400">
                  <svg className="w-3 h-3 shrink-0 mt-px" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <span>Only pages matching the filter will be <strong>included</strong> in the split.</span>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-zinc-800" />

      {/* Split mode selector */}
      <div className="space-y-2">
        <SectionHeader label="Split by" />

        {/* Per pages */}
        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="radio"
            name="splitMode"
            checked={mode === 'perPages'}
            onChange={() => setMode('perPages')}
            className="w-3.5 h-3.5 mt-1 text-blue-500 bg-zinc-800 border-zinc-600 focus:ring-0"
          />
          <div className="flex-1">
            <span className="text-sm text-zinc-300 group-hover:text-zinc-100">Every N pages</span>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="number"
                min={1}
                max={Math.max(1, numPages)}
                value={perPages}
                onChange={(e) => { const v = parseInt(e.target.value, 10); if (v >= 1) setPerPages(v); }}
                disabled={mode !== 'perPages'}
                className="w-16 px-2 py-1 text-xs font-mono bg-zinc-800 border border-zinc-700 rounded text-zinc-200 text-center focus:outline-none focus:border-blue-500 disabled:opacity-40"
              />
              <span className="text-xs text-zinc-500">pages per file</span>
            </div>
          </div>
        </label>

        {/* Per files */}
        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="radio"
            name="splitMode"
            checked={mode === 'perFiles'}
            onChange={() => setMode('perFiles')}
            className="w-3.5 h-3.5 mt-1 text-blue-500 bg-zinc-800 border-zinc-600 focus:ring-0"
          />
          <div className="flex-1">
            <span className="text-sm text-zinc-300 group-hover:text-zinc-100">Into N equal files</span>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="number"
                min={1}
                max={Math.max(1, numPages)}
                value={perFiles}
                onChange={(e) => { const v = parseInt(e.target.value, 10); if (v >= 1 && v <= numPages) setPerFiles(v); }}
                disabled={mode !== 'perFiles'}
                className="w-16 px-2 py-1 text-xs font-mono bg-zinc-800 border border-zinc-700 rounded text-zinc-200 text-center focus:outline-none focus:border-blue-500 disabled:opacity-40"
              />
              <span className="text-xs text-zinc-500">equal parts</span>
            </div>
          </div>
        </label>

        {/* At page markers */}
        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="radio"
            name="splitMode"
            checked={mode === 'perMarkers'}
            onChange={() => setMode('perMarkers')}
            className="w-3.5 h-3.5 mt-1 text-blue-500 bg-zinc-800 border-zinc-600 focus:ring-0"
          />
          <div className="flex-1">
            <span className="text-sm text-zinc-300 group-hover:text-zinc-100">At page markers</span>
            <input
              type="text"
              value={markersStr}
              onChange={(e) => setMarkersStr(e.target.value)}
              disabled={mode !== 'perMarkers'}
              placeholder="e.g. 10, 25, 40"
              className="mt-1 w-full px-2.5 py-1.5 text-xs font-mono bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 disabled:opacity-40"
            />
            <p className="text-[10px] text-zinc-600 mt-1">
              Split <em>after</em> each page number. <code className="text-zinc-500">10, 25, 40</code> → 4 files (1-10, 11-25, 26-40, 41-end).
            </p>
          </div>
        </label>

        {/* Custom ranges */}
        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="radio"
            name="splitMode"
            checked={mode === 'customRanges'}
            onChange={() => setMode('customRanges')}
            className="w-3.5 h-3.5 mt-1 text-blue-500 bg-zinc-800 border-zinc-600 focus:ring-0"
          />
          <div className="flex-1">
            <span className="text-sm text-zinc-300 group-hover:text-zinc-100">Custom ranges</span>
            <input
              type="text"
              value={customRangesStr}
              onChange={(e) => setCustomRangesStr(e.target.value)}
              disabled={mode !== 'customRanges'}
              placeholder="e.g. 1-10, 11-25, 26-50"
              className="mt-1 w-full px-2.5 py-1.5 text-xs font-mono bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 disabled:opacity-40"
            />
            <p className="text-[10px] text-zinc-600 mt-1">
              Microsoft standard: comma-separated ranges. <code className="text-zinc-500">1-10, 11-25, 26-50</code>
            </p>
          </div>
        </label>

        {/* One page per file */}
        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="radio"
            name="splitMode"
            checked={mode === 'perPage'}
            onChange={() => setMode('perPage')}
            className="w-3.5 h-3.5 mt-1 text-blue-500 bg-zinc-800 border-zinc-600 focus:ring-0"
          />
          <div className="flex-1">
            <span className="text-sm text-zinc-300 group-hover:text-zinc-100">One page per file</span>
            <p className="text-xs text-zinc-600 mt-0.5">
              Each page becomes a separate PDF in the ZIP. {numPages} pages → {numPages} files.
            </p>
          </div>
        </label>

        {/* Split by TOC bookmarks */}
        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="radio"
            name="splitMode"
            checked={mode === 'perTOC'}
            onChange={() => setMode('perTOC')}
            disabled={!hasTOC}
            className="w-3.5 h-3.5 mt-1 text-green-500 bg-zinc-800 border-zinc-600 focus:ring-0 disabled:opacity-30"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className={`text-sm ${hasTOC ? 'text-zinc-300 group-hover:text-zinc-100' : 'text-zinc-600'}`}>
                By TOC bookmarks
              </span>
              {!hasTOC && tocItems === null && (
                <span className="inline-flex items-center gap-1.5 text-[10px] text-blue-400">
                  <div className="w-3 h-3 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
                  Loading TOC...
                </span>
              )}
              {!hasTOC && tocItems !== null && mode !== 'perTOC' && (
                <span className="text-[10px] text-zinc-600 italic">(no TOC found)</span>
              )}
            </div>
            {mode === 'perTOC' && hasTOC && (
              <div className="mt-2 space-y-2">
                {/* ── TOC Tree Browser ────────────────────── */}
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-zinc-500 font-medium">
                    Click a bookmark to set split depth
                  </p>
                  {selectedTOCPath !== null && (
                    <button
                      onClick={() => { setSelectedTOCPath(null); setTocDepth(1); }}
                      className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      Clear selection
                    </button>
                  )}
                </div>
                <div className="bg-zinc-800/60 border border-zinc-700 rounded-lg max-h-52 overflow-y-auto">
                  <div className="py-1">
                    {renderTOCTreeNodes(tocItems!, '', 0)}
                  </div>
                </div>

                {/* ── Depth indicator + quick buttons ─────── */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-zinc-600">
                    Depth:{' '}
                    <span className="text-green-400 font-semibold">
                      {tocDepth === 'all' ? 'All' : tocDepth === 0 ? 'Top Level' : `Level ${tocDepth}`}
                    </span>
                    {' → '}
                    <span className="text-zinc-300 tabular-nums">{preview.fileCount}</span>
                    <span className="text-zinc-600"> file{preview.fileCount !== 1 ? 's' : ''}</span>
                  </span>
                  <div className="flex-1" />
                  <div className="flex gap-1">
                    {depthLabels.map((d) => (
                      <button
                        key={String(d.value)}
                        onClick={() => { setTocDepth(d.value); setSelectedTOCPath(null); }}
                        className={`px-2 py-0.5 text-[10px] rounded border transition-all ${
                          tocDepth === d.value
                            ? 'bg-green-600/20 border-green-600/40 text-green-300'
                            : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600'
                        }`}
                        title={d.desc}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {mode === 'perTOC' && !hasTOC && tocItems === null && (
              <p className="text-[10px] text-blue-400 italic mt-1 flex items-center gap-1.5">
                <div className="w-3 h-3 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
                Loading table of contents...
              </p>
            )}
            {mode === 'perTOC' && !hasTOC && tocItems !== null && (
              <p className="text-[10px] text-zinc-500 italic mt-1">
                This PDF has no table of contents. Try another split mode.
              </p>
            )}
          </div>
        </label>
      </div>

      {/* Divider */}
      <div className="border-t border-zinc-800" />

      {/* Preview */}
      {previewLines.length > 0 && (
        <div className="space-y-2">
          <SectionHeader label={`Files (${preview.fileCount})`} />
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-3 max-h-48 overflow-auto space-y-1">
            {shownLines.map((line, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-zinc-400">
                <svg className="w-3.5 h-3.5 text-purple-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="font-mono">{line}</span>
              </div>
            ))}
            {hiddenCount > 0 && (
              <div className="text-xs text-zinc-500 italic pl-5.5">
                ... and {hiddenCount} more file{hiddenCount !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Summary preview */}
      <PreviewBar
        icon="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
        summary={`${filteredPageCount} pages → ${preview.fileCount} file${preview.fileCount !== 1 ? 's' : ''} in ${base}-split.zip`}
      />
        </>
      )}
    </DialogShell>
  );
}
