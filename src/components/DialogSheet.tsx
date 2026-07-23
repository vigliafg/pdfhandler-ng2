import { useState, useRef, useEffect } from 'react';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';

export type DialogType = 'alert' | 'confirm' | 'prompt';

export interface DialogState {
  type: DialogType;
  title: string;
  message: string;
  defaultValue?: string;
  resolve: (value: string | boolean | null) => void;
}

interface DialogSheetProps {
  dialog: DialogState | null;
}

// ─── Prompt input (separate component to avoid remounting) ─

function PromptInput({ dialog, onSubmit, onCancel }: {
  dialog: DialogState;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}) {
  const [val, setVal] = useState(dialog.defaultValue ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 100);
  }, []);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') onSubmit(val);
    if (e.key === 'Escape') onCancel();
  };

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="text"
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={handleKey}
        className="w-full h-10 px-3 text-sm font-mono bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 focus:outline-none focus:border-blue-500 placeholder:text-zinc-600"
        placeholder={dialog.defaultValue ?? ''}
      />
      <div className="flex gap-2 justify-end pt-1">
        <button onClick={onCancel}
          className="min-h-[44px] px-4 py-2 text-xs font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 rounded-lg transition-colors">
          Cancel
        </button>
        <button onClick={() => onSubmit(val)}
          className="min-h-[44px] px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-400 rounded-lg transition-colors">
          OK
        </button>
      </div>
    </div>
  );
}

// ─── DialogSheet ────────────────────────────────────────────

export function DialogSheet({ dialog }: DialogSheetProps) {
  const { isCompact } = useResponsiveLayout();

  if (!dialog) return null;

  const handleSubmit = (value?: string) => {
    if (dialog.type === 'confirm') {
      dialog.resolve(true);
    } else if (dialog.type === 'prompt') {
      dialog.resolve(value ?? null);
    } else {
      dialog.resolve(null);
    }
  };

  const handleCancel = () => {
    if (dialog.type === 'confirm') {
      dialog.resolve(false);
    } else {
      dialog.resolve(null);
    }
  };

  // ── Content ─────────────────────────────────────────────
  const content = (
    <div className="flex flex-col max-h-full">
      {/* Handle bar (mobile) */}
      {isCompact && <div className="bottom-sheet-handle" />}

      {/* Title */}
      <p className="text-sm font-bold text-zinc-200 mb-1">{dialog.title}</p>

      {/* Message — scrollable */}
      <div className="overflow-y-auto max-h-[40vh] mb-3 -mx-1 px-1">
        <p className="text-xs text-zinc-400 whitespace-pre-wrap leading-relaxed">{dialog.message}</p>
      </div>

      {/* Actions */}
      {dialog.type === 'alert' && (
        <button onClick={() => handleSubmit()}
          className="min-h-[44px] w-full px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-400 rounded-lg transition-colors">
          OK
        </button>
      )}

      {dialog.type === 'confirm' && (
        <div className="flex gap-2">
          <button onClick={handleCancel}
            className="min-h-[44px] flex-1 px-4 py-2 text-xs font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 rounded-lg transition-colors">
            Cancel
          </button>
          <button onClick={() => handleSubmit()}
            className="min-h-[44px] flex-1 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-400 rounded-lg transition-colors">
            OK
          </button>
        </div>
      )}

      {dialog.type === 'prompt' && (
        <PromptInput dialog={dialog} onSubmit={handleSubmit} onCancel={handleCancel} />
      )}
    </div>
  );

  // ── Desktop: centered modal ─────────────────────────────
  if (!isCompact) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={(e) => { if (e.target === e.currentTarget && dialog.type === 'alert') handleSubmit(); }}>
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 max-w-sm w-full shadow-2xl animate-fade-in max-h-[80vh] flex flex-col">
          {content}
        </div>
      </div>
    );
  }

  // ── Mobile: bottom sheet ────────────────────────────────
  return (
    <div className="bottom-sheet">
      <div className="bottom-sheet-backdrop"
        onClick={() => { if (dialog.type === 'alert') handleSubmit(); }} />
      <div className="bottom-sheet-panel animate-slide-up max-h-[80dvh]">
        <div className="bottom-sheet-content">
          {content}
        </div>
      </div>
    </div>
  );
}
