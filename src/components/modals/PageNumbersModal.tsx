import { useState } from 'react';
import { addPageNumbers, type PageNumbersOptions } from '../../lib/docOperations';
import { ModalWrapper, Field, HelpBox, ErrorBanner } from './shared';

interface Props { pdfBytes: ArrayBuffer; onApply: (bytes: Uint8Array) => void; onClose: () => void; }

export function PageNumbersModal({ pdfBytes, onApply, onClose }: Props) {
  const [opts, setOpts] = useState<PageNumbersOptions>({
    format: 'Page {n} of {t}',
    fontSize: 10,
    position: 'bottom-center',
    startAt: 1,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApply = async () => {
    setLoading(true);
    setError(null);
    try {
      const bytes = await addPageNumbers(pdfBytes, opts);
      onApply(bytes);
      onClose();
    } catch (e: any) { setError(e.message || 'Failed to add page numbers.'); }
    finally { setLoading(false); }
  };

  return (
    <ModalWrapper title="Page Numbers" onClose={onClose}>
      <div className="space-y-3 text-sm">
        <HelpBox>Add page numbers to every page. Use <code className="text-zinc-400">{'{n}'}</code> for the current page and <code className="text-zinc-400">{'{t}'}</code> for the total.</HelpBox>
        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
        <Field label='Format ({n}=page, {t}=total)'>
          <input value={opts.format} onChange={(e) => setOpts((p) => ({ ...p, format: e.target.value }))}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 focus:outline-none focus:border-emerald-500" />
        </Field>
        <div className="flex gap-3">
          <Field label="Font Size" className="flex-1">
            <input type="number" value={opts.fontSize} onChange={(e) => setOpts((p) => ({ ...p, fontSize: +e.target.value }))}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 text-center" />
          </Field>
          <Field label="Start at page" className="flex-1">
            <input type="number" min={1} value={opts.startAt} onChange={(e) => setOpts((p) => ({ ...p, startAt: +e.target.value }))}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 text-center" />
          </Field>
        </div>
        <Field label="Position">
          <select value={opts.position} onChange={(e) => setOpts((p) => ({ ...p, position: e.target.value as any }))}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200">
            <option value="bottom-center">Bottom Center</option>
            <option value="bottom-right">Bottom Right</option>
            <option value="bottom-left">Bottom Left</option>
            <option value="top-center">Top Center</option>
          </select>
        </Field>
        <button onClick={handleApply} disabled={loading}
          className="w-full py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg transition-colors mt-2">
          {loading ? 'Applying...' : 'Add Page Numbers'}
        </button>
      </div>
    </ModalWrapper>
  );
}
