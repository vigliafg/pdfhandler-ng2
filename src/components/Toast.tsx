import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((type: ToastType, message: string) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return { toasts, showToast };
}

export function Toast({ toasts }: { toasts: ToastMessage[] }) {
  return createPortal(
    <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none safe-bottom">
      {toasts.map((t, i) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl animate-slide-up text-sm font-medium max-w-xs ${
            t.type === 'success'
              ? 'bg-emerald-600 text-white'
              : t.type === 'error'
              ? 'bg-red-600 text-white'
              : 'bg-blue-600 text-white'
          }`}
          style={{ animationDelay: `${i * 50}ms` }}
        >
          {t.type === 'success' ? (
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : t.type === 'error' ? (
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          <span>{t.message}</span>
        </div>
      ))}
    </div>,
    document.body,
  );
}
