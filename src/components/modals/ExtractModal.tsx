import { useState, useCallback, useMemo } from 'react';
import {
  DialogShell,
  RangeSelector,
  SubsetSelector,
  PreviewBar,
  SectionHeader,
  HelpBox,
  ErrorBanner,
  parseRangeString,
  type RangeMode,
  type SubsetValue,
} from './shared';

interface ExtractModalProps {
  /** Total pages in the current document. */
  numPages: number;
  /** Current page in the viewer. */
  currentPage: number;
  /** Number of currently selected pages in the editor. */
  selectedCount: number;
  /** Summary of selected pages (e.g. "5, 8, 12-18, 25"). */
  selectedPagesSummary?: string;
  /** Original file name (without path) for the default output name. */
  fileName: string | null;
  /** Called when user cancels. */
  onClose: () => void;
  /** Called when user clicks Extract. Passes the resolved page numbers and options. */
  onExtract: (pageNumbers: number[], options: ExtractOptions) => Promise<void>;
  executing?: boolean;
}

export interface ExtractOptions {
  outputType: 'single' | 'separate';
  deleteAfter: boolean;
}

type OutputType = 'single' | 'separate';

export function ExtractModal({
  numPages,
  currentPage,
  selectedCount,
  selectedPagesSummary,
  fileName,
  onClose,
  onExtract,
  executing = false,
}: ExtractModalProps) {
  const [rangeMode, setRangeMode] = useState<RangeMode>(
    selectedCount > 0 ? 'selected' : 'all',
  );
  const [customRange, setCustomRange] = useState('');
  const [subset, setSubset] = useState<SubsetValue>('all');
  const [outputType, setOutputType] = useState<OutputType>('single');
  const [deleteAfter, setDeleteAfter] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRangeChange = useCallback((mode: RangeMode) => {
    setRangeMode(mode);
  }, []);

  const handleCustomRangeChange = useCallback((value: string) => {
    setCustomRange(value);
  }, []);

  // Resolve page numbers based on current selections
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
        // The modal doesn't have direct access to selectedPages set,
        // but we use selectedCount as an indicator. The parent will
        // pass selected pages via the onExtract callback.
        // For preview, we show the count.
        pages = [];
        break;
      case 'custom':
        pages = parseRangeString(customRange, numPages);
        break;
    }

    // Apply subset filter
    if (subset === 'odd') {
      pages = pages.filter((p) => p % 2 === 1);
    } else if (subset === 'even') {
      pages = pages.filter((p) => p % 2 === 0);
    }

    return pages;
  }, [rangeMode, customRange, subset, numPages, currentPage]);

  const canExtract =
    !executing &&
    (rangeMode !== 'custom' || customRange.trim().length > 0) &&
    (rangeMode !== 'selected' || selectedCount > 0) &&
    (rangeMode === 'selected' || resolvedPages.length > 0);

  const baseName = fileName?.replace(/\.pdf$/i, '') ?? 'document';

  const previewPages =
    rangeMode === 'selected' ? selectedCount : resolvedPages.length;

  const handleExecute = useCallback(async () => {
    if (!canExtract) return;
    setError(null);
    try {
      await onExtract(rangeMode === 'selected' ? [] : resolvedPages, {
        outputType,
        deleteAfter,
      });
    } catch (err: any) {
      setError(err?.message || 'Extraction failed. The PDF may be corrupted or too large.');
    }
  }, [canExtract, onExtract, rangeMode, resolvedPages, outputType, deleteAfter]);

  return (
    <DialogShell
      title="Extract Pages"
      icon="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      onCancel={onClose}
      onExecute={handleExecute}
      executeLabel={`Extract ${previewPages} page${previewPages !== 1 ? 's' : ''}`}
      executeDisabled={!canExtract}
      disabledReason={
        executing ? undefined
        : rangeMode === 'custom' && !customRange.trim() ? 'Enter a custom page range (e.g. 10-20, 34)'
        : rangeMode === 'selected' && selectedCount === 0 ? 'Select at least one page in the editor first'
        : rangeMode !== 'selected' && resolvedPages.length === 0 ? 'No pages match the current range and subset'
        : undefined
      }
      executing={executing}
    >
      <HelpBox>Extract selected pages into a new PDF or a ZIP of separate files. The original document is <strong className="text-zinc-400">not modified</strong> unless you enable &ldquo;Delete after extraction.&rdquo;</HelpBox>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {/* ① Page Range */}
      <RangeSelector
        numPages={numPages}
        currentPage={currentPage}
        selectedCount={selectedCount}
        selectedPagesSummary={selectedPagesSummary}
        value={rangeMode}
        onChange={handleRangeChange}
        customRange={customRange}
        onCustomRangeChange={handleCustomRangeChange}
      />

      {/* ② Subset */}
      <SubsetSelector value={subset} onChange={setSubset} />

      {/* Divider */}
      <div className="border-t border-zinc-800" />

      {/* ③ Output */}
      <div className="space-y-3">
        <SectionHeader label="Output" />

        {/* Output type */}
        <div>
          <label className="text-xs text-zinc-500 mb-1 block">Type</label>
          <div className="flex items-center bg-zinc-800 rounded-lg p-0.5 border border-zinc-700">
            {([
              { value: 'single' as OutputType, label: 'Single PDF' },
              { value: 'separate' as OutputType, label: 'Separate files (ZIP)' },
            ]).map((opt) => (
              <button
                key={opt.value}
                onClick={() => setOutputType(opt.value)}
                className={`flex-1 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  outputType === opt.value
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* File name */}
        <div>
          <label className="text-xs text-zinc-500 mb-1 block">Name</label>
          <input
            type="text"
            readOnly
            value={
              outputType === 'single'
                ? `${baseName}-extracted.pdf`
                : `${baseName}-extracted.zip`
            }
            className="w-full px-3 py-2 text-xs font-mono bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-300 cursor-default"
          />
        </div>
      </div>

      {/* ④ Options */}
      <div className="space-y-3">
        <SectionHeader label="Options" />
        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={deleteAfter}
            onChange={(e) => setDeleteAfter(e.target.checked)}
            className="w-4 h-4 mt-0.5 text-blue-500 bg-zinc-800 border-zinc-600 rounded focus:ring-blue-500 focus:ring-0"
          />
          <div>
            <span className="text-sm text-zinc-300 group-hover:text-zinc-100">
              Delete pages after extraction
            </span>
            <p className="text-xs text-zinc-600 mt-0.5">
              Removes the extracted pages from the original document and compacts it in a single operation.
            </p>
          </div>
        </label>
      </div>

      {/* Divider */}
      <div className="border-t border-zinc-800" />

      {/* ⑤ Preview */}
      <PreviewBar
        icon="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        summary={`${previewPages} page${previewPages !== 1 ? 's' : ''} will be extracted${rangeMode === 'selected' && selectedCount > 0 ? ' (from selected pages)' : ''} as ${outputType === 'single' ? 'a single PDF' : 'separate files in a ZIP'}.\nFile: ${baseName}-extracted.${outputType === 'single' ? 'pdf' : 'zip'} (${previewPages} page${previewPages !== 1 ? 's' : ''})`}
        warning={
          deleteAfter && previewPages > 0
            ? `With "Delete after extraction": PDF original: ${numPages} → ${numPages - previewPages} pages`
            : undefined
        }
      />
    </DialogShell>
  );
}
