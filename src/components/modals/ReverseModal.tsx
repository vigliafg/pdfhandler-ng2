import { useState, useCallback, useMemo } from 'react';
import {
  DialogShell,
  RangeSelector,
  PreviewBar,
  HelpBox,
  ErrorBanner,
  parseRangeString,
  type RangeMode,
} from './shared';

interface ReverseModalProps {
  numPages: number;
  currentPage: number;
  selectedCount: number;
  selectedPagesSummary?: string;
  onClose: () => void;
  onReverse: (pageNumbers: number[]) => Promise<void>;
  executing?: boolean;
}

export function ReverseModal({
  numPages,
  currentPage,
  selectedCount,
  selectedPagesSummary,
  onClose,
  onReverse,
  executing = false,
}: ReverseModalProps) {
  const [rangeMode, setRangeMode] = useState<RangeMode>(
    selectedCount > 0 ? 'selected' : 'all',
  );
  const [customRange, setCustomRange] = useState('');
  const [error, setError] = useState<string | null>(null);

  const resolvedPages = useMemo(() => {
    let pages: number[] = [];
    switch (rangeMode) {
      case 'all':
        for (let i = 1; i <= numPages; i++) pages.push(i);
        break;
      case 'selected':
        pages = []; // resolved by parent
        break;
      case 'custom':
        pages = parseRangeString(customRange, numPages);
        break;
      default:
        pages = [];
        break;
    }
    return pages;
  }, [rangeMode, customRange, numPages]);

  const previewPages =
    rangeMode === 'all' ? numPages : rangeMode === 'selected' ? selectedCount : resolvedPages.length;

  // Build a preview of the mapping (first 5 pairs)
  const previewMapping = useMemo(() => {
    if (previewPages === 0) return '';
    if (previewPages === 0) return '';
    const pages = rangeMode === 'all'
      ? Array.from({ length: numPages }, (_, i) => i + 1)
      : rangeMode === 'selected'
        ? [] // preview just shows count
        : resolvedPages;
    const reversed = [...pages].reverse();
    const pairs: string[] = [];
    for (let i = 0; i < Math.min(5, pages.length); i++) {
      pairs.push(`${pages[i]} → ${reversed[i]}`);
    }
    if (pages.length > 5) pairs.push(`... (+${pages.length - 5} more)`);
    return pairs.join(', ');
  }, [rangeMode, resolvedPages, numPages, previewPages]);

  const canReverse =
    !executing &&
    (rangeMode === 'all' || rangeMode === 'selected' || (customRange.trim().length > 0 && resolvedPages.length > 0)) &&
    (rangeMode !== 'selected' || selectedCount > 0);

  const handleExecute = useCallback(async () => {
    if (!canReverse) return;
    setError(null);
    try {
      const pages = rangeMode === 'all' ? [] : rangeMode === 'selected' ? [] : resolvedPages;
      await onReverse(pages);
    } catch (err: any) {
      setError(err?.message || 'Reverse failed. The PDF may be corrupted.');
    }
  }, [canReverse, onReverse, rangeMode, resolvedPages, selectedCount]);

  return (
    <DialogShell
      title="Reverse Page Order"
      icon="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
      onCancel={onClose}
      onExecute={handleExecute}
      executeLabel={`Reverse ${previewPages} page${previewPages !== 1 ? 's' : ''}`}
      executeDisabled={!canReverse}
      disabledReason={
        executing ? undefined
        : rangeMode === 'custom' && (!customRange.trim() || resolvedPages.length === 0) ? 'Enter a valid custom page range (e.g. 10-20)'
        : rangeMode === 'selected' && selectedCount === 0 ? 'Select at least one page in the editor first'
        : undefined
      }
      executing={executing}
    >
      <HelpBox>Reverse the order of the selected pages — the first becomes last, the last becomes first. This operation <strong className="text-zinc-400">modifies the PDF in-place</strong>.</HelpBox>

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
        disabledModes={['current']}
      />

      {/* Divider */}
      <div className="border-t border-zinc-800" />

      {/* ⑤ Preview with mapping */}
      <PreviewBar
        icon="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
        summary={`${previewPages} page${previewPages !== 1 ? 's' : ''} ${rangeMode === 'all' ? `(all ${numPages} pages)` : ''} will be reversed.\n\nMapping: ${previewMapping}`}
      />
    </DialogShell>
  );
}
