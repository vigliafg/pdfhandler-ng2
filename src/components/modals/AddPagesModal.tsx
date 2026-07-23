import { useState } from 'react';
import { addBlankPages } from '../../lib/docOperations';
import { ModalWrapper, Field, HelpBox, ErrorBanner } from './shared';

interface Props { pdfBytes: ArrayBuffer; totalPages: number; onApply: (bytes: Uint8Array) => void; onClose: () => void; }

export function AddPagesModal({ pdfBytes, totalPages, onApply, onClose }: Props) {
  const [count, setCount] = useState(1);
  const [position, setPosition] = useState<'start' | 'end'>('end');
  const [size, setSize] = useState<'A4' | 'Letter'>('A4');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApply = async () => {
    setLoading(true);
    setError(null);
    try {
      const bytes = await addBlankPages(pdfBytes, { count, position, size });
      onApply(bytes);
      onClose();
    } catch (e: any) { setError(e.message || 'Failed to add blank pages.'); }
    finally { setLoading(false); }
  };

  return (
    <ModalWrapper title="Add Blank Pages" onClose={onClose}>
      <div className="space-y-3 text-sm">
        <HelpBox>Insert blank A4 or Letter pages at the beginning or end of the document.</HelpBox>
        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
        <Field label="How many">
          <input type="number" min={1} max={100} value={count}
            onChange={(e) => setCount(+e.target.value)}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 text-center" />
        </Field>
        <Field label="Position">
          <select value={position} onChange={(e) => setPosition(e.target.value as any)}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200">
            <option value="start">At beginning</option>
            <option value="end">At end (after page {totalPages})</option>
          </select>
        </Field>
        <Field label="Page size">
          <select value={size} onChange={(e) => setSize(e.target.value as any)}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200">
            <option value="A4">A4</option>
            <option value="Letter">Letter</option>
          </select>
        </Field>
        <button onClick={handleApply} disabled={loading}
          className="w-full py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg transition-colors mt-2">
          {loading ? 'Applying...' : 'Add Pages'}
        </button>
      </div>
    </ModalWrapper>
  );
}
