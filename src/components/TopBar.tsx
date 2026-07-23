import { type ReactNode } from 'react';

interface TopBarProps {
  title: string;
  subtitle?: string;
  onMenuToggle: () => void;
  actions?: ReactNode;
  isDrawerOpen: boolean;
}

export function TopBar({ title, subtitle, onMenuToggle, actions, isDrawerOpen }: TopBarProps) {
  return (
    <header className="flex items-center gap-2 px-3 py-2.5 bg-zinc-900 border-b border-zinc-800 shrink-0 safe-top">
      {/* Hamburger */}
      <button
        onClick={onMenuToggle}
        className={`p-1.5 rounded-lg transition-all shrink-0 ${
          isDrawerOpen
            ? 'bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30'
            : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
        }`}
        aria-label="Toggle menu"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          {isDrawerOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* Title */}
      <div className="flex items-center gap-2 min-w-0">
        <svg className="w-5 h-5 text-blue-500 shrink-0" fill="currentColor" viewBox="0 0 24 24">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z" />
          <path d="M8 12h8v2H8zm0 4h8v2H8z" fill="#18181b" />
        </svg>
        <div className="min-w-0">
          <span className="text-sm font-bold text-zinc-100 truncate block">{title}</span>
          {subtitle && (
            <span className="text-[10px] text-zinc-500 truncate block">{subtitle}</span>
          )}
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Actions */}
      {actions}
    </header>
  );
}
