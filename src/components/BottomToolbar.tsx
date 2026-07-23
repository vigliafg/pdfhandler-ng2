interface BottomToolbarProps {
  children: React.ReactNode;
  visible: boolean;
}

export function BottomToolbar({ children, visible }: BottomToolbarProps) {
  if (!visible) return null;

  return (
    <div className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-zinc-900/95 backdrop-blur border-t border-zinc-800 safe-bottom">
      <div className="flex items-center justify-around px-1 py-1.5">
        {children}
      </div>
    </div>
  );
}

// ─── Bottom toolbar button ─────────────────────────────────

interface BottomToolbarButtonProps {
  icon: string;
  label: string;
  onClick: () => void;
  active?: boolean;
  badge?: string;
}

export function BottomToolbarButton({ icon, label, onClick, active, badge }: BottomToolbarButtonProps) {
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
