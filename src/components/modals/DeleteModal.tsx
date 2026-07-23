import { useState, useCallback, useMemo } from 'react';
import {
  DialogShell,
  RangeSelector,
  SubsetSelector,
  PreviewBar,
  HelpBox,
  ErrorBanner,
  parseRangeString,
  type RangeMode,
  type SubsetValue,
} from './shared';

interface DeleteModalProps {
  numPages: number;
  currentPage: number;
  selectedCount: number;
  selectedPagesSummary?: string;
  onClose: () => void;
  onDelete: (pageNumbers: number[]) => Promise<void>;
  executing?: boolean;
}

export function DeleteModal({
  numPages,
  currentPage,
  selectedCount,
  selectedPagesSummary,
  onClose,
  onDelete,
  executing = false,
}: DeleteModalProps) {
  const [rangeMode, setRangeMode] = useState<RangeMode>(
    selectedCount > 0 ? 'selected' : 'all',
  );
  const [customRange, setCustomRange] = useState('');
  const [subset, setSubset] = useState<SubsetValue>('all');
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

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

    if (subset === 'odd') {
      pages = pages.filter((p) => p % 2 === 1);
    } else if (subset === 'even') {
      pages = pages.filter((p) => p % 2 === 0);
    }

    return pages;
  }, [rangeMode, customRange, subset, numPages, currentPage]);

  const previewPages =
    rangeMode === 'selected' ? selectedCount : resolvedPages.length;

  const remainingPages = numPages - previewPages;

  const canDelete =
    !executing &&
    confirmed &&
    (rangeMode !== 'custom' || customRange.trim().length > 0) &&
    (rangeMode !== 'selected' || selectedCount > 0) &&
    (rangeMode === 'selected' || resolvedPages.length > 0) &&
    remainingPages >= 1;

  const handleExecute = useCallback(async () => {
    if (!canDelete) return;
    setError(null);
    try {
      const pages = rangeMode === 'selected' ? [] : resolvedPages;
      await onDelete(pages);
    } catch (err: any) {
      setError(err?.message || 'Deletion failed. The PDF may be corrupted or read-only.');
    }
  }, [canDelete, onDelete, rangeMode, resolvedPages]);

  return (
    <DialogShell
      title="Delete Pages"
      icon="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      onCancel={onClose}
      onExecute={handleExecute}
      executeLabel={`Delete ${previewPages} page${previewPages !== 1 ? 's' : ''}`}
      executeDisabled={!canDelete}
      disabledReason={
        executing ? undefined
        : !confirmed ? 'Confirm that you understand this is permanent'
        : remainingPages <= 0 ? 'Cannot delete every page — at least one must remain'
        : rangeMode === 'custom' && !customRange.trim() ? 'Enter a custom page range (e.g. 5-10)'
        : rangeMode === 'selected' && selectedCount === 0 ? 'Select at least one page in the editor first'
        : rangeMode !== 'selected' && resolvedPages.length === 0 ? 'No pages match the current range and subset'
        : undefined
      }
      executing={executing}
    >
      <HelpBox>Permanently remove pages from the current document. This operation <strong className="text-zinc-400">modifies the PDF in-place</strong> — save a copy first if needed.</HelpBox>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {/* ① Page Range */}
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

      {/* ② Subset */}
      <SubsetSelector value={subset} onChange={setSubset} />

      {/* Divider */}
      <div className="border-t border-zinc-800" />

      {/* Confirmation checkbox */}
      <label className="flex items-start gap-3 cursor-pointer group">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="w-4 h-4 mt-0.5 text-blue-500 bg-zinc-800 border-zinc-600 rounded focus:ring-blue-500 focus:ring-0"
        />
        <span className="text-sm text-zinc-400 group-hover:text-zinc-300 transition-colors">
          I understand this will permanently delete the selected pages from the document.
        </span>
      </label>

      {/* ⑤ Preview with warning */}
      <PreviewBar
        icon="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
        summary={`${previewPages} page${previewPages !== 1 ? 's' : ''} will be deleted. ${remainingPages} page${remainingPages !== 1 ? 's' : ''} will remain.`}
        warning={
          remainingPages <= 0
            ? '⚠️ Cannot delete all pages — at least one page must remain.'
            : remainingPages < 5
              ? `⚠️ Only ${remainingPages} page${remainingPages !== 1 ? 's' : ''} will remain after deletion.`
              : undefined
        }
      />
    </DialogShell>
  );
}
