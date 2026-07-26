import { useState, useEffect, useRef } from 'react';

interface BottomToolbarProps {
  children: React.ReactNode;
  visible: boolean;
}

export function BottomToolbar({ children, visible }: BottomToolbarProps) {
  if (!visible) return null;

  return (
    <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-zinc-900/95 backdrop-blur border-t border-zinc-800 safe-bottom">
      <div className="flex items-center justify-around px-1 py-1.5">
        {children}
      </div>
    </div>
  );
}

export function BottomToolbarButton({ icon, label, onClick, active, badge }: {
  icon: string;
  label: string;
  onClick: () => void;
  active?: boolean;
  badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center gap-0.5 px-2 py-1 min-w-0 transition-colors rounded-lg ${
        active
          ? 'text-blue-400'
          : 'text-zinc-500 hover:text-zinc-300'
      }`}
    >
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
      </svg>
      <span className="text-[9px] font-medium leading-none truncate max-w-[60px]">{label}</span>
      {badge && (
        <span className="absolute -top-0.5 -right-0.5 text-[8px] font-bold tabular-nums bg-blue-600 px-1 py-px rounded-full text-white leading-none min-w-[16px] text-center">
          {badge}
        </span>
      )}
    </button>
  );
}

interface BottomToolbarSelectProps {
  selectMode: boolean;
  onToggle: () => void;
  selectedCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

export function BottomToolbarSelect({
  selectMode, onToggle, selectedCount, onSelectAll, onDeselectAll,
}: BottomToolbarSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleAction = (fn: () => void) => {
    fn();
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`relative flex flex-col items-center gap-0.5 px-2 py-1 min-w-0 transition-colors rounded-lg ${
          selectMode ? 'text-blue-400' : 'text-zinc-500 hover:text-zinc-300'
        }`}
      >
        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h6v5H3zm11 0h6v5h-6zm-11 8h6v5H3zm11 0h6v5h-6z" />
        </svg>
        <span className="text-[9px] font-medium leading-none truncate max-w-[60px]">Select</span>
        {selectedCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 text-[8px] font-bold tabular-nums bg-blue-600 px-1 py-px rounded-full text-white leading-none min-w-[16px] text-center">
            {selectedCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-44 bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl p-2 animate-slide-up">
          <div className="flex flex-col gap-1">
            <button
              onClick={() => handleAction(onToggle)}
              className={`flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                selectMode
                  ? 'bg-blue-600 text-white'
                  : 'text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              <span>✂️ Select</span>
              <span className={`text-[10px] ${selectMode ? 'text-blue-200' : 'text-zinc-500'}`}>
                {selectMode ? 'ON' : 'OFF'}
              </span>
            </button>

            {selectedCount > 0 && (
              <div className="px-3 py-1 text-[10px] font-semibold text-blue-400 text-center tabular-nums">
                {selectedCount} selected
              </div>
            )}

            <div className="flex gap-1.5">
              <button
                onClick={() => handleAction(onSelectAll)}
                className="flex-1 px-2 py-1.5 text-[11px] font-semibold text-zinc-200 bg-zinc-700 hover:bg-zinc-600 active:bg-zinc-500 rounded-lg transition-colors"
              >
                All
              </button>
              <button
                onClick={() => handleAction(onDeselectAll)}
                disabled={selectedCount === 0}
                className="flex-1 px-2 py-1.5 text-[11px] font-semibold text-zinc-200 bg-zinc-700 hover:bg-zinc-600 active:bg-zinc-500 rounded-lg transition-colors disabled:opacity-30"
              >
                None
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function BottomToolbarRotate({ onRotateCCW, onRotateCW }: {
  onRotateCCW: () => void;
  onRotateCW: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={onRotateCCW}
        className="flex flex-col items-center gap-0.5 px-2 py-1 min-w-0 transition-colors rounded-lg text-zinc-500 hover:text-zinc-300"
        title="Rotate left"
        aria-label="Rotate left"
      >
        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a5 5 0 015 5v2M3 10l4-4M3 10l4 4" />
        </svg>
        <span className="text-[9px] font-medium leading-none">↺</span>
      </button>
      <button
        onClick={onRotateCW}
        className="flex flex-col items-center gap-0.5 px-2 py-1 min-w-0 transition-colors rounded-lg text-zinc-500 hover:text-zinc-300"
        title="Rotate right"
        aria-label="Rotate right"
      >
        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 10H11a5 5 0 00-5 5v2m15-7l-4-4m4 4l-4 4" />
        </svg>
        <span className="text-[9px] font-medium leading-none">↻</span>
      </button>
    </div>
  );
}
