import { useState, useCallback, useMemo } from 'react';
import {
  DialogShell,
  RangeSelector,
  PreviewBar,
  SectionHeader,
  HelpBox,
  ErrorBanner,
  parseRangeString,
  type RangeMode,
} from './shared';

type OperationMode = 'copy' | 'move';

interface CopyMoveModalProps {
  numPages: number;
  currentPage: number;
  selectedCount: number;
  selectedPagesSummary?: string;
  onClose: () => void;
  onCopyMove: (
    pageNumbers: number[],
    copies: number,
    location: 'before' | 'after',
    targetPage: number,
    operation: OperationMode,
  ) => Promise<void>;
  executing?: boolean;
}

export function CopyMoveModal({
  numPages,
  currentPage,
  selectedCount,
  selectedPagesSummary,
  onClose,
  onCopyMove,
  executing = false,
}: CopyMoveModalProps) {
  const [operation, setOperation] = useState<OperationMode>(
    selectedCount > 0 ? 'copy' : 'copy',
  );
  const [rangeMode, setRangeMode] = useState<RangeMode>(
    selectedCount > 0 ? 'selected' : 'all',
  );
  const [customRange, setCustomRange] = useState('');

  // Destination
  const [location, setLocation] = useState<'before' | 'after'>('after');
  const [destPageMode, setDestPageMode] = useState<'first' | 'last' | 'custom'>('last');
  const [destCustomPage, setDestCustomPage] = useState(String(currentPage));

  // Copies (only for copy mode)
  const [copies, setCopies] = useState(1);
  const [error, setError] = useState<string | null>(null);

  // Resolve pages
  const resolvedPages = useMemo(() => {
    let pages: number[] = [];
    switch (rangeMode) {
      case 'all':
        for (let i = 1; i <= numPages; i++) pages.push(i);
        break;
      case 'current':
        pages = [currentPage];
        break;
      case 'selected':
        pages = []; // resolved by parent
        break;
      case 'custom':
        pages = parseRangeString(customRange, numPages);
        break;
    }
    return pages;
  }, [rangeMode, customRange, numPages, currentPage]);

  const targetPage = useMemo(() => {
    switch (destPageMode) {
      case 'first': return 1;
      case 'last': return numPages;
      case 'custom': {
        const n = parseInt(destCustomPage, 10);
        return isNaN(n) ? numPages : Math.max(1, Math.min(n, numPages));
      }
      default: return numPages;
    }
  }, [destPageMode, destCustomPage, numPages]);

  const previewPages =
    rangeMode === 'selected' ? selectedCount : resolvedPages.length;

  const effectiveCopies = operation === 'move' ? 1 : copies;
  const newTotal = operation === 'move'
    ? numPages
    : numPages + previewPages * effectiveCopies;

  const canExecute =
    !executing &&
    (rangeMode !== 'custom' || customRange.trim().length > 0) &&
    (rangeMode !== 'selected' || selectedCount > 0) &&
    (rangeMode === 'selected' || resolvedPages.length > 0) &&
    (operation === 'move' || (copies >= 1 && copies <= 99));

  const handleExecute = useCallback(async () => {
    if (!canExecute) return;
    setError(null);
    try {
      const pages = rangeMode === 'selected' ? [] : resolvedPages;
      await onCopyMove(pages, effectiveCopies, location, targetPage, operation);
    } catch (err: any) {
      setError(err?.message || 'Operation failed. The PDF may be corrupted.');
    }
  }, [canExecute, onCopyMove, rangeMode, resolvedPages, effectiveCopies, location, targetPage, operation]);

  const executeLabel = operation === 'move'
    ? `Move ${previewPages} page${previewPages !== 1 ? 's' : ''}`
    : `Copy ${previewPages} page${previewPages !== 1 ? 's' : ''}`;

  const previewSummary = operation === 'move'
    ? `${previewPages} page${previewPages !== 1 ? 's' : ''} will be moved ${location} page ${targetPage}.\\nTotal pages: ${newTotal} (unchanged)`
    : `${previewPages} page${previewPages !== 1 ? 's' : ''} copied × ${copies} = ${previewPages * copies} new page${previewPages * copies !== 1 ? 's' : ''}\\nCopies inserted ${location} page ${targetPage}.\\nNew total: ${newTotal} pages`;

  return (
    <DialogShell
      title={operation === 'move' ? 'Move Pages' : 'Copy Pages'}
      icon={operation === 'move'
        ? 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4'
        : 'M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2'
      }
      onCancel={onClose}
      onExecute={handleExecute}
      executeLabel={executeLabel}
      executeDisabled={!canExecute}
      disabledReason={
        executing ? undefined
        : rangeMode === 'custom' && !customRange.trim() ? 'Enter a custom page range (e.g. 3-5)'
        : rangeMode === 'selected' && selectedCount === 0 ? 'Select at least one page in the editor first'
        : rangeMode !== 'selected' && resolvedPages.length === 0 ? 'No pages match the current range'
        : undefined
      }
      executing={executing}
    >
      <HelpBox>
        <strong className="text-zinc-400">Copy</strong> duplicates pages and inserts them at a chosen position.{' '}
        <strong className="text-zinc-400">Move</strong> cuts pages from their current location and pastes them elsewhere.{' '}
        This operation <strong className="text-zinc-400">modifies the PDF in-place</strong>.
      </HelpBox>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {/* ① Operation toggle */}
      <div className="space-y-2">
        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
          Operation
        </label>
        <div className="flex items-center bg-zinc-800 rounded-lg p-0.5 border border-zinc-700">
          {([
            { value: 'copy' as const, label: 'Copy', desc: 'Duplicate pages' },
            { value: 'move' as const, label: 'Move', desc: 'Cut & paste pages' },
          ]).map((opt) => (
            <button
              key={opt.value}
              onClick={() => setOperation(opt.value)}
              className={`flex-1 flex flex-col items-center gap-0.5 px-3 py-2 rounded-md transition-all ${
                operation === opt.value
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span className="text-xs font-semibold">{opt.label}</span>
              <span className="text-[9px] opacity-70">{opt.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ② Page Range */}
      <RangeSelector
        numPages={numPages}
        currentPage={currentPage}
        selectedCount={selectedCount}
        selectedPagesSummary={selectedPagesSummary}
        value={rangeMode}
        onChange={setRangeMode}
        customRange={customRange}
        onCustomRangeChange={setCustomRange}
      />

      {/* Divider */}
      <div className="border-t border-zinc-800" />

      {/* ③ Destination */}
      <div className="space-y-3">
        <SectionHeader label="Destination" />

        {/* Location: Before / After */}
        <div>
          <label className="text-xs text-zinc-500 mb-1 block">Location</label>
          <div className="flex items-center bg-zinc-800 rounded-lg p-0.5 border border-zinc-700">
            {([
              { value: 'before' as const, label: 'Before' },
              { value: 'after' as const, label: 'After' },
            ]).map((opt) => (
              <button
                key={opt.value}
                onClick={() => setLocation(opt.value)}
                className={`flex-1 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  location === opt.value
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Page: First / Last / Custom */}
        <div>
          <label className="text-xs text-zinc-500 mb-1 block">Page</label>
          <div className="space-y-2">
            <label className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="radio"
                name="destPage"
                checked={destPageMode === 'first'}
                onChange={() => setDestPageMode('first')}
                className="w-3.5 h-3.5 text-blue-500 bg-zinc-800 border-zinc-600 focus:ring-0"
              />
              <span className="text-sm text-zinc-300 group-hover:text-zinc-100">First</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="radio"
                name="destPage"
                checked={destPageMode === 'last'}
                onChange={() => setDestPageMode('last')}
                className="w-3.5 h-3.5 text-blue-500 bg-zinc-800 border-zinc-600 focus:ring-0"
              />
              <span className="text-sm text-zinc-300 group-hover:text-zinc-100">Last</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="radio"
                name="destPage"
                checked={destPageMode === 'custom'}
                onChange={() => { setDestPageMode('custom'); setDestCustomPage(String(currentPage)); }}
                className="w-3.5 h-3.5 text-blue-500 bg-zinc-800 border-zinc-600 focus:ring-0"
              />
              <span className="text-sm text-zinc-300 group-hover:text-zinc-100">Custom:</span>
              <input
                type="number"
                min={1}
                max={numPages}
                value={destCustomPage}
                onChange={(e) => setDestCustomPage(e.target.value)}
                disabled={destPageMode !== 'custom'}
                className="w-16 px-2 py-1 text-xs font-mono bg-zinc-800 border border-zinc-700 rounded text-zinc-200 text-center focus:outline-none focus:border-blue-500 disabled:opacity-40"
              />
            </label>
          </div>
        </div>

        {/* Copies (only for copy mode) */}
        {operation === 'copy' && (
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Copies</label>
            <input
              type="number"
              min={1}
              max={99}
              value={copies}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (v >= 1 && v <= 99) setCopies(v);
              }}
              className="w-20 px-3 py-2 text-sm font-mono bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 text-center focus:outline-none focus:border-blue-500"
            />
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-zinc-800" />

      {/* ④ Preview */}
      <PreviewBar
        icon={operation === 'move'
          ? 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4'
          : 'M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2'
        }
        summary={previewSummary}
      />
    </DialogShell>
  );
}
