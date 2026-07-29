import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface DrawerMenuProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function DrawerMenu({ isOpen, onClose, children }: DrawerMenuProps) {
  if (!isOpen) return null;

  return createPortal(
    <>
      {/* Overlay backdrop */}
      <div
        className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer panel — always overlay on the left */}
      <nav
        className="fixed inset-y-0 left-0 z-40 w-72 shadow-2xl bg-zinc-900 flex flex-col animate-slide-in-left"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
          <span className="text-sm font-bold text-zinc-200">Menu</span>
          <button
            onClick={onClose}
            className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Drawer content */}
        <div className="flex-1 overflow-y-auto py-2 scrollbar-thin">
          {children}
        </div>
      </nav>
    </>,
    document.body
  );
}

// ─── Drawer section ────────────────────────────────────────

interface DrawerSectionProps {
  label: string;
  color?: 'blue' | 'emerald';
  children: ReactNode;
  defaultOpen?: boolean;
}

export function DrawerSection({ label, color = 'blue', children, defaultOpen = true }: DrawerSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const colorClasses = color === 'blue'
    ? 'text-blue-400 bg-blue-500/10'
    : 'text-emerald-400 bg-emerald-500/10';

  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center gap-2 px-4 py-2 text-[10px] font-bold uppercase tracking-widest ${colorClasses} transition-colors`}
      >
        <svg
          className={`w-2.5 h-2.5 transition-transform ${open ? 'rotate-90' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        {label}
      </button>
      {open && <div className="py-1">{children}</div>}
    </div>
  );
}

// ─── Drawer item ──────────────────────────────────────────

interface DrawerItemProps {
  icon: string;
  label: string;
  active?: boolean;
  badge?: string;
  onClick: () => void;
}

export function DrawerItem({ icon, label, active, badge, onClick }: DrawerItemProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2.5 w-full px-4 py-2 text-[12px] transition-colors text-left ${
        active
          ? 'bg-blue-500/10 text-blue-300 border-r-2 border-blue-500'
          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
      }`}
    >
      <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
      </svg>
      <span className="flex-1 truncate">{label}</span>
      {badge && (
        <span className="text-[9px] font-semibold tabular-nums bg-zinc-700 px-1.5 py-0.5 rounded-full text-zinc-300">
          {badge}
        </span>
      )}
    </button>
  );
}

// ─── Drawer action item (instant) ─────────────────────────

interface DrawerActionProps {
  icon: string;
  label: string;
  onClick: () => void;
}

export function DrawerAction({ icon, label, onClick }: DrawerActionProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2.5 w-full px-4 py-2 text-[12px] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 transition-colors text-left"
    >
      <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
      </svg>
      <span className="truncate">{label}</span>
    </button>
  );
}
