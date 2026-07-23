import { useState, useCallback, useMemo } from 'react';
import type { RotationAngle } from '../../lib/pdfOperations';
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

interface RotateModalProps {
  numPages: number;
  currentPage: number;
  selectedCount: number;
  selectedPagesSummary?: string;
  onClose: () => void;
  onRotate: (pageNumbers: number[], angle: RotationAngle) => Promise<void>;
  executing?: boolean;
}

const ANGLES: { value: RotationAngle; label: string; icon: string }[] = [
  {
    value: 90,
    label: 'Clockwise 90°',
    icon: 'M21 10H11a5 5 0 00-5 5v2m15-7l-4-4m4 4l-4 4',
  },
  {
    value: 180,
    label: '180°',
    icon: 'M4 4h16v16H4z M12 4v16 M4 12h16',
  },
  {
    value: 270,
    label: 'Counterclockwise 90°',
    icon: 'M3 10h10a5 5 0 015 5v2M3 10l4-4M3 10l4 4',
  },
];

export function RotateModal({
  numPages,
  currentPage,
  selectedCount,
  selectedPagesSummary,
  onClose,
  onRotate,
  executing = false,
}: RotateModalProps) {
  const [angle, setAngle] = useState<RotationAngle>(90);
  const [rangeMode, setRangeMode] = useState<RangeMode>(
    selectedCount > 0 ? 'selected' : 'all',
  );
  const [customRange, setCustomRange] = useState('');
  const [subset, setSubset] = useState<SubsetValue>('all');
  const [error, setError] = useState<string | null>(null);

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
        pages = [];
        break;
      case 'custom':
        pages = parseRangeString(customRange, numPages);
        break;
    }
    if (subset === 'odd') pages = pages.filter((p) => p % 2 === 1);
    else if (subset === 'even') pages = pages.filter((p) => p % 2 === 0);
    return pages;
  }, [rangeMode, customRange, subset, numPages, currentPage]);

  const previewPages =
    rangeMode === 'selected' ? selectedCount : resolvedPages.length;

  const canRotate =
    !executing &&
    (rangeMode !== 'custom' || customRange.trim().length > 0) &&
    (rangeMode !== 'selected' || selectedCount > 0) &&
    (rangeMode === 'selected' || resolvedPages.length > 0);

  const handleExecute = useCallback(async () => {
    if (!canRotate) return;
    setError(null);
    try {
      const pages = rangeMode === 'selected' ? [] : resolvedPages;
      await onRotate(pages, angle);
    } catch (err: any) {
      setError(err?.message || 'Rotation failed. The PDF may be corrupted or too large.');
    }
  }, [canRotate, onRotate, rangeMode, resolvedPages, angle]);

  return (
    <DialogShell
      title="Rotate Pages"
      icon="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      onCancel={onClose}
      onExecute={handleExecute}
      executeLabel={`Rotate ${previewPages} page${previewPages !== 1 ? 's' : ''}`}
      executeDisabled={!canRotate}
      disabledReason={
        executing ? undefined
        : rangeMode === 'custom' && !customRange.trim() ? 'Enter a custom page range (e.g. 3-5)'
        : rangeMode === 'selected' && selectedCount === 0 ? 'Select at least one page in the editor first'
        : rangeMode !== 'selected' && resolvedPages.length === 0 ? 'No pages match the current range and subset'
        : undefined
      }
      executing={executing}
    >
      <HelpBox>Rotate pages by 90°, 180°, or 270° (counterclockwise). This operation <strong className="text-zinc-400">modifies the PDF in-place</strong> — the table of contents is preserved.</HelpBox>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {/* Direction */}
      <div className="space-y-2">
        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
          Direction
        </label>
        <div className="grid grid-cols-3 gap-2">
          {ANGLES.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setAngle(opt.value)}
              className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border transition-all ${
                angle === opt.value
                  ? 'bg-blue-500/15 border-blue-500/40 text-blue-300'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'
              }`}
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d={opt.icon} />
              </svg>
              <span className="text-[10px] font-semibold">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

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

      {/* ⑤ Preview */}
      <PreviewBar
        icon="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
        summary={`${previewPages} page${previewPages !== 1 ? 's' : ''} will be rotated ${angle}° ${angle === 90 ? 'clockwise' : angle === 270 ? 'counterclockwise' : ''}.`}
      />
    </DialogShell>
  );
}
