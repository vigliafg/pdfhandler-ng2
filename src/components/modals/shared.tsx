import { useState, type ReactNode } from 'react';

// ─── Modal wrapper (existing) ─────────────────────────────────

export function ModalWrapper({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h2 className="text-lg font-bold text-zinc-100">{title}</h2>
          <button onClick={onClose} className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors rounded-lg hover:bg-zinc-800">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="text-xs text-zinc-500 mb-1 block">{label}</label>
      {children}
    </div>
  );
}

// ─── Dialog Shell (new) ──────────────────────────────────────

export interface DialogShellProps {
  title: string;
  icon: string; // SVG path `d` attribute
  onCancel: () => void;
  onExecute: () => void;
  executeLabel?: string;
  executeDisabled?: boolean;
  /** Shown as a tooltip when the execute button is disabled. */
  disabledReason?: string;
  executing?: boolean;
  children: ReactNode;
}

export function DialogShell({
  title,
  icon,
  onCancel,
  onExecute,
  executeLabel = 'Execute',
  executeDisabled = false,
  disabledReason,
  executing = false,
  children,
}: DialogShellProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
            </svg>
            <h2 className="text-base font-bold text-zinc-100">{title}</h2>
          </div>
          <button onClick={onCancel} className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors rounded-lg hover:bg-zinc-800">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">{children}</div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-zinc-800 bg-zinc-900/50">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <div className="relative group/tooltip">
            <button
              onClick={onExecute}
              disabled={executeDisabled || executing}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:text-blue-300 disabled:cursor-not-allowed rounded-lg transition-all"
            >
              {executing ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : null}
              {executing ? 'Processing...' : executeLabel}
            </button>
            {/* Tooltip shown when button is disabled and a reason is provided */}
            {executeDisabled && disabledReason && !executing && (
              <div className="absolute bottom-full right-0 mb-2 px-3 py-2 text-xs text-zinc-200 bg-zinc-700 border border-zinc-600 rounded-lg shadow-xl whitespace-nowrap opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-10">
                <div className="flex items-start gap-2">
                  <svg className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-px" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{disabledReason}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Range Selector ──────────────────────────────────────────

export type RangeMode = 'all' | 'current' | 'selected' | 'custom';

export interface RangeSelectorProps {
  numPages: number;
  currentPage: number;
  selectedCount: number;
  selectedPagesSummary?: string; // e.g. "pagine 5, 8, 12-18, 25, 70"
  value: RangeMode;
  onChange: (mode: RangeMode) => void;
  customRange: string;
  onCustomRangeChange: (value: string) => void;
  disabledModes?: RangeMode[];
}

/**
 * Parse a custom range string like "5, 10-20, 30-" into an array of
 * 1-based page numbers. "30-" means from page 30 to the end.
 */
export function parseRangeString(input: string, numPages: number): number[] {
  const pages = new Set<number>();
  const parts = input.split(',').map((s) => s.trim()).filter(Boolean);

  for (const part of parts) {
    if (part.endsWith('-')) {
      // Open-ended range: "30-" means from 30 to numPages
      const start = parseInt(part.slice(0, -1), 10);
      if (isNaN(start) || start < 1 || start > numPages) continue;
      for (let p = start; p <= numPages; p++) pages.add(p);
    } else if (part.includes('-')) {
      const [a, b] = part.split('-').map(Number);
      if (isNaN(a) || isNaN(b)) continue;
      const start = Math.max(1, Math.min(a, b));
      const end = Math.min(numPages, Math.max(a, b));
      for (let p = start; p <= end; p++) pages.add(p);
    } else {
      const n = parseInt(part, 10);
      if (!isNaN(n) && n >= 1 && n <= numPages) pages.add(n);
    }
  }

  return Array.from(pages).sort((a, b) => a - b);
}

export function RangeSelector({
  numPages,
  currentPage,
  selectedCount,
  selectedPagesSummary,
  value,
  onChange,
  customRange,
  onCustomRangeChange,
  disabledModes = [],
}: RangeSelectorProps) {
  const isDisabled = (m: RangeMode) => disabledModes.includes(m);

  return (
    <div className="space-y-2.5">
      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
        Page Range
      </label>

      {/* All pages */}
      <label className={`flex items-center gap-2.5 cursor-pointer group ${isDisabled('all') ? 'opacity-40 pointer-events-none' : ''}`}>
        <input
          type="radio"
          name="range"
          checked={value === 'all'}
          onChange={() => onChange('all')}
          className="w-3.5 h-3.5 text-blue-500 bg-zinc-800 border-zinc-600 focus:ring-blue-500 focus:ring-0"
        />
        <span className="text-sm text-zinc-300 group-hover:text-zinc-100">All pages</span>
        <span className="text-xs text-zinc-600 tabular-nums">({numPages} pages)</span>
      </label>

      {/* Current page */}
      <label className={`flex items-center gap-2.5 cursor-pointer group ${isDisabled('current') ? 'opacity-40 pointer-events-none' : ''}`}>
        <input
          type="radio"
          name="range"
          checked={value === 'current'}
          onChange={() => onChange('current')}
          className="w-3.5 h-3.5 text-blue-500 bg-zinc-800 border-zinc-600 focus:ring-blue-500 focus:ring-0"
        />
        <span className="text-sm text-zinc-300 group-hover:text-zinc-100">Current page</span>
        <span className="text-xs text-zinc-600 tabular-nums">(page {currentPage})</span>
      </label>

      {/* Selected pages */}
      <label className={`flex items-start gap-2.5 cursor-pointer group ${isDisabled('selected') ? 'opacity-40 pointer-events-none' : ''}`}>
        <input
          type="radio"
          name="range"
          checked={value === 'selected'}
          onChange={() => onChange('selected')}
          disabled={isDisabled('selected') || selectedCount === 0}
          className="w-3.5 h-3.5 mt-0.5 text-blue-500 bg-zinc-800 border-zinc-600 focus:ring-blue-500 focus:ring-0 disabled:opacity-30"
        />
        <div>
          <span className="text-sm text-zinc-300 group-hover:text-zinc-100">
            Selected pages
          </span>
          {selectedCount > 0 ? (
            <div className="text-xs text-blue-400 mt-0.5">
              <span className="font-semibold tabular-nums">{selectedCount} selected</span>
              {selectedPagesSummary && (
                <span className="text-zinc-600 ml-1">({selectedPagesSummary})</span>
              )}
            </div>
          ) : (
            <div className="text-xs text-zinc-600 mt-0.5 italic">(none selected)</div>
          )}
        </div>
      </label>

      {/* Custom range */}
      <label className={`flex items-start gap-2.5 cursor-pointer group ${isDisabled('custom') ? 'opacity-40 pointer-events-none' : ''}`}>
        <input
          type="radio"
          name="range"
          checked={value === 'custom'}
          onChange={() => onChange('custom')}
          disabled={isDisabled('custom')}
          className="w-3.5 h-3.5 mt-0.5 text-blue-500 bg-zinc-800 border-zinc-600 focus:ring-blue-500 focus:ring-0 disabled:opacity-30"
        />
        <div className="flex-1">
          <span className="text-sm text-zinc-300 group-hover:text-zinc-100">Custom range</span>
          <input
            type="text"
            value={customRange}
            onChange={(e) => onCustomRangeChange(e.target.value)}
            disabled={value !== 'custom' || isDisabled('custom')}
            onClick={() => { if (value !== 'custom') onChange('custom'); }}
            placeholder="e.g. 10-20, 34, 50-51"
            className="mt-1 w-full px-2.5 py-1.5 text-xs font-mono bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 disabled:opacity-40"
          />
          <p className="text-[10px] text-zinc-600 mt-1">
            Microsoft standard: comma-separated pages and ranges. <code className="text-zinc-500">X-Y</code> includes all pages from X to Y. <code className="text-zinc-500">N-</code> means from N to end.
          </p>
        </div>
      </label>
    </div>
  );
}

// ─── Subset Selector ─────────────────────────────────────────

export type SubsetValue = 'all' | 'odd' | 'even';

export interface SubsetSelectorProps {
  value: SubsetValue;
  onChange: (value: SubsetValue) => void;
}

const SUBSET_OPTIONS: { value: SubsetValue; label: string; description: string }[] = [
  { value: 'all', label: 'All pages', description: 'No filtering' },
  { value: 'odd', label: 'Odd pages only', description: '1, 3, 5, ...' },
  { value: 'even', label: 'Even pages only', description: '2, 4, 6, ...' },
];

export function SubsetSelector({ value, onChange }: SubsetSelectorProps) {
  const [open, setOpen] = useState(false);

  const selected = SUBSET_OPTIONS.find((o) => o.value === value) ?? SUBSET_OPTIONS[0];

  return (
    <div className="space-y-2">
      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
        Subset
      </label>
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center justify-between w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 hover:border-zinc-600 transition-colors"
        >
          <span>{selected.label}</span>
          <svg className={`w-4 h-4 text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {open && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 overflow-hidden">
            {SUBSET_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`flex flex-col w-full px-3 py-2 text-left transition-colors ${
                  opt.value === value
                    ? 'bg-blue-500/15 text-blue-300'
                    : 'text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                <span className="text-sm font-medium">{opt.label}</span>
                <span className="text-[10px] text-zinc-500">{opt.description}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Preview Bar ─────────────────────────────────────────────

export interface PreviewBarProps {
  icon?: string;
  summary: string;
  warning?: string;
}

export function PreviewBar({ icon = 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', summary, warning }: PreviewBarProps) {
  return (
    <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-3.5 space-y-2">
      <div className="flex items-start gap-2.5">
        <svg className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
        <p className="text-sm text-zinc-300">{summary}</p>
      </div>
      {warning && (
        <div className="flex items-start gap-2.5">
          <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <p className="text-sm text-amber-400">{warning}</p>
        </div>
      )}
    </div>
  );
}

// ─── Section Header ──────────────────────────────────────────

export function SectionHeader({ label }: { label: string }) {
  return (
    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
      {label}
    </label>
  );
}

// ─── Help Box ───────────────────────────────────────────────

/** Blue info box shown at the top of each tool dialog explaining what the tool does. */
export function HelpBox({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 text-xs text-zinc-500 bg-zinc-800/50 rounded-lg p-2.5 border border-zinc-800">
      <svg className="w-4 h-4 text-blue-400 shrink-0 mt-px" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>{children}</span>
    </div>
  );
}

// ─── Error Banner ───────────────────────────────────────────

/** Red error banner shown inline when an operation fails. */
export function ErrorBanner({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  return (
    <div className="flex items-start gap-2 px-3 py-2 text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg">
      <svg className="w-4 h-4 text-red-400 shrink-0 mt-px" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span className="flex-1">{message}</span>
      {onDismiss && (
        <button onClick={onDismiss} className="text-red-400 hover:text-red-300 shrink-0">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ─── Warning Banner ─────────────────────────────────────────

/** Amber warning banner for non-critical issues (e.g. rejected files). */
export function WarningBanner({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  return (
    <div className="flex items-start gap-2 px-3 py-2 text-sm text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg">
      <svg className="w-4 h-4 text-amber-400 shrink-0 mt-px" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
      <span className="flex-1">{message}</span>
      {onDismiss && (
        <button onClick={onDismiss} className="text-amber-400 hover:text-amber-300 shrink-0">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
