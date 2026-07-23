import { useState, useCallback, useMemo, useRef } from 'react';
import { PDFDocument } from 'pdf-lib';
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

type Operation = 'insert' | 'replace';

export interface InsertReplaceParams {
  operation: Operation;
  sourceBytes: ArrayBuffer;
  sourceFileName: string;
  sourcePages: number[];
  /** Insert: where to place the new pages. */
  location: 'before' | 'after';
  /** Insert: 1-based target page for insertion. */
  targetPage: number;
  /** Replace: 1-based pages to replace (empty = resolved from parent). */
  targetPages: number[];
}

interface InsertReplaceModalProps {
  numPages: number;
  currentPage: number;
  selectedCount: number;
  selectedPagesSummary?: string;
  onClose: () => void;
  onApply: (params: InsertReplaceParams) => Promise<void>;
  executing?: boolean;
}

export function InsertReplaceModal({
  numPages,
  currentPage,
  selectedCount,
  selectedPagesSummary,
  onClose,
  onApply,
  executing = false,
}: InsertReplaceModalProps) {
  // ── Operation toggle ──────────────────────────────────
  const [operation, setOperation] = useState<Operation>('insert');

  // ── Target pages (Replace only) ───────────────────────
  const [targetRangeMode, setTargetRangeMode] = useState<RangeMode>(
    selectedCount > 0 ? 'selected' : 'current',
  );
  const [targetCustomRange, setTargetCustomRange] = useState('');

  // ── Source PDF ────────────────────────────────────────
  const [sourceBytes, setSourceBytes] = useState<ArrayBuffer | null>(null);
  const [sourceFileName, setSourceFileName] = useState<string | null>(null);
  const [sourceNumPages, setSourceNumPages] = useState(0);

  // ── Source pages range ────────────────────────────────
  const [sourceRangeMode, setSourceRangeMode] = useState<RangeMode>('all');
  const [sourceCustomRange, setSourceCustomRange] = useState('');

  // ── Destination (Insert only) ─────────────────────────
  const [location, setLocation] = useState<'before' | 'after'>('after');
  const [destPageMode, setDestPageMode] = useState<'first' | 'last' | 'custom'>('last');
  const [destCustomPage, setDestCustomPage] = useState(String(currentPage));

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Source file loader ────────────────────────────────
  const handleSourceFile = useCallback(async (file: File) => {
    try {
      const bytes = await file.arrayBuffer();
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      setSourceBytes(bytes);
      setSourceFileName(file.name);
      setSourceNumPages(doc.getPageCount());
      setSourceRangeMode('all');
      setSourceCustomRange('');
    } catch {
      setError('Failed to load source PDF. The file may be corrupted or password-protected.');
    }
  }, []);

  // ── Resolved target pages (Replace only) ──────────────
  const resolvedTargetPages = useMemo(() => {
    let pages: number[] = [];
    switch (targetRangeMode) {
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
        pages = parseRangeString(targetCustomRange, numPages);
        break;
    }
    return pages;
  }, [targetRangeMode, targetCustomRange, numPages, currentPage]);

  // ── Resolved source pages ─────────────────────────────
  const resolvedSourcePages = useMemo(() => {
    if (!sourceBytes) return [];
    let pages: number[] = [];
    switch (sourceRangeMode) {
      case 'all':
        for (let i = 1; i <= sourceNumPages; i++) pages.push(i);
        break;
      case 'custom':
        pages = parseRangeString(sourceCustomRange, sourceNumPages);
        break;
      default:
        pages = [];
        break;
    }
    return pages;
  }, [sourceBytes, sourceRangeMode, sourceCustomRange, sourceNumPages]);

  // ── Destination page (Insert only) ────────────────────
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

  // ── Counters for preview ──────────────────────────────
  const targetPreviewCount =
    targetRangeMode === 'selected' ? selectedCount : resolvedTargetPages.length;
  const sourcePreviewCount = resolvedSourcePages.length;

  // ── New total after operation ─────────────────────────
  const newTotal = operation === 'insert'
    ? numPages + sourcePreviewCount
    : numPages - targetPreviewCount + sourcePreviewCount;

  // ── Validity checks ───────────────────────────────────
  const canExecute =
    !executing &&
    sourceBytes !== null &&
    resolvedSourcePages.length > 0 &&
    (sourceRangeMode !== 'custom' || sourceCustomRange.trim().length > 0) &&
    (operation === 'insert' || (
      (targetRangeMode !== 'custom' || targetCustomRange.trim().length > 0) &&
      (targetRangeMode !== 'selected' || selectedCount > 0) &&
      (targetRangeMode === 'selected' || resolvedTargetPages.length > 0)
    ));

  // ── Execute ───────────────────────────────────────────
  const handleExecute = useCallback(async () => {
    if (!canExecute || !sourceBytes) return;
    setError(null);
    try {
      const targetPages = targetRangeMode === 'selected' ? [] : resolvedTargetPages;
      await onApply({
        operation,
        sourceBytes,
        sourceFileName: sourceFileName ?? 'source.pdf',
        sourcePages: resolvedSourcePages,
        location,
        targetPage,
        targetPages,
      });
    } catch (err: any) {
      setError(err?.message || 'Operation failed. Check that both PDFs are valid.');
    }
  }, [canExecute, onApply, operation, sourceBytes, sourceFileName, resolvedSourcePages,
    location, targetPage, targetRangeMode, resolvedTargetPages]);

  // ── Preview text ──────────────────────────────────────
  const previewSummary = !sourceBytes
    ? 'Select a source PDF file to preview.'
    : operation === 'insert'
      ? `${sourcePreviewCount} page${sourcePreviewCount !== 1 ? 's' : ''} from ${sourceFileName ?? 'source'} will be inserted ${location} page ${targetPage}.\nNew total: ${newTotal} pages`
      : `${targetPreviewCount} page${targetPreviewCount !== 1 ? 's' : ''} will be replaced with ${sourcePreviewCount} page${sourcePreviewCount !== 1 ? 's' : ''} from ${sourceFileName ?? 'source'}.\nNew total: ${newTotal} pages (was ${numPages})`;

  const previewWarning =
    operation === 'replace' && sourceBytes
      ? sourcePreviewCount > targetPreviewCount
        ? `⚠️ Replacement will add ${sourcePreviewCount - targetPreviewCount} more page${sourcePreviewCount - targetPreviewCount !== 1 ? 's' : ''} than removed.`
        : sourcePreviewCount < targetPreviewCount
          ? `⚠️ Replacement will remove ${targetPreviewCount - sourcePreviewCount} more page${targetPreviewCount - sourcePreviewCount !== 1 ? 's' : ''} than added.`
          : undefined
      : undefined;

  const executeLabel = operation === 'insert' ? 'Insert' : 'Replace';

  return (
    <DialogShell
      title="Insert / Replace Pages"
      icon="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
      onCancel={onClose}
      onExecute={handleExecute}
      executeLabel={executeLabel}
      executeDisabled={!canExecute}
      disabledReason={
        executing ? undefined
        : !sourceBytes ? 'Select a source PDF file first'
        : resolvedSourcePages.length === 0 ? 'No valid pages in source range — check the custom range input'
        : operation === 'replace' && targetRangeMode === 'custom' && !targetCustomRange.trim() ? 'Enter a target page range to replace'
        : operation === 'replace' && targetRangeMode === 'selected' && selectedCount === 0 ? 'Select at least one page in the editor first'
        : undefined
      }
      executing={executing}
    >
      {/* Help text */}
      <HelpBox>
        <strong className="text-zinc-400">Insert</strong> adds pages from another PDF into this document.{' '}
        <strong className="text-zinc-400">Replace</strong> swaps pages in this document with pages from another PDF.{' '}
        This operation <strong className="text-zinc-400">modifies the PDF in-place</strong>.
      </HelpBox>

      {/* Error banner */}
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {/* ── Operation toggle ──────────────────────────── */}
      <div className="space-y-2">
        <SectionHeader label="Operation" />
        <div className="flex items-center bg-zinc-800 rounded-lg p-0.5 border border-zinc-700">
          <button
            onClick={() => setOperation('insert')}
            className={`flex-1 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              operation === 'insert'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span className="flex items-center justify-center gap-1.5">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Insert
            </span>
          </button>
          <button
            onClick={() => setOperation('replace')}
            className={`flex-1 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              operation === 'replace'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span className="flex items-center justify-center gap-1.5">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h6v2H6v4H4V4zm14 0h-6v2h4v4h2V4zM4 20h6v-2H6v-4H4v6zm14 0h-6v-2h4v-4h2v6z" />
              </svg>
              Replace
            </span>
          </button>
        </div>
      </div>

      {/* ── Target Pages (Replace only) ────────────────── */}
      {operation === 'replace' && (
        <RangeSelector
          numPages={numPages}
          currentPage={currentPage}
          selectedCount={selectedCount}
          selectedPagesSummary={selectedPagesSummary}
          value={targetRangeMode}
          onChange={setTargetRangeMode}
          customRange={targetCustomRange}
          onCustomRangeChange={setTargetCustomRange}
        />
      )}

      {/* Divider */}
      <div className="border-t border-zinc-800" />

      {/* ── Source File ────────────────────────────────── */}
      <div className="space-y-3">
        <SectionHeader label="Source File" />
        <div className="flex items-center gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition-colors shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-2l-2-2H9L7 5H5a2 2 0 00-2 2z" />
            </svg>
            {sourceFileName ? 'Change file...' : 'Choose file...'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleSourceFile(f);
              e.target.value = '';
            }}
            className="hidden"
          />
          {sourceFileName ? (
            <div className="flex-1 min-w-0">
              <p className="text-sm text-zinc-200 truncate">{sourceFileName}</p>
              <p className="text-xs text-zinc-600">
                Pages: 1–{sourceNumPages} ({sourceNumPages} total)
              </p>
            </div>
          ) : (
            <p className="text-xs text-zinc-600 italic">No file selected</p>
          )}
        </div>
      </div>

      {/* ── Source Pages ───────────────────────────────── */}
      {sourceBytes && (
        <RangeSelector
          numPages={sourceNumPages}
          currentPage={1}
          selectedCount={0}
          value={sourceRangeMode}
          onChange={setSourceRangeMode}
          customRange={sourceCustomRange}
          onCustomRangeChange={setSourceCustomRange}
          disabledModes={['current', 'selected']}
        />
      )}

      {/* Divider */}
      <div className="border-t border-zinc-800" />

      {/* ── Destination (Insert only) ──────────────────── */}
      {operation === 'insert' && (
        <div className="space-y-3">
          <SectionHeader label="Destination" />

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

          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Page</label>
            <div className="space-y-2">
              {([
                { value: 'first' as const, label: 'First' },
                { value: 'last' as const, label: 'Last' },
                { value: 'custom' as const, label: 'Custom:' },
              ]).map((opt) => (
                <label key={opt.value} className="flex items-center gap-2.5 cursor-pointer group">
                  <input
                    type="radio"
                    name="destPage"
                    checked={destPageMode === opt.value}
                    onChange={() => {
                      setDestPageMode(opt.value);
                      if (opt.value === 'custom') setDestCustomPage(String(currentPage));
                    }}
                    className="w-3.5 h-3.5 text-blue-500 bg-zinc-800 border-zinc-600 focus:ring-0"
                  />
                  <span className="text-sm text-zinc-300 group-hover:text-zinc-100">{opt.label}</span>
                  {opt.value === 'custom' && (
                    <input
                      type="number"
                      min={1}
                      max={numPages}
                      value={destCustomPage}
                      onChange={(e) => setDestCustomPage(e.target.value)}
                      disabled={destPageMode !== 'custom'}
                      className="w-16 px-2 py-1 text-xs font-mono bg-zinc-800 border border-zinc-700 rounded text-zinc-200 text-center focus:outline-none focus:border-blue-500 disabled:opacity-40"
                    />
                  )}
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Divider */}
      <div className="border-t border-zinc-800" />

      {/* ── Preview ────────────────────────────────────── */}
      <PreviewBar
        icon={operation === 'insert'
          ? 'M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z'
          : 'M4 4h6v2H6v4H4V4zm14 0h-6v2h4v4h2V4zM4 20h6v-2H6v-4H4v6zm14 0h-6v-2h4v-4h2v6z'}
        summary={previewSummary}
        warning={previewWarning}
      />
    </DialogShell>
  );
}
